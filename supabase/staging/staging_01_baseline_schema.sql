-- ====================================================================
-- Mantsa Biryani - Staging Baseline Schema Initialization
-- File: staging_01_baseline_schema.sql
-- Target Database: Staging Supabase Project (onzriatzbtpzjkrxhuon)
-- Safety: READ-ONLY review artifact. Do NOT execute against production.
-- Verified Contracts:
--   - public.orders.order_number is BIGINT (managed via sequence).
--   - public.orders has ZERO delivery_partner_id column (all assignments in delivery_assignments).
--   - public.profiles has role = 'delivery' and is_active BOOLEAN (NO updated_at column).
--   - public.delivery_assignments enforces UNIQUE(order_id) (1 assignment per order).
-- ====================================================================

-- 1. EXTENSIONS & DOMAIN ENUMS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE food_category AS ENUM (
    'biryani',
    'starters',
    'curries',
    'breads',
    'desserts'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'pending',
    'accepted',
    'preparing',
    'ready_for_pickup',
    'out_for_delivery',
    'delivered',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('COD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. SEQUENCES
CREATE SEQUENCE IF NOT EXISTS public.orders_order_number_seq
  START WITH 1001
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

-- 3. PROFILES TABLE (Linked with auth.users)
-- Verified Production Contract:
--   - role supports 'delivery', 'admin', 'customer', 'delivery_partner'
--   - is_active BOOLEAN NOT NULL DEFAULT true
--   - phone UNIQUE constraint for duplicate prevention
--   - ZERO updated_at column (verified absent in live DB)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'delivery', 'delivery_partner')),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  vehicle_details TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. MENU ITEMS TABLE
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

-- 5. ORDERS TABLE
-- Verified Production Contract:
--   - order_number is BIGINT (not TEXT)
--   - ZERO delivery_partner_id column (strictly segregated into delivery_assignments)
--   - instructions column mapped from frontend delivery notes / customer instructions
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number BIGINT NOT NULL UNIQUE DEFAULT nextval('public.orders_order_number_seq'),
  customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  landmark TEXT NOT NULL,
  instructions TEXT,
  subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
  delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 40.00,
  packaging_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
  payment_method payment_method NOT NULL DEFAULT 'COD',
  status order_status NOT NULL DEFAULT 'pending',
  tracking_token_hash TEXT,
  tracking_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe idempotent alterations for pre-existing databases
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_token_hash TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_token_expires_at TIMESTAMPTZ;

-- 6. ORDER ITEMS TABLE
-- Compatible with store.ts fetching name/item_name, price/unit_price, subtotal/line_total
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id TEXT REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  is_veg BOOLEAN NOT NULL DEFAULT FALSE,
  subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. DELIVERY ASSIGNMENTS TABLE
-- Verified Production Contract:
--   - order_id is UNIQUE (exactly one assignment record per order)
--   - foreign keys to orders and profiles
--   - delivery_partner_id references profiles(id)
CREATE TABLE IF NOT EXISTS public.delivery_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  delivery_partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  notes TEXT
);

-- 8. PERFORMANCE INDICES
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tracking ON public.orders(order_number, tracking_token_hash);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_order ON public.delivery_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_partner ON public.delivery_assignments(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category);
CREATE INDEX IF NOT EXISTS idx_profiles_role_active ON public.profiles(role, is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);
