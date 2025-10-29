-- Migration: Add user management columns to profiles table
-- Description: Adds columns for suspension, tags, and internal notes management
-- Date: 2025-01-28

-- Add suspension management columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- Add tags column (array of text for categorization)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add internal notes column (for admin-only notes)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Add index for suspended users query
CREATE INDEX IF NOT EXISTS idx_profiles_is_suspended ON profiles(is_suspended) WHERE is_suspended = TRUE;

-- Add index for tags search
CREATE INDEX IF NOT EXISTS idx_profiles_tags ON profiles USING GIN(tags);

-- Create function to auto-unsuspend expired suspensions
CREATE OR REPLACE FUNCTION auto_unsuspend_expired_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET 
    is_suspended = FALSE,
    suspended_until = NULL,
    suspension_reason = NULL
  WHERE 
    is_suspended = TRUE
    AND suspended_until IS NOT NULL
    AND suspended_until < NOW();
END;
$$;

-- Create a scheduled job to check for expired suspensions (runs every hour)
-- Note: This requires pg_cron extension, which may not be available in all Supabase plans
-- Alternative: Run this manually or via a cron job
COMMENT ON FUNCTION auto_unsuspend_expired_users() IS 
'Automatically unsuspends users whose suspension period has expired. 
Should be run periodically via cron or scheduled job.';

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION auto_unsuspend_expired_users() TO service_role;

-- Add comment to explain new columns
COMMENT ON COLUMN profiles.is_suspended IS 'Indicates if the user account is currently suspended';
COMMENT ON COLUMN profiles.suspended_until IS 'Timestamp when the suspension expires (NULL = permanent)';
COMMENT ON COLUMN profiles.suspension_reason IS 'Reason for account suspension (admin use only)';
COMMENT ON COLUMN profiles.tags IS 'Array of tags for user categorization (e.g., ["vip", "problematic", "high-value"])';
COMMENT ON COLUMN profiles.internal_notes IS 'Internal notes about the user (admin use only, not visible to user)';
