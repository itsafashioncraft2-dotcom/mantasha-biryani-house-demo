
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

    // Verify the caller's actual Supabase Auth user.
    const {
      data: { user: caller },
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !caller) {
      return respond({ error: 'Invalid or expired session.' }, 401);
    }

    // Require an active administrator, not just role = admin.
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

    // Parse and validate the request body.
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

    const { fullName, phone, email, password } = body;

    if (typeof fullName !== 'string' || !fullName.trim()) {
      return respond({ error: 'A valid full name is required.' }, 400);
    }

    if (typeof phone !== 'string' || !phone.trim()) {
      return respond({ error: 'A valid phone number is required.' }, 400);
    }

    if (typeof email !== 'string' || !email.trim()) {
      return respond({ error: 'A valid email address is required.' }, 400);
    }

    if (typeof password !== 'string' || password.length < 8) {
      return respond(
        { error: 'Password must be at least 8 characters long.' },
        400
      );
    }

    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length > 100 || cleanPhone.length > 30) {
      return respond({ error: 'Name or phone number is too long.' }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return respond({ error: 'Invalid email address format.' }, 400);
    }

    // Check for an existing phone number.
    // A database unique constraint is still needed to prevent races.
    const { data: existingPhone, error: phoneCheckError } =
      await admin
        .from('profiles')
        .select('id')
        .eq('phone', cleanPhone)
        .limit(1);

    if (phoneCheckError) {
      console.error('Phone duplicate check failed.');
      return respond({ error: 'Could not validate the phone number.' }, 500);
    }

    if (existingPhone && existingPhone.length > 0) {
      return respond(
        { error: 'A profile with this phone number already exists.' },
        409
      );
    }

    // Create the Auth account only on the trusted server.
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: cleanName,
          phone: cleanPhone,
          role: 'delivery',
        },
      });

    if (createError || !created?.user) {
      // Do not expose raw Auth errors to the browser.
      console.error('Delivery account creation failed.');
      return respond(
        { error: 'Could not create the delivery account. Check the details and try again.' },
        400
      );
    }

    const newUserId = created.user.id;

    // Create the matching public profile with active delivery status.
    const { error: insertError } = await admin
      .from('profiles')
      .insert({
        id: newUserId,
        full_name: cleanName,
        phone: cleanPhone,
        role: 'delivery',
        is_active: true,
      });

    if (insertError) {
      console.error('Delivery profile creation failed; attempting cleanup.');

      const { error: rollbackError } =
        await admin.auth.admin.deleteUser(newUserId);

      if (rollbackError) {
        // Manual investigation may be required if cleanup fails.
        console.error(
          'CRITICAL: Auth cleanup failed for newly created user:',
          newUserId
        );
      }

      return respond(
        {
          error: rollbackError
            ? 'Profile creation failed and account cleanup needs administrator attention.'
            : 'Profile creation failed. The account creation was rolled back.',
        },
        500
      );
    }

    return respond(
      {
        success: true,
        rider: {
          id: newUserId,
          fullName: cleanName,
          phone: cleanPhone,
          email: cleanEmail,
          role: 'delivery',
          isActive: true,
        },
      },
      201
    );
  } catch (error) {
    // Keep internal exception details in server logs only.
    console.error('Unhandled admin-create-rider error:', error);
    return respond({ error: 'An unexpected server error occurred.' }, 500);
  }
});
