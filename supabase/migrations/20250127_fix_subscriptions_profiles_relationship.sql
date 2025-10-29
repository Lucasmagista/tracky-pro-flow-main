-- ============================================================================
-- FIX: Add proper foreign key relationship between subscriptions and profiles
-- ============================================================================
-- This migration fixes the relationship to allow PostgREST to join
-- profiles with subscriptions directly
-- ============================================================================

-- First, ensure the subscriptions table exists and has the correct structure
-- The user_id in subscriptions should reference profiles(id) instead of auth.users(id)
-- Since profiles.id already references auth.users(id), this creates the proper chain

-- Drop the existing foreign key if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'subscriptions_user_id_fkey' 
    AND table_name = 'subscriptions'
  ) THEN
    ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_user_id_fkey;
  END IF;
END $$;

-- Add the new foreign key that references profiles instead of auth.users
-- This allows PostgREST to automatically detect the relationship
ALTER TABLE subscriptions 
  ADD CONSTRAINT subscriptions_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES profiles(id) 
  ON DELETE CASCADE;

-- Create an index on user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- Add a comment to document the relationship
COMMENT ON CONSTRAINT subscriptions_user_id_fkey ON subscriptions IS 
  'Links subscriptions to profiles (which in turn links to auth.users)';

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
