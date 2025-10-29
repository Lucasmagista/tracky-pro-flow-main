-- Migration: Create MFA (Multi-Factor Authentication) tables for admin security
-- Created: 2025-01-29
-- Description: Implements TOTP-based 2FA with backup codes

-- Table for MFA configurations
CREATE TABLE IF NOT EXISTS admin_mfa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  secret TEXT NOT NULL, -- TOTP secret (encrypted)
  enabled BOOLEAN DEFAULT false,
  verified BOOLEAN DEFAULT false,
  backup_codes TEXT[], -- Encrypted backup codes (one-time use)
  used_backup_codes TEXT[], -- Track used codes
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id)
);

-- Table for MFA verification attempts (security log)
CREATE TABLE IF NOT EXISTS admin_mfa_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  attempt_type TEXT NOT NULL, -- 'totp', 'backup_code', 'recovery'
  success BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_mfa_user_id ON admin_mfa(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_mfa_enabled ON admin_mfa(enabled);
CREATE INDEX IF NOT EXISTS idx_admin_mfa_attempts_user_id ON admin_mfa_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_mfa_attempts_created_at ON admin_mfa_attempts(created_at DESC);

-- RLS Policies (admins can only manage their own MFA)
ALTER TABLE admin_mfa ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_mfa_attempts ENABLE ROW LEVEL SECURITY;

-- Admins can only read/update their own MFA settings
CREATE POLICY "Admins can manage their own MFA"
  ON admin_mfa
  FOR ALL
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- Admins can view their own MFA attempts
CREATE POLICY "Admins can view their own MFA attempts"
  ON admin_mfa_attempts
  FOR SELECT
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- Super admins can view all MFA attempts (for security monitoring)
CREATE POLICY "Super admins can view all MFA attempts"
  ON admin_mfa_attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND admin_role = 'super_admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_admin_mfa_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
CREATE TRIGGER update_admin_mfa_timestamp_trigger
  BEFORE UPDATE ON admin_mfa
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_mfa_timestamp();

-- Function to clean old MFA attempts (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_mfa_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM admin_mfa_attempts
  WHERE created_at < now() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE admin_mfa IS 'Stores MFA (2FA) configuration for admin users';
COMMENT ON TABLE admin_mfa_attempts IS 'Logs all MFA verification attempts for security audit';
COMMENT ON COLUMN admin_mfa.secret IS 'TOTP secret key (should be encrypted at application level)';
COMMENT ON COLUMN admin_mfa.backup_codes IS 'One-time backup codes for account recovery';
COMMENT ON COLUMN admin_mfa.enabled IS 'Whether MFA is active for this admin';
COMMENT ON COLUMN admin_mfa.verified IS 'Whether the admin has successfully verified their MFA setup';
