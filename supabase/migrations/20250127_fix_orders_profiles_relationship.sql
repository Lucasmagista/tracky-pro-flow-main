-- Migration: Fix Orders-Profiles Relationship
-- Description: Add foreign key relationship to enable PostgREST joins between orders and profiles
-- Created: 2025-01-27

-- The issue: orders.user_id references auth.users(id), but we need to join with profiles
-- Since profiles.id also references auth.users(id), we can create a direct relationship

-- Step 1: Drop existing foreign key constraint
ALTER TABLE public.orders 
  DROP CONSTRAINT IF EXISTS orders_user_id_fkey;

-- Step 2: Add foreign key to profiles instead of auth.users
-- This enables PostgREST to discover the relationship
ALTER TABLE public.orders
  ADD CONSTRAINT orders_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

-- Step 3: Create index for better join performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);

-- Step 4: Update RLS policies to work with profiles relationship
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can delete own orders" ON public.orders;

-- Recreate policies (they work the same way)
CREATE POLICY "Users can view own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders" ON public.orders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own orders" ON public.orders
  FOR DELETE USING (auth.uid() = user_id);

-- Step 5: Grant necessary permissions
GRANT SELECT ON public.orders TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.orders TO authenticated;

-- ============================================================================
-- Fix billing_history relationship
-- ============================================================================

-- Step 6: Fix billing_history.user_id to reference profiles
ALTER TABLE public.billing_history 
  DROP CONSTRAINT IF EXISTS billing_history_user_id_fkey;

ALTER TABLE public.billing_history
  ADD CONSTRAINT billing_history_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

-- Step 7: Create index for better join performance
CREATE INDEX IF NOT EXISTS idx_billing_history_user_id ON public.billing_history(user_id);

-- ============================================================================
-- Verify relationships
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'orders_user_id_fkey' 
    AND table_name = 'orders'
  ) AND EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'billing_history_user_id_fkey' 
    AND table_name = 'billing_history'
  ) THEN
    RAISE NOTICE 'All foreign key relationships successfully created';
  ELSE
    RAISE EXCEPTION 'Failed to create one or more foreign key relationships';
  END IF;
END $$;
