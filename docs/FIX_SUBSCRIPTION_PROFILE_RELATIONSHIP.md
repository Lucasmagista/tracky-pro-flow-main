# Fix for Subscription-Profile Relationship Error

## Problem

The error occurs because Supabase's PostgREST cannot find a direct foreign key relationship between `profiles` and `subscriptions` tables when trying to perform embedded queries.

### Error Message

```
Could not find a relationship between 'profiles' and 'subscriptions' in the schema cache
```

## Root Cause

The `subscriptions` table has a foreign key to `auth.users(id)`, but the query is trying to join through `profiles`. Even though `profiles.id` references `auth.users(id)`, PostgREST requires a **direct** foreign key relationship to perform the embedded query.

## Solution

### Step 1: Apply the Migration

Run the migration file in your Supabase SQL Editor:

```bash
# File: supabase/migrations/20250127_fix_subscriptions_profiles_relationship.sql
```

Or execute it directly in Supabase:

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Paste the contents of `20250127_fix_subscriptions_profiles_relationship.sql`
4. Click "Run"

### Step 2: What the Migration Does

1. **Drops** the existing foreign key from `subscriptions.user_id` → `auth.users(id)`
2. **Creates** a new foreign key from `subscriptions.user_id` → `profiles(id)`
3. **Adds** an index on `subscriptions.user_id` for better performance
4. **Notifies** PostgREST to reload the schema cache

### Step 3: Verify the Fix

After running the migration, test the query in your Supabase SQL Editor:

```sql
SELECT
  p.*,
  s.id as subscription_id,
  s.status,
  s.current_period_end,
  pl.name as plan_name
FROM profiles p
LEFT JOIN subscriptions s ON s.user_id = p.id
LEFT JOIN plans pl ON pl.id = s.plan_id
LIMIT 5;
```

Or test the API endpoint directly:

```
GET /rest/v1/profiles?select=*,subscriptions(id,status,current_period_end,plan:plans(name))
```

## Why This Works

- `profiles.id` references `auth.users(id)`
- `subscriptions.user_id` now references `profiles(id)`
- This creates a proper foreign key chain that PostgREST can follow
- The `ON DELETE CASCADE` ensures that when a user is deleted, their profile and subscriptions are also deleted

## Important Notes

### Data Integrity

- The migration will **fail** if there are subscriptions with `user_id` values that don't exist in the `profiles` table
- Before running, ensure all users with subscriptions have corresponding profiles

### Check for Orphaned Subscriptions

Run this query to check for subscriptions without profiles:

```sql
SELECT s.*
FROM subscriptions s
LEFT JOIN profiles p ON p.id = s.user_id
WHERE p.id IS NULL;
```

If any exist, you need to either:

1. Create missing profiles
2. Delete orphaned subscriptions

### Create Missing Profiles

If users exist in `auth.users` but not in `profiles`:

```sql
INSERT INTO profiles (id, created_at, updated_at)
SELECT
  au.id,
  au.created_at,
  NOW()
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
```

## Alternative Solution (If Migration Fails)

If you can't modify the foreign key relationship, you can change the query approach in the code:

### Option 1: Use a different query structure

Instead of embedded queries, use explicit joins:

```typescript
// In src/services/admin.ts
const { data, error } = await supabase
  .from("profiles")
  .select("*")
  .range(from, to)
  .order("created_at", { ascending: false });

// Then fetch subscriptions separately
const userIds = data.map((u) => u.id);
const { data: subscriptions } = await supabase
  .from("subscriptions")
  .select("*, plan:plans(name)")
  .in("user_id", userIds);

// Merge the data in JavaScript
const usersWithSubscriptions = data.map((user) => ({
  ...user,
  subscription: subscriptions?.find((s) => s.user_id === user.id),
}));
```

### Option 2: Create a database view

Create a view that pre-joins the tables:

```sql
CREATE OR REPLACE VIEW profiles_with_subscriptions AS
SELECT
  p.*,
  s.id as subscription_id,
  s.status as subscription_status,
  s.current_period_end,
  pl.id as plan_id,
  pl.name as plan_name
FROM profiles p
LEFT JOIN subscriptions s ON s.user_id = p.id
LEFT JOIN plans pl ON pl.id = s.plan_id;
```

Then query the view instead:

```typescript
const { data } = await supabase.from("profiles_with_subscriptions").select("*");
```

## Testing After Fix

1. **Check the Admin Users page** - it should now load without errors
2. **Verify subscription data** - user subscriptions should display correctly
3. **Test filtering** - try filtering by subscription status
4. **Check performance** - queries should be fast with the new index

## Rollback (If Needed)

If you need to rollback the change:

```sql
-- Drop the new foreign key
ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_user_id_fkey;

-- Restore the old foreign key
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Notify PostgREST
NOTIFY pgrst, 'reload schema';
```

## Related Files

- Migration: `supabase/migrations/20250127_fix_subscriptions_profiles_relationship.sql`
- Service: `src/services/admin.ts` (getAllUsers method)
- Component: `src/pages/admin/AdminUsers.tsx`
