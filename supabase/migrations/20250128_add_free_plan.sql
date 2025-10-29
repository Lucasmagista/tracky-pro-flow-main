-- ============================================================================
-- ADICIONAR PLANO GRATUITO
-- ============================================================================
-- Migration para adicionar plano "Free" à tabela plans
-- Data: 2025-01-28
-- Objetivo: Permitir que novos usuários tenham um plano gratuito ativo por padrão
-- ============================================================================

-- Inserir plano gratuito como primeiro plano (antes do Starter)
INSERT INTO plans (id, name, description, price, interval, is_popular, features, limits) VALUES
('free', 'Gratuito', 'Perfeito para começar e testar o sistema', 0.00, 'month', false,
  '[
    "Até 50 pedidos/mês", 
    "Rastreamento básico", 
    "1 integração marketplace",
    "Notificações por WhatsApp (100/mês)", 
    "Relatórios básicos", 
    "Suporte por email"
  ]'::jsonb,
  '{
    "orders": 50, 
    "notifications": 100, 
    "integrations": 1, 
    "users": 1, 
    "storage": 0.5, 
    "api_calls": 500
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  is_popular = EXCLUDED.is_popular,
  updated_at = NOW();

-- ============================================================================
-- FUNÇÃO: CRIAR ASSINATURA GRATUITA AUTOMÁTICA NO REGISTRO
-- ============================================================================

-- Função para criar assinatura gratuita quando usuário é criado
CREATE OR REPLACE FUNCTION create_free_subscription_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  free_plan_id TEXT := 'free';
BEGIN
  -- Criar assinatura gratuita para o novo usuário
  INSERT INTO subscriptions (
    user_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end
  ) VALUES (
    NEW.id,
    free_plan_id,
    'active',
    NOW(),
    NOW() + INTERVAL '100 years', -- Plano gratuito não expira
    false
  )
  ON CONFLICT (user_id) DO NOTHING; -- Se já existe, não faz nada
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para executar a função quando novo usuário é criado
-- Primeiro, remover trigger se já existir
DROP TRIGGER IF EXISTS create_free_subscription_trigger ON auth.users;

-- Criar trigger
CREATE TRIGGER create_free_subscription_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_free_subscription_on_signup();

-- ============================================================================
-- CRIAR ASSINATURAS GRATUITAS PARA USUÁRIOS EXISTENTES SEM ASSINATURA
-- ============================================================================

-- Inserir assinaturas gratuitas para usuários que não têm nenhuma assinatura
INSERT INTO subscriptions (
  user_id,
  plan_id,
  status,
  current_period_start,
  current_period_end,
  cancel_at_period_end
)
SELECT 
  u.id,
  'free',
  'active',
  NOW(),
  NOW() + INTERVAL '100 years',
  false
FROM auth.users u
LEFT JOIN subscriptions s ON u.id = s.user_id
WHERE s.id IS NULL -- Usuários sem assinatura
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON FUNCTION create_free_subscription_on_signup() IS 
'Cria automaticamente uma assinatura gratuita quando um novo usuário se registra no sistema';

-- ============================================================================
-- POLÍTICAS RLS (Verificar se já existem)
-- ============================================================================

-- Permitir que usuários vejam seu próprio plano gratuito
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'subscriptions' 
    AND policyname = 'Users can view their own subscriptions'
  ) THEN
    CREATE POLICY "Users can view their own subscriptions"
      ON subscriptions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================

-- Verificar se o plano gratuito foi criado
DO $$
DECLARE
  free_plan_count INTEGER;
  users_without_subscription INTEGER;
BEGIN
  -- Contar plano gratuito
  SELECT COUNT(*) INTO free_plan_count
  FROM plans
  WHERE id = 'free';
  
  RAISE NOTICE 'Planos gratuitos criados: %', free_plan_count;
  
  -- Contar usuários sem assinatura
  SELECT COUNT(*) INTO users_without_subscription
  FROM auth.users u
  LEFT JOIN subscriptions s ON u.id = s.user_id
  WHERE s.id IS NULL;
  
  RAISE NOTICE 'Usuários sem assinatura restantes: %', users_without_subscription;
  
  IF free_plan_count = 0 THEN
    RAISE EXCEPTION 'ERRO: Plano gratuito não foi criado!';
  END IF;
  
  IF users_without_subscription > 0 THEN
    RAISE WARNING 'Ainda existem % usuários sem assinatura', users_without_subscription;
  END IF;
END $$;
