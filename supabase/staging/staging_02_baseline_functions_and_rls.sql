-- ====================================================================
-- Mantsa Biryani - Staging Baseline Functions, Triggers & RLS Policies
-- File: staging_02_baseline_functions_and_rls.sql
-- Target Database: Staging Supabase Project (onzriatzbtpzjkrxhuon)
-- Safety: READ-ONLY review artifact. Do NOT execute against production.
-- Verified Contracts:
--   - Security definer functions with hardened SET search_path = ''
--   - Accurate RLS without orders.delivery_partner_id (joins delivery_assignments)
--   - Working get_delivery_partners_v2() returning is_active
--   - Atomic create_order RPC with authoritative server-side price recalculation
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. ROW LEVEL SECURITY ACTIVATION
-- --------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 2. SECURITY HELPER FUNCTIONS
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
      AND role = 'admin' 
      AND is_active = true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

CREATE OR REPLACE FUNCTION public.is_delivery_partner()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
      AND role IN ('delivery', 'delivery_partner')
      AND is_active = true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_delivery_partner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_delivery_partner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_delivery_partner() TO service_role;

-- Non-recursive order assigned rider helper (breaks circular orders <-> delivery_assignments RLS)
CREATE OR REPLACE FUNCTION public.is_order_assigned_rider(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_order_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.delivery_assignments
    WHERE order_id = p_order_id AND delivery_partner_id = auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_order_assigned_rider(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_order_assigned_rider(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_order_assigned_rider(UUID) TO service_role;

-- Non-recursive order customer helper (breaks circular delivery_assignments <-> orders RLS)
CREATE OR REPLACE FUNCTION public.is_order_customer(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_order_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = p_order_id AND customer_id = auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_order_customer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_order_customer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_order_customer(UUID) TO service_role;

-- 256-bit CSPRNG Tracking Token Generator using core PostgreSQL gen_random_uuid()
CREATE OR REPLACE FUNCTION public.generate_tracking_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN pg_catalog.replace(pg_catalog.gen_random_uuid()::TEXT, '-', '') ||
         pg_catalog.replace(pg_catalog.gen_random_uuid()::TEXT, '-', '');
END;
$$;

REVOKE ALL ON FUNCTION public.generate_tracking_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_tracking_token() TO anon;
GRANT EXECUTE ON FUNCTION public.generate_tracking_token() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_tracking_token() TO service_role;

-- Multi-environment SHA-256 cryptographic digest helper
-- Dynamically and deterministically resolves pgcrypto's digest(bytea, text)
-- Handles missing extensions schema (3F000) and undefined_function (42883) safely
CREATE OR REPLACE FUNCTION public.hash_tracking_token(p_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_schema TEXT;
  v_hash TEXT;
BEGIN
  IF p_token IS NULL OR pg_catalog.btrim(p_token) = '' THEN
    RETURN NULL;
  END IF;

  -- 1. Deterministically discover the schema containing pgcrypto's digest(bytea, text)
  SELECT n.nspname
  INTO v_schema
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
  WHERE p.proname = 'digest'
    AND pg_catalog.pg_get_function_identity_arguments(p.oid) = 'bytea, text'
  ORDER BY
    CASE
      WHEN n.nspname = 'extensions' THEN 1
      WHEN n.nspname = 'public' THEN 2
      ELSE 3
    END
  LIMIT 1;

  IF v_schema IS NOT NULL THEN
    BEGIN
      EXECUTE pg_catalog.format(
        'SELECT pg_catalog.encode(%I.digest(pg_catalog.convert_to($1, ''UTF8''), ''sha256''), ''hex'')',
        v_schema
      )
      INTO v_hash
      USING pg_catalog.btrim(p_token);

      RETURN v_hash;
    EXCEPTION
      WHEN undefined_function OR invalid_schema_name THEN
        -- Fall through to safe explicit attempts if runtime resolution fails
        NULL;
    END;
  END IF;

  -- 2. Safe explicit qualification attempts catching both 42883 (undefined_function)
  --    and 3F000 (invalid_schema_name) when the schema itself does not exist.
  --    Dynamic SQL prevents compile-time parsing failures on databases lacking the 'extensions' schema.
  BEGIN
    EXECUTE 'SELECT pg_catalog.encode(extensions.digest(pg_catalog.convert_to($1, ''UTF8''), ''sha256''), ''hex'')'
    INTO v_hash
    USING pg_catalog.btrim(p_token);

    RETURN v_hash;
  EXCEPTION
    WHEN undefined_function OR invalid_schema_name THEN
      BEGIN
        EXECUTE 'SELECT pg_catalog.encode(public.digest(pg_catalog.convert_to($1, ''UTF8''), ''sha256''), ''hex'')'
        INTO v_hash
        USING pg_catalog.btrim(p_token);

        RETURN v_hash;
      EXCEPTION
        WHEN undefined_function OR invalid_schema_name THEN
          -- Never return an incorrect hash or dummy value; explicitly abort if digest is unavailable
          RAISE EXCEPTION 'Cryptographic hash function digest(bytea, text) is unavailable. Ensure pgcrypto extension is installed in extensions or public schema.'
            USING ERRCODE = '42883';
      END;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.hash_tracking_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hash_tracking_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.hash_tracking_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hash_tracking_token(TEXT) TO service_role;

-- --------------------------------------------------------------------
-- 3. TIMESTAMP TRIGGERS
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_orders_timestamp ON public.orders;
CREATE TRIGGER trigger_update_orders_timestamp
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trigger_update_menu_timestamp ON public.menu_items;
CREATE TRIGGER trigger_update_menu_timestamp
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- --------------------------------------------------------------------
-- 4. ORDER UPDATE INTEGRITY TRIGGER
-- Prevents non-admins from altering pricing, items, customer details
-- and checks status transition legitimacy under delivery assignment linkage
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_order_update_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_is_assigned_rider BOOLEAN;
BEGIN
  -- 1. Active admins retain full management authorization
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- 2. Verify caller is assigned rider via delivery_assignments
  SELECT EXISTS (
    SELECT 1 FROM public.delivery_assignments
    WHERE order_id = OLD.id AND delivery_partner_id = auth.uid()
  ) INTO v_is_assigned_rider;

  IF NOT v_is_assigned_rider THEN
    RAISE EXCEPTION 'Access denied: Only administrators or assigned delivery partners may update this order.'
      USING ERRCODE = '42501';
  END IF;

  -- 3. Non-admin field protection: comprehensive tamper guard on all core and sensitive order properties
  IF (OLD.id IS DISTINCT FROM NEW.id OR
      OLD.order_number IS DISTINCT FROM NEW.order_number OR
      OLD.customer_id IS DISTINCT FROM NEW.customer_id OR
      OLD.customer_name IS DISTINCT FROM NEW.customer_name OR
      OLD.customer_phone IS DISTINCT FROM NEW.customer_phone OR
      OLD.delivery_address IS DISTINCT FROM NEW.delivery_address OR
      OLD.landmark IS DISTINCT FROM NEW.landmark OR
      OLD.instructions IS DISTINCT FROM NEW.instructions OR
      OLD.subtotal IS DISTINCT FROM NEW.subtotal OR
      OLD.delivery_fee IS DISTINCT FROM NEW.delivery_fee OR
      OLD.packaging_fee IS DISTINCT FROM NEW.packaging_fee OR
      OLD.total_amount IS DISTINCT FROM NEW.total_amount OR
      OLD.payment_method IS DISTINCT FROM NEW.payment_method OR
      OLD.tracking_token_hash IS DISTINCT FROM NEW.tracking_token_hash OR
      OLD.tracking_token_expires_at IS DISTINCT FROM NEW.tracking_token_expires_at OR
      OLD.created_at IS DISTINCT FROM NEW.created_at) THEN
    RAISE EXCEPTION 'Security violation: Delivery partners cannot modify order amounts, items, customer details, or tracking credentials.'
      USING ERRCODE = '42501';
  END IF;

  -- 4. Enforce legitimate rider progression (only out_for_delivery -> delivered)
  IF (OLD.status != NEW.status) THEN
    IF NOT (OLD.status = 'out_for_delivery' AND NEW.status = 'delivered') THEN
      RAISE EXCEPTION 'Invalid status transition: Delivery partner cannot change status from "%" to "%".', OLD.status, NEW.status
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_order_update_security ON public.orders;
CREATE TRIGGER trigger_enforce_order_update_security
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_update_security();

-- --------------------------------------------------------------------
-- 5. RPC: get_delivery_partners_v2()
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_delivery_partners_v2()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  phone TEXT,
  role TEXT,
  created_at TIMESTAMPTZ,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = auth.uid() 
      AND pr.role = 'admin' 
      AND pr.is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied: Active administrator privileges required.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.phone, p.role, p.created_at, p.is_active
  FROM public.profiles p
  WHERE p.role IN ('delivery', 'delivery_partner')
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_delivery_partners_v2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_delivery_partners_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_delivery_partners_v2() TO service_role;

-- Revoke legacy get_delivery_partners() if present
DO $$ BEGIN
  REVOKE ALL ON FUNCTION public.get_delivery_partners() FROM PUBLIC, anon, authenticated;
EXCEPTION
  WHEN undefined_function THEN NULL;
END $$;

-- --------------------------------------------------------------------
-- 6. RPC: create_order()
-- Authoritative order creation called from store.ts with guest or authenticated sessions
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order(
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_delivery_address TEXT,
  p_landmark TEXT,
  p_instructions TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_order_id UUID;
  v_order_number BIGINT;
  v_subtotal NUMERIC(10, 2) := 0.00;
  v_delivery_fee NUMERIC(10, 2) := 40.00;
  v_total_amount NUMERIC(10, 2) := 0.00;
  v_item JSONB;
  v_menu_item_id TEXT;
  v_quantity_text TEXT;
  v_quantity INT;
  v_item_name TEXT;
  v_item_price NUMERIC(10, 2);
  v_item_veg BOOLEAN;
  v_item_subtotal NUMERIC(10, 2);
  v_now TIMESTAMPTZ;
  v_raw_tracking_token TEXT;
  v_tracking_token_hash TEXT;
  v_token_expires_at TIMESTAMPTZ;
  v_seen_item_ids TEXT[] := ARRAY[]::TEXT[];
  v_items_count INT;
BEGIN
  v_caller_id := auth.uid();
  v_now := pg_catalog.clock_timestamp();

  -- If the caller does not have an existing profile row (e.g. anonymous guest checkout), nullify to avoid FK constraint violation
  IF v_caller_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_caller_id) THEN
    v_caller_id := NULL;
  END IF;

  -- Input Validation
  IF p_customer_name IS NULL OR pg_catalog.btrim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'Customer name cannot be empty.' USING ERRCODE = '23514';
  END IF;

  IF p_customer_phone IS NULL OR pg_catalog.btrim(p_customer_phone) = '' THEN
    RAISE EXCEPTION 'Customer phone cannot be empty.' USING ERRCODE = '23514';
  END IF;

  IF p_delivery_address IS NULL OR pg_catalog.btrim(p_delivery_address) = '' THEN
    RAISE EXCEPTION 'Delivery address cannot be empty.' USING ERRCODE = '23514';
  END IF;

  -- Array Type Validation: Prevent type conversion crash
  IF p_items IS NULL OR pg_catalog.jsonb_typeof(p_items) != 'array' THEN
    RAISE EXCEPTION 'Order items must be provided as a JSON array.' USING ERRCODE = '23514';
  END IF;

  v_items_count := pg_catalog.jsonb_array_length(p_items);
  IF v_items_count = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item.' USING ERRCODE = '23514';
  END IF;

  IF v_items_count > 30 THEN
    RAISE EXCEPTION 'Order exceeds maximum allowed distinct items (limit 30).' USING ERRCODE = '23514';
  END IF;

  -- Authoritatively validate items, check quantities, prevent duplicates & compute subtotal
  FOR v_item IN SELECT * FROM pg_catalog.jsonb_array_elements(p_items)
  LOOP
    IF pg_catalog.jsonb_typeof(v_item) != 'object' THEN
      RAISE EXCEPTION 'Invalid item format in order items list.' USING ERRCODE = '23514';
    END IF;

    v_menu_item_id := pg_catalog.btrim(COALESCE(v_item->>'menu_item_id', ''));
    IF v_menu_item_id = '' THEN
      RAISE EXCEPTION 'Menu item ID cannot be empty.' USING ERRCODE = '23514';
    END IF;

    -- Duplicate item detection
    IF v_menu_item_id = ANY(v_seen_item_ids) THEN
      RAISE EXCEPTION 'Duplicate item "%" detected in order. Consolidate quantities before submitting.', v_menu_item_id
        USING ERRCODE = '23514';
    END IF;
    v_seen_item_ids := pg_catalog.array_append(v_seen_item_ids, v_menu_item_id);

    -- Quantity format and bounds check (regex ensures clean positive integer)
    v_quantity_text := v_item->>'quantity';
    IF v_quantity_text IS NULL OR v_quantity_text !~ '^[1-9][0-9]*$' THEN
      RAISE EXCEPTION 'Quantity for item "%" must be a positive whole number.', v_menu_item_id
        USING ERRCODE = '23514';
    END IF;

    v_quantity := v_quantity_text::INT;
    IF v_quantity > 50 THEN
      RAISE EXCEPTION 'Quantity for item "%" exceeds maximum allowed limit of 50.', v_menu_item_id
        USING ERRCODE = '23514';
    END IF;

    SELECT name, price, is_veg
    INTO v_item_name, v_item_price, v_item_veg
    FROM public.menu_items
    WHERE id = v_menu_item_id AND is_available = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Menu item "%" is not available or does not exist.', v_menu_item_id USING ERRCODE = 'P0002';
    END IF;

    v_subtotal := v_subtotal + (v_item_price * v_quantity);
  END LOOP;

  -- Business Rule: Minimum subtotal ₹150
  IF v_subtotal < 150.00 THEN
    RAISE EXCEPTION 'Order subtotal (₹%) is below the minimum order amount of ₹150.00.', v_subtotal
      USING ERRCODE = '23514';
  END IF;

  -- Business Rule: Delivery fee ₹40 under ₹499; ₹0 at ₹499+
  IF v_subtotal >= 499.00 THEN
    v_delivery_fee := 0.00;
  ELSE
    v_delivery_fee := 40.00;
  END IF;

  v_total_amount := v_subtotal + v_delivery_fee;

  -- Generate 256-bit CSPRNG tracking token and SHA-256 hash (24h expiry)
  v_raw_tracking_token := public.generate_tracking_token();
  v_tracking_token_hash := public.hash_tracking_token(v_raw_tracking_token);
  v_token_expires_at := v_now + INTERVAL '24 hours';

  -- Create Order with hashed tracking token
  INSERT INTO public.orders (
    customer_id,
    customer_name,
    customer_phone,
    delivery_address,
    landmark,
    instructions,
    subtotal,
    delivery_fee,
    packaging_fee,
    total_amount,
    payment_method,
    status,
    tracking_token_hash,
    tracking_token_expires_at,
    created_at,
    updated_at
  )
  VALUES (
    v_caller_id,
    pg_catalog.btrim(p_customer_name),
    pg_catalog.btrim(p_customer_phone),
    pg_catalog.btrim(p_delivery_address),
    pg_catalog.btrim(COALESCE(p_landmark, '')),
    p_instructions,
    v_subtotal,
    v_delivery_fee,
    0.00,
    v_total_amount,
    'COD',
    'pending',
    v_tracking_token_hash,
    v_token_expires_at,
    v_now,
    v_now
  )
  RETURNING id, order_number INTO v_order_id, v_order_number;

  -- Create Order Items
  FOR v_item IN SELECT * FROM pg_catalog.jsonb_array_elements(p_items)
  LOOP
    v_menu_item_id := v_item->>'menu_item_id';
    v_quantity := (v_item->>'quantity')::INT;

    SELECT name, price, is_veg
    INTO v_item_name, v_item_price, v_item_veg
    FROM public.menu_items
    WHERE id = v_menu_item_id;

    v_item_subtotal := v_item_price * v_quantity;

    INSERT INTO public.order_items (
      order_id,
      menu_item_id,
      name,
      price,
      quantity,
      is_veg,
      subtotal,
      created_at
    )
    VALUES (
      v_order_id,
      v_menu_item_id,
      v_item_name,
      v_item_price,
      v_quantity,
      v_item_veg,
      v_item_subtotal,
      v_now
    );
  END LOOP;

  -- Return payload matching store.ts parser with raw token returned once
  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'id', v_order_id,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'total_amount', v_total_amount,
    'status', 'pending',
    'tracking_token', v_raw_tracking_token,
    'tracking_token_expires_at', v_token_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_order(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.create_order(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- --------------------------------------------------------------------
-- 6B. RPC: track_guest_order()
-- Secure Guest Order Tracking RPC (least-privilege, privacy-preserving)
-- Verifies order_number (BIGINT) + tracking_token (TEXT) against stored SHA-256 hash
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_guest_order(
  p_order_number BIGINT,
  p_tracking_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token_hash TEXT;
  v_order RECORD;
  v_rider_name TEXT := NULL;
  v_items JSONB := '[]'::JSONB;
BEGIN
  -- Guard 1: Validate non-null, positive order number
  IF p_order_number IS NULL OR p_order_number <= 0 THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Invalid order reference number.'
    );
  END IF;

  -- Guard 2: Validate non-empty tracking token
  IF p_tracking_token IS NULL OR pg_catalog.btrim(p_tracking_token) = '' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Valid tracking token is required.'
    );
  END IF;

  -- Compute SHA-256 hash of provided token
  v_token_hash := public.hash_tracking_token(pg_catalog.btrim(p_tracking_token));

  -- Lookup order matching order_number and token hash
  SELECT
    o.id,
    o.order_number,
    o.status,
    o.subtotal,
    o.delivery_fee,
    o.total_amount,
    o.tracking_token_expires_at,
    o.created_at,
    o.updated_at
  INTO v_order
  FROM public.orders o
  WHERE o.order_number = p_order_number
    AND o.tracking_token_hash = v_token_hash;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Order not found or invalid tracking token.'
    );
  END IF;

  -- Guard 3: Cancellation check - a cancelled order must not be retrievable through guest tracking
  -- Enforces revocation invariant even when tracking_token_expires_at remains unexpired.
  -- Returns generic failure without disclosing private order existence or status.
  IF v_order.status = 'cancelled' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Order not found or tracking is unavailable.'
    );
  END IF;

  -- Guard 4: Fail-closed token expiration (NULL expiry or past timestamp rejected)
  IF v_order.tracking_token_expires_at IS NULL OR v_order.tracking_token_expires_at < pg_catalog.clock_timestamp() THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Tracking link has expired for this order.'
    );
  END IF;

  -- Fetch assigned rider name (if assigned) without exposing rider phone or profile IDs
  SELECT p.full_name
  INTO v_rider_name
  FROM public.delivery_assignments da
  JOIN public.profiles p ON da.delivery_partner_id = p.id
  WHERE da.order_id = v_order.id
  LIMIT 1;

  -- Fetch order items summary (without exposing internal UUIDs)
  SELECT COALESCE(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'name', oi.name,
        'quantity', oi.quantity,
        'price', oi.price,
        'is_veg', oi.is_veg,
        'subtotal', oi.subtotal
      )
    ),
    '[]'::JSONB
  )
  INTO v_items
  FROM public.order_items oi
  WHERE oi.order_id = v_order.id;

  -- Return minimal privacy-preserving tracking payload (NO customer_phone, NO delivery_address)
  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'subtotal', v_order.subtotal,
    'delivery_fee', v_order.delivery_fee,
    'total_amount', v_order.total_amount,
    'rider_name', v_rider_name,
    'items', v_items,
    'created_at', v_order.created_at,
    'updated_at', v_order.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.track_guest_order(BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_guest_order(BIGINT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.track_guest_order(BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_guest_order(BIGINT, TEXT) TO service_role;

-- --------------------------------------------------------------------
-- 6C. RPC: admin_toggle_menu_availability()
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_toggle_menu_availability(
  p_item_id TEXT,
  p_is_available BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_updated_at TIMESTAMPTZ;
BEGIN
  v_caller_id := auth.uid();
  v_updated_at := pg_catalog.clock_timestamp();

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

  IF p_item_id IS NULL OR pg_catalog.btrim(p_item_id) = '' THEN
    RAISE EXCEPTION 'Menu item ID cannot be empty.'
      USING ERRCODE = '23514';
  END IF;

  IF p_is_available IS NULL THEN
    RAISE EXCEPTION 'Availability flag cannot be null.'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.menu_items
  SET
    is_available = p_is_available,
    updated_at = v_updated_at
  WHERE id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Menu item "%" not found.', p_item_id
      USING ERRCODE = 'P0002';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'id', p_item_id,
    'is_available', p_is_available,
    'updated_at', v_updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_toggle_menu_availability(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_toggle_menu_availability(TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_menu_availability(TEXT, BOOLEAN) TO service_role;

-- --------------------------------------------------------------------
-- 6D. RPC: admin_upsert_menu_item()
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_upsert_menu_item(
  p_id TEXT,
  p_name TEXT,
  p_description TEXT,
  p_category TEXT,
  p_price NUMERIC,
  p_is_veg BOOLEAN,
  p_is_available BOOLEAN,
  p_image_url TEXT,
  p_portion_info TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_updated_at TIMESTAMPTZ;
BEGIN
  v_caller_id := auth.uid();
  v_updated_at := pg_catalog.clock_timestamp();

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

  IF p_id IS NULL OR pg_catalog.btrim(p_id) = '' THEN
    RAISE EXCEPTION 'Menu item ID cannot be empty.'
      USING ERRCODE = '23514';
  END IF;

  IF p_name IS NULL OR pg_catalog.btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Menu item name cannot be empty.'
      USING ERRCODE = '23514';
  END IF;

  IF p_category IS NULL OR pg_catalog.btrim(p_category) = '' THEN
    RAISE EXCEPTION 'Menu item category cannot be empty.'
      USING ERRCODE = '23514';
  END IF;

  IF p_price IS NULL OR p_price < 0 THEN
    RAISE EXCEPTION 'Price must be non-negative.'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.menu_items (
    id,
    name,
    description,
    category,
    price,
    is_veg,
    is_available,
    image_url,
    portion_info,
    created_at,
    updated_at
  )
  VALUES (
    pg_catalog.btrim(p_id),
    pg_catalog.btrim(p_name),
    p_description,
    pg_catalog.btrim(p_category),
    p_price,
    COALESCE(p_is_veg, true),
    COALESCE(p_is_available, true),
    p_image_url,
    p_portion_info,
    v_updated_at,
    v_updated_at
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    price = EXCLUDED.price,
    is_veg = EXCLUDED.is_veg,
    is_available = EXCLUDED.is_available,
    image_url = EXCLUDED.image_url,
    portion_info = EXCLUDED.portion_info,
    updated_at = EXCLUDED.updated_at;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'id', p_id,
    'updated_at', v_updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_menu_item(TEXT, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_menu_item(TEXT, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_menu_item(TEXT, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN, BOOLEAN, TEXT, TEXT) TO service_role;

-- --------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY POLICIES
-- --------------------------------------------------------------------

-- PROFILES
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL
  USING (public.is_admin());

-- MENU ITEMS
DROP POLICY IF EXISTS "Public can view available menu items" ON public.menu_items;
CREATE POLICY "Public can view available menu items"
  ON public.menu_items FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can modify menu items" ON public.menu_items;
CREATE POLICY "Admins can modify menu items"
  ON public.menu_items FOR ALL
  USING (public.is_admin());

-- ORDERS
-- Permissive direct inserts are dropped; all order creation is strictly mediated by public.create_order() RPC
DROP POLICY IF EXISTS "Anyone can insert an order" ON public.orders;

-- Non-recursive order view policy utilizing SECURITY DEFINER helper public.is_order_assigned_rider
DROP POLICY IF EXISTS "Authorized viewers can view orders" ON public.orders;
CREATE POLICY "Authorized viewers can view orders"
  ON public.orders FOR SELECT
  USING (
    customer_id = auth.uid() OR
    public.is_admin() OR
    public.is_order_assigned_rider(id)
  );

DROP POLICY IF EXISTS "Admins and assigned riders can update orders" ON public.orders;
CREATE POLICY "Admins and assigned riders can update orders"
  ON public.orders FOR UPDATE
  USING (
    public.is_admin() OR
    public.is_order_assigned_rider(id)
  )
  WITH CHECK (
    public.is_admin() OR
    public.is_order_assigned_rider(id)
  );

-- ORDER ITEMS
-- Permissive direct inserts are dropped; items are populated exclusively via public.create_order() RPC
DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;

-- Non-recursive order items view policy utilizing SECURITY DEFINER helpers
DROP POLICY IF EXISTS "Authorized viewers can view order items" ON public.order_items;
CREATE POLICY "Authorized viewers can view order items"
  ON public.order_items FOR SELECT
  USING (
    public.is_admin() OR
    public.is_order_customer(order_id) OR
    public.is_order_assigned_rider(order_id)
  );

-- DELIVERY ASSIGNMENTS
-- Non-recursive delivery assignments view policy utilizing SECURITY DEFINER helper public.is_order_customer
DROP POLICY IF EXISTS "Authorized viewers can view delivery assignments" ON public.delivery_assignments;
CREATE POLICY "Authorized viewers can view delivery assignments"
  ON public.delivery_assignments FOR SELECT
  USING (
    public.is_admin() OR
    delivery_partner_id = auth.uid() OR
    public.is_order_customer(order_id)
  );

DROP POLICY IF EXISTS "Admins have full access to delivery assignments" ON public.delivery_assignments;
CREATE POLICY "Admins have full access to delivery assignments"
  ON public.delivery_assignments FOR ALL
  USING (public.is_admin());
