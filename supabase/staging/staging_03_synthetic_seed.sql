-- ====================================================================
-- Mantsa Biryani - Staging Synthetic Seed Data
-- File: staging_03_synthetic_seed.sql
-- Target Database: Staging Supabase Project (onzriatzbtpzjkrxhuon)
-- Safety: Pure synthetic test data. NO production or customer data included.
-- Purpose:
--   1. Seed synthetic auth users & profiles (admin, active riders, inactive rider, customer).
--   2. Seed authentic Bhagalpur menu catalog from default dishes.
--   3. Seed synthetic orders across lifecycle states (pending, accepted, preparing,
--      ready_for_pickup, out_for_delivery, delivered, cancelled) specifically crafted
--      for multi-session concurrency race testing.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. SYNTHETIC PROFILES LINKED TO PROVISIONED AUTH USERS
-- --------------------------------------------------------------------
-- NOTE: In Supabase, auth.users must NEVER be populated via raw SQL INSERTs.
-- Doing so breaks GoTrue identities, encrypted password hashes, and schema constraints.
-- Users must be provisioned via the Supabase Auth Admin API using:
--   npx tsx scripts/provision-staging-users.ts
--
-- The block below idempotently updates or inserts public.profiles for staging users
-- using real auth.users records dynamically retrieved by email:
DO $$
DECLARE
  v_admin_id UUID;
  v_tariq_id UUID;
  v_raju_id UUID;
  v_vikram_id UUID;
  v_sneha_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'staging_admin@mantsa.local';
  SELECT id INTO v_tariq_id FROM auth.users WHERE email = 'rider_tariq@mantsa.local';
  SELECT id INTO v_raju_id FROM auth.users WHERE email = 'rider_raju@mantsa.local';
  SELECT id INTO v_vikram_id FROM auth.users WHERE email = 'rider_vikram@mantsa.local';
  SELECT id INTO v_sneha_id FROM auth.users WHERE email = 'customer_sneha@mantsa.local';

  -- Fail explicitly if required synthetic users have not been provisioned via Admin API
  IF v_admin_id IS NULL OR v_tariq_id IS NULL OR v_raju_id IS NULL OR v_vikram_id IS NULL OR v_sneha_id IS NULL THEN
    RAISE EXCEPTION 'Synthetic staging auth users missing. Run "npx tsx scripts/provision-staging-users.ts" before executing staging seed.'
      USING ERRCODE = 'P0002';
  END IF;

  -- Upsert profiles for all required synthetic staging users
  INSERT INTO public.profiles (id, role, full_name, phone, is_active, created_at)
  VALUES (v_admin_id, 'admin', 'Staging Admin', '+919000000001', true, NOW())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO public.profiles (id, role, full_name, phone, vehicle_details, is_active, created_at)
  VALUES (v_tariq_id, 'delivery', 'Mohammad Tariq', '+917903155678', 'Bajaj Pulsar (BR-10-E-3341)', true, NOW())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active, vehicle_details = EXCLUDED.vehicle_details;

  INSERT INTO public.profiles (id, role, full_name, phone, vehicle_details, is_active, created_at)
  VALUES (v_raju_id, 'delivery', 'Raju Kumar', '+919835012345', 'Hero Splendor (BR-10-A-4120)', true, NOW())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active, vehicle_details = EXCLUDED.vehicle_details;

  INSERT INTO public.profiles (id, role, full_name, phone, vehicle_details, is_active, created_at)
  VALUES (v_vikram_id, 'delivery', 'Vikram Singh', '+919470288412', 'Honda Activa (BR-10-C-9011)', false, NOW())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active, vehicle_details = EXCLUDED.vehicle_details;

  INSERT INTO public.profiles (id, role, full_name, phone, is_active, created_at)
  VALUES (v_sneha_id, 'customer', 'Sneha Roy', '+919123456780', true, NOW())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;
END $$;

-- --------------------------------------------------------------------
-- 2. SYNTHETIC MENU ITEMS
-- --------------------------------------------------------------------
INSERT INTO public.menu_items (
  id,
  name,
  description,
  category,
  price,
  is_veg,
  is_available,
  portion_info,
  is_bestseller,
  spice_level
)
VALUES
  (
    'mb-01',
    'Mantsa Special Chicken Dum Biryani',
    'Fragrant long-grain aged Basmati rice layered with marinated tender chicken, golden spiced potato (aloo), boiled egg, slow-cooked with saffron and ghee.',
    'biryani',
    240.00,
    false,
    true,
    'Serves 1-2 · 1 large chicken pc, 1 aloo, 1 egg, raita',
    true,
    'Medium'
  ),
  (
    'mb-02',
    'Royal Mutton Dum Biryani',
    'Authentic slow-dum cooked juicy mutton shank chunks infused with whole aromatic spices, saffron milk, caramelized birista, and spiced potato.',
    'biryani',
    360.00,
    false,
    true,
    'Serves 1-2 · 2 tender mutton pcs, 1 aloo, 1 egg, raita',
    true,
    'Medium'
  ),
  (
    'mb-03',
    'Egg Dum Biryani',
    'Classic dum basmati rice served with two golden pan-roasted spiced eggs, slow-cooked caramelized onions, mint, and house salan.',
    'biryani',
    180.00,
    false,
    true,
    'Serves 1 · 2 roasted eggs, 1 spiced aloo, raita',
    false,
    'Medium'
  ),
  (
    'mb-04',
    'Paneer Tikka Dum Biryani',
    'Fresh malai paneer cubes marinated in rich tandoori spices and layered with aromatic saffron rice, roasted cashews, fried onions, and fresh mint.',
    'biryani',
    210.00,
    true,
    true,
    'Serves 1-2 · Generous paneer chunks, cooling raita',
    false,
    'Mild'
  ),
  (
    'mb-05',
    'Kolkata-Awadhi Chicken Chaap',
    'Slow-braised chicken quarter in a velvety cashew, poppy seed, and aromatic whole spice reduction. The timeless companion to biryani.',
    'curries',
    220.00,
    false,
    true,
    'Serves 1-2 · 1 large chaap piece in thick gravy',
    true,
    'Medium'
  ),
  (
    'mb-13',
    'Hot Gulab Jamun (2 Pcs)',
    'Mawa dumplings fried to golden brown and steeped in warm cardamom and rose-scented sugar syrup.',
    'desserts',
    70.00,
    true,
    true,
    '2 large warm pieces',
    false,
    'Mild'
  )
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      price = EXCLUDED.price,
      is_available = EXCLUDED.is_available;

-- --------------------------------------------------------------------
-- 3. SYNTHETIC ORDERS FOR CONCURRENCY RACE TESTS
-- --------------------------------------------------------------------

-- Reset sequence to 1008 after seeding
ALTER SEQUENCE public.orders_order_number_seq RESTART WITH 1008;

DO $$
DECLARE
  v_customer_id UUID;
BEGIN
  SELECT id INTO v_customer_id FROM public.profiles WHERE phone = '+919123456780' LIMIT 1;
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Synthetic customer profile (+919123456780) missing. Section 1 must run successfully first.'
      USING ERRCODE = 'P0002';
  END IF;

  -- Order 1: Pending, Unassigned (order_number: 1001)
  -- Purpose: Baseline unassigned order. Used for Assignment Race tests.
  INSERT INTO public.orders (
    id,
    order_number,
    customer_id,
    customer_name,
    customer_phone,
    delivery_address,
    landmark,
    instructions,
    subtotal,
    delivery_fee,
    total_amount,
    status
  )
  VALUES (
    'd0000000-0000-0000-0000-000000000001',
    1001,
    v_customer_id,
    'Sneha Roy',
    '9123456780',
    'Flat 302, Royal Enclave, Tilkamanjhi, Bhagalpur',
    'Near Tilkamanjhi Chowk',
    'Please do not ring the bell',
    240.00,
    40.00,
    280.00,
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Order 2: Accepted, Unassigned (order_number: 1002)
  -- Purpose: Accepted order awaiting kitchen prep & assignment.
  INSERT INTO public.orders (
    id,
    order_number,
    customer_id,
    customer_name,
    customer_phone,
    delivery_address,
    landmark,
    instructions,
    subtotal,
    delivery_fee,
    total_amount,
    status
  )
  VALUES (
    'd0000000-0000-0000-0000-000000000002',
    1002,
    v_customer_id,
    'Sneha Roy',
    '9123456780',
    'Lane 4, Zero Mile, Bhagalpur',
    'Opposite SBI ATM',
    'Call upon arrival',
    360.00,
    40.00,
    400.00,
    'accepted'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Order 3: Preparing, Assigned to Rider A (order_number: 1003)
  -- Purpose: Testing RACE 1: Rider deactivation vs preparing -> ready_for_pickup advance.
  INSERT INTO public.orders (
    id,
    order_number,
    customer_id,
    customer_name,
    customer_phone,
    delivery_address,
    landmark,
    instructions,
    subtotal,
    delivery_fee,
    total_amount,
    status
  )
  VALUES (
    'd0000000-0000-0000-0000-000000000003',
    1003,
    v_customer_id,
    'Sneha Roy',
    '9123456780',
    'House 12, Adampur, Bhagalpur',
    'Behind Central Jail Road',
    'Extra spicy please',
    460.00,
    40.00,
    500.00,
    'preparing'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Order 4: Ready for Pickup, Assigned to Rider A (order_number: 1004)
  -- Purpose: Testing RACE 2: Rider deactivation vs dispatch (ready_for_pickup -> out_for_delivery).
  INSERT INTO public.orders (
    id,
    order_number,
    customer_id,
    customer_name,
    customer_phone,
    delivery_address,
    landmark,
    instructions,
    subtotal,
    delivery_fee,
    total_amount,
    status
  )
  VALUES (
    'd0000000-0000-0000-0000-000000000004',
    1004,
    v_customer_id,
    'Sneha Roy',
    '9123456780',
    'Shop 5, Sujaganj Market, Bhagalpur',
    'Near Clock Tower',
    'Leave with shopkeeper',
    500.00,
    0.00,
    500.00,
    'ready_for_pickup'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Order 5: Out for Delivery, Assigned to Rider B (order_number: 1005)
  -- Purpose: Testing RACE 3: Rider delivery completion (out_for_delivery -> delivered) vs Rider deactivation.
  INSERT INTO public.orders (
    id,
    order_number,
    customer_id,
    customer_name,
    customer_phone,
    delivery_address,
    landmark,
    instructions,
    subtotal,
    delivery_fee,
    total_amount,
    status
  )
  VALUES (
    'd0000000-0000-0000-0000-000000000005',
    1005,
    v_customer_id,
    'Sneha Roy',
    '9123456780',
    'Plot 88, Khanjarpur, Bhagalpur',
    'Near University Gate',
    'Handover directly to customer',
    240.00,
    40.00,
    280.00,
    'out_for_delivery'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Order 6: Delivered (order_number: 1006)
  -- Purpose: Historical baseline order. Terminal delivered state.
  INSERT INTO public.orders (
    id,
    order_number,
    customer_id,
    customer_name,
    customer_phone,
    delivery_address,
    landmark,
    instructions,
    subtotal,
    delivery_fee,
    total_amount,
    status
  )
  VALUES (
    'd0000000-0000-0000-0000-000000000006',
    1006,
    v_customer_id,
    'Sneha Roy',
    '9123456780',
    'Bhikhanpur Chowk, Bhagalpur',
    'Near Railway Colony',
    NULL,
    360.00,
    40.00,
    400.00,
    'delivered'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Order 7: Cancelled (order_number: 1007)
  -- Purpose: Terminal cancelled state.
  INSERT INTO public.orders (
    id,
    order_number,
    customer_id,
    customer_name,
    customer_phone,
    delivery_address,
    landmark,
    instructions,
    subtotal,
    delivery_fee,
    total_amount,
    status
  )
  VALUES (
    'd0000000-0000-0000-0000-000000000007',
    1007,
    v_customer_id,
    'Sneha Roy',
    '9123456780',
    'Mayaganj Hospital Road, Bhagalpur',
    'Gate No. 2',
    'Customer cancelled before prep',
    180.00,
    40.00,
    220.00,
    'cancelled'
  )
  ON CONFLICT (id) DO NOTHING;
END $$;

-- --------------------------------------------------------------------
-- 4. DELIVERY ASSIGNMENTS SEED
-- --------------------------------------------------------------------
DO $$
DECLARE
  v_tariq_id UUID;
  v_raju_id UUID;
BEGIN
  SELECT id INTO v_tariq_id FROM public.profiles WHERE phone = '+917903155678' LIMIT 1;
  SELECT id INTO v_raju_id FROM public.profiles WHERE phone = '+919835012345' LIMIT 1;

  IF v_tariq_id IS NULL OR v_raju_id IS NULL THEN
    RAISE EXCEPTION 'Required rider profiles (+917903155678, +919835012345) not found. Section 1 must run successfully first.'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.delivery_assignments (
    id, order_id, delivery_partner_id, assigned_at, picked_up_at, delivered_at
  )
  VALUES
    -- Order 3 assigned to Rider A (preparing)
    ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', v_tariq_id, NOW() - INTERVAL '20 minutes', NULL, NULL),
    -- Order 4 assigned to Rider A (ready_for_pickup)
    ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004', v_tariq_id, NOW() - INTERVAL '15 minutes', NULL, NULL),
    -- Order 5 assigned to Rider B (out_for_delivery)
    ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000005', v_raju_id, NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '10 minutes', NULL),
    -- Order 6 assigned to Rider B (delivered)
    ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000006', v_raju_id, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '20 minutes')
  ON CONFLICT (order_id) DO UPDATE
    SET delivery_partner_id = EXCLUDED.delivery_partner_id,
        assigned_at = EXCLUDED.assigned_at,
        picked_up_at = EXCLUDED.picked_up_at,
        delivered_at = EXCLUDED.delivered_at;
END $$;

-- --------------------------------------------------------------------
-- 5. ORDER ITEMS SEED
-- --------------------------------------------------------------------
INSERT INTO public.order_items (
  id,
  order_id,
  menu_item_id,
  name,
  price,
  quantity,
  is_veg,
  subtotal
)
VALUES
  -- Order 1: 1 Chicken Biryani
  ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'mb-01', 'Mantsa Special Chicken Dum Biryani', 240.00, 1, false, 240.00),

  -- Order 2: 1 Mutton Biryani
  ('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'mb-02', 'Royal Mutton Dum Biryani', 360.00, 1, false, 360.00),

  -- Order 3: 1 Chicken Biryani + 1 Chicken Chaap
  ('f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'mb-01', 'Mantsa Special Chicken Dum Biryani', 240.00, 1, false, 240.00),
  ('f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003', 'mb-05', 'Kolkata-Awadhi Chicken Chaap', 220.00, 1, false, 220.00),

  -- Order 4: 2 Chicken Biryani + 1 Gulab Jamun
  ('f0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000004', 'mb-01', 'Mantsa Special Chicken Dum Biryani', 240.00, 2, false, 480.00),
  ('f0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000004', 'mb-13', 'Hot Gulab Jamun (2 Pcs)', 70.00, 1, true, 70.00),

  -- Order 5: 1 Chicken Biryani
  ('f0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000005', 'mb-01', 'Mantsa Special Chicken Dum Biryani', 240.00, 1, false, 240.00),

  -- Order 6: 1 Mutton Biryani
  ('f0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000006', 'mb-02', 'Royal Mutton Dum Biryani', 360.00, 1, false, 360.00),

  -- Order 7: 1 Egg Biryani
  ('f0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000007', 'mb-03', 'Egg Dum Biryani', 180.00, 1, false, 180.00)
ON CONFLICT (id) DO NOTHING;
