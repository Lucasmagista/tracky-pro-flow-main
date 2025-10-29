-- ============================================================================
-- PRE-MIGRATION CHECK: Verify data integrity before fixing relationships
-- ============================================================================
-- Run this script BEFORE applying the fix migration to identify any issues
-- ============================================================================

-- 1. Check for orphaned subscriptions (subscriptions without profiles)
SELECT 
  'ORPHANED_SUBSCRIPTIONS' as check_type,
  COUNT(*) as count
FROM subscriptions s
LEFT JOIN profiles p ON p.id = s.user_id
WHERE p.id IS NULL;

-- 2. Show details of orphaned subscriptions if any
SELECT 
  'ORPHANED_SUBSCRIPTION_DETAILS' as info,
  s.id,
  s.user_id,
  s.status,
  s.created_at
FROM subscriptions s
LEFT JOIN profiles p ON p.id = s.user_id
WHERE p.id IS NULL;

-- 3. Check for users without profiles
SELECT 
  'USERS_WITHOUT_PROFILES' as check_type,
  COUNT(*) as count
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE p.id IS NULL;

-- 4. Show details of users without profiles
SELECT 
  'USER_WITHOUT_PROFILE_DETAILS' as info,
  au.id,
  au.email,
  au.created_at
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE p.id IS NULL;

-- 5. Check current foreign key constraints on subscriptions
SELECT
  'CURRENT_CONSTRAINTS' as info,
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'subscriptions';

-- 6. Summary
SELECT 
  'SUMMARY' as info,
  (SELECT COUNT(*) FROM profiles) as total_profiles,
  (SELECT COUNT(*) FROM subscriptions) as total_subscriptions,
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(*) FROM subscriptions s LEFT JOIN profiles p ON p.id = s.user_id WHERE p.id IS NULL) as orphaned_subscriptions,
  (SELECT COUNT(*) FROM auth.users au LEFT JOIN profiles p ON p.id = au.id WHERE p.id IS NULL) as users_without_profiles;
