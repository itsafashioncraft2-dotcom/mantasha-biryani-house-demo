# Implementation Plan: Atomic Concurrency & Locking for Mantsa Biryani

Establish an atomic, deadlock-free concurrency architecture for delivery partner assignment, deactivation, dispatch, and delivery confirmation in the Supabase PostgreSQL database.

---

## A. Proposed Architecture & Global Lock Order

### 1. The Global Lock Hierarchy
To guarantee mathematical deadlock freedom across all concurrent transactions, every database stored procedure and transaction must acquire row-level locks in the **exact same global sequence**:

```text
GLOBAL LOCK ORDER:
1. public.profiles (Rider profile row) FOR UPDATE
2. public.orders (Order row) FOR UPDATE
3. public.delivery_assignments (Mutations & timestamp updates)
```

### 2. How This Solves TOCTOU Races & Deadlocks
* **TOCTOU Race Elimination:** In rider deactivation, the active-order check and the `profiles.is_active = false` update occur within the exclusive lock on the rider's `profiles` row. Because `admin_assign_delivery_partner` is required to lock `profiles` *before* inserting into `delivery_assignments`, any concurrent assignment for that rider is forced to block on the `profiles` lock until deactivation finishes. If deactivation sets `is_active = false`, the subsequent assignment unblocks, re-reads `is_active`, and immediately aborts.
* **Deadlock Freedom:** A deadlock requires a circular wait condition ($T_1 \to T_2 \to T_1$). Because all four operational functions (`admin_toggle_rider_status`, `admin_assign_delivery_partner`, `admin_update_order_status`, and `rider_update_order_status`) acquire `profiles` *before* `orders`, no circular dependency can ever form.

---

## B. Function-by-Function Change Plan

### 1. New Atomic RPC: `public.admin_toggle_rider_status(p_rider_id uuid, p_is_active boolean)`
* **Role / Security:** `SECURITY DEFINER`, `SET search_path = ''`. Granted to `authenticated`.
* **Execution Flow:**
  1. **Admin Authorization Guard:** Verify caller has `role = 'admin' AND is_active = true` in `public.profiles` using `auth.uid()`.
  2. **Self-Deactivation Guard:** Reject if `p_rider_id = auth.uid()`.
  3. **Lock Step 1 (Profiles):** `SELECT role, is_active FROM public.profiles WHERE id = p_rider_id FOR UPDATE;`
  4. **Target Role Validation:** Revalidate `role = 'delivery'`.
  5. **Active Order Validation (if `p_is_active = false`):** While holding the `profiles` lock, query:
     ```sql
     SELECT COUNT(o.id) INTO v_active_count
     FROM public.delivery_assignments da
     JOIN public.orders o ON da.order_id = o.id
     WHERE da.delivery_partner_id = p_rider_id
       AND o.status IN ('pending', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery');
     ```
     If `v_active_count > 0`, raise exception `23505` (`'Cannot deactivate rider with active orders.'`).
  6. **Mutate:** `UPDATE public.profiles SET is_active = p_is_active, updated_at = NOW() WHERE id = p_rider_id;`
  7. **Return:** `jsonb_build_object('success', true, 'riderId', p_rider_id, 'isActive', p_is_active)`.

### 2. Updated RPC: `public.admin_assign_delivery_partner(p_order_id uuid, p_delivery_partner_id uuid)`
* **Role / Security:** `SECURITY DEFINER`, `SET search_path = ''`. Granted to `authenticated`.
* **Execution Flow:**
  1. **Admin Authorization Guard:** Verify caller is active admin via `auth.uid()`.
  2. **Lock Step 1 (Profiles):** `SELECT role, is_active FROM public.profiles WHERE id = p_delivery_partner_id FOR UPDATE;`
  3. **Revalidate Rider:** Ensure `role = 'delivery'` and `is_active = true`. If inactive, abort with descriptive exception.
  4. **Lock Step 2 (Orders):** `SELECT status FROM public.orders WHERE id = p_order_id FOR UPDATE;`
  5. **Revalidate Order:** Ensure `status NOT IN ('delivered', 'cancelled')`.
  6. **Mutate Step 3:** Update `orders.delivery_partner_id = p_delivery_partner_id` and insert assignment record into `delivery_assignments`.
  7. **Return:** `jsonb_build_object('success', true, 'orderId', p_order_id, 'deliveryPartnerId', p_delivery_partner_id)`.

### 3. Updated RPC: `public.admin_update_order_status(p_order_id uuid, p_new_status text)`
* **Role / Security:** `SECURITY DEFINER`, `SET search_path = ''`. Granted to `authenticated`.
* **Execution Flow:**
  1. **Admin Authorization Guard:** Verify caller is active admin via `auth.uid()`.
  2. **Peek Assignment:** Non-locking read: `SELECT delivery_partner_id FROM public.orders WHERE id = p_order_id;`
  3. **Lock Step 1 (Profiles - if rider assigned):**
     If rider is assigned, `SELECT is_active FROM public.profiles WHERE id = v_partner_id FOR UPDATE;`
     If transitioning to `'out_for_delivery'`, revalidate `is_active = true`.
  4. **Lock Step 2 (Orders):** `SELECT status, delivery_partner_id FROM public.orders WHERE id = p_order_id FOR UPDATE;`
  5. **Revalidate Consistency:** If `delivery_partner_id` changed during lock acquisition, abort and rollback.
  6. **Mutate Step 3:** Update `orders.status = p_new_status`. Update `delivery_assignments.picked_up_at` if `'out_for_delivery'` or `delivered_at` if `'delivered'`.
  7. **Return:** `jsonb_build_object('success', true, 'orderId', p_order_id, 'status', p_new_status)`.

### 4. Updated RPC: `public.rider_update_order_status(p_order_id uuid, p_new_status text)`
* **Role / Security:** `SECURITY DEFINER`, `SET search_path = ''`. Granted to `authenticated`.
* **Execution Flow:**
  1. **Lock Step 1 (Profiles - Caller):**
     `SELECT role, is_active FROM public.profiles WHERE id = auth.uid() FOR UPDATE;`
     Revalidate `role = 'delivery'` and `is_active = true`.
  2. **Lock Step 2 (Orders):** `SELECT status, delivery_partner_id FROM public.orders WHERE id = p_order_id FOR UPDATE;`
  3. **Revalidate Ownership:** Ensure `delivery_partner_id = auth.uid()`.
  4. **Revalidate Transition:** Allow only valid rider transitions:
     - `'ready_for_pickup'` / `'preparing'` / `'accepted'` $\to$ `'out_for_delivery'`
     - `'out_for_delivery'` $\to$ `'delivered'`
  5. **Mutate Step 3:** Update `orders.status = p_new_status` and update `delivery_assignments` timestamps.
  6. **Return:** `jsonb_build_object('success', true, 'orderId', p_order_id, 'status', p_new_status)`.

---

## C. Edge Function Authentication Approach

In `supabase/functions/admin-toggle-rider-status/index.ts`:
1. **Extract Caller JWT:** Extract Bearer token from incoming `req.headers.get('Authorization')`.
2. **Forward JWT with User-Scoped Client:** Instead of performing multi-query service-role table mutations, instantiate an authenticated Supabase client:
   ```typescript
   const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
     global: { headers: { Authorization: `Bearer ${token}` } },
     auth: { persistSession: false, autoRefreshToken: false },
   });
   ```
3. **Delegate to Atomic RPC:** Call the new stored procedure:
   ```typescript
   const { data, error } = await userClient.rpc('admin_toggle_rider_status', {
     p_rider_id: cleanRiderId,
     p_is_active: isActive,
   });
   ```
4. **Benefits:**
   - `auth.uid()` inside PostgreSQL is guaranteed to be the verified administrator ID.
   - The service-role key is bypassed for this operation, enforcing least privilege.
   - The multi-roundtrip network race condition is replaced with an atomic database transaction.

---

## D. Regression-Test Matrix

| Test Scenario | Setup State | Trigger Action | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **Concurrent Deactivation vs. Assignment** | Rider R has 0 orders. Order O unassigned. | Admin 1 calls deactivation on R while Admin 2 assigns O to R. | One operation succeeds, the other fails closed. Zero active orders left assigned to an inactive rider. Zero deadlocks. |
| **Concurrent Dispatch vs. Deactivation** | Rider R has Order O in `ready_for_pickup`. | Admin 1 dispatches O to `out_for_delivery` while Admin 2 attempts deactivating R. | Deactivation is rejected due to active order. Dispatch succeeds. |
| **Two Simultaneous Assignments** | Order O is unassigned. | Admin 1 assigns O to Rider A; Admin 2 assigns O to Rider B. | First lock commits assignment. Second assignment sees order already assigned / locks order, preventing duplicate or conflicting history. |
| **Delivery Confirmation vs. Cancellation** | Order O is `out_for_delivery` assigned to Rider R. | Rider R marks `delivered` while Admin cancels O. | Serialized execution. One state transition wins cleanly; no contradictory audit timestamps. |
| **Inactive Administrator Invocation** | Admin account A has `is_active = false`. | Admin A invokes `admin_assign_delivery_partner` or `admin_toggle_rider_status`. | Fails immediately with HTTP 403 / PostgreSQL error `42501` (`Access denied`). |
| **Inactive Rider Status Update** | Rider R has `is_active = false`. | Rider R attempts `rider_update_order_status`. | Fails immediately with error `42501` (`Active delivery partner privileges required`). |
| **Self-Deactivation Guard** | Admin A is logged in. | Admin A calls `admin_toggle_rider_status` with their own UUID. | Fails closed with error `23514` (`Administrators cannot deactivate their own account`). |
| **Normal Sequential Workflow** | Active Admin, active Rider R, pending Order O. | Assign O to R $\to$ dispatch to `out_for_delivery` $\to$ confirm `delivered`. | All 3 transitions succeed with correct timestamps in `delivery_assignments`. |

---

## E. Risks and Unresolved Questions

1. **Status Column Type in Live Database:**
   - Repository `schema.sql` defines `order_status` as a PostgreSQL ENUM.
   - User query specifications indicate `public.admin_update_order_status(uuid, text)`.
   - **Verification Requirement:** Confirm whether `orders.status` is typed as `text` with a CHECK constraint or uses the enum in the live database before writing DDL.
2. **Foreign Key & Relationship Between `orders` and `delivery_assignments`:**
   - Both `orders.delivery_partner_id` and table `delivery_assignments` exist.
   - Ensure a unique index exists on `delivery_assignments(order_id, delivery_partner_id)` or appropriate foreign key cascades.
3. **Trigger Conflicts:**
   - Check if any trigger on `orders` (e.g. `trigger_enforce_order_update_security`) fires on status changes and whether it permits updates executed by `SECURITY DEFINER` functions.
