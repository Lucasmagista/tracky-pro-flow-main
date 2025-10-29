# Subscription-Profile Relationship Fix - Summary

## 🔴 Problem Identified

**Error:** `PGRST200 - Could not find a relationship between 'profiles' and 'subscriptions' in the schema cache`

**Location:** Admin Users page (`AdminUsers.tsx`)

**API Call:**

```
GET /rest/v1/profiles?select=*,subscriptions(id,status,current_period_end,plan:plans(name))
```

## 🔍 Root Cause

The Supabase PostgREST API requires a **direct foreign key relationship** to perform embedded queries (joins).

**Current Structure:**

- `profiles.id` → references `auth.users(id)`
- `subscriptions.user_id` → references `auth.users(id)` ❌

**The Problem:**

- Both tables reference `auth.users`, but there's no direct relationship between `profiles` and `subscriptions`
- PostgREST cannot automatically detect the relationship through the intermediate `auth.users` table

## ✅ Solution

Change the foreign key in `subscriptions` to reference `profiles` directly:

**New Structure:**

- `profiles.id` → references `auth.users(id)`
- `subscriptions.user_id` → references `profiles(id)` ✅

This creates a proper chain that PostgREST can follow.

## 📁 Files Created

### 1. Migration Files

- **`20250127_pre_migration_check.sql`** - Check for data integrity issues
- **`20250127_data_cleanup.sql`** - Clean up orphaned records (if needed)
- **`20250127_fix_subscriptions_profiles_relationship.sql`** - Main fix migration

### 2. Helper Scripts

- **`fix-subscription-relationship.ps1`** - PowerShell script to guide through the fix process

### 3. Documentation

- **`docs/FIX_SUBSCRIPTION_PROFILE_RELATIONSHIP.md`** - Complete guide with alternatives and rollback instructions

## 🚀 How to Apply the Fix

### Quick Method (Recommended)

Run the PowerShell helper script:

```powershell
.\fix-subscription-relationship.ps1
```

This will guide you through all steps.

### Manual Method

1. **Check for Issues:**

   - Open `supabase/migrations/20250127_pre_migration_check.sql` in Supabase SQL Editor
   - Run it and review results

2. **Clean Up Data (if needed):**

   - If the check found orphaned records, run `20250127_data_cleanup.sql`

3. **Apply the Fix:**

   - Open `supabase/migrations/20250127_fix_subscriptions_profiles_relationship.sql`
   - Run it in Supabase SQL Editor

4. **Verify:**
   - Refresh your Admin Users page
   - The error should be gone

## 🔧 What the Fix Does

1. **Drops** the existing foreign key: `subscriptions.user_id → auth.users(id)`
2. **Creates** a new foreign key: `subscriptions.user_id → profiles(id)`
3. **Adds** an index on `subscriptions.user_id` for performance
4. **Notifies** PostgREST to reload the schema cache

## ⚠️ Important Notes

- **Data Integrity:** The migration will fail if there are subscriptions without corresponding profiles
- **Pre-check Required:** Always run the pre-migration check first
- **Backup:** Consider taking a database backup before applying
- **Testing:** Test in a development environment first if possible

## 🧪 Verification

After applying the fix, verify it works:

### Test in SQL Editor:

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

### Test the API:

```
GET /rest/v1/profiles?select=*,subscriptions(id,status,current_period_end,plan:plans(name))
```

### Check the Application:

- Navigate to Admin Users page
- Should load without errors
- User subscriptions should display correctly

## 🔄 Alternative Solutions

If you cannot modify the foreign key relationship:

### Option 1: Change the Query

Fetch profiles and subscriptions separately, then merge in JavaScript.

### Option 2: Create a Database View

Create a pre-joined view and query that instead.

See `docs/FIX_SUBSCRIPTION_PROFILE_RELATIONSHIP.md` for detailed alternatives.

## 📊 Impact

- **Fixed:** Admin Users page now loads correctly
- **Performance:** Added index improves query performance
- **Data Integrity:** Ensures all subscriptions have valid profiles
- **Maintainability:** Proper foreign key relationships make the schema clearer

## 🆘 Rollback

If needed, you can rollback the change:

```sql
ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_user_id_fkey;
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;
NOTIFY pgrst, 'reload schema';
```

## 📚 Related Documentation

- Main Guide: `docs/FIX_SUBSCRIPTION_PROFILE_RELATIONSHIP.md`
- Subscription System: `docs/SUBSCRIPTION_SYSTEM_COMPLETE.md`
- Admin Panel: `docs/ADMIN_PANEL_COMPLETE.md`

## ✨ Next Steps

1. Apply the fix using the helper script
2. Test the Admin Users page
3. Verify subscription data displays correctly
4. Consider adding automated tests for this relationship

---

**Created:** 2025-01-27  
**Status:** Ready to apply  
**Priority:** High (blocks Admin Users functionality)
