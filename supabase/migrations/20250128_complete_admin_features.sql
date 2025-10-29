-- ============================================================================
-- COMPLETE ADMIN FEATURES - Additional Tables and Columns
-- ============================================================================
-- Migration created: 2025-01-28
-- Description: Add missing tables and columns for full admin functionality
-- ============================================================================

-- ============================================================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add trial_ends_at to subscriptions table
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Add metadata column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for metadata searches
CREATE INDEX IF NOT EXISTS idx_orders_metadata ON orders USING gin(metadata);

-- ============================================================================
-- NOTIFICATION QUEUE TABLE
-- ============================================================================

-- Notification status enum
DO $$ BEGIN
  CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Notification type enum
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'order_update', 'subscription_expiring', 'payment_failed', 
    'integration_error', 'security_alert', 'system_maintenance',
    'welcome', 'trial_ending', 'plan_upgraded', 'custom'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create notification_queue table
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status notification_status DEFAULT 'pending',
  priority INTEGER DEFAULT 0, -- 0=low, 1=normal, 2=high, 3=urgent
  
  -- Delivery channels
  send_email BOOLEAN DEFAULT FALSE,
  send_push BOOLEAN DEFAULT FALSE,
  send_sms BOOLEAN DEFAULT FALSE,
  send_whatsapp BOOLEAN DEFAULT FALSE,
  
  -- Scheduling
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  
  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notification_queue
CREATE INDEX IF NOT EXISTS idx_notification_queue_user_id ON notification_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_type ON notification_queue(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled ON notification_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_queue_created ON notification_queue(created_at DESC);

-- ============================================================================
-- USER NOTIFICATIONS TABLE (In-App Notifications)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  notification_type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- Action button (optional)
  action_url TEXT,
  action_label TEXT,
  
  -- Priority and styling
  priority INTEGER DEFAULT 0,
  icon TEXT, -- Icon name from lucide-react
  color TEXT, -- Badge color: default, primary, success, warning, danger
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Expiration
  expires_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user_notifications
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_is_read ON user_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created ON user_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON user_notifications(user_id, is_read) WHERE is_read = FALSE;

-- ============================================================================
-- NOTIFICATION TEMPLATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  
  -- Template content (supports variables like {{user_name}}, {{order_id}})
  subject_template TEXT,
  email_template TEXT,
  sms_template TEXT,
  push_template TEXT,
  whatsapp_template TEXT,
  
  -- Default settings
  default_channels JSONB DEFAULT '{"email": true, "push": false, "sms": false, "whatsapp": false}'::jsonb,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  variables JSONB DEFAULT '[]'::jsonb, -- List of available variables
  description TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add notification_type column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_templates' AND column_name = 'notification_type'
  ) THEN
    ALTER TABLE notification_templates 
    ADD COLUMN notification_type notification_type;
  END IF;
END $$;

-- ============================================================================
-- SCHEDULED REPORTS TABLE
-- ============================================================================

-- Report frequency enum
DO $$ BEGIN
  CREATE TYPE report_frequency AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Report format enum
DO $$ BEGIN
  CREATE TYPE report_format AS ENUM ('csv', 'excel', 'pdf', 'json');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Report type
  report_type TEXT NOT NULL, -- 'users', 'orders', 'revenue', 'subscriptions', 'custom'
  
  -- Query configuration
  query_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Schedule
  frequency report_frequency NOT NULL,
  cron_expression TEXT, -- For custom schedules
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  
  -- Recipients
  recipient_emails TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Format
  format report_format DEFAULT 'csv',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================================
-- REPORT HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS report_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scheduled_report_id UUID REFERENCES scheduled_reports(id) ON DELETE CASCADE,
  
  -- Execution details
  status TEXT NOT NULL, -- 'success', 'failed', 'running'
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  
  -- Results
  file_url TEXT, -- S3/Storage URL
  file_size BIGINT, -- in bytes
  row_count INTEGER,
  
  -- Error tracking
  error_message TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_history_scheduled_report ON report_history(scheduled_report_id);
CREATE INDEX IF NOT EXISTS idx_report_history_created ON report_history(created_at DESC);

-- ============================================================================
-- CUSTOM QUERIES TABLE (Query Builder)
-- ============================================================================

CREATE TABLE IF NOT EXISTS custom_queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Query definition
  query_json JSONB NOT NULL, -- Structured query builder JSON
  sql_query TEXT, -- Generated SQL (read-only, for reference)
  
  -- Metadata
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_public BOOLEAN DEFAULT FALSE, -- Share with other admins
  is_favorite BOOLEAN DEFAULT FALSE,
  
  -- Usage stats
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_custom_queries_created_by ON custom_queries(created_by);
CREATE INDEX IF NOT EXISTS idx_custom_queries_is_public ON custom_queries(is_public) WHERE is_public = TRUE;

-- ============================================================================
-- INTEGRATION MONITORING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS integration_monitoring (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Health metrics
  status TEXT NOT NULL, -- 'healthy', 'degraded', 'down', 'unauthorized'
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  consecutive_failures INTEGER DEFAULT 0,
  
  -- Performance metrics
  avg_response_time INTEGER, -- in milliseconds
  success_rate DECIMAL(5,2), -- percentage
  total_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  
  -- Error tracking
  last_error_message TEXT,
  last_error_code TEXT,
  
  -- Rate limiting
  rate_limit_remaining INTEGER,
  rate_limit_reset_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_check_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_monitoring_integration ON integration_monitoring(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_monitoring_user ON integration_monitoring(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_monitoring_status ON integration_monitoring(status);

-- ============================================================================
-- INTEGRATION LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS integration_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Request details
  method TEXT NOT NULL, -- GET, POST, etc
  endpoint TEXT NOT NULL,
  request_headers JSONB,
  request_body JSONB,
  
  -- Response details
  status_code INTEGER,
  response_headers JSONB,
  response_body JSONB,
  response_time INTEGER, -- in milliseconds
  
  -- Status
  success BOOLEAN NOT NULL,
  error_message TEXT,
  
  -- Metadata
  action_type TEXT, -- 'sync', 'webhook', 'manual', 'scheduled'
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_logs_integration ON integration_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_user ON integration_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created ON integration_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_success ON integration_logs(success);

-- ============================================================================
-- API USAGE TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Endpoint info
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  
  -- Usage metrics
  request_count INTEGER DEFAULT 1,
  total_response_time INTEGER DEFAULT 0, -- in milliseconds
  
  -- Time bucket (for aggregation)
  bucket_date DATE NOT NULL,
  bucket_hour INTEGER, -- 0-23
  
  -- Metadata
  user_agent TEXT,
  ip_address INET,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, endpoint, method, bucket_date, bucket_hour)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_bucket ON api_usage(bucket_date, bucket_hour);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage(endpoint);

-- ============================================================================
-- COHORT ANALYSIS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS cohort_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Cohort definition
  cohort_name TEXT NOT NULL,
  cohort_period DATE NOT NULL, -- First day of the cohort (e.g., signup month)
  
  -- Metrics by period offset
  period_offset INTEGER NOT NULL, -- 0 = first period, 1 = second, etc
  
  -- User counts
  total_users INTEGER NOT NULL,
  active_users INTEGER NOT NULL,
  churned_users INTEGER NOT NULL,
  
  -- Revenue metrics
  total_revenue DECIMAL(12,2) DEFAULT 0,
  avg_revenue_per_user DECIMAL(12,2) DEFAULT 0,
  
  -- Retention metrics
  retention_rate DECIMAL(5,2), -- percentage
  churn_rate DECIMAL(5,2), -- percentage
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(cohort_period, period_offset)
);

CREATE INDEX IF NOT EXISTS idx_cohort_analysis_period ON cohort_analysis(cohort_period);
CREATE INDEX IF NOT EXISTS idx_cohort_analysis_offset ON cohort_analysis(period_offset);

-- ============================================================================
-- EXPORT JOBS TABLE
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE export_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS export_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Job details
  export_type TEXT NOT NULL, -- 'users', 'orders', 'subscriptions', 'custom_query'
  format report_format NOT NULL,
  
  -- Filters
  filters JSONB DEFAULT '{}'::jsonb,
  
  -- Status
  status export_status DEFAULT 'pending',
  
  -- Progress
  total_rows INTEGER,
  processed_rows INTEGER DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0,
  
  -- Results
  file_url TEXT,
  file_size BIGINT,
  expires_at TIMESTAMPTZ, -- Download link expiration
  
  -- Error tracking
  error_message TEXT,
  
  -- User info
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_created_by ON export_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_created ON export_jobs(created_at DESC);

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================

-- Auto-update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for all new tables (with error handling)
DO $$ 
BEGIN
  -- notification_queue trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_notification_queue_updated_at') THEN
    CREATE TRIGGER update_notification_queue_updated_at BEFORE UPDATE ON notification_queue
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- user_notifications trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_notifications_updated_at') THEN
    CREATE TRIGGER update_user_notifications_updated_at BEFORE UPDATE ON user_notifications
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- notification_templates trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_notification_templates_updated_at') THEN
    CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON notification_templates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- scheduled_reports trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_scheduled_reports_updated_at') THEN
    CREATE TRIGGER update_scheduled_reports_updated_at BEFORE UPDATE ON scheduled_reports
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- custom_queries trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_custom_queries_updated_at') THEN
    CREATE TRIGGER update_custom_queries_updated_at BEFORE UPDATE ON custom_queries
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- integration_monitoring trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_integration_monitoring_updated_at') THEN
    CREATE TRIGGER update_integration_monitoring_updated_at BEFORE UPDATE ON integration_monitoring
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- api_usage trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_api_usage_updated_at') THEN
    CREATE TRIGGER update_api_usage_updated_at BEFORE UPDATE ON api_usage
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own notifications" ON user_notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON user_notifications;
DROP POLICY IF EXISTS "Users can view their own queries" ON custom_queries;
DROP POLICY IF EXISTS "Users can manage their own queries" ON custom_queries;
DROP POLICY IF EXISTS "Users can view their own export jobs" ON export_jobs;
DROP POLICY IF EXISTS "Users can create export jobs" ON export_jobs;
DROP POLICY IF EXISTS "Admins can view all notifications" ON notification_queue;
DROP POLICY IF EXISTS "Admins can manage notification templates" ON notification_templates;
DROP POLICY IF EXISTS "Admins can manage scheduled reports" ON scheduled_reports;
DROP POLICY IF EXISTS "Admins can view report history" ON report_history;
DROP POLICY IF EXISTS "Admins can view integration monitoring" ON integration_monitoring;
DROP POLICY IF EXISTS "Admins can view integration logs" ON integration_logs;
DROP POLICY IF EXISTS "Admins can view API usage" ON api_usage;
DROP POLICY IF EXISTS "Admins can view cohort analysis" ON cohort_analysis;

-- Policies for user_notifications (users see their own)
CREATE POLICY "Users can view their own notifications"
  ON user_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON user_notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies for custom_queries (users see their own + public)
CREATE POLICY "Users can view their own queries"
  ON custom_queries FOR SELECT
  USING (auth.uid() = created_by OR is_public = TRUE);

CREATE POLICY "Users can manage their own queries"
  ON custom_queries FOR ALL
  USING (auth.uid() = created_by);

-- Policies for export_jobs (users see their own)
CREATE POLICY "Users can view their own export jobs"
  ON export_jobs FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create export jobs"
  ON export_jobs FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Admin policies (admins can see everything)
CREATE POLICY "Admins can view all notifications"
  ON notification_queue FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can manage notification templates"
  ON notification_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can manage scheduled reports"
  ON scheduled_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can view report history"
  ON report_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can view integration monitoring"
  ON integration_monitoring FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can view integration logs"
  ON integration_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can view API usage"
  ON api_usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can view cohort analysis"
  ON cohort_analysis FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE id = notification_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS VOID AS $$
BEGIN
  UPDATE user_notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE user_id = auth.uid() AND is_read = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM user_notifications
    WHERE user_id = auth.uid() AND is_read = FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean expired notifications
CREATE OR REPLACE FUNCTION clean_expired_notifications()
RETURNS VOID AS $$
BEGIN
  DELETE FROM user_notifications
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Insert default notification templates (with error handling)
DO $$ 
BEGIN
  -- Only insert if notification_type column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_templates' AND column_name = 'notification_type'
  ) THEN
    INSERT INTO notification_templates (name, notification_type, subject_template, email_template, description, variables)
    VALUES 
      (
        'welcome_email',
        'welcome',
        'Bem-vindo ao Tracky Pro, {{user_name}}!',
        '<h1>Olá {{user_name}}!</h1><p>Seja bem-vindo ao Tracky Pro. Estamos felizes em tê-lo conosco.</p>',
        'Email de boas-vindas para novos usuários',
        '["user_name", "user_email"]'::jsonb
      ),
      (
        'trial_ending',
        'trial_ending',
        'Seu período de teste termina em {{days_remaining}} dias',
        '<h1>Atenção {{user_name}}</h1><p>Seu período de teste termina em {{days_remaining}} dias. Não perca acesso às funcionalidades premium!</p>',
        'Alerta de término de período de teste',
        '["user_name", "days_remaining", "plan_name"]'::jsonb
      ),
      (
        'payment_failed',
        'payment_failed',
        'Problema com seu pagamento',
        '<h1>Olá {{user_name}}</h1><p>Detectamos um problema com seu pagamento. Por favor, atualize suas informações de pagamento.</p>',
        'Notificação de falha no pagamento',
        '["user_name", "amount", "error_message"]'::jsonb
      )
    ON CONFLICT (name) DO NOTHING;
  ELSE
    -- If column doesn't exist yet, insert without notification_type
    INSERT INTO notification_templates (name, subject_template, email_template, description, variables)
    VALUES 
      (
        'welcome_email',
        'Bem-vindo ao Tracky Pro, {{user_name}}!',
        '<h1>Olá {{user_name}}!</h1><p>Seja bem-vindo ao Tracky Pro. Estamos felizes em tê-lo conosco.</p>',
        'Email de boas-vindas para novos usuários',
        '["user_name", "user_email"]'::jsonb
      ),
      (
        'trial_ending',
        'Seu período de teste termina em {{days_remaining}} dias',
        '<h1>Atenção {{user_name}}</h1><p>Seu período de teste termina em {{days_remaining}} dias. Não perca acesso às funcionalidades premium!</p>',
        'Alerta de término de período de teste',
        '["user_name", "days_remaining", "plan_name"]'::jsonb
      ),
      (
        'payment_failed',
        'Problema com seu pagamento',
        '<h1>Olá {{user_name}}</h1><p>Detectamos um problema com seu pagamento. Por favor, atualize suas informações de pagamento.</p>',
        'Notificação de falha no pagamento',
        '["user_name", "amount", "error_message"]'::jsonb
      )
    ON CONFLICT (name) DO NOTHING;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Silently ignore errors in sample data insertion
    NULL;
END $$;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE notification_queue IS 'Queue for outgoing notifications (email, SMS, push, WhatsApp)';
COMMENT ON TABLE user_notifications IS 'In-app notifications shown to users';
COMMENT ON TABLE notification_templates IS 'Reusable templates for notifications';
COMMENT ON TABLE scheduled_reports IS 'Automated report generation configuration';
COMMENT ON TABLE report_history IS 'History of generated reports';
COMMENT ON TABLE custom_queries IS 'User-defined custom queries for data analysis';
COMMENT ON TABLE integration_monitoring IS 'Real-time monitoring of integration health';
COMMENT ON TABLE integration_logs IS 'Detailed logs of all integration API calls';
COMMENT ON TABLE api_usage IS 'Track API usage for rate limiting and analytics';
COMMENT ON TABLE cohort_analysis IS 'Pre-calculated cohort retention and revenue metrics';
COMMENT ON TABLE export_jobs IS 'Background jobs for data export';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
