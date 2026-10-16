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
    // Use the standard public anon key to initialize the user-scoped client.
    // The service-role key is NOT used for this RPC to guarantee least privilege.
    const supabaseAnonKey =
      Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing server-side Supabase configuration.');
      return respond({ error: 'Server configuration error.' }, 500);
    }

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

    if (!token) {
      return respond({ error: 'Authentication required.' }, 401);
    }

    // 1. Parse and validate request payload strictly.
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

    // Strict boolean type validation for isActive (prevent string/numeric truthy coercion)
    if (typeof body.isActive !== 'boolean') {
      return respond(
        {
          error:
            'Field "isActive" must be an explicit boolean primitive (true or false). Coercion from strings or numbers is not permitted.',
        },
        400
      );
    }

    const isActive: boolean = body.isActive;

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (typeof rawRiderId !== 'string' || !uuidRegex.test(rawRiderId.trim())) {
      return respond(
        { error: 'A valid rider ID (UUID) is required.' },
        400
      );
    }

    const cleanRiderId = rawRiderId.trim();

    // 2. Initialize a user-scoped Supabase client that forwards the caller's verified JWT.
    // This ensures auth.uid() in PostgreSQL evaluates strictly to the calling administrator.
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 3. Delegate to the atomic database stored procedure.
    // This executes active-admin authorization, rider profile locking, active-order verification,
    // and status mutation within a single serializable database transaction.
    const { data: rpcData, error: rpcError } = await userClient.rpc(
      'admin_toggle_rider_status',
      {
        p_rider_id: cleanRiderId,
        p_is_active: isActive,
      }
    );

    if (rpcError) {
      console.error('admin_toggle_rider_status RPC execution error:', rpcError.message);
      const code = rpcError.code;
      const msg = rpcError.message || '';

      // Map known PostgreSQL authorization error code (42501 = insufficient_privilege)
      if (code === '42501' || msg.includes('Access denied')) {
        return respond(
          { error: 'Active administrator access required.' },
          403
        );
      }

      // Map self-deactivation check violation (23514 = check_violation)
      if (code === '23514' || msg.includes('own account')) {
        return respond(
          {
            error:
              'Security violation: Administrators cannot deactivate their own account.',
          },
          400
        );
      }

      // Map business-rule rejection when rider has active orders (P0001 = raise_exception)
      if (code === 'P0001' || msg.includes('active order')) {
        return respond(
          {
            error: msg || 'Cannot deactivate delivery partner: Active orders are in progress.',
          },
          409
        );
      }

      // Map record not found (P0002 = no_data_found)
      if (code === 'P0002' || msg.includes('not found')) {
        return respond(
          { error: 'Delivery partner profile not found.' },
          404
        );
      }

      // Default sanitized fallback for unexpected errors
      return respond(
        { error: 'Failed to update delivery partner status in database.' },
        500
      );
    }

    return respond(
      {
        success: true,
        riderId: cleanRiderId,
        isActive,
        message: isActive
          ? 'Rider reactivated with active delivery status.'
          : 'Rider deactivated. Active delivery assignments blocked.',
        ...(typeof rpcData === 'object' && rpcData !== null ? rpcData : {}),
      },
      200
    );
  } catch (error) {
    console.error('Unhandled admin-toggle-rider-status error:', error);
    return respond(
      { error: 'An unexpected server error occurred.' },
      500
    );
  }
});

