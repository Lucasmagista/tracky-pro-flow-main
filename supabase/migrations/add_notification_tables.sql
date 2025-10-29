-- Create notification_templates table
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('email', 'whatsapp')),
  subject VARCHAR(500),
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notification_logs table
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('email', 'whatsapp')),
  recipient VARCHAR(500) NOT NULL,
  subject VARCHAR(500),
  status VARCHAR(50) NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  provider_response JSONB,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scheduled_notifications table
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES notification_templates(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('email', 'whatsapp')),
  recipient VARCHAR(500) NOT NULL,
  variables JSONB DEFAULT '{}',
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notification_templates_user_id ON notification_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON notification_templates(type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_user_id ON scheduled_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_scheduled_at ON scheduled_notifications(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_status ON scheduled_notifications(status);

-- Enable RLS (Row Level Security)
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own notification templates" ON notification_templates
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own notification logs" ON notification_logs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own scheduled notifications" ON scheduled_notifications
  FOR ALL USING (auth.uid() = user_id);

-- Create tracking_cache table
CREATE TABLE IF NOT EXISTS tracking_cache (
  tracking_code VARCHAR(50) PRIMARY KEY,
  carrier VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  events JSONB DEFAULT '[]',
  estimated_delivery TIMESTAMP WITH TIME ZONE,
  last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tracking_webhooks table
CREATE TABLE IF NOT EXISTS tracking_webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  carrier VARCHAR(50) NOT NULL,
  tracking_code VARCHAR(50) NOT NULL,
  webhook_url TEXT NOT NULL,
  secret_key VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_triggered TIMESTAMP WITH TIME ZONE,
  UNIQUE(carrier, tracking_code)
);

-- Create proactive_alerts table
CREATE TABLE IF NOT EXISTS proactive_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('delay_warning', 'delivery_reminder', 'status_change', 'exception_alert')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_read BOOLEAN DEFAULT false,
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  action_taken BOOLEAN DEFAULT false,
  action_details JSONB
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tracking_cache_carrier ON tracking_cache(carrier);
CREATE INDEX IF NOT EXISTS idx_tracking_cache_last_update ON tracking_cache(last_update);
CREATE INDEX IF NOT EXISTS idx_tracking_webhooks_carrier ON tracking_webhooks(carrier);
CREATE INDEX IF NOT EXISTS idx_tracking_webhooks_active ON tracking_webhooks(is_active);
CREATE INDEX IF NOT EXISTS idx_proactive_alerts_user_id ON proactive_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_proactive_alerts_order_id ON proactive_alerts(order_id);
CREATE INDEX IF NOT EXISTS idx_proactive_alerts_type ON proactive_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_proactive_alerts_read ON proactive_alerts(is_read);

-- Enable RLS
ALTER TABLE tracking_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE proactive_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own proactive alerts" ON proactive_alerts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Tracking cache is publicly readable" ON tracking_cache
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own webhooks" ON tracking_webhooks
  FOR ALL USING (auth.uid() = user_id);

-- Create cache_entries table
CREATE TABLE IF NOT EXISTS cache_entries (
  key VARCHAR(255) PRIMARY KEY,
  data JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  access_count INTEGER DEFAULT 1,
  size INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for cache performance
CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at ON cache_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_entries_last_accessed ON cache_entries(last_accessed);

-- Enable RLS
ALTER TABLE cache_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policy - cache is readable by all authenticated users
CREATE POLICY "Authenticated users can manage cache" ON cache_entries
  FOR ALL USING (auth.role() = 'authenticated');

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- 'general', 'notifications', 'integrations', 'billing', etc.
  key VARCHAR(100) NOT NULL,
  value JSONB,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, category, key)
);

-- Create marketplace_integrations table
CREATE TABLE IF NOT EXISTS marketplace_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace VARCHAR(50) NOT NULL, -- 'shopify', 'woocommerce', 'mercadolivre', etc.
  name VARCHAR(255) NOT NULL,
  api_key VARCHAR(500),
  api_secret VARCHAR(500),
  access_token VARCHAR(500),
  store_url VARCHAR(500),
  webhook_secret VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  last_sync TIMESTAMP WITH TIME ZONE,
  sync_status VARCHAR(50) DEFAULT 'idle', -- 'idle', 'syncing', 'error', 'success'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, marketplace)
);

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2),
  features JSONB DEFAULT '[]', -- Array of feature objects
  limits JSONB DEFAULT '{}', -- Object with limits (orders_per_month, api_calls, etc.)
  is_active BOOLEAN DEFAULT true,
  is_popular BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'past_due', 'trialing'
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create data_exports table
CREATE TABLE IF NOT EXISTS data_exports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  export_type VARCHAR(50) NOT NULL, -- 'orders', 'customers', 'full_backup'
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  download_url TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create system_backups table
CREATE TABLE IF NOT EXISTS system_backups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  backup_type VARCHAR(50) NOT NULL, -- 'full', 'incremental', 'config_only'
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  storage_location TEXT,
  download_url TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_marketplace_integrations_user_id ON marketplace_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_integrations_marketplace ON marketplace_integrations(marketplace);
CREATE INDEX IF NOT EXISTS idx_marketplace_integrations_active ON marketplace_integrations(is_active);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_period_end ON user_subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_data_exports_user_id ON data_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_data_exports_status ON data_exports(status);
CREATE INDEX IF NOT EXISTS idx_system_backups_user_id ON system_backups(user_id);
CREATE INDEX IF NOT EXISTS idx_system_backups_status ON system_backups(status);

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_backups ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own settings" ON settings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public settings are readable by all" ON settings
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can manage their own marketplace integrations" ON marketplace_integrations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Subscription plans are readable by all authenticated users" ON subscription_plans
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view their own subscriptions" ON user_subscriptions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own data exports" ON data_exports
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own system backups" ON system_backups
  FOR ALL USING (auth.uid() = user_id);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, features, limits, is_active, is_popular, sort_order) VALUES
('Gratuito', 'Perfeito para começar', 0.00, 0.00, 
 '["Até 50 pedidos/mês", "1 integração marketplace", "Suporte básico", "Relatórios simples"]'::jsonb,
 '{"orders_per_month": 50, "marketplaces": 1, "api_calls": 1000}'::jsonb,
 true, false, 1),

('Profissional', 'Para negócios em crescimento', 29.90, 299.00,
 '["Até 500 pedidos/mês", "3 integrações marketplace", "Suporte prioritário", "Relatórios avançados", "API completa", "Webhooks ilimitados"]'::jsonb,
 '{"orders_per_month": 500, "marketplaces": 3, "api_calls": 10000}'::jsonb,
 true, true, 2),

('Empresarial', 'Para grandes operações', 99.90, 999.00,
 '["Pedidos ilimitados", "Integrações ilimitadas", "Suporte 24/7", "Relatórios customizados", "API dedicada", "Consultoria incluída", "SLA garantido"]'::jsonb,
 '{"orders_per_month": -1, "marketplaces": -1, "api_calls": -1}'::jsonb,
 true, false, 3);

-- Create function to update updated_at timestamp for settings tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_integrations_updated_at
  BEFORE UPDATE ON marketplace_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create analytics_metrics table
CREATE TABLE IF NOT EXISTS analytics_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_type VARCHAR(50) NOT NULL, -- 'orders', 'revenue', 'tracking', 'integrations', 'users', 'performance'
  metric_name VARCHAR(100) NOT NULL,
  value DECIMAL(15,2) NOT NULL,
  metadata JSONB DEFAULT '{}',
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create analytics_reports table
CREATE TABLE IF NOT EXISTS analytics_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'custom'
  title VARCHAR(255) NOT NULL,
  description TEXT,
  date_range JSONB NOT NULL,
  metrics JSONB DEFAULT '[]',
  summary JSONB DEFAULT '{}',
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Create dashboard_widgets table
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_type VARCHAR(20) NOT NULL, -- 'chart', 'metric', 'table', 'comparison'
  title VARCHAR(255) NOT NULL,
  config JSONB DEFAULT '{}',
  position JSONB NOT NULL,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for analytics performance
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_user_id ON analytics_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_type ON analytics_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_name ON analytics_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_date ON analytics_metrics(date);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_user_id ON analytics_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_type ON analytics_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_user_id ON dashboard_widgets(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_type ON dashboard_widgets(widget_type);

-- Enable RLS
ALTER TABLE analytics_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own analytics metrics" ON analytics_metrics
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own analytics reports" ON analytics_reports
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own dashboard widgets" ON dashboard_widgets
  FOR ALL USING (auth.uid() = user_id);

-- Create trigger for dashboard_widgets updated_at
CREATE TRIGGER update_dashboard_widgets_updated_at
  BEFORE UPDATE ON dashboard_widgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();