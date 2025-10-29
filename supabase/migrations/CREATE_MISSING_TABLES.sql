-- ============================================
-- SCRIPT PARA CRIAR TABELAS FALTANTES
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- 1. NOTIFICATION SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_enabled BOOLEAN DEFAULT false,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  whatsapp_number TEXT,
  auto_notifications BOOLEAN DEFAULT true,
  delay_hours INTEGER DEFAULT 2,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id)
);

-- 2. MARKETPLACE INTEGRATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS marketplace_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace VARCHAR(50) NOT NULL CHECK (marketplace IN ('shopify', 'woocommerce', 'mercadolivre', 'nuvemshop')),
  name VARCHAR(100),
  api_key TEXT,
  api_secret TEXT,
  access_token TEXT,
  store_url TEXT,
  webhook_secret TEXT,
  is_active BOOLEAN DEFAULT false,
  last_sync TIMESTAMP WITH TIME ZONE,
  sync_status VARCHAR(20) DEFAULT 'idle',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, marketplace)
);

-- 3. CARRIER INTEGRATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS carrier_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  carrier VARCHAR(50) NOT NULL CHECK (carrier IN ('correios', 'jadlog', 'total_express', 'azul_cargo', 'loggi', 'melhor_envio')),
  is_connected BOOLEAN DEFAULT false,
  credentials JSONB,
  settings JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, carrier)
);

-- 4. WEBHOOK CONFIGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('shopify', 'woocommerce', 'mercadolivre', 'nuvemshop')),
  webhook_url TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  events TEXT[] NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_triggered TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. WEBHOOK EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID REFERENCES webhook_configs(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. SYNC LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  sync_type VARCHAR(50) NOT NULL,
  payload JSONB,
  status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CREATE RLS POLICIES
-- ============================================

-- Notification Settings Policies
DROP POLICY IF EXISTS "Users can manage own notification settings" ON notification_settings;
CREATE POLICY "Users can manage own notification settings" ON notification_settings
  FOR ALL USING (auth.uid() = user_id);

-- Marketplace Integrations Policies
DROP POLICY IF EXISTS "Users can manage own marketplace integrations" ON marketplace_integrations;
CREATE POLICY "Users can manage own marketplace integrations" ON marketplace_integrations
  FOR ALL USING (auth.uid() = user_id);

-- Carrier Integrations Policies
DROP POLICY IF EXISTS "Users can manage own carrier integrations" ON carrier_integrations;
CREATE POLICY "Users can manage own carrier integrations" ON carrier_integrations
  FOR ALL USING (auth.uid() = user_id);

-- Webhook Configs Policies
DROP POLICY IF EXISTS "Users can manage own webhook configs" ON webhook_configs;
CREATE POLICY "Users can manage own webhook configs" ON webhook_configs
  FOR ALL USING (auth.uid() = user_id);

-- Webhook Events Policies (via webhook_configs)
DROP POLICY IF EXISTS "Users can view own webhook events" ON webhook_events;
CREATE POLICY "Users can view own webhook events" ON webhook_events
  FOR SELECT USING (
    webhook_id IN (
      SELECT id FROM webhook_configs WHERE user_id = auth.uid()
    )
  );

-- Sync Logs Policies (via orders)
DROP POLICY IF EXISTS "Users can view own sync logs" ON sync_logs;
CREATE POLICY "Users can view own sync logs" ON sync_logs
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- CREATE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_integrations_user_id ON marketplace_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_integrations_marketplace ON marketplace_integrations(marketplace);
CREATE INDEX IF NOT EXISTS idx_marketplace_integrations_active ON marketplace_integrations(is_active);
CREATE INDEX IF NOT EXISTS idx_carrier_integrations_user_id ON carrier_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_carrier_integrations_carrier ON carrier_integrations(carrier);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_user_id ON webhook_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_platform ON webhook_configs(platform);
CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook_id ON webhook_events(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_order_id ON sync_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_platform ON sync_logs(platform);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);

-- ============================================
-- CREATE UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- CREATE TRIGGERS FOR UPDATED_AT
-- ============================================
DROP TRIGGER IF EXISTS update_notification_settings_updated_at ON notification_settings;
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_marketplace_integrations_updated_at ON marketplace_integrations;
CREATE TRIGGER update_marketplace_integrations_updated_at
  BEFORE UPDATE ON marketplace_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_carrier_integrations_updated_at ON carrier_integrations;
CREATE TRIGGER update_carrier_integrations_updated_at
  BEFORE UPDATE ON carrier_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_webhook_configs_updated_at ON webhook_configs;
CREATE TRIGGER update_webhook_configs_updated_at
  BEFORE UPDATE ON webhook_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Execute estas queries após criar as tabelas para verificar:

-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN (
--   'notification_settings',
--   'marketplace_integrations', 
--   'carrier_integrations',
--   'webhook_configs',
--   'webhook_events',
--   'sync_logs'
-- );

-- ============================================
-- SCRIPT CONCLUÍDO
-- ============================================
-- Após executar este script, todas as tabelas necessárias
-- estarão criadas e configuradas com RLS, policies e indexes.
-- ============================================
