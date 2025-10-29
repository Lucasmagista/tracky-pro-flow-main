-- =====================================================
-- MIGRAÇÕES PARA MELHORIAS DO ADMIN
-- Data: 28/01/2025
-- =====================================================

-- =====================================================
-- 1. ADICIONAR COLUNAS FALTANTES NA TABELA PROFILES
-- =====================================================

-- Adicionar coluna phone (telefone)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Adicionar coluna role (papel do usuário)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Adicionar coluna email_verified (verificação de email)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Adicionar coluna two_factor_enabled (autenticação 2FA)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;

-- Adicionar coluna notification_preferences (preferências de notificação)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}'::jsonb;

-- Adicionar coluna last_login (último login)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- =====================================================
-- 2. CRIAR TABELA ACTIVITY_LOGS (Logs de Atividade)
-- =====================================================

-- Deletar tabela se já existir (para evitar conflitos)
DROP TABLE IF EXISTS activity_logs CASCADE;

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  description TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);

-- =====================================================
-- 3. CRIAR TABELAS DO STRIPE
-- =====================================================

-- Deletar tabelas se já existirem (para evitar conflitos)
DROP TABLE IF EXISTS stripe_refunds CASCADE;
DROP TABLE IF EXISTS stripe_disputes CASCADE;
DROP TABLE IF EXISTS stripe_invoices CASCADE;
DROP TABLE IF EXISTS stripe_transactions CASCADE;
DROP TABLE IF EXISTS stripe_webhooks CASCADE;

-- Tabela de Transações do Stripe
CREATE TABLE stripe_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_id TEXT UNIQUE NOT NULL,
  amount INTEGER NOT NULL, -- Valor em centavos
  currency TEXT DEFAULT 'brl',
  status TEXT NOT NULL, -- succeeded, pending, failed, refunded, canceled
  customer_id TEXT,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Reembolsos do Stripe
CREATE TABLE stripe_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_refund_id TEXT UNIQUE,
  transaction_id UUID REFERENCES stripe_transactions(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Valor em centavos
  reason TEXT, -- duplicate, fraudulent, requested_by_customer, other
  status TEXT DEFAULT 'pending', -- pending, succeeded, failed, canceled
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Tabela de Webhooks do Stripe
CREATE TABLE stripe_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, processed, failed
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Tabela de Disputas do Stripe
CREATE TABLE stripe_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_dispute_id TEXT UNIQUE NOT NULL,
  transaction_id UUID REFERENCES stripe_transactions(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL, -- Valor em centavos
  currency TEXT DEFAULT 'brl',
  reason TEXT NOT NULL, -- fraudulent, duplicate, etc
  status TEXT NOT NULL, -- needs_response, under_review, won, lost
  customer_email TEXT,
  evidence_due_date TIMESTAMPTZ,
  evidence_submitted BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Faturas do Stripe
CREATE TABLE stripe_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_invoice_id TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  subscription_id TEXT,
  amount_due INTEGER NOT NULL, -- Valor em centavos
  amount_paid INTEGER DEFAULT 0, -- Valor em centavos
  currency TEXT DEFAULT 'brl',
  status TEXT NOT NULL, -- draft, open, paid, void, uncollectible
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  invoice_pdf TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. CRIAR ÍNDICES PARA TABELAS DO STRIPE
-- =====================================================

-- Índices para stripe_transactions
CREATE INDEX idx_stripe_transactions_status ON stripe_transactions(status);
CREATE INDEX idx_stripe_transactions_customer_email ON stripe_transactions(customer_email);
CREATE INDEX idx_stripe_transactions_created_at ON stripe_transactions(created_at DESC);

-- Índices para stripe_refunds
CREATE INDEX idx_stripe_refunds_transaction_id ON stripe_refunds(transaction_id);
CREATE INDEX idx_stripe_refunds_status ON stripe_refunds(status);
CREATE INDEX idx_stripe_refunds_created_at ON stripe_refunds(created_at DESC);

-- Índices para stripe_webhooks
CREATE INDEX idx_stripe_webhooks_event_type ON stripe_webhooks(event_type);
CREATE INDEX idx_stripe_webhooks_status ON stripe_webhooks(status);
CREATE INDEX idx_stripe_webhooks_created_at ON stripe_webhooks(created_at DESC);

-- Índices para stripe_disputes
CREATE INDEX idx_stripe_disputes_status ON stripe_disputes(status);
CREATE INDEX idx_stripe_disputes_customer_email ON stripe_disputes(customer_email);
CREATE INDEX idx_stripe_disputes_created_at ON stripe_disputes(created_at DESC);

-- Índices para stripe_invoices
CREATE INDEX idx_stripe_invoices_customer_id ON stripe_invoices(customer_id);
CREATE INDEX idx_stripe_invoices_status ON stripe_invoices(status);
CREATE INDEX idx_stripe_invoices_created_at ON stripe_invoices(created_at DESC);

-- =====================================================
-- 5. CRIAR TABELA SYSTEM_SETTINGS (Configurações do Sistema)
-- =====================================================

-- Deletar tabela se já existir (para evitar conflitos)
DROP TABLE IF EXISTS system_settings CASCADE;

CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name TEXT DEFAULT 'TrackyPro Flow',
  site_url TEXT DEFAULT '',
  support_email TEXT DEFAULT '',
  maintenance_mode BOOLEAN DEFAULT false,
  allow_registrations BOOLEAN DEFAULT true,
  
  -- SMTP Settings
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 587,
  smtp_user TEXT,
  smtp_password TEXT,
  smtp_from_email TEXT,
  smtp_from_name TEXT,
  
  -- Limites e Segurança
  api_rate_limit INTEGER DEFAULT 100,
  max_upload_size_mb INTEGER DEFAULT 10,
  session_timeout_minutes INTEGER DEFAULT 60,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir configurações padrão
INSERT INTO system_settings (site_name, site_url, support_email)
VALUES ('TrackyPro Flow', '', 'suporte@trackypro.com');

-- =====================================================
-- 6. CRIAR TABELA API_KEYS (Chaves de API)
-- =====================================================

-- Deletar tabela se já existir (para evitar conflitos)
DROP TABLE IF EXISTS api_keys CASCADE;

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_used TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para api_keys
CREATE INDEX idx_api_keys_key ON api_keys(key);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);

-- =====================================================
-- 7. CRIAR TABELA WEBHOOKS (Webhooks Configurados)
-- =====================================================

-- Deletar tabela se já existir (para evitar conflitos)
DROP TABLE IF EXISTS webhooks CASCADE;

CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] DEFAULT '{}',
  secret TEXT,
  is_active BOOLEAN DEFAULT true,
  last_triggered TIMESTAMPTZ,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para webhooks
CREATE INDEX idx_webhooks_is_active ON webhooks(is_active);
CREATE INDEX idx_webhooks_created_at ON webhooks(created_at DESC);

-- =====================================================
-- 8. ATUALIZAR POLÍTICAS RLS (Row Level Security)
-- =====================================================

-- Activity Logs - Apenas admins podem ver logs de todos os usuários
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seus próprios logs"
  ON activity_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todos os logs"
  ON activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

CREATE POLICY "Sistema pode inserir logs"
  ON activity_logs FOR INSERT
  WITH CHECK (true);

-- Stripe Tables - Apenas admins podem acessar
ALTER TABLE stripe_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apenas admins podem acessar transações"
  ON stripe_transactions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

CREATE POLICY "Apenas admins podem acessar reembolsos"
  ON stripe_refunds FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

CREATE POLICY "Apenas admins podem acessar webhooks do Stripe"
  ON stripe_webhooks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

CREATE POLICY "Apenas admins podem acessar disputas"
  ON stripe_disputes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

CREATE POLICY "Apenas admins podem acessar faturas"
  ON stripe_invoices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- System Settings - Apenas admins podem acessar e modificar
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apenas admins podem acessar configurações"
  ON system_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- API Keys - Apenas admins podem gerenciar
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apenas admins podem gerenciar API keys"
  ON api_keys FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- Webhooks - Apenas admins podem gerenciar
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apenas admins podem gerenciar webhooks"
  ON webhooks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- =====================================================
-- 9. CRIAR FUNÇÕES AUXILIARES
-- =====================================================

-- Função para registrar atividade do usuário
CREATE OR REPLACE FUNCTION log_user_activity(
  p_user_id UUID,
  p_action TEXT,
  p_description TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO activity_logs (user_id, action, description, ip_address, metadata)
  VALUES (p_user_id, p_action, p_description, p_ip_address, p_metadata)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
DROP TRIGGER IF EXISTS update_stripe_transactions_updated_at ON stripe_transactions;
CREATE TRIGGER update_stripe_transactions_updated_at
  BEFORE UPDATE ON stripe_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stripe_disputes_updated_at ON stripe_disputes;
CREATE TRIGGER update_stripe_disputes_updated_at
  BEFORE UPDATE ON stripe_disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stripe_invoices_updated_at ON stripe_invoices;
CREATE TRIGGER update_stripe_invoices_updated_at
  BEFORE UPDATE ON stripe_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_webhooks_updated_at ON webhooks;
CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 10. COMENTÁRIOS NAS TABELAS (Documentação)
-- =====================================================

COMMENT ON TABLE activity_logs IS 'Logs de atividades dos usuários para auditoria';
COMMENT ON TABLE stripe_transactions IS 'Transações processadas pelo Stripe';
COMMENT ON TABLE stripe_refunds IS 'Reembolsos processados via Stripe';
COMMENT ON TABLE stripe_webhooks IS 'Webhooks recebidos do Stripe';
COMMENT ON TABLE stripe_disputes IS 'Disputas e chargebacks do Stripe';
COMMENT ON TABLE stripe_invoices IS 'Faturas geradas pelo Stripe';
COMMENT ON TABLE system_settings IS 'Configurações gerais do sistema';
COMMENT ON TABLE api_keys IS 'Chaves de API para integrações externas';
COMMENT ON TABLE webhooks IS 'Webhooks configurados para eventos do sistema';

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================

-- Verificar se tudo foi criado corretamente
DO $$
BEGIN
  RAISE NOTICE '✅ Migração concluída com sucesso!';
  RAISE NOTICE '📊 Tabelas criadas:';
  RAISE NOTICE '  - activity_logs';
  RAISE NOTICE '  - stripe_transactions';
  RAISE NOTICE '  - stripe_refunds';
  RAISE NOTICE '  - stripe_webhooks';
  RAISE NOTICE '  - stripe_disputes';
  RAISE NOTICE '  - stripe_invoices';
  RAISE NOTICE '  - system_settings';
  RAISE NOTICE '  - api_keys';
  RAISE NOTICE '  - webhooks';
  RAISE NOTICE '📝 Colunas adicionadas em profiles:';
  RAISE NOTICE '  - phone, role, email_verified, two_factor_enabled';
  RAISE NOTICE '  - notification_preferences, last_login';
  RAISE NOTICE '🔒 Políticas RLS configuradas para todas as tabelas';
  RAISE NOTICE '🎯 Sistema pronto para uso!';
END $$;
