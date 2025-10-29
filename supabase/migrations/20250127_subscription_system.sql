-- ============================================================================
-- SUBSCRIPTION SYSTEM - Sistema completo de assinaturas e pagamentos
-- Criado em: 2025-01-27
-- ============================================================================

-- Tabela de Planos
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  interval TEXT NOT NULL CHECK (interval IN ('month', 'year')),
  is_active BOOLEAN DEFAULT TRUE,
  is_popular BOOLEAN DEFAULT FALSE,
  features JSONB DEFAULT '[]'::jsonb,
  limits JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Assinaturas
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'incomplete', 'trialing', 'paused')) DEFAULT 'active',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Tabela de Uso (Usage)
CREATE TABLE IF NOT EXISTS subscription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  metric TEXT NOT NULL CHECK (metric IN ('orders', 'notifications', 'integrations', 'users', 'storage', 'api_calls')),
  value INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subscription_id, metric, period_start)
);

-- Tabela de Histórico de Faturamento
CREATE TABLE IF NOT EXISTS billing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL CHECK (status IN ('paid', 'pending', 'failed', 'refunded', 'canceled')) DEFAULT 'pending',
  description TEXT NOT NULL,
  invoice_url TEXT,
  payment_method_id UUID,
  paid_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Métodos de Pagamento
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit_card', 'debit_card', 'pix', 'boleto', 'paypal')),
  is_default BOOLEAN DEFAULT FALSE,
  -- Dados do cartão (criptografados no backend)
  card_brand TEXT,
  card_last4 TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  -- Dados do titular
  holder_name TEXT,
  -- Provider info (Stripe, Mercado Pago, etc)
  provider TEXT,
  provider_payment_method_id TEXT,
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Feedback de Cancelamento
CREATE TABLE IF NOT EXISTS subscription_cancellation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('expensive', 'not_using', 'missing_features', 'switching', 'temporary', 'technical', 'support', 'other')),
  feedback TEXT,
  would_return BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Histórico de Mudanças de Plano
CREATE TABLE IF NOT EXISTS subscription_plan_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_plan_id TEXT REFERENCES plans(id),
  to_plan_id TEXT NOT NULL REFERENCES plans(id),
  change_type TEXT NOT NULL CHECK (change_type IN ('upgrade', 'downgrade', 'change')),
  effective_date TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ÍNDICES para performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);

CREATE INDEX IF NOT EXISTS idx_subscription_usage_subscription_id ON subscription_usage(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_metric ON subscription_usage(metric);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_period ON subscription_usage(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_billing_history_subscription_id ON billing_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_user_id ON billing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_status ON billing_history(status);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_default ON payment_methods(is_default) WHERE is_default = true;

-- ============================================================================
-- TRIGGERS para updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_usage_updated_at BEFORE UPDATE ON subscription_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_history_updated_at BEFORE UPDATE ON billing_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS (Row Level Security)
-- ============================================================================

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_cancellation_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plan_changes ENABLE ROW LEVEL SECURITY;

-- Plans: Todos podem ler planos ativos
CREATE POLICY "Plans are viewable by everyone" ON plans
  FOR SELECT USING (is_active = true);

-- Subscriptions: Usuários só veem suas próprias assinaturas
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions" ON subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- Usage: Usuários só veem seu próprio uso
CREATE POLICY "Users can view own usage" ON subscription_usage
  FOR SELECT USING (
    subscription_id IN (
      SELECT id FROM subscriptions WHERE user_id = auth.uid()
    )
  );

-- Billing History: Usuários só veem seu próprio histórico
CREATE POLICY "Users can view own billing history" ON billing_history
  FOR SELECT USING (auth.uid() = user_id);

-- Payment Methods: Usuários só veem seus próprios métodos
CREATE POLICY "Users can view own payment methods" ON payment_methods
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment methods" ON payment_methods
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment methods" ON payment_methods
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own payment methods" ON payment_methods
  FOR DELETE USING (auth.uid() = user_id);

-- Cancellation Feedback
CREATE POLICY "Users can insert own cancellation feedback" ON subscription_cancellation_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Plan Changes
CREATE POLICY "Users can view own plan changes" ON subscription_plan_changes
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- FUNÇÕES AUXILIARES
-- ============================================================================

-- Função para incrementar uso
CREATE OR REPLACE FUNCTION increment_usage(
  p_subscription_id UUID,
  p_metric TEXT,
  p_increment INTEGER DEFAULT 1
)
RETURNS void AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
BEGIN
  -- Pega o período atual da assinatura
  SELECT current_period_start, current_period_end
  INTO v_period_start, v_period_end
  FROM subscriptions
  WHERE id = p_subscription_id;

  -- Insere ou atualiza o uso
  INSERT INTO subscription_usage (subscription_id, metric, value, period_start, period_end)
  VALUES (p_subscription_id, p_metric, p_increment, v_period_start, v_period_end)
  ON CONFLICT (subscription_id, metric, period_start)
  DO UPDATE SET value = subscription_usage.value + p_increment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para resetar uso no novo período
CREATE OR REPLACE FUNCTION reset_usage_for_new_period(p_subscription_id UUID)
RETURNS void AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
BEGIN
  SELECT current_period_start, current_period_end
  INTO v_period_start, v_period_end
  FROM subscriptions
  WHERE id = p_subscription_id;

  -- Criar novos registros de uso zerados para o novo período
  INSERT INTO subscription_usage (subscription_id, metric, value, period_start, period_end)
  SELECT p_subscription_id, metric, 0, v_period_start, v_period_end
  FROM unnest(ARRAY['orders', 'notifications', 'integrations', 'users', 'storage', 'api_calls']) AS metric
  ON CONFLICT (subscription_id, metric, period_start) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DADOS INICIAIS - Planos padrão
-- ============================================================================

INSERT INTO plans (id, name, description, price, interval, is_popular, features, limits) VALUES
('starter', 'Starter', 'Perfeito para pequenos negócios', 29.00, 'month', false,
  '["Até 100 pedidos/mês", "Rastreamento automático", "Notificações por WhatsApp", "Relatórios básicos", "Suporte por email"]'::jsonb,
  '{"orders": 100, "notifications": 500, "integrations": 1, "users": 1, "storage": 1, "api_calls": 1000}'::jsonb
),
('professional', 'Professional', 'Para empresas em crescimento', 79.00, 'month', true,
  '["Até 1.000 pedidos/mês", "Rastreamento avançado", "WhatsApp + Email + SMS", "Analytics avançado", "Integrações ilimitadas", "Suporte prioritário", "API access"]'::jsonb,
  '{"orders": 1000, "notifications": 5000, "integrations": -1, "users": 5, "storage": 10, "api_calls": 10000}'::jsonb
),
('enterprise', 'Enterprise', 'Solução completa para grandes empresas', 199.00, 'month', false,
  '["Pedidos ilimitados", "Todas as notificações", "Analytics com IA", "Integrações customizadas", "Usuários ilimitados", "Suporte dedicado", "SLA garantido", "White-label"]'::jsonb,
  '{"orders": -1, "notifications": -1, "integrations": -1, "users": -1, "storage": -1, "api_calls": -1}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  updated_at = NOW();

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON TABLE plans IS 'Planos de assinatura disponíveis';
COMMENT ON TABLE subscriptions IS 'Assinaturas ativas dos usuários';
COMMENT ON TABLE subscription_usage IS 'Uso dos recursos por período';
COMMENT ON TABLE billing_history IS 'Histórico de faturas e pagamentos';
COMMENT ON TABLE payment_methods IS 'Métodos de pagamento salvos';
COMMENT ON TABLE subscription_cancellation_feedback IS 'Feedback de cancelamentos';
COMMENT ON TABLE subscription_plan_changes IS 'Histórico de mudanças de plano';
