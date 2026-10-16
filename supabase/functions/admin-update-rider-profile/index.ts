import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  const respond = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') {
    return respond({ error: 'Method not allowed.' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing server-side Supabase configuration.');
      return respond({ error: 'Server configuration error.' }, 500);
    }

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

    if (!token) {
      return respond({ error: 'Authentication required.' }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Verify the caller's actual Supabase Auth session.
    const {
      data: { user: caller },
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !caller) {
      return respond({ error: 'Invalid or expired session.' }, 401);
    }

    // 2. Require an active administrator (profiles.role = 'admin' AND is_active = true).
    const { data: callerProfile, error: callerProfileError } =
      await admin
        .from('profiles')
        .select('id, role, is_active')
        .eq('id', caller.id)
        .maybeSingle();

    if (callerProfileError) {
      console.error('Administrator profile verification failed.');
      return respond({ error: 'Authorization check failed.' }, 500);
    }

    if (
      !callerProfile ||
      callerProfile.role !== 'admin' ||
      callerProfile.is_active !== true
    ) {
      return respond({ error: 'Active administrator access required.' }, 403);
    }

    // 3. Parse and validate the request body.
    let body: Record<string, unknown>;

    try {
      const parsed: unknown = await req.json();

      if (
        !parsed ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed)
      ) {
        return respond({ error: 'Invalid request body.' }, 400);
      }

      body = parsed as Record<string, unknown>;
    } catch {
      return respond({ error: 'Invalid JSON request body.' }, 400);
    }

    const rawRiderId = body.riderId ?? body.partnerId ?? body.id;
    const rawFullName = body.fullName ?? body.full_name;
    const rawPhone = body.phone;

    // Validate rider ID as UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (typeof rawRiderId !== 'string' || !uuidRegex.test(rawRiderId.trim())) {
      return respond({ error: 'A valid rider ID (UUID) is required.' }, 400);
    }

    const cleanRiderId = rawRiderId.trim();

    // Prevent modifying administrator's own profile via rider update function
    if (cleanRiderId === caller.id) {
      return respond(
        { error: 'Cannot modify administrator accounts using rider update.' },
        400
      );
    }

    // Validate full name
    if (typeof rawFullName !== 'string' || !rawFullName.trim()) {
      return respond({ error: 'A valid full name is required.' }, 400);
    }

    // Validate phone number
    if (typeof rawPhone !== 'string' || !rawPhone.trim()) {
      return respond({ error: 'A valid phone number is required.' }, 400);
    }

    const cleanName = rawFullName.trim();
    const cleanPhone = rawPhone.trim();

    if (cleanName.length > 100) {
      return respond({ error: 'Full name cannot exceed 100 characters.' }, 400);
    }

    if (cleanPhone.length > 30) {
      return respond({ error: 'Phone number cannot exceed 30 characters.' }, 400);
    }

    const phoneDigits = cleanPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return respond(
        { error: 'Phone number must contain at least 10 digits.' },
        400
      );
    }

    if (!/^[0-9+\-\s()]+$/.test(cleanPhone)) {
      return respond(
        { error: 'Phone number contains invalid characters.' },
        400
      );
    }

    // 4. Verify the target profile exists and has role = 'delivery'
    const { data: targetProfile, error: targetError } = await admin
      .from('profiles')
      .select('id, role, full_name, phone')
      .eq('id', cleanRiderId)
      .maybeSingle();

    if (targetError) {
      console.error('Target delivery partner lookup failed.');
      return respond(
        { error: 'Could not retrieve delivery partner profile.' },
        500
      );
    }

    if (!targetProfile) {
      return respond(
        { error: 'Delivery partner profile not found.' },
        404
      );
    }

    if (targetProfile.role !== 'delivery') {
      return respond(
        {
          error:
            'Security violation: Target user is not a delivery partner. Profile updates via this function are restricted to delivery accounts.',
        },
        403
      );
    }

    // 5. Check duplicate phone in profiles (excluding target rider's own record).
    // Note: A database unique constraint is required for full concurrency protection against race conditions.
    const { data: existingPhone, error: phoneCheckError } = await admin
      .from('profiles')
      .select('id')
      .eq('phone', cleanPhone)
      .neq('id', cleanRiderId)
      .limit(1);

    if (phoneCheckError) {
      console.error('Phone duplicate check failed.');
      return respond(
        { error: 'Could not validate the phone number.' },
        500
      );
    }

    if (existingPhone && existingPhone.length > 0) {
      return respond(
        { error: 'A profile with this phone number already exists.' },
        409
      );
    }

    // 6. Update full_name and phone ONLY. Defense-in-depth: enforce role = 'delivery'.
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        full_name: cleanName,
        phone: cleanPhone,
      })
      .eq('id', cleanRiderId)
      .eq('role', 'delivery');

    if (updateError) {
      console.error('Delivery profile update failed in database.');
      return respond(
        { error: 'Failed to update delivery partner profile. Please try again.' },
        500
      );
    }

    return respond(
      {
        success: true,
        rider: {
          id: cleanRiderId,
          fullName: cleanName,
          phone: cleanPhone,
          role: 'delivery',
        },
      },
      200
    );
  } catch (error) {
    console.error('Unhandled admin-update-rider-profile error:', error);
    return respond({ error: 'An unexpected server error occurred.' }, 500);
  }
});
