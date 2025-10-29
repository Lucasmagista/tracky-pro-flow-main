-- ============================================================================
-- ADMIN SYSTEM - Complete Admin Panel Database Structure
-- ============================================================================
-- Migration created: 2025-01-27
-- Description: Comprehensive admin system with roles, permissions, logging, 
--              and system management capabilities
-- ============================================================================

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Admin roles
CREATE TYPE admin_role AS ENUM ('super_admin', 'admin', 'moderator', 'support');

-- Activity types
CREATE TYPE activity_type AS ENUM (
  'user_login', 'user_logout', 'user_register', 'user_update', 'user_delete',
  'subscription_create', 'subscription_update', 'subscription_cancel',
  'order_create', 'order_update', 'order_delete',
  'payment_success', 'payment_failed',
  'integration_connect', 'integration_disconnect',
  'settings_update', 'system_config',
  'admin_action', 'security_event', 'error'
);

-- Log level
CREATE TYPE log_level AS ENUM ('info', 'warning', 'error', 'critical', 'debug');

-- System status
CREATE TYPE system_status AS ENUM ('operational', 'degraded', 'maintenance', 'offline');

-- ============================================================================
-- ADMIN USERS & ROLES
-- ============================================================================

-- Add admin role to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS admin_role admin_role,
ADD COLUMN IF NOT EXISTS admin_since TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_admin_action TIMESTAMPTZ;

-- Create admin_permissions table
CREATE TABLE IF NOT EXISTS admin_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role admin_role NOT NULL DEFAULT 'support',
  permissions JSONB DEFAULT '[]'::jsonb, -- Array of specific permissions
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================================
-- ADMIN ACTIVITY LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  activity_type activity_type NOT NULL DEFAULT 'admin_action',
  description TEXT,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_entity_type TEXT, -- 'user', 'subscription', 'order', etc
  target_entity_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  severity log_level DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX idx_admin_logs_activity_type ON admin_logs(activity_type);
CREATE INDEX idx_admin_logs_target_user ON admin_logs(target_user_id);
CREATE INDEX idx_admin_logs_created_at ON admin_logs(created_at DESC);
CREATE INDEX idx_admin_logs_severity ON admin_logs(severity);

-- ============================================================================
-- USER ACTIVITY TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_type activity_type NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  entity_type TEXT,
  entity_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX idx_user_activities_type ON user_activities(activity_type);
CREATE INDEX idx_user_activities_created_at ON user_activities(created_at DESC);

-- ============================================================================
-- SYSTEM SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  category TEXT NOT NULL, -- 'general', 'security', 'features', 'limits', 'integrations'
  description TEXT,
  data_type TEXT NOT NULL, -- 'string', 'number', 'boolean', 'json', 'array'
  is_public BOOLEAN DEFAULT FALSE, -- Can be accessed by non-admins
  is_editable BOOLEAN DEFAULT TRUE,
  requires_restart BOOLEAN DEFAULT FALSE,
  validation_rules JSONB, -- JSON Schema for validation
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_settings_category ON system_settings(category);
CREATE INDEX idx_system_settings_is_public ON system_settings(is_public);

-- ============================================================================
-- SYSTEM HEALTH & MONITORING
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_health (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  status system_status NOT NULL DEFAULT 'operational',
  component TEXT NOT NULL, -- 'api', 'database', 'cache', 'queue', 'storage'
  message TEXT,
  response_time_ms INTEGER,
  cpu_usage NUMERIC(5,2),
  memory_usage NUMERIC(5,2),
  disk_usage NUMERIC(5,2),
  active_connections INTEGER,
  error_rate NUMERIC(5,2),
  metadata JSONB DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_health_component ON system_health(component);
CREATE INDEX idx_system_health_status ON system_health(status);
CREATE INDEX idx_system_health_checked_at ON system_health(checked_at DESC);

-- ============================================================================
-- ADMIN SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  ended_at TIMESTAMPTZ
);

CREATE INDEX idx_admin_sessions_admin_id ON admin_sessions(admin_id);
CREATE INDEX idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX idx_admin_sessions_active ON admin_sessions(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- SYSTEM NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'info', 'warning', 'error', 'success'
  priority INTEGER DEFAULT 0, -- Higher = more important
  target_role admin_role[], -- Which roles should see this
  is_global BOOLEAN DEFAULT FALSE, -- Show to all admins
  action_url TEXT,
  action_label TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_by UUID[], -- Array of user IDs who read it
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_notifications_is_global ON admin_notifications(is_global);
CREATE INDEX idx_admin_notifications_priority ON admin_notifications(priority DESC);
CREATE INDEX idx_admin_notifications_created_at ON admin_notifications(created_at DESC);

-- ============================================================================
-- BACKUP LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS backup_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  backup_type TEXT NOT NULL, -- 'full', 'incremental', 'manual'
  status TEXT NOT NULL, -- 'started', 'completed', 'failed'
  file_path TEXT,
  file_size_bytes BIGINT,
  tables_included TEXT[],
  records_count INTEGER,
  duration_seconds INTEGER,
  error_message TEXT,
  initiated_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_backup_logs_status ON backup_logs(status);
CREATE INDEX idx_backup_logs_started_at ON backup_logs(started_at DESC);

-- ============================================================================
-- FEATURE FLAGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT FALSE,
  enabled_for_users UUID[], -- Specific users who have access
  enabled_for_plans TEXT[], -- Specific plans that have access
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feature_flags_is_enabled ON feature_flags(is_enabled);

-- ============================================================================
-- RATE LIMITING & ABUSE PREVENTION
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address INET,
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  blocked BOOLEAN DEFAULT FALSE,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  window_end TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_rate_limit_logs_user_id ON rate_limit_logs(user_id);
CREATE INDEX idx_rate_limit_logs_ip ON rate_limit_logs(ip_address);
CREATE INDEX idx_rate_limit_logs_window ON rate_limit_logs(window_start, window_end);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admin_permissions_updated_at 
  BEFORE UPDATE ON admin_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at 
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feature_flags_updated_at 
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Log admin actions automatically
CREATE OR REPLACE FUNCTION log_admin_action()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO admin_logs (
    admin_id,
    action,
    activity_type,
    description,
    target_entity_type,
    target_entity_id,
    metadata
  ) VALUES (
    auth.uid(),
    TG_OP,
    'admin_action',
    'Admin action on ' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object('operation', TG_OP, 'table', TG_TABLE_NAME)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_logs ENABLE ROW LEVEL SECURITY;

-- Admin permissions policies
CREATE POLICY "Admins can view all permissions" ON admin_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );

CREATE POLICY "Super admins can manage permissions" ON admin_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.admin_role = 'super_admin'
    )
  );

-- Admin logs policies
CREATE POLICY "Admins can view all logs" ON admin_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );

CREATE POLICY "System can insert logs" ON admin_logs
  FOR INSERT WITH CHECK (TRUE);

-- User activities policies
CREATE POLICY "Users can view own activities" ON user_activities
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all activities" ON user_activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );

CREATE POLICY "System can insert activities" ON user_activities
  FOR INSERT WITH CHECK (TRUE);

-- System settings policies
CREATE POLICY "Everyone can view public settings" ON system_settings
  FOR SELECT USING (is_public = TRUE);

CREATE POLICY "Admins can view all settings" ON system_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can update settings" ON system_settings
  FOR UPDATE USING (
    is_editable = TRUE AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );

-- System health policies
CREATE POLICY "Admins can view system health" ON system_health
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );

-- Admin sessions policies
CREATE POLICY "Admins can view own sessions" ON admin_sessions
  FOR SELECT USING (auth.uid() = admin_id);

CREATE POLICY "Super admins can view all sessions" ON admin_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.admin_role = 'super_admin'
    )
  );

-- Admin notifications policies
CREATE POLICY "Admins can view relevant notifications" ON admin_notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
      AND (
        is_global = TRUE 
        OR profiles.admin_role = ANY(target_role)
      )
    )
  );

-- Backup logs policies
CREATE POLICY "Admins can view backup logs" ON backup_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );

-- Feature flags policies
CREATE POLICY "Admins can manage feature flags" ON feature_flags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );

-- Rate limit logs policies
CREATE POLICY "Admins can view rate limits" ON rate_limit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default system settings
INSERT INTO system_settings (key, value, category, description, data_type, is_public) VALUES
  ('app.name', '"Tracky Pro Flow"', 'general', 'Application name', 'string', true),
  ('app.version', '"1.0.0"', 'general', 'Current application version', 'string', true),
  ('maintenance.enabled', 'false', 'general', 'Maintenance mode enabled', 'boolean', true),
  ('maintenance.message', '"Sistema em manutenção. Voltamos em breve!"', 'general', 'Maintenance message', 'string', true),
  ('security.max_login_attempts', '5', 'security', 'Maximum login attempts before lockout', 'number', false),
  ('security.lockout_duration_minutes', '30', 'security', 'Account lockout duration in minutes', 'number', false),
  ('security.session_timeout_minutes', '60', 'security', 'Session timeout in minutes', 'number', false),
  ('security.require_2fa_for_admins', 'true', 'security', 'Require 2FA for admin users', 'boolean', false),
  ('features.allow_registration', 'true', 'features', 'Allow new user registration', 'boolean', true),
  ('features.allow_marketplace_integrations', 'true', 'features', 'Allow marketplace integrations', 'boolean', true),
  ('features.allow_exports', 'true', 'features', 'Allow data exports', 'boolean', false),
  ('limits.max_orders_per_import', '1000', 'limits', 'Maximum orders per import', 'number', false),
  ('limits.max_api_calls_per_minute', '60', 'limits', 'Maximum API calls per minute per user', 'number', false),
  ('limits.max_file_upload_mb', '10', 'limits', 'Maximum file upload size in MB', 'number', false),
  ('integrations.stripe_enabled', 'true', 'integrations', 'Enable Stripe integration', 'boolean', false),
  ('integrations.whatsapp_enabled', 'true', 'integrations', 'Enable WhatsApp integration', 'boolean', false),
  ('notifications.email_enabled', 'true', 'integrations', 'Enable email notifications', 'boolean', false),
  ('notifications.sms_enabled', 'false', 'integrations', 'Enable SMS notifications', 'boolean', false)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has specific admin role
CREATE OR REPLACE FUNCTION has_admin_role(required_role admin_role, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND is_admin = TRUE
    AND (
      admin_role = required_role 
      OR admin_role = 'super_admin'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log user activity
CREATE OR REPLACE FUNCTION log_user_activity(
  p_user_id UUID,
  p_activity_type activity_type,
  p_action TEXT,
  p_description TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO user_activities (
    user_id, activity_type, action, description,
    entity_type, entity_id, metadata
  ) VALUES (
    p_user_id, p_activity_type, p_action, p_description,
    p_entity_type, p_entity_id, p_metadata
  ) RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get system statistics
CREATE OR REPLACE FUNCTION get_system_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles),
    'active_users_today', (SELECT COUNT(DISTINCT user_id) FROM user_activities WHERE created_at > NOW() - INTERVAL '1 day'),
    'total_orders', (SELECT COUNT(*) FROM orders),
    'orders_today', (SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '1 day'),
    'total_subscriptions', (SELECT COUNT(*) FROM subscriptions WHERE status = 'active'),
    'revenue_this_month', (SELECT COALESCE(SUM(amount), 0) FROM billing_history WHERE status = 'paid' AND created_at > DATE_TRUNC('month', NOW())),
    'total_integrations', (SELECT COUNT(*) FROM marketplace_integrations WHERE is_active = TRUE),
    'system_errors_today', (SELECT COUNT(*) FROM admin_logs WHERE severity IN ('error', 'critical') AND created_at > NOW() - INTERVAL '1 day')
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE admin_permissions IS 'Admin user permissions and roles';
COMMENT ON TABLE admin_logs IS 'Audit log of all admin actions';
COMMENT ON TABLE user_activities IS 'Log of all user activities';
COMMENT ON TABLE system_settings IS 'Global system configuration settings';
COMMENT ON TABLE system_health IS 'System health and monitoring data';
COMMENT ON TABLE admin_sessions IS 'Active admin sessions tracking';
COMMENT ON TABLE admin_notifications IS 'Notifications for admin users';
COMMENT ON TABLE backup_logs IS 'Database backup history';
COMMENT ON TABLE feature_flags IS 'Feature toggles and rollout management';
COMMENT ON TABLE rate_limit_logs IS 'API rate limiting and abuse tracking';

-- ============================================================================
-- COMPLETION
-- ============================================================================

-- Migration completed successfully
SELECT 'Admin system migration completed successfully!' AS status;
