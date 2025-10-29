-- Migration: Add cancelled_at column to subscriptions
-- Description: Adds cancelled_at timestamp to track when subscriptions were cancelled
-- Date: 2025-01-28

-- Add cancelled_at column
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Create index for cancelled subscriptions queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_cancelled_at ON subscriptions(cancelled_at) WHERE cancelled_at IS NOT NULL;

-- Add comment
COMMENT ON COLUMN subscriptions.cancelled_at IS 'Timestamp when the subscription was cancelled';

-- Update existing cancelled subscriptions to set cancelled_at = updated_at
UPDATE subscriptions 
SET cancelled_at = updated_at 
WHERE status = 'cancelled' 
  AND cancelled_at IS NULL;
