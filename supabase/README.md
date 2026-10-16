# Mantsa Biryani - Supabase Integration Guide

This application is designed specifically for **Supabase Authentication + PostgreSQL database** with strict Row-Level Security (RLS).

## 1. Quick Setup Steps

1. **Create a Supabase Project**:
   - Go to [https://supabase.com](https://supabase.com) and create a new project.
   - Choose the region nearest to your customers (e.g., South Asia / Mumbai `ap-south-1`).

2. **Execute Schema SQL**:
   - In your Supabase Dashboard, navigate to the **SQL Editor**.
   - Copy the entire contents of `/supabase/schema.sql` and run it.
   - This creates tables (`profiles`, `menu_items`, `orders`, `order_items`, `delivery_assignments`), indices, and Row-Level Security policies.

3. **Configure Environment Variables**:
   In your `.env` (or environment settings in AI Studio):
   ```env
   VITE_SUPABASE_URL="https://your-project.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-anon-public-key"
   ```
   > ⚠️ **CRITICAL SECURITY RULE**: NEVER paste your `SUPABASE_SERVICE_ROLE_KEY` or database password into frontend files. Only provide the `anon` public key to the browser client.

## 2. Row Level Security (RLS) Structure

| Table | Anonymous Customers | Authenticated Customer | Delivery Partner | Restaurant Admin |
| :--- | :--- | :--- | :--- | :--- |
| `menu_items` | Read-only | Read-only | Read-only | Full CRUD (price, availability) |
| `orders` | Insert order | View own orders | View & update status of assigned orders only | Full CRUD & partner assignment |
| `order_items` | Insert with order | View own order items | View assigned order items | Full access |
| `profiles` | None | Read own profile | Read own profile | Full management |

## 3. Server-Side Price Integrity
Even when clients submit an order, the server/backend recalculates `subtotal`, `delivery_fee`, and `total_amount` using the current price recorded in `menu_items` to guarantee zero client-side tampering.
