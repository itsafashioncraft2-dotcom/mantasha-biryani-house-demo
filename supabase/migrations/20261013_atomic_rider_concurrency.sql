-- ====================================================================
-- Mantsa Biryani - Concurrency & Transaction Safety Migration
-- Migration: 20261013_atomic_rider_concurrency.sql
-- Description:
--   1. Introduces atomic public.admin_toggle_rider_status RPC.
--   2. Updates admin_assign_delivery_partner, admin_update_order_status,
--      and rider_update_order_status with unified global row-locking:
--        Step 1: public.profiles FOR UPDATE (Rider Profile, if assigned)
--        Step 2: public.orders FOR UPDATE (Order Row)
--        Step 3: public.delivery_assignments FOR UPDATE / INSERT
--   3. Complies with verified live schema & execution semantics:
--      - Zero references to orders.delivery_partner_id (does not exist in live DB).
--      - Zero references to profiles.updated_at (does not exist in live DB).
--      - delivery_assignments.order_id is UNIQUE (1 assignment per order).
--      - Assignment whitelist: pending, accepted, preparing, ready_for_pickup.
--      - Preserves exact original return shapes (snake_case where live DB requires).
--      - Uses standard SQL COALESCE(...) keyword syntax (cannot be schema-qualified).
--      - Explicitly rejects NULL inputs with ERRCODE 23514 across all administrative RPCs.
--      - Eliminates preparing -> ready_for_pickup deactivation race by locking
--        the assigned rider profile in admin_update_order_status before locking the order.
--      - Post-lock timestamp timing: captures v_now := pg_catalog.clock_timestamp()
--        ONLY AFTER all blocking locks and validations succeed, then reuses it
--        for related table updates.
--      - Assignment timestamp preserves live pg_catalog.clock_timestamp() in VALUES.
--      - Rider transition permits ONLY out_for_delivery -> delivered using
--        (p_new_status IS DISTINCT FROM 'delivered').
--      - SECURITY DEFINER and SET search_path TO '' with safe function qualifications.
--      - Grants: authenticated and service_role permitted, anon denied.
--      - Revokes legacy get_delivery_partners() while keeping get_delivery_partners_v2().
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Atomic Admin Rider Status Toggle (Activation / Deactivation)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_toggle_rider_status(
  p_rider_id UUID,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_target_role TEXT;
  v_target_name TEXT;
  v_current_active BOOLEAN;
  v_active_order_count INT;
  v_conflicting_orders TEXT;
BEGIN
  v_caller_id := auth.uid();

  -- Authorization Guard: Caller must be an active administrator
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_caller_id 
      AND role = 'admin' 
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied: Active administrator privileges required.'
      USING ERRCODE = '42501';
  END IF;

  -- Input Validation Guards: Explicitly reject NULL inputs
  IF p_rider_id IS NULL THEN
    RAISE EXCEPTION 'Target rider ID cannot be null.'
      USING ERRCODE = '23514';
  END IF;

  IF p_is_active IS NULL THEN
    RAISE EXCEPTION 'Target status (is_active) cannot be null.'
      USING ERRCODE = '23514';
  END IF;

  -- Self-modification Guard: Admin cannot toggle self via rider function
  IF p_rider_id = v_caller_id THEN
    RAISE EXCEPTION 'Security violation: Administrators cannot deactivate their own account.'
      USING ERRCODE = '23514';
  END IF;

  -- STEP 1: Acquire exclusive row lock on target rider profile FIRST (Global Lock Order 1)
  SELECT role, full_name, is_active
  INTO v_target_role, v_target_name, v_current_active
  FROM public.profiles
  WHERE id = p_rider_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery partner profile not found.'
      USING ERRCODE = 'P0002';
  END IF;

  -- Revalidate target role
  IF v_target_role NOT IN ('delivery', 'delivery_partner') THEN
    RAISE EXCEPTION 'Security violation: Target user is not a delivery partner (role: %).', v_target_role
      USING ERRCODE = '42501';
  END IF;

  -- STEP 2: If deactivating, atomically verify zero active orders under lock
  IF p_is_active = false THEN
    SELECT 
      pg_catalog.count(da.id),
      pg_catalog.string_agg('#' || COALESCE(o.order_number::text, o.id::text), ', ')
    INTO v_active_order_count, v_conflicting_orders
    FROM public.delivery_assignments da
    JOIN public.orders o ON da.order_id = o.id
    WHERE da.delivery_partner_id = p_rider_id
      AND o.status IN (
        'pending',
        'accepted',
        'preparing',
        'ready_for_pickup',
        'out_for_delivery'
      );

    IF v_active_order_count > 0 THEN
      RAISE EXCEPTION 'Cannot deactivate rider: Rider has % active order(s) in progress (%). Reassign orders first.',
        v_active_order_count, v_conflicting_orders
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- STEP 3: Mutate rider status (Live DB: profiles has NO updated_at column)
  UPDATE public.profiles
  SET is_active = p_is_active
  WHERE id = p_rider_id
    AND role IN ('delivery', 'delivery_partner');

  -- Return payload compatible with Edge Function callers and direct RPC consumers
  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'rider_id', p_rider_id,
    'is_active', p_is_active,
    'riderId', p_rider_id,
    'isActive', p_is_active,
    'fullName', v_target_name,
    'message', CASE 
      WHEN p_is_active THEN 'Rider reactivated with active delivery status.'
      ELSE 'Rider deactivated. Active delivery assignments blocked.'
    END
  );
END;
$$;

-- --------------------------------------------------------------------
-- 2. Atomic Order Assignment
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_assign_delivery_partner(
  p_order_id UUID,
  p_delivery_partner_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_rider_role TEXT;
  v_rider_active BOOLEAN;
  v_order_status TEXT;
  v_existing_assignment UUID;
BEGIN
  v_caller_id := auth.uid();

  -- Authorization Guard: Caller must be an active administrator
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_caller_id 
      AND role = 'admin' 
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied: Active administrator privileges required.'
      USING ERRCODE = '42501';
  END IF;

  -- Input Validation Guards: Explicitly reject NULL inputs
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Order ID cannot be null.'
      USING ERRCODE = '23514';
  END IF;

  IF p_delivery_partner_id IS NULL THEN
    RAISE EXCEPTION 'Delivery partner ID cannot be null.'
      USING ERRCODE = '23514';
  END IF;

  -- STEP 1: Lock rider profile row FIRST (Global Lock Order 1)
  SELECT role, is_active
  INTO v_rider_role, v_rider_active
  FROM public.profiles
  WHERE id = p_delivery_partner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery partner not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_rider_role NOT IN ('delivery', 'delivery_partner') THEN
    RAISE EXCEPTION 'Target user is not a delivery partner.'
      USING ERRCODE = '42501';
  END IF;

  IF v_rider_active != true THEN
    RAISE EXCEPTION 'Cannot assign order: Delivery partner is deactivated.'
      USING ERRCODE = '23514';
  END IF;

  -- STEP 2: Lock order row SECOND (Global Lock Order 2)
  SELECT status
  INTO v_order_status
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.'
      USING ERRCODE = 'P0002';
  END IF;

  -- Whitelist status eligibility check: only pending, accepted, preparing, ready_for_pickup
  IF v_order_status NOT IN ('pending', 'accepted', 'preparing', 'ready_for_pickup') THEN
    RAISE EXCEPTION 'Order is not in an assignable status (status: %).', v_order_status
      USING ERRCODE = '23514';
  END IF;

  -- STEP 3: Enforce one-assignment constraint (reject already assigned orders)
  SELECT delivery_partner_id INTO v_existing_assignment
  FROM public.delivery_assignments
  WHERE order_id = p_order_id;

  IF v_existing_assignment IS NOT NULL THEN
    RAISE EXCEPTION 'Order is already assigned to a delivery partner.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Insert new assignment using live function timestamp behavior (clock_timestamp())
  INSERT INTO public.delivery_assignments (
    order_id,
    delivery_partner_id,
    assigned_at
  )
  VALUES (
    p_order_id,
    p_delivery_partner_id,
    pg_catalog.clock_timestamp()
  );

  -- Exact live response shape: success, order_id, delivery_partner_id
  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'delivery_partner_id', p_delivery_partner_id
  );
END;
$$;

-- --------------------------------------------------------------------
-- 3. Atomic Admin Order Status Update (Dispatch & Lifecycle)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_order_status(
  p_order_id UUID,
  p_new_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_current_partner_id UUID;
  v_confirmed_partner_id UUID;
  v_late_partner_id UUID;
  v_rider_role TEXT;
  v_rider_active BOOLEAN;
  v_current_status TEXT;
  v_now TIMESTAMPTZ;
BEGIN
  v_caller_id := auth.uid();

  -- Authorization Guard: Caller must be an active administrator
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_caller_id 
      AND role = 'admin' 
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied: Active administrator privileges required.'
      USING ERRCODE = '42501';
  END IF;

  -- Input Validation Guards: Explicitly reject NULL inputs
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Order ID cannot be null.'
      USING ERRCODE = '23514';
  END IF;

  IF p_new_status IS NULL THEN
    RAISE EXCEPTION 'Order status cannot be null.'
      USING ERRCODE = '23514';
  END IF;

  -- Non-locking peek of delivery_assignments to inspect assigned rider
  SELECT delivery_partner_id INTO v_current_partner_id
  FROM public.delivery_assignments
  WHERE order_id = p_order_id;

  -- UNIFIED LOCK PROTOCOL:
  -- CASE 1: Order has an assigned rider
  IF v_current_partner_id IS NOT NULL THEN
    -- STEP 1: Lock rider profile FIRST (Global Lock Order 1)
    SELECT role, is_active
    INTO v_rider_role, v_rider_active
    FROM public.profiles
    WHERE id = v_current_partner_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Assigned delivery partner profile not found.'
        USING ERRCODE = 'P0002';
    END IF;

    IF v_rider_role NOT IN ('delivery', 'delivery_partner') THEN
      RAISE EXCEPTION 'Assigned user is not a delivery partner (role: %).', v_rider_role
        USING ERRCODE = '42501';
    END IF;

    -- If dispatching, rider MUST be active
    IF p_new_status = 'out_for_delivery' AND v_rider_active != true THEN
      RAISE EXCEPTION 'Cannot dispatch order: Assigned delivery partner is deactivated.'
        USING ERRCODE = '23514';
    END IF;

    -- If advancing non-dispatch status, deactivated rider cannot hold advancing orders
    IF p_new_status != 'cancelled' AND v_rider_active != true THEN
      RAISE EXCEPTION 'Cannot advance order: Assigned delivery partner is deactivated.'
        USING ERRCODE = '23514';
    END IF;

    -- STEP 2: Lock order row SECOND (Global Lock Order 2)
    SELECT status INTO v_current_status
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'P0002';
    END IF;

    -- STEP 3: Lock assignment row THIRD & revalidate assignment did not change
    SELECT delivery_partner_id INTO v_confirmed_partner_id
    FROM public.delivery_assignments
    WHERE order_id = p_order_id
    FOR UPDATE;

    IF v_confirmed_partner_id IS DISTINCT FROM v_current_partner_id THEN
      RAISE EXCEPTION 'Concurrency conflict: Delivery assignment changed during status update.'
        USING ERRCODE = 'P0001';
    END IF;

  -- CASE 2: Order is unassigned
  ELSE
    -- Cannot dispatch unassigned order
    IF p_new_status = 'out_for_delivery' THEN
      RAISE EXCEPTION 'Cannot dispatch unassigned order: Order has no assigned delivery partner.'
        USING ERRCODE = '23514';
    END IF;

    -- STEP 2: Lock order row directly (no rider profile exists)
    SELECT status INTO v_current_status
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'P0002';
    END IF;

    -- STEP 3: Verify no concurrent assignment occurred before acquiring order lock
    SELECT delivery_partner_id INTO v_late_partner_id
    FROM public.delivery_assignments
    WHERE order_id = p_order_id;

    IF v_late_partner_id IS NOT NULL THEN
      RAISE EXCEPTION 'Concurrency conflict: Order was assigned concurrently.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- EXPLICIT TRANSITION PAIR ALLOWLIST VALIDATION:
  -- Strictly permits ONLY the 5 approved state transitions:
  --   1. pending -> accepted
  --   2. pending -> cancelled
  --   3. accepted -> preparing
  --   4. preparing -> ready_for_pickup
  --   5. ready_for_pickup -> out_for_delivery
  -- All unlisted pairs are rejected, including:
  --   - Same-status transitions (e.g. pending -> pending)
  --   - Terminal state mutations (from cancelled, delivered, rejected)
  --   - Out-of-order transitions or skips
  --   - Transitions from out_for_delivery via admin RPC
  --   - Unknown statuses and NULLs
  IF NOT (
    (v_current_status = 'pending' AND p_new_status = 'accepted') OR
    (v_current_status = 'pending' AND p_new_status = 'cancelled') OR
    (v_current_status = 'accepted' AND p_new_status = 'preparing') OR
    (v_current_status = 'preparing' AND p_new_status = 'ready_for_pickup') OR
    (v_current_status = 'ready_for_pickup' AND p_new_status = 'out_for_delivery')
  ) THEN
    RAISE EXCEPTION 'Invalid status transition: Cannot transition order from "%" to "%".',
      COALESCE(v_current_status, 'NULL'), COALESCE(p_new_status, 'NULL')
      USING ERRCODE = '23514';
  END IF;

  -- Post-lock timestamp capture: Capture v_now ONLY after all locks and validations succeed
  v_now := pg_catalog.clock_timestamp();

  -- MUTATIONS:
  UPDATE public.orders
  SET status = p_new_status,
      updated_at = v_now
  WHERE id = p_order_id;

  IF p_new_status = 'out_for_delivery' THEN
    UPDATE public.delivery_assignments
    SET picked_up_at = COALESCE(picked_up_at, v_now)
    WHERE order_id = p_order_id;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'status', p_new_status
  );
END;
$$;

-- --------------------------------------------------------------------
-- 4. Atomic Rider Order Status Update (Delivery Confirmation ONLY)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rider_update_order_status(
  p_order_id UUID,
  p_new_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_caller_active BOOLEAN;
  v_current_status TEXT;
  v_assigned_partner_id UUID;
  v_now TIMESTAMPTZ;
BEGIN
  v_caller_id := auth.uid();

  -- Caller Authentication Guard: Explicitly reject unauthenticated callers
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: Active delivery partner privileges required.'
      USING ERRCODE = '42501';
  END IF;

  -- Input Validation Guards: Explicitly reject NULL inputs
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Order ID cannot be null.'
      USING ERRCODE = '23514';
  END IF;

  -- Rider transition contract: Permitted ONLY out_for_delivery -> delivered
  IF p_new_status IS NULL OR p_new_status IS DISTINCT FROM 'delivered' THEN
    RAISE EXCEPTION 'Riders are only permitted to mark orders delivered.'
      USING ERRCODE = '42501';
  END IF;

  -- STEP 1: Lock caller rider profile row FIRST (Global Lock Order 1)
  SELECT role, is_active
  INTO v_caller_role, v_caller_active
  FROM public.profiles
  WHERE id = v_caller_id
  FOR UPDATE;

  IF NOT FOUND OR v_caller_role NOT IN ('delivery', 'delivery_partner') OR v_caller_active != true THEN
    RAISE EXCEPTION 'Access denied: Active delivery partner privileges required.'
      USING ERRCODE = '42501';
  END IF;

  -- STEP 2: Lock order row SECOND (Global Lock Order 2)
  SELECT status INTO v_current_status
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_current_status != 'out_for_delivery' THEN
    RAISE EXCEPTION 'Invalid transition: Order must be out_for_delivery to mark delivered (current: %).', v_current_status
      USING ERRCODE = '23514';
  END IF;

  -- STEP 3: Lock matching assignment row THIRD & verify ownership
  SELECT delivery_partner_id INTO v_assigned_partner_id
  FROM public.delivery_assignments
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_assigned_partner_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'Access denied: You are not the assigned delivery partner for this order.'
      USING ERRCODE = '42501';
  END IF;

  -- Post-lock timestamp capture: Capture v_now ONLY after all locks and validations succeed
  v_now := pg_catalog.clock_timestamp();

  -- Mutate order and preserve existing delivered_at timestamp via COALESCE with v_now
  UPDATE public.orders
  SET status = 'delivered',
      updated_at = v_now
  WHERE id = p_order_id;

  UPDATE public.delivery_assignments
  SET delivered_at = COALESCE(delivered_at, v_now)
  WHERE order_id = p_order_id;

  -- Exact live snake_case response shape: success, order_id, status
  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'status', 'delivered'
  );
END;
$$;

-- --------------------------------------------------------------------
-- 5. Execution Grants & Privileges (Least Privilege Principle)
-- --------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.admin_toggle_rider_status(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_toggle_rider_status(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_rider_status(UUID, BOOLEAN) TO service_role;

REVOKE ALL ON FUNCTION public.admin_assign_delivery_partner(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_delivery_partner(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_delivery_partner(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.admin_update_order_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.rider_update_order_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rider_update_order_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rider_update_order_status(UUID, TEXT) TO service_role;

-- Ensure legacy get_delivery_partners() remains revoked from authenticated if present
DO $$ BEGIN
  REVOKE ALL ON FUNCTION public.get_delivery_partners() FROM PUBLIC, anon, authenticated;
EXCEPTION
  WHEN undefined_function THEN NULL;
END $$;

-- Ensure working get_delivery_partners_v2() remains granted to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.get_delivery_partners_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_delivery_partners_v2() TO service_role;
