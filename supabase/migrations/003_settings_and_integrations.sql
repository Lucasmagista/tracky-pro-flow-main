-- Create notification settings table
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

-- Create notification templates table
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'whatsapp', 'sms')),
  name VARCHAR(100) NOT NULL,
  subject TEXT,
  content TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, type, name)
);

-- Create marketplace integrations table
CREATE TABLE IF NOT EXISTS marketplace_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('shopify', 'woocommerce', 'mercadolivre', 'nuvemshop')),
  is_connected BOOLEAN DEFAULT false,
  credentials JSONB,
  settings JSONB,
  last_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, platform)
);

-- Create carrier integrations table
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

-- Insert default templates for new users
INSERT INTO notification_templates (user_id, type, name, subject, content, is_default, is_active)
SELECT
  auth.users.id,
  'email',
  'Padrão',
  'Atualização do seu pedido',
  'Olá {cliente}!\n\nSeu pedido {codigo} está {status}.\n\nObrigado por escolher nossa loja!',
  true,
  true
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM notification_templates
  WHERE notification_templates.user_id = auth.users.id
  AND notification_templates.type = 'email'
  AND notification_templates.is_default = true
);

INSERT INTO notification_templates (user_id, type, name, subject, content, is_default, is_active)
SELECT
  auth.users.id,
  'whatsapp',
  'Padrão',
  NULL,
  'Olá {cliente}! 📦\n\nSeu pedido *{codigo}* está *{status}*.\n\nAcompanhe em tempo real: {link}',
  true,
  true
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM notification_templates
  WHERE notification_templates.user_id = auth.users.id
  AND notification_templates.type = 'whatsapp'
  AND notification_templates.is_default = true
);

INSERT INTO notification_templates (user_id, type, name, subject, content, is_default, is_active)
SELECT
  auth.users.id,
  'sms',
  'Padrão',
  NULL,
  'Pedido {codigo} - Status: {status}. Acompanhe: {link}',
  true,
  true
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM notification_templates
  WHERE notification_templates.user_id = auth.users.id
  AND notification_templates.type = 'sms'
  AND notification_templates.is_default = true
);

-- Enable RLS
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_integrations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own notification settings" ON notification_settings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own notification templates" ON notification_templates
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own marketplace integrations" ON marketplace_integrations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own carrier integrations" ON carrier_integrations
  FOR ALL USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_templates_user_id ON notification_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON notification_templates(type);
CREATE INDEX IF NOT EXISTS idx_marketplace_integrations_user_id ON marketplace_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_carrier_integrations_user_id ON carrier_integrations(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_integrations_updated_at
  BEFORE UPDATE ON marketplace_integrations
  FOR EACH ROW EXECUTE FUNCTION update_marketplace_integrations_updated_at();

CREATE TRIGGER update_carrier_integrations_updated_at
  BEFORE UPDATE ON carrier_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();