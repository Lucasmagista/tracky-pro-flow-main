-- Migration: Create IP Whitelisting tables for admin access control
-- Created: 2025-01-29
-- Description: Implements IP-based access control for enhanced admin security

-- Table for allowed IP addresses
CREATE TABLE IF NOT EXISTS admin_allowed_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET NOT NULL UNIQUE,
  ip_range CIDR, -- For IP ranges (e.g., 192.168.1.0/24)
  description TEXT,
  added_by UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ, -- Optional expiration
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure either ip_address or ip_range is set
  CONSTRAINT check_ip_or_range CHECK (
    (ip_address IS NOT NULL AND ip_range IS NULL) OR
    (ip_address IS NULL AND ip_range IS NOT NULL)
  )
);

-- Table for IP access attempts (successful and blocked)
CREATE TABLE IF NOT EXISTS admin_ip_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ip_address INET NOT NULL,
  access_granted BOOLEAN NOT NULL,
  blocked_reason TEXT, -- Why access was denied
  user_agent TEXT,
  endpoint TEXT, -- Which admin endpoint was accessed
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table for auto-blocked IPs (rate limiting, suspicious activity)
CREATE TABLE IF NOT EXISTS admin_blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET NOT NULL UNIQUE,
  block_reason TEXT NOT NULL,
  blocked_by UUID REFERENCES profiles(id), -- NULL if auto-blocked
  failed_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  blocked_until TIMESTAMPTZ, -- Temporary blocks
  is_permanent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_allowed_ips_active ON admin_allowed_ips(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_admin_allowed_ips_ip_address ON admin_allowed_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_admin_ip_access_log_user_id ON admin_ip_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_ip_access_log_ip_address ON admin_ip_access_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_admin_ip_access_log_created_at ON admin_ip_access_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_blocked_ips_ip_address ON admin_blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_admin_blocked_ips_blocked_until ON admin_blocked_ips(blocked_until);

-- RLS Policies
ALTER TABLE admin_allowed_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_ip_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_blocked_ips ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage allowed IPs
CREATE POLICY "Super admins can manage allowed IPs"
  ON admin_allowed_ips
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND admin_role = 'super_admin'
    )
  );

-- Admins can view their own access logs
CREATE POLICY "Admins can view their own IP access logs"
  ON admin_ip_access_log
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND admin_role IN ('super_admin', 'admin')
    )
  );

-- Super admins can view all IP access logs
CREATE POLICY "Super admins can view all IP access logs"
  ON admin_ip_access_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND admin_role = 'super_admin'
    )
  );

-- Super admins can manage blocked IPs
CREATE POLICY "Super admins can manage blocked IPs"
  ON admin_blocked_ips
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND admin_role = 'super_admin'
    )
  );

-- Function to check if IP is allowed
CREATE OR REPLACE FUNCTION is_ip_allowed(check_ip INET)
RETURNS BOOLEAN AS $$
DECLARE
  is_allowed BOOLEAN := false;
  is_blocked BOOLEAN := false;
BEGIN
  -- First check if IP is blocked
  SELECT EXISTS (
    SELECT 1 FROM admin_blocked_ips
    WHERE ip_address = check_ip
    AND (
      is_permanent = true
      OR (blocked_until IS NOT NULL AND blocked_until > now())
    )
  ) INTO is_blocked;

  IF is_blocked THEN
    RETURN false;
  END IF;

  -- Check if IP is in whitelist (exact match or range)
  SELECT EXISTS (
    SELECT 1 FROM admin_allowed_ips
    WHERE is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (
      ip_address = check_ip
      OR (ip_range IS NOT NULL AND check_ip << ip_range)
    )
  ) INTO is_allowed;

  RETURN is_allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log IP access attempt
CREATE OR REPLACE FUNCTION log_ip_access(
  p_user_id UUID,
  p_ip_address INET,
  p_access_granted BOOLEAN,
  p_blocked_reason TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_endpoint TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO admin_ip_access_log (
    user_id,
    ip_address,
    access_granted,
    blocked_reason,
    user_agent,
    endpoint
  ) VALUES (
    p_user_id,
    p_ip_address,
    p_access_granted,
    p_blocked_reason,
    p_user_agent,
    p_endpoint
  );

  -- If access was denied, check if we should auto-block
  IF p_access_granted = false THEN
    -- Count failed attempts in last hour
    DECLARE
      failed_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO failed_count
      FROM admin_ip_access_log
      WHERE ip_address = p_ip_address
      AND access_granted = false
      AND created_at > now() - INTERVAL '1 hour';

      -- Auto-block after 5 failed attempts
      IF failed_count >= 5 THEN
        INSERT INTO admin_blocked_ips (
          ip_address,
          block_reason,
          failed_attempts,
          last_attempt_at,
          blocked_until,
          is_permanent
        ) VALUES (
          p_ip_address,
          'Auto-blocked: Too many failed access attempts',
          failed_count,
          now(),
          now() + INTERVAL '24 hours', -- Block for 24 hours
          false
        )
        ON CONFLICT (ip_address) 
        DO UPDATE SET
          failed_attempts = admin_blocked_ips.failed_attempts + 1,
          last_attempt_at = now(),
          blocked_until = now() + INTERVAL '24 hours';
      END IF;
    END;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_admin_ip_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_admin_allowed_ips_timestamp_trigger
  BEFORE UPDATE ON admin_allowed_ips
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_ip_timestamp();

CREATE TRIGGER update_admin_blocked_ips_timestamp_trigger
  BEFORE UPDATE ON admin_blocked_ips
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_ip_timestamp();

-- Function to cleanup old access logs (keep last 180 days)
CREATE OR REPLACE FUNCTION cleanup_old_ip_access_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM admin_ip_access_log
  WHERE created_at < now() - INTERVAL '180 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired blocks
CREATE OR REPLACE FUNCTION cleanup_expired_ip_blocks()
RETURNS void AS $$
BEGIN
  DELETE FROM admin_blocked_ips
  WHERE is_permanent = false
  AND blocked_until IS NOT NULL
  AND blocked_until < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE admin_allowed_ips IS 'Whitelist of IP addresses allowed to access admin panel';
COMMENT ON TABLE admin_ip_access_log IS 'Logs all admin access attempts with IP addresses';
COMMENT ON TABLE admin_blocked_ips IS 'IPs that are blocked from accessing admin panel';
COMMENT ON FUNCTION is_ip_allowed IS 'Checks if an IP address is allowed to access admin panel';
COMMENT ON FUNCTION log_ip_access IS 'Logs an IP access attempt and auto-blocks after too many failures';
COMMENT ON COLUMN admin_allowed_ips.ip_range IS 'Use CIDR notation for IP ranges (e.g., 192.168.1.0/24)';
COMMENT ON COLUMN admin_blocked_ips.blocked_until IS 'For temporary blocks. NULL means check is_permanent';
