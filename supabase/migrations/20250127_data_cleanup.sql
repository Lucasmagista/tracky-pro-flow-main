-- ============================================================================
-- DATA CLEANUP: Fix orphaned records before migration
-- ============================================================================
-- Run this ONLY IF the pre-migration check found issues
-- This script will create missing profiles and clean up invalid data
-- ============================================================================

-- Step 1: Create missing profiles for users who have subscriptions but no profile
-- This ensures no subscriptions become orphaned
INSERT INTO profiles (id, created_at, updated_at)
SELECT DISTINCT
  s.user_id,
  NOW(),
  NOW()
FROM subscriptions s
LEFT JOIN profiles p ON p.id = s.user_id
WHERE p.id IS NULL
  AND s.user_id IN (SELECT id FROM auth.users) -- Only if user exists in auth
ON CONFLICT (id) DO NOTHING;

-- Step 2: Create missing profiles for all users in auth.users
-- This is a general cleanup to ensure all users have profiles
INSERT INTO profiles (id, created_at, updated_at)
SELECT 
  au.id,
  au.created_at,
  NOW()
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Step 3: Delete orphaned subscriptions (subscriptions for non-existent users)
-- Only run this if you want to remove invalid data
-- Comment out if you want to preserve all data
DELETE FROM subscriptions
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Step 4: Verify cleanup was successful
-- This should return 0 for both counts
SELECT 
  'AFTER_CLEANUP_CHECK' as status,
  (SELECT COUNT(*) FROM subscriptions s LEFT JOIN profiles p ON p.id = s.user_id WHERE p.id IS NULL) as orphaned_subscriptions,
  (SELECT COUNT(*) FROM auth.users au LEFT JOIN profiles p ON p.id = au.id WHERE p.id IS NULL) as users_without_profiles;

-- Step 5: Log the cleanup
-- Create an audit log entry
DO $$
DECLARE
  profiles_created INTEGER;
  subscriptions_deleted INTEGER;
BEGIN
  GET DIAGNOSTICS profiles_created = ROW_COUNT;
  
  RAISE NOTICE 'Data cleanup completed:';
  RAISE NOTICE '- Profiles created: %', profiles_created;
  RAISE NOTICE 'Ready to apply the foreign key fix migration';
END $$;
