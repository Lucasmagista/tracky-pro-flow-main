-- ============================================
-- SCRIPT DE CORREÇÃO DE PROBLEMAS NO BANCO
-- Execute este script para corrigir erros 406 e 404
-- ============================================

-- 1. CRIAR TABELA NOTIFICATION_TEMPLATES (se não existe)
-- ============================================
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
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

-- 2. HABILITAR RLS EM TODAS AS TABELAS
-- ============================================
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- 3. REMOVER POLICIES ANTIGAS (se existirem)
-- ============================================
DROP POLICY IF EXISTS "Users can view own notification settings" ON notification_settings;
DROP POLICY IF EXISTS "Users can manage own notification settings" ON notification_settings;
DROP POLICY IF EXISTS "Users can view own notification templates" ON notification_templates;
DROP POLICY IF EXISTS "Users can manage own notification templates" ON notification_templates;
DROP POLICY IF EXISTS "Users can view own marketplace integrations" ON marketplace_integrations;
DROP POLICY IF EXISTS "Users can manage own marketplace integrations" ON marketplace_integrations;
DROP POLICY IF EXISTS "Users can view own carrier integrations" ON carrier_integrations;
DROP POLICY IF EXISTS "Users can manage own carrier integrations" ON carrier_integrations;
DROP POLICY IF EXISTS "Users can manage own webhook configs" ON webhook_configs;
DROP POLICY IF EXISTS "Users can view own webhook events" ON webhook_events;
DROP POLICY IF EXISTS "Users can view own sync logs" ON sync_logs;

-- 4. CRIAR POLICIES CORRETAS PARA TODAS AS OPERAÇÕES
-- ============================================

-- Notification Settings Policies (CRUD completo)
CREATE POLICY "Users can view own notification settings" 
  ON notification_settings FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification settings" 
  ON notification_settings FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification settings" 
  ON notification_settings FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notification settings" 
  ON notification_settings FOR DELETE 
  USING (auth.uid() = user_id);

-- Notification Templates Policies (CRUD completo)
CREATE POLICY "Users can view own notification templates" 
  ON notification_templates FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification templates" 
  ON notification_templates FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification templates" 
  ON notification_templates FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notification templates" 
  ON notification_templates FOR DELETE 
  USING (auth.uid() = user_id);

-- Marketplace Integrations Policies (CRUD completo)
CREATE POLICY "Users can view own marketplace integrations" 
  ON marketplace_integrations FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own marketplace integrations" 
  ON marketplace_integrations FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own marketplace integrations" 
  ON marketplace_integrations FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own marketplace integrations" 
  ON marketplace_integrations FOR DELETE 
  USING (auth.uid() = user_id);

-- Carrier Integrations Policies (CRUD completo)
CREATE POLICY "Users can view own carrier integrations" 
  ON carrier_integrations FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own carrier integrations" 
  ON carrier_integrations FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own carrier integrations" 
  ON carrier_integrations FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own carrier integrations" 
  ON carrier_integrations FOR DELETE 
  USING (auth.uid() = user_id);

-- Webhook Configs Policies (CRUD completo)
CREATE POLICY "Users can view own webhook configs" 
  ON webhook_configs FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own webhook configs" 
  ON webhook_configs FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own webhook configs" 
  ON webhook_configs FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own webhook configs" 
  ON webhook_configs FOR DELETE 
  USING (auth.uid() = user_id);

-- Webhook Events Policies (apenas leitura via webhook_configs)
CREATE POLICY "Users can view own webhook events" 
  ON webhook_events FOR SELECT 
  USING (
    webhook_id IN (
      SELECT id FROM webhook_configs WHERE user_id = auth.uid()
    )
  );

-- Sync Logs Policies (apenas leitura via orders)
CREATE POLICY "Users can view own sync logs" 
  ON sync_logs FOR SELECT 
  USING (
    order_id IN (
      SELECT id FROM orders WHERE user_id = auth.uid()
    )
  );

-- 5. CRIAR ÍNDICES ADICIONAIS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notification_templates_user_id ON notification_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON notification_templates(type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_is_default ON notification_templates(is_default);
CREATE INDEX IF NOT EXISTS idx_notification_templates_is_active ON notification_templates(is_active);

-- 6. CRIAR TRIGGER PARA UPDATED_AT
-- ============================================
DROP TRIGGER IF EXISTS update_notification_templates_updated_at ON notification_templates;
CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. INSERIR TEMPLATES PADRÃO (se o usuário não tiver nenhum)
-- ============================================
-- Este insert vai criar templates padrão para todos os usuários que ainda não têm

-- Template Email Padrão
INSERT INTO notification_templates (user_id, type, name, subject, content, is_default, is_active)
SELECT 
  u.id,
  'email',
  'Padrão',
  'Atualização do seu pedido',
  'Olá {cliente}!

Seu pedido {codigo} está {status}.

Obrigado por escolher nossa loja!',
  true,
  true
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM notification_templates nt
  WHERE nt.user_id = u.id AND nt.type = 'email' AND nt.is_default = true
)
ON CONFLICT (user_id, type, name) DO NOTHING;

-- Template WhatsApp Padrão
INSERT INTO notification_templates (user_id, type, name, subject, content, is_default, is_active)
SELECT 
  u.id,
  'whatsapp',
  'Padrão',
  NULL,
  'Olá {cliente}! 📦

Seu pedido *{codigo}* está *{status}*.

Acompanhe em tempo real: {link}',
  true,
  true
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM notification_templates nt
  WHERE nt.user_id = u.id AND nt.type = 'whatsapp' AND nt.is_default = true
)
ON CONFLICT (user_id, type, name) DO NOTHING;

-- Template SMS Padrão
INSERT INTO notification_templates (user_id, type, name, subject, content, is_default, is_active)
SELECT 
  u.id,
  'sms',
  'Padrão',
  NULL,
  'Pedido {codigo} - Status: {status}. Acompanhe: {link}',
  true,
  true
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM notification_templates nt
  WHERE nt.user_id = u.id AND nt.type = 'sms' AND nt.is_default = true
)
ON CONFLICT (user_id, type, name) DO NOTHING;

-- 8. CRIAR CONFIGURAÇÃO DE NOTIFICAÇÃO PADRÃO (se não existir)
-- ============================================
INSERT INTO notification_settings (
  user_id, 
  whatsapp_enabled, 
  email_enabled, 
  sms_enabled, 
  whatsapp_number,
  auto_notifications,
  delay_hours
)
SELECT 
  u.id,
  false,
  true,
  false,
  '',
  true,
  2
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM notification_settings ns
  WHERE ns.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================

-- Execute estas queries para verificar se tudo foi criado:

-- 1. Verificar tabelas criadas
SELECT table_name, 
       (SELECT count(*) FROM information_schema.table_constraints 
        WHERE constraint_type = 'PRIMARY KEY' 
        AND table_name = t.table_name) as has_pk,
       (SELECT count(*) FROM pg_policies 
        WHERE tablename = t.table_name) as policy_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name IN (
  'notification_settings',
  'notification_templates',
  'marketplace_integrations', 
  'carrier_integrations',
  'webhook_configs',
  'webhook_events',
  'sync_logs'
)
ORDER BY table_name;

-- 2. Verificar policies (deve retornar várias linhas)
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN (
  'notification_settings',
  'notification_templates',
  'marketplace_integrations',
  'carrier_integrations',
  'webhook_configs',
  'webhook_events',
  'sync_logs'
)
ORDER BY tablename, policyname;

-- 3. Verificar se há templates padrão para o usuário logado
SELECT user_id, type, name, is_default, is_active
FROM notification_templates
WHERE user_id = auth.uid()
ORDER BY type, name;

-- 4. Verificar configurações de notificação do usuário logado
SELECT *
FROM notification_settings
WHERE user_id = auth.uid();

-- ============================================
-- SCRIPT CONCLUÍDO
-- ============================================
-- Após executar:
-- 1. Todas as tabelas devem estar criadas
-- 2. RLS deve estar ativo com policies corretas
-- 3. Templates padrão devem estar inseridos
-- 4. Erro 406 e 404 devem desaparecer
-- ============================================
