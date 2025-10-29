-- Migration: Update orders table for admin analytics
-- Description: Adds necessary columns to existing orders table for admin analytics
-- Date: 2025-01-28

-- Add missing columns to existing orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Update profile_id with user_id values if profile_id is null
UPDATE orders SET profile_id = user_id WHERE profile_id IS NULL AND user_id IS NOT NULL;

-- Make order_number unique if not already
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'orders_order_number_key'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_profile_id ON orders(profile_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_total_amount ON orders(total_amount);

-- Update trigger for updated_at if not exists
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON orders;
CREATE TRIGGER trigger_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_orders_updated_at();

-- Add RLS policies for profile_id if not exists
DO $$
BEGIN
  -- Admins can view all orders via profile_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'orders' 
    AND policyname = 'Admins can view all orders via profile_id'
  ) THEN
    CREATE POLICY "Admins can view all orders via profile_id"
      ON orders FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
          AND is_admin = true
        )
        OR auth.uid() = profile_id
      );
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN orders.profile_id IS 'User who placed the order (references profiles.id)';
COMMENT ON COLUMN orders.order_number IS 'Unique order identifier (e.g., ORD-2025-0001)';
COMMENT ON COLUMN orders.total_amount IS 'Total order value';
COMMENT ON COLUMN orders.items IS 'Order items as JSON array';
COMMENT ON COLUMN orders.shipping_address IS 'Shipping address as JSON object';
COMMENT ON COLUMN orders.notes IS 'Internal admin notes about the order';
COMMENT ON COLUMN orders.completed_at IS 'Timestamp when order was completed';
COMMENT ON COLUMN orders.cancelled_at IS 'Timestamp when order was cancelled';
