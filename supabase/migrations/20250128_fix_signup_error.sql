-- ============================================================================
-- FIX: Erro 500 no Signup
-- ============================================================================
-- Data: 2025-01-28
-- Problema: Triggers conflitantes ou erros durante criação de usuário
-- Solução: Consolidar triggers e adicionar tratamento de erros
-- ============================================================================

-- ============================================================================
-- 1. REMOVER TRIGGERS EXISTENTES PARA RECRIÁ-LOS NA ORDEM CORRETA
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS create_free_subscription_trigger ON auth.users;

-- ============================================================================
-- 2. RECRIAR FUNÇÃO handle_new_user COM TRATAMENTO DE ERRO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Criar profile do usuário
  INSERT INTO public.profiles (
    id, 
    name, 
    store_name
  )
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'store_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Criar assinatura gratuita
  INSERT INTO public.subscriptions (
    user_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end
  )
  VALUES (
    NEW.id,
    'free',
    'active',
    NOW(),
    NOW() + INTERVAL '100 years',
    false
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log o erro mas não impeça a criação do usuário
    RAISE WARNING 'Erro ao criar profile/subscription para usuário %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. CRIAR APENAS UM TRIGGER QUE FAZ TUDO
-- ============================================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 4. GARANTIR QUE O PLANO FREE EXISTE
-- ============================================================================

INSERT INTO plans (id, name, description, price, interval, is_popular, features, limits) 
VALUES (
  'free', 
  'Gratuito', 
  'Perfeito para começar e testar o sistema', 
  0.00, 
  'month', 
  false,
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
-- 5. VERIFICAR E CORRIGIR POLICIES
-- ============================================================================

-- Garantir que usuários podem inserir seu próprio profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" 
  ON public.profiles
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Garantir que usuários podem ver suas próprias subscriptions
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
CREATE POLICY "Users can view own subscriptions" 
  ON subscriptions
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Permitir inserção de subscriptions pelo trigger
DROP POLICY IF EXISTS "Service role can insert subscriptions" ON subscriptions;
CREATE POLICY "Service role can insert subscriptions"
  ON subscriptions
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- 6. CRIAR ASSINATURAS PARA USUÁRIOS EXISTENTES SEM ASSINATURA
-- ============================================================================

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
WHERE s.id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- 7. CRIAR PROFILES PARA USUÁRIOS EXISTENTES SEM PROFILE
-- ============================================================================

INSERT INTO public.profiles (
  id,
  name,
  store_name
)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', ''),
  COALESCE(u.raw_user_meta_data->>'store_name', '')
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 8. COMENTÁRIOS
-- ============================================================================

COMMENT ON FUNCTION public.handle_new_user() IS 
'Cria profile e assinatura gratuita quando um novo usuário se registra. Inclui tratamento de erros para não bloquear o signup.';

-- ============================================================================
-- 9. VERIFICAÇÃO FINAL
-- ============================================================================

DO $$
DECLARE
  trigger_count INTEGER;
  free_plan_exists BOOLEAN;
  users_without_profile INTEGER;
  users_without_subscription INTEGER;
BEGIN
  -- Contar triggers
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE event_object_table = 'users'
  AND event_object_schema = 'auth'
  AND trigger_name IN ('on_auth_user_created', 'create_free_subscription_trigger');
  
  -- Verificar plano free
  SELECT EXISTS(SELECT 1 FROM plans WHERE id = 'free') INTO free_plan_exists;
  
  -- Contar usuários sem profile
  SELECT COUNT(*) INTO users_without_profile
  FROM auth.users u
  LEFT JOIN public.profiles p ON u.id = p.id
  WHERE p.id IS NULL;
  
  -- Contar usuários sem subscription
  SELECT COUNT(*) INTO users_without_subscription
  FROM auth.users u
  LEFT JOIN subscriptions s ON u.id = s.user_id
  WHERE s.id IS NULL;
  
  -- Reportar resultados
  RAISE NOTICE '=== VERIFICAÇÃO ===';
  RAISE NOTICE 'Triggers ativos: %', trigger_count;
  RAISE NOTICE 'Plano FREE existe: %', free_plan_exists;
  RAISE NOTICE 'Usuários sem profile: %', users_without_profile;
  RAISE NOTICE 'Usuários sem subscription: %', users_without_subscription;
  
  -- Validações
  IF trigger_count > 1 THEN
    RAISE WARNING 'ATENÇÃO: Múltiplos triggers detectados! Pode causar problemas.';
  END IF;
  
  IF NOT free_plan_exists THEN
    RAISE EXCEPTION 'ERRO: Plano FREE não existe!';
  END IF;
  
  IF users_without_profile > 0 THEN
    RAISE WARNING 'Ainda existem % usuários sem profile', users_without_profile;
  END IF;
  
  IF users_without_subscription > 0 THEN
    RAISE WARNING 'Ainda existem % usuários sem subscription', users_without_subscription;
  END IF;
  
  RAISE NOTICE '=== FIM DA VERIFICAÇÃO ===';
END $$;
