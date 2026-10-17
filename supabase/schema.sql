-- ====================================================================
-- Mantsa Biryani - Production Database Schema for Supabase PostgreSQL
-- Location: Bhagalpur, Bihar, India
-- ====================================================================

-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('customer', 'admin', 'delivery_partner');

CREATE TYPE order_status AS ENUM (
  'pending',
  'accepted',
  'preparing',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
  'cancelled'
);

CREATE TYPE food_category AS ENUM (
  'biryani',
  'starters',
  'curries',
  'breads',
  'desserts'
);

CREATE TYPE payment_method AS ENUM ('COD');

-- 2. PROFILES TABLE (Linked with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'customer',
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  vehicle_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. MENU ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.menu_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category food_category NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  is_veg BOOLEAN NOT NULL DEFAULT FALSE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  image_url TEXT,
  portion_info TEXT,
  is_bestseller BOOLEAN NOT NULL DEFAULT FALSE,
  spice_level TEXT DEFAULT 'Medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  landmark TEXT NOT NULL,
  delivery_notes TEXT,
  subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
  delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 40.00,
  packaging_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
  payment_method payment_method NOT NULL DEFAULT 'COD',
  status order_status NOT NULL DEFAULT 'pending',
  delivery_partner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id TEXT REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  is_veg BOOLEAN NOT NULL DEFAULT FALSE,
  subtotal NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. DELIVERY ASSIGNMENTS TABLE
CREATE TABLE IF NOT EXISTS public.delivery_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  delivery_partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  notes TEXT
);

-- 7. PERFORMANCE INDICES
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_partner ON public.orders(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category);

-- 8. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;

-- Security Helper Functions (Hardened with fixed search_path)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_delivery_partner()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('delivery', 'delivery_partner')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_delivery_partner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_delivery_partner() TO authenticated;

-- Policies for profiles
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL
  USING (public.is_admin());

-- Policies for menu_items
CREATE POLICY "Public can view available menu items"
  ON public.menu_items FOR SELECT
  USING (true);

CREATE POLICY "Admins can modify menu items"
  ON public.menu_items FOR ALL
  USING (public.is_admin());

-- Policies for orders
-- 1. Customers can create orders (anonymous or authenticated)
CREATE POLICY "Anyone can insert an order"
  ON public.orders FOR INSERT
  WITH CHECK (true);

-- 2. Customers can read their own order by order_number or id
CREATE POLICY "Customers can view their orders"
  ON public.orders FOR SELECT
  USING (
    customer_id = auth.uid() OR
    public.is_admin() OR
    (public.is_delivery_partner() AND delivery_partner_id = auth.uid())
  );

-- 3. Delivery partners can only see and update their assigned orders
CREATE POLICY "Delivery partners can update assigned orders status"
  ON public.orders FOR UPDATE
  USING (
    public.is_admin() OR
    (public.is_delivery_partner() AND delivery_partner_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin() OR
    (public.is_delivery_partner() AND delivery_partner_id = auth.uid())
  );

-- 4. Admins can manage all orders
CREATE POLICY "Admins have full access to orders"
  ON public.orders FOR ALL
  USING (public.is_admin());

-- Policies for order_items
CREATE POLICY "Order items viewable by order viewer"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE public.orders.id = public.order_items.order_id
      AND (
        public.orders.customer_id = auth.uid()
        OR public.is_admin()
        OR (public.is_delivery_partner() AND public.orders.delivery_partner_id = auth.uid())
      )
    )
  );

CREATE POLICY "Anyone can insert order items on creation"
  ON public.order_items FOR INSERT
  WITH CHECK (true);

-- 9. SERVER-SIDE TRIGGER TO AUTO-UPDATE TIMESTAMPS
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_orders_timestamp
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trigger_update_menu_timestamp
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- 10. ADMIN RIDER MANAGEMENT FUNCTIONS & GUARDS
-- 10.1 Query Delivery Partners (Hardened SECURITY DEFINER with fixed search_path)
CREATE OR REPLACE FUNCTION public.get_delivery_partners()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  phone TEXT,
  role public.user_role,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Strict verification of admin caller
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = auth.uid() AND pr.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required.';
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.phone, p.role, p.created_at
  FROM public.profiles p
  WHERE p.role IN ('delivery_partner', 'delivery')
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_delivery_partners() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_delivery_partners() TO authenticated;

-- 10.2 Database-side Order Column Protection & Transition Integrity Trigger
-- Prevents delivery partners from tampering with protected financial or customer columns,
-- and strictly enforces allowed status progressions: ready_for_pickup -> out_for_delivery -> delivered.
CREATE OR REPLACE FUNCTION public.enforce_order_update_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Admins retain unrestricted management access
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Non-admin restrictions: Protect sensitive order fields
  IF (OLD.id != NEW.id OR
      OLD.order_number != NEW.order_number OR
      OLD.customer_id IS DISTINCT FROM NEW.customer_id OR
      OLD.customer_name != NEW.customer_name OR
      OLD.customer_phone != NEW.customer_phone OR
      OLD.delivery_address != NEW.delivery_address OR
      OLD.subtotal != NEW.subtotal OR
      OLD.delivery_fee != NEW.delivery_fee OR
      OLD.packaging_fee != NEW.packaging_fee OR
      OLD.total_amount != NEW.total_amount OR
      OLD.payment_method != NEW.payment_method) THEN
    RAISE EXCEPTION 'Security violation: Delivery partners are forbidden from modifying order amounts, items, or customer details.';
  END IF;

  -- Validate allowed status transitions
  -- Allowed transitions for delivery partner:
  --   1. pickup: ready_for_pickup (or accepted/preparing) -> out_for_delivery
  --   2. deliver: out_for_delivery -> delivered
  IF (OLD.status != NEW.status) THEN
    IF NOT (
      (OLD.status IN ('ready_for_pickup', 'accepted', 'preparing') AND NEW.status = 'out_for_delivery') OR
      (OLD.status = 'out_for_delivery' AND NEW.status = 'delivered')
    ) THEN
      RAISE EXCEPTION 'Invalid status transition: Delivery partner cannot change status from "%" to "%".', OLD.status, NEW.status;
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

-- NOTE: Rider account provisioning and status deactivation/reactivation are handled exclusively
-- through Supabase Edge Functions (supabase/functions/admin-create-rider and admin-toggle-rider-status)
-- using the Supabase Auth Admin API. Direct SQL insertion/deletion on auth.users is deprecated.
