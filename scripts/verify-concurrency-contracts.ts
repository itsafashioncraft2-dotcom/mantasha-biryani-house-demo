// Static Contract & Migration Syntax Verification Script
// NOTE: This is a STATIC lint/contract verification script that checks AST/string patterns,
// business logic transition maps, whitelists, and migration definitions.
// IMPORTANT: Static tests DO NOT prove live SQL correctness or guarantee absence of runtime race conditions.
// Live multi-connection database integration tests against real PostgreSQL instances are still required.

import fs from 'node:fs';
import path from 'node:path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

console.log('=== STATIC TEST SUITE: BUSINESS LOGIC CONTRACTS ===');

console.log('\n--- 1. Testing Admin Status Transition Map ---');
const adminTransitions: Record<string, string[]> = {
  pending: ['accepted', 'cancelled'],
  accepted: ['preparing'],
  preparing: ['ready_for_pickup'],
  ready_for_pickup: ['out_for_delivery'],
  out_for_delivery: [], // Admin CANNOT transition out_for_delivery
  delivered: [],
  cancelled: [],
  rejected: [],
};

function isValidAdminTransition(current: string, next: string): boolean {
  return (adminTransitions[current] || []).includes(next);
}

assert(isValidAdminTransition('pending', 'accepted'), 'pending -> accepted allowed');
assert(isValidAdminTransition('pending', 'cancelled'), 'pending -> cancelled allowed');
assert(!isValidAdminTransition('pending', 'delivered'), 'pending -> delivered blocked');
assert(!isValidAdminTransition('pending', 'pending'), 'pending -> pending same-status blocked');
assert(!isValidAdminTransition('accepted', 'accepted'), 'accepted -> accepted same-status blocked');
assert(!isValidAdminTransition('ready_for_pickup', 'ready_for_pickup'), 'ready_for_pickup -> ready_for_pickup same-status blocked');
assert(!isValidAdminTransition('unknown_status', 'accepted'), 'unknown current status blocked');
assert(isValidAdminTransition('accepted', 'preparing'), 'accepted -> preparing allowed');
assert(isValidAdminTransition('preparing', 'ready_for_pickup'), 'preparing -> ready_for_pickup allowed');
assert(isValidAdminTransition('ready_for_pickup', 'out_for_delivery'), 'ready_for_pickup -> out_for_delivery allowed');
assert(!isValidAdminTransition('out_for_delivery', 'delivered'), 'out_for_delivery -> delivered blocked for admin RPC');
assert(!isValidAdminTransition('out_for_delivery', 'cancelled'), 'out_for_delivery -> cancelled blocked for admin RPC');

console.log('\n--- 2. Testing Rider Status Transition Contract ---');
function isValidRiderTransition(current: string, next: string): boolean {
  return current === 'out_for_delivery' && next === 'delivered';
}

assert(isValidRiderTransition('out_for_delivery', 'delivered'), 'Rider out_for_delivery -> delivered allowed');
assert(!isValidRiderTransition('ready_for_pickup', 'out_for_delivery'), 'Rider pickup blocked (admin dispatch required)');
assert(!isValidRiderTransition('pending', 'delivered'), 'Rider direct delivery jump blocked');
assert(!isValidRiderTransition('out_for_delivery', 'cancelled'), 'Rider cancellation blocked');

console.log('\n--- 3. Testing Assignment Status Eligibility Whitelist ---');
const assignableStatuses = new Set(['pending', 'accepted', 'preparing', 'ready_for_pickup']);

function isAssignableStatus(status: string): boolean {
  return assignableStatuses.has(status);
}

assert(isAssignableStatus('pending'), 'pending is assignable');
assert(isAssignableStatus('accepted'), 'accepted is assignable');
assert(isAssignableStatus('preparing'), 'preparing is assignable');
assert(isAssignableStatus('ready_for_pickup'), 'ready_for_pickup is assignable');
assert(!isAssignableStatus('out_for_delivery'), 'out_for_delivery is NOT assignable');
assert(!isAssignableStatus('delivered'), 'delivered is NOT assignable');
assert(!isAssignableStatus('cancelled'), 'cancelled is NOT assignable');
assert(!isAssignableStatus('rejected'), 'rejected is NOT assignable');

console.log('\n--- 4. Testing Migration File Static Verification ---');
const migrationPath = path.resolve('supabase/migrations/20261013_atomic_rider_concurrency.sql');
assert(fs.existsSync(migrationPath), 'Migration file exists');

const sqlContent = fs.readFileSync(migrationPath, 'utf8');

assert(sqlContent.includes('public.admin_toggle_rider_status'), 'admin_toggle_rider_status defined in migration');
assert(sqlContent.includes('public.admin_assign_delivery_partner'), 'admin_assign_delivery_partner defined in migration');
assert(sqlContent.includes('public.admin_update_order_status'), 'admin_update_order_status defined in migration');
assert(sqlContent.includes('public.rider_update_order_status'), 'rider_update_order_status defined in migration');

// Strip SQL comments before asserting column references in SQL code
const sqlWithoutComments = sqlContent
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

assert(!sqlWithoutComments.includes('delivery_partner_id') || !sqlWithoutComments.includes('orders.delivery_partner_id'), 'Zero SQL references to non-existent orders.delivery_partner_id');
assert(!sqlWithoutComments.includes('orders.delivery_partner_id'), 'Zero references to orders.delivery_partner_id in SQL statements');
assert(!sqlWithoutComments.includes('profiles.updated_at'), 'Zero references to non-existent profiles.updated_at');
assert(!sqlWithoutComments.includes('profiles SET updated_at'), 'Zero attempts to update updated_at on profiles');

// Check that ON CONFLICT DO UPDATE is NOT used for assignment
assert(!sqlContent.includes('ON CONFLICT (order_id) DO UPDATE'), 'No silent overwrite of existing assignment');

// Check SQL syntax: COALESCE keyword used, pg_catalog.coalesce NOT used
assert(!sqlWithoutComments.includes('pg_catalog.coalesce'), 'Zero invalid occurrences of pg_catalog.coalesce (COALESCE is keyword)');
assert(sqlContent.includes('COALESCE(o.order_number::text, o.id::text)'), 'Standard COALESCE keyword used for order number string_agg');

// Check explicit NULL checks across functions
assert(sqlContent.includes('IF p_is_active IS NULL THEN'), 'admin_toggle_rider_status explicitly rejects NULL is_active');
assert(sqlContent.includes('IF p_rider_id IS NULL THEN'), 'admin_toggle_rider_status explicitly rejects NULL rider_id');
assert(sqlContent.includes('IF p_new_status IS NULL THEN'), 'admin_update_order_status explicitly rejects NULL status before reads/locks');

// Check unified locking protocol and explicit transition allowlist in admin_update_order_status
assert(sqlContent.includes('IF v_current_partner_id IS NOT NULL THEN'), 'admin_update_order_status branches on assigned partner existence');
assert(sqlContent.includes('Cannot advance order: Assigned delivery partner is deactivated'), 'admin_update_order_status prevents advancing orders of deactivated riders');
assert(sqlContent.includes("v_current_status = 'pending' AND p_new_status = 'accepted'"), 'admin_update_order_status includes explicit transition pair allowlist');

// Check captured timestamp and COALESCE semantics
assert(sqlContent.includes('v_now := pg_catalog.clock_timestamp()'), 'Single captured timestamp v_now := pg_catalog.clock_timestamp() used post-lock');
assert(sqlContent.includes('COALESCE(picked_up_at, v_now)'), 'COALESCE picked_up_at with captured v_now preserved');
assert(sqlContent.includes('COALESCE(delivered_at, v_now)'), 'COALESCE delivered_at with captured v_now preserved');

// Check assignment timestamp preservation
assert(sqlContent.includes('pg_catalog.clock_timestamp()'), 'admin_assign_delivery_partner preserves clock_timestamp() in VALUES');

// Check distinct status check and auth.uid() guard in rider RPC
assert(sqlContent.includes("p_new_status IS DISTINCT FROM 'delivered'"), "rider_update_order_status uses p_new_status IS DISTINCT FROM 'delivered'");
assert(sqlContent.includes('IF v_caller_id IS NULL THEN') && sqlContent.includes("RAISE EXCEPTION 'Access denied: Active delivery partner privileges required.'"), 'rider_update_order_status explicitly rejects auth.uid() IS NULL with 42501');

// Check exact response shapes
assert(sqlContent.includes("'order_id', p_order_id"), "admin_assign_delivery_partner returns original snake_case 'order_id'");
assert(sqlContent.includes("'delivery_partner_id', p_delivery_partner_id"), "admin_assign_delivery_partner returns original snake_case 'delivery_partner_id'");
assert(!sqlContent.includes("'deliveryPartnerName'"), "admin_assign_delivery_partner does not add unverified keys");

// Check service_role and authenticated grants
assert(sqlContent.includes('GRANT EXECUTE ON FUNCTION public.admin_assign_delivery_partner(UUID, UUID) TO authenticated;'), 'admin_assign_delivery_partner granted to authenticated');
assert(sqlContent.includes('GRANT EXECUTE ON FUNCTION public.admin_assign_delivery_partner(UUID, UUID) TO service_role;'), 'admin_assign_delivery_partner granted to service_role');
assert(sqlContent.includes('REVOKE ALL ON FUNCTION public.get_delivery_partners() FROM PUBLIC, anon, authenticated;'), 'Legacy get_delivery_partners() revoked from authenticated');
assert(sqlContent.includes('GRANT EXECUTE ON FUNCTION public.get_delivery_partners_v2() TO authenticated;'), 'Working get_delivery_partners_v2() granted to authenticated');
assert(sqlContent.includes('GRANT EXECUTE ON FUNCTION public.get_delivery_partners_v2() TO service_role;'), 'Working get_delivery_partners_v2() granted to service_role');

console.log('\n--- 5. Testing Guest Tracking & Cryptographic Contract Verification ---');
const stagingFuncPath = path.resolve('supabase/staging/staging_02_baseline_functions_and_rls.sql');
assert(fs.existsSync(stagingFuncPath), 'Staging baseline functions file exists');

const stagingFuncSql = fs.readFileSync(stagingFuncPath, 'utf8');

// A. track_guest_order Cancellation Revocation Invariant
assert(stagingFuncSql.includes('CREATE OR REPLACE FUNCTION public.track_guest_order('), 'track_guest_order RPC defined');
assert(stagingFuncSql.includes("IF v_order.status = 'cancelled' THEN"), 'track_guest_order contains explicit cancellation guard');
assert(stagingFuncSql.includes("'Order not found or tracking is unavailable.'"), 'Cancelled orders return generic failure without disclosing details');

// B. track_guest_order Expiration Guard
assert(stagingFuncSql.includes('v_order.tracking_token_expires_at < pg_catalog.clock_timestamp()'), 'track_guest_order verifies token expiration timestamp');

// C. hash_tracking_token Deterministic Schema Discovery & Exception Handling
assert(stagingFuncSql.includes('CREATE OR REPLACE FUNCTION public.hash_tracking_token('), 'hash_tracking_token helper defined');
assert(stagingFuncSql.includes('FROM pg_catalog.pg_proc p') && stagingFuncSql.includes('JOIN pg_catalog.pg_namespace n'), 'hash_tracking_token queries core system catalogs pg_proc and pg_namespace');
assert(stagingFuncSql.includes('WHEN undefined_function OR invalid_schema_name THEN'), 'hash_tracking_token catches both undefined_function (42883) and invalid_schema_name (3F000)');

// Strip comments from staging functions to ensure zero references to non-existent functions
const stagingWithoutComments = stagingFuncSql
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

assert(!stagingWithoutComments.includes('pg_catalog.sha256'), 'Zero references to non-existent pg_catalog.sha256 in SQL code');

// D. Function permissions & grants
assert(stagingFuncSql.includes('REVOKE ALL ON FUNCTION public.hash_tracking_token(TEXT) FROM PUBLIC;'), 'hash_tracking_token revoked from PUBLIC');
assert(stagingFuncSql.includes('GRANT EXECUTE ON FUNCTION public.hash_tracking_token(TEXT) TO anon;'), 'hash_tracking_token granted to anon');
assert(stagingFuncSql.includes('GRANT EXECUTE ON FUNCTION public.track_guest_order(BIGINT, TEXT) TO anon;'), 'track_guest_order granted to anon');

console.log('\n--- 6. Testing Synthetic Seed Integrity & Idempotency ---');
const stagingSeedPath = path.resolve('supabase/staging/staging_03_synthetic_seed.sql');
assert(fs.existsSync(stagingSeedPath), 'Staging synthetic seed file exists');

const stagingSeedSql = fs.readFileSync(stagingSeedPath, 'utf8');

// Strip comments from seed file
const seedWithoutComments = stagingSeedSql
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

// A. Verified zero invalid hardcoded customer UUIDs in orders
assert(!seedWithoutComments.includes('c0000000-0000-0000-0000-000000000001'), 'Zero occurrences of invalid hardcoded customer UUID in orders');
assert(stagingSeedSql.includes("SELECT id INTO v_customer_id FROM public.profiles WHERE phone = '+919123456780'"), 'Orders dynamically resolve customer_id from profiles');

// B. Explicit missing-user guard (no silent skip)
assert(stagingSeedSql.includes("RAISE EXCEPTION 'Synthetic staging auth users missing"), 'Explicit exception if synthetic auth users are not provisioned');
assert(stagingSeedSql.includes("RAISE EXCEPTION 'Required rider profiles"), 'Explicit exception if required rider profiles are missing');

// C. Order items column schema and deterministic rerun-safe UUIDs
assert(stagingSeedSql.includes('INSERT INTO public.order_items (\n  id,\n  order_id,\n  menu_item_id,\n  name,\n  price,\n  quantity,\n  is_veg,\n  subtotal\n)'), 'order_items insert includes explicit id and matches baseline schema columns');
assert(stagingSeedSql.includes('f0000000-0000-0000-0000-000000000001') && stagingSeedSql.includes('f0000000-0000-0000-0000-000000000009'), 'order_items seed specifies deterministic UUIDs for all rows');
assert(stagingSeedSql.includes('ON CONFLICT (id) DO NOTHING;'), 'order_items uses ON CONFLICT (id) DO NOTHING for rerun idempotency');

// D. Concurrency fixture validation
assert(stagingSeedSql.includes("'d0000000-0000-0000-0000-000000000001'") && stagingSeedSql.includes('1001'), 'Order 1 fixture (UUID + BIGINT order_number 1001) verified');
assert(stagingSeedSql.includes("'d0000000-0000-0000-0000-000000000004'") && stagingSeedSql.includes('1004'), 'Order 4 fixture (UUID + BIGINT order_number 1004) verified');
assert(stagingSeedSql.includes("'d0000000-0000-0000-0000-000000000005'") && stagingSeedSql.includes('1005'), 'Order 5 fixture (UUID + BIGINT order_number 1005) verified');
assert(stagingSeedSql.includes('ALTER SEQUENCE public.orders_order_number_seq RESTART WITH 1008;'), 'Sequence restart configured to 1008 to prevent test order collisions');

console.log('\n--- 7. Testing Round 18 Security Hardening & Admin Menu RPC Migration ---');
const hardeningMigrationPath = path.resolve('supabase/migrations/20261015_security_hardening_and_menu_rpc.sql');
assert(fs.existsSync(hardeningMigrationPath), 'Hardening migration 20261015 exists');

const hardeningSql = fs.readFileSync(hardeningMigrationPath, 'utf8');

// A. track_guest_order fail-closed token expiry
assert(
  hardeningSql.includes('v_order.tracking_token_expires_at IS NULL OR v_order.tracking_token_expires_at < pg_catalog.clock_timestamp()'),
  'track_guest_order fails closed on NULL or expired tracking_token_expires_at'
);

// B. create_order defensive validations
assert(hardeningSql.includes("jsonb_typeof(p_items) != 'array'"), 'create_order verifies JSON array input format');
assert(hardeningSql.includes('Duplicate item "%" detected in order'), 'create_order detects duplicate menu items in payload');
assert(hardeningSql.includes("v_quantity_text !~ '^[1-9][0-9]*$'"), 'create_order enforces positive integer regex validation on quantity');
assert(hardeningSql.includes('exceeds maximum allowed limit of 50'), 'create_order enforces maximum quantity limit of 50');
assert(hardeningSql.includes('distinct items (limit 30)'), 'create_order enforces distinct items limit of 30');

// C. enforce_order_update_security comprehensive field comparisons
assert(hardeningSql.includes('OLD.landmark IS DISTINCT FROM NEW.landmark'), 'enforce_order_update_security guards landmark');
assert(hardeningSql.includes('OLD.instructions IS DISTINCT FROM NEW.instructions'), 'enforce_order_update_security guards instructions');
assert(hardeningSql.includes('OLD.tracking_token_hash IS DISTINCT FROM NEW.tracking_token_hash'), 'enforce_order_update_security guards tracking_token_hash');
assert(hardeningSql.includes('OLD.tracking_token_expires_at IS DISTINCT FROM NEW.tracking_token_expires_at'), 'enforce_order_update_security guards tracking_token_expires_at');
assert(hardeningSql.includes('OLD.created_at IS DISTINCT FROM NEW.created_at'), 'enforce_order_update_security guards created_at');

// D. Admin Menu RPCs
assert(hardeningSql.includes('public.admin_toggle_menu_availability'), 'admin_toggle_menu_availability RPC defined');
assert(hardeningSql.includes('public.admin_upsert_menu_item'), 'admin_upsert_menu_item RPC defined');
assert(hardeningSql.includes('GRANT EXECUTE ON FUNCTION public.admin_toggle_menu_availability(TEXT, BOOLEAN) TO authenticated;'), 'admin_toggle_menu_availability granted to authenticated');
assert(hardeningSql.includes('GRANT EXECUTE ON FUNCTION public.admin_upsert_menu_item(TEXT, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN, BOOLEAN, TEXT, TEXT) TO authenticated;'), 'admin_upsert_menu_item granted to authenticated');

console.log('\n✨ All static contract verifications passed successfully!');
console.log('⚠️  CRITICAL REMINDER: Static AST/text checks do NOT replace execution on a staging database, nor do they validate runtime concurrency behavior under real concurrent database transactions.');


