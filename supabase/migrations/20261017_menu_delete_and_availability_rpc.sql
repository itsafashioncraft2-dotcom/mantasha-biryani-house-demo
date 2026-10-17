-- ====================================================================
-- Mantsa Biryani - Menu Management Enhancements
-- Migration: 20261017_menu_delete_and_availability_rpc.sql
-- Description:
--   1. Adds public.admin_delete_menu_item RPC for safe dish deletion.
--   2. Ensures public.admin_toggle_menu_availability RPC is installed and granted.
--   3. Relaxes order_items FK so historical orders remain intact on dish removal.
-- ====================================================================

DO $$
BEGIN
  ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_menu_item_id_fkey;
  ALTER TABLE public.order_items 
    ADD CONSTRAINT order_items_menu_item_id_fkey 
    FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) 
    ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 1. Admin Delete Menu Item RPC
CREATE OR REPLACE FUNCTION public.admin_delete_menu_item(
  p_item_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  -- Verify active administrator
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_caller_id 
      AND LOWER(TRIM(role::TEXT)) = 'admin' 
      AND COALESCE(is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'Access denied: Active administrator privileges required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_item_id IS NULL OR pg_catalog.btrim(p_item_id) = '' THEN
    RAISE EXCEPTION 'Menu item ID cannot be empty.' USING ERRCODE = '23514';
  END IF;

  -- Disassociate prior order items so historic receipts remain preserved
  UPDATE public.order_items
  SET menu_item_id = NULL
  WHERE menu_item_id = p_item_id;

  -- Delete the menu item
  DELETE FROM public.menu_items
  WHERE id = p_item_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'id', p_item_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_menu_item(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_menu_item(TEXT) TO authenticated, service_role;

-- 2. Admin Toggle Menu Availability RPC
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

  -- Verify active administrator
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_caller_id 
      AND LOWER(TRIM(role::TEXT)) = 'admin' 
      AND COALESCE(is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'Access denied: Active administrator privileges required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_item_id IS NULL OR pg_catalog.btrim(p_item_id) = '' THEN
    RAISE EXCEPTION 'Menu item ID cannot be empty.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.menu_items
  SET is_available = p_is_available,
      updated_at = v_updated_at
  WHERE id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Menu item not found.' USING ERRCODE = 'P0002';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'id', p_item_id,
    'is_available', p_is_available
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_toggle_menu_availability(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_toggle_menu_availability(TEXT, BOOLEAN) TO authenticated, service_role;
