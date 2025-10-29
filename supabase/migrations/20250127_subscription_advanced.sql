-- Adicionar campos Stripe ao profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- Adicionar campos Stripe ao subscriptions
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_start TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ;

-- Adicionar campos Stripe aos plans
ALTER TABLE plans ADD COLUMN IF NOT EXISTS stripe_price_id TEXT UNIQUE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS stripe_product_id TEXT UNIQUE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS trial_period_days INTEGER DEFAULT 0;

-- Adicionar campos ao billing_history
ALTER TABLE billing_history ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT UNIQUE;
ALTER TABLE billing_history ADD COLUMN IF NOT EXISTS invoice_url TEXT;
ALTER TABLE billing_history ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL';

-- Criar tabela de cupons de desconto
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10,2) NOT NULL,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    stripe_coupon_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela de addons
CREATE TABLE IF NOT EXISTS addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'BRL',
    type TEXT NOT NULL,
    limits JSONB,
    is_active BOOLEAN DEFAULT true,
    stripe_price_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela de subscription_addons
CREATE TABLE IF NOT EXISTS subscription_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    addon_id UUID REFERENCES addons(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subscription_id, addon_id)
);

-- Criar tabela de audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active, valid_until);
CREATE INDEX IF NOT EXISTS idx_addons_active ON addons(is_active);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Trigger para verificar limites antes de criar pedido
CREATE OR REPLACE FUNCTION check_subscription_limits()
RETURNS TRIGGER AS $$
DECLARE
    current_sub RECORD;
    current_plan RECORD;
    current_usage RECORD;
BEGIN
    -- Buscar subscription ativa do usuário
    SELECT * INTO current_sub
    FROM subscriptions
    WHERE user_id = NEW.user_id
    AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;

    -- Se não tem subscription ativa, bloquear
    IF current_sub IS NULL THEN
        RAISE EXCEPTION 'Nenhuma assinatura ativa encontrada';
    END IF;

    -- Buscar plano
    SELECT * INTO current_plan
    FROM plans
    WHERE id = current_sub.plan_id;

    -- Buscar uso atual
    SELECT 
        SUM(CASE WHEN metric = 'orders' THEN value ELSE 0 END) as orders
    INTO current_usage
    FROM subscription_usage
    WHERE subscription_id = current_sub.id
    AND period_start = current_sub.current_period_start;

    -- Verificar limite de pedidos
    IF current_plan.limits->>'orders' != '-1' THEN
        IF COALESCE(current_usage.orders, 0) >= (current_plan.limits->>'orders')::INTEGER THEN
            RAISE EXCEPTION 'Limite de pedidos excedido. Faça upgrade do seu plano.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em orders (se a tabela existir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        DROP TRIGGER IF EXISTS check_order_limits ON orders;
        CREATE TRIGGER check_order_limits
            BEFORE INSERT ON orders
            FOR EACH ROW
            EXECUTE FUNCTION check_subscription_limits();
    END IF;
END $$;

-- Função para resetar uso no início do período
CREATE OR REPLACE FUNCTION reset_usage_for_new_period()
RETURNS void AS $$
BEGIN
    -- Para cada subscription que entrou em novo período
    WITH renewed_subs AS (
        SELECT id, current_period_start
        FROM subscriptions
        WHERE current_period_end <= NOW()
        AND status = 'active'
    )
    -- Deletar uso do período anterior
    DELETE FROM subscription_usage
    WHERE subscription_id IN (SELECT id FROM renewed_subs)
    AND period_start < (
        SELECT current_period_start 
        FROM renewed_subs 
        WHERE renewed_subs.id = subscription_usage.subscription_id
    );

    -- Atualizar datas do período
    UPDATE subscriptions
    SET 
        current_period_start = current_period_end,
        current_period_end = current_period_end + interval '1 month'
    WHERE current_period_end <= NOW()
    AND status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Função para enviar alerta de 80% de uso
CREATE OR REPLACE FUNCTION check_usage_alerts()
RETURNS void AS $$
DECLARE
    sub_record RECORD;
    plan_record RECORD;
    usage_record RECORD;
BEGIN
    -- Para cada subscription ativa
    FOR sub_record IN 
        SELECT * FROM subscriptions WHERE status = 'active'
    LOOP
        -- Buscar plano
        SELECT * INTO plan_record
        FROM plans WHERE id = sub_record.plan_id;

        -- Buscar uso
        FOR usage_record IN
            SELECT metric, SUM(value) as total
            FROM subscription_usage
            WHERE subscription_id = sub_record.id
            AND period_start = sub_record.current_period_start
            GROUP BY metric
        LOOP
            -- Verificar se atingiu 80%
            DECLARE
                limit_value INTEGER;
                percentage DECIMAL;
            BEGIN
                limit_value := (plan_record.limits->>usage_record.metric)::INTEGER;
                
                IF limit_value > 0 THEN
                    percentage := (usage_record.total::DECIMAL / limit_value) * 100;
                    
                    IF percentage >= 80 AND percentage < 100 THEN
                        -- Inserir notificação (você pode criar tabela de notificações)
                        -- ou chamar Edge Function para enviar email
                        RAISE NOTICE 'Alerta: Usuário % atingiu % %% de uso em %', 
                            sub_record.user_id, ROUND(percentage, 2), usage_record.metric;
                    END IF;
                END IF;
            END;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- RLS para novas tabelas
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies para coupons (apenas admin pode ver)
CREATE POLICY "Coupons são públicos para leitura"
    ON coupons FOR SELECT
    USING (is_active = true);

-- Policies para addons (todos podem ver)
CREATE POLICY "Addons são públicos"
    ON addons FOR SELECT
    USING (is_active = true);

-- Policies para subscription_addons
CREATE POLICY "Usuários podem ver seus addons"
    ON subscription_addons FOR SELECT
    USING (
        subscription_id IN (
            SELECT id FROM subscriptions WHERE user_id = auth.uid()
        )
    );

-- Policies para audit_logs
CREATE POLICY "Usuários podem ver seus próprios logs"
    ON audit_logs FOR SELECT
    USING (user_id = auth.uid());

-- Criar função update_updated_at se não existir
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger updated_at para novas tabelas
DROP TRIGGER IF EXISTS update_coupons_updated_at ON coupons;
CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON coupons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_addons_updated_at ON addons;
CREATE TRIGGER update_addons_updated_at BEFORE UPDATE ON addons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Inserir alguns cupons de exemplo
INSERT INTO coupons (code, description, discount_type, discount_value, max_uses) VALUES
('WELCOME10', 'Desconto de 10% para novos usuários', 'percentage', 10, 100),
('SAVE20', 'Desconto de R$20 na primeira mensalidade', 'fixed', 20, 50),
('ANNUAL50', 'Desconto de 50% para planos anuais', 'percentage', 50, NULL)
ON CONFLICT (code) DO NOTHING;

-- Inserir alguns addons de exemplo
INSERT INTO addons (name, description, price, type, limits) VALUES
('Pedidos Extra', '+1000 pedidos por mês', 19.90, 'orders', '{"orders": 1000}'),
('Notificações Premium', '+5000 notificações por mês', 29.90, 'notifications', '{"notifications": 5000}'),
('Integrações Avançadas', '+5 integrações simultâneas', 39.90, 'integrations', '{"integrations": 5}'),
('Armazenamento Extra', '+10GB de armazenamento', 14.90, 'storage', '{"storage": 10240}')
ON CONFLICT DO NOTHING;
