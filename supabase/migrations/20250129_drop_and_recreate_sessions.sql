-- Drop existing session management tables and recreate them
-- This fixes the "column user_id does not exist" error

-- Drop triggers first
DROP TRIGGER IF EXISTS update_session_activity_trigger ON admin_session_activities;
DROP TRIGGER IF EXISTS update_admin_sessions_timestamp_trigger ON admin_sessions;

-- Drop functions
DROP FUNCTION IF EXISTS update_session_activity();
DROP FUNCTION IF EXISTS update_admin_session_timestamp();
DROP FUNCTION IF EXISTS revoke_session(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS revoke_all_other_sessions(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS cleanup_expired_sessions();
DROP FUNCTION IF EXISTS cleanup_old_session_activities();
DROP FUNCTION IF EXISTS get_user_active_sessions(UUID);

-- Drop tables
DROP TABLE IF EXISTS admin_session_activities CASCADE;
DROP TABLE IF EXISTS admin_trusted_devices CASCADE;
DROP TABLE IF EXISTS admin_sessions CASCADE;

-- Now recreate everything with correct structure
-- Table for active admin sessions
CREATE TABLE admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  
  -- Device Information
  device_name TEXT,
  device_type TEXT,
  os_name TEXT,
  os_version TEXT,
  browser_name TEXT,
  browser_version TEXT,
  
  -- Location Information
  ip_address INET,
  country TEXT,
  city TEXT,
  timezone TEXT,
  
  -- Session Details
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  
  -- Security
  mfa_verified BOOLEAN DEFAULT false,
  trusted_device BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES profiles(id),
  revoke_reason TEXT
);

-- Table for session activities
CREATE TABLE admin_session_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES admin_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  action TEXT NOT NULL,
  endpoint TEXT,
  method TEXT,
  resource_type TEXT,
  resource_id TEXT,
  
  request_data JSONB,
  response_status INTEGER,
  duration_ms INTEGER,
  
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table for trusted devices
CREATE TABLE admin_trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  device_type TEXT,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  trusted_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, device_fingerprint)
);

-- Indexes
CREATE INDEX idx_admin_sessions_user_id ON admin_sessions(user_id);
CREATE INDEX idx_admin_sessions_is_active ON admin_sessions(is_active) WHERE is_active = true;
CREATE INDEX idx_admin_sessions_session_token ON admin_sessions(session_token);
CREATE INDEX idx_admin_sessions_expires_at ON admin_sessions(expires_at);
CREATE INDEX idx_admin_sessions_last_activity ON admin_sessions(last_activity_at DESC);

CREATE INDEX idx_admin_session_activities_session_id ON admin_session_activities(session_id);
CREATE INDEX idx_admin_session_activities_user_id ON admin_session_activities(user_id);
CREATE INDEX idx_admin_session_activities_created_at ON admin_session_activities(created_at DESC);
CREATE INDEX idx_admin_session_activities_action ON admin_session_activities(action);

CREATE INDEX idx_admin_trusted_devices_user_id ON admin_trusted_devices(user_id);
CREATE INDEX idx_admin_trusted_devices_fingerprint ON admin_trusted_devices(device_fingerprint);

-- RLS Policies
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_session_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_trusted_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view their own sessions"
  ON admin_sessions FOR SELECT
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can revoke their own sessions"
  ON admin_sessions FOR UPDATE
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Super admins can view all sessions"
  ON admin_sessions FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND admin_role = 'super_admin'));

CREATE POLICY "Super admins can revoke any session"
  ON admin_sessions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND admin_role = 'super_admin'));

CREATE POLICY "Admins can view their own activities"
  ON admin_session_activities FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND admin_role IN ('super_admin', 'admin')));

CREATE POLICY "Admins can manage their own trusted devices"
  ON admin_trusted_devices FOR ALL
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Functions (create functions first, triggers after)
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE admin_sessions SET last_activity_at = now() WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_admin_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers (create after tables exist)
CREATE TRIGGER update_session_activity_trigger
  AFTER INSERT ON admin_session_activities
  FOR EACH ROW EXECUTE FUNCTION update_session_activity();

CREATE TRIGGER update_admin_sessions_timestamp_trigger
  BEFORE UPDATE ON admin_sessions
  FOR EACH ROW EXECUTE FUNCTION update_admin_session_timestamp();

CREATE OR REPLACE FUNCTION revoke_session(p_session_id UUID, p_revoked_by UUID, p_reason TEXT DEFAULT NULL)
RETURNS void AS $$
BEGIN
  UPDATE admin_sessions
  SET is_active = false, revoked_at = now(), revoked_by = p_revoked_by, revoke_reason = p_reason
  WHERE id = p_session_id;
  
  INSERT INTO admin_logs (admin_id, action, activity_type, target_entity_type, target_entity_id, description)
  VALUES (p_revoked_by, 'revoke_session', 'admin_action', 'session', p_session_id, COALESCE(p_reason, 'Session revoked manually'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION revoke_all_other_sessions(p_user_id UUID, p_current_session_id UUID, p_reason TEXT DEFAULT 'All other sessions revoked by user')
RETURNS INTEGER AS $$
DECLARE revoked_count INTEGER;
BEGIN
  UPDATE admin_sessions
  SET is_active = false, revoked_at = now(), revoked_by = p_user_id, revoke_reason = p_reason
  WHERE user_id = p_user_id AND id != p_current_session_id AND is_active = true;
  
  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  
  INSERT INTO admin_logs (admin_id, action, activity_type, target_entity_type, target_entity_id, description)
  VALUES (p_user_id, 'revoke_all_sessions', 'admin_action', 'session', p_user_id, format('Revoked %s sessions: %s', revoked_count, p_reason));
  
  RETURN revoked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
  UPDATE admin_sessions SET is_active = false WHERE is_active = true AND expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  DELETE FROM admin_sessions
  WHERE is_active = false AND (revoked_at < now() - INTERVAL '90 days' OR (expires_at IS NOT NULL AND expires_at < now() - INTERVAL '90 days'));
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_old_session_activities()
RETURNS void AS $$
BEGIN
  DELETE FROM admin_session_activities WHERE created_at < now() - INTERVAL '180 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_active_sessions(p_user_id UUID)
RETURNS TABLE (session_count INTEGER, devices JSONB, locations JSONB, last_activity TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  WITH session_data AS (
    SELECT device_type, device_name, browser_name, country, city, last_activity_at
    FROM admin_sessions WHERE admin_sessions.user_id = p_user_id AND is_active = true
  ),
  device_list AS (
    SELECT DISTINCT jsonb_build_object('type', device_type, 'name', device_name, 'browser', browser_name) as device_info
    FROM session_data WHERE device_type IS NOT NULL OR device_name IS NOT NULL OR browser_name IS NOT NULL
  ),
  location_list AS (
    SELECT DISTINCT jsonb_build_object('country', country, 'city', city) as location_info
    FROM session_data WHERE country IS NOT NULL OR city IS NOT NULL
  )
  SELECT
    (SELECT COUNT(*)::INTEGER FROM session_data) as session_count,
    (SELECT jsonb_agg(device_info) FROM device_list) as devices,
    (SELECT jsonb_agg(location_info) FROM location_list) as locations,
    (SELECT MAX(last_activity_at) FROM session_data) as last_activity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE admin_sessions IS 'Tracks active admin sessions with device and location information';
COMMENT ON TABLE admin_session_activities IS 'Detailed activity log for each admin session';
COMMENT ON TABLE admin_trusted_devices IS 'User-trusted devices that skip additional security checks';
COMMENT ON FUNCTION revoke_session IS 'Revoke a specific admin session';
COMMENT ON FUNCTION revoke_all_other_sessions IS 'Revoke all sessions except the current one';
COMMENT ON FUNCTION cleanup_expired_sessions IS 'Clean up expired and old inactive sessions';
COMMENT ON COLUMN admin_sessions.session_token IS 'Unique token identifying this session';
COMMENT ON COLUMN admin_sessions.trusted_device IS 'Whether this session is from a trusted device';
COMMENT ON COLUMN admin_sessions.mfa_verified IS 'Whether MFA was verified for this session';
