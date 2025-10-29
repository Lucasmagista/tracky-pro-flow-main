-- ============================================================================
-- FIX: Criar profiles para usuários que não têm
-- ============================================================================
-- Este script corrige o problema de usuários criados em auth.users
-- mas sem profile correspondente na tabela profiles

-- 1. Primeiro, vamos verificar quantos usuários estão sem profile
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO missing_count
  FROM auth.users au
  LEFT JOIN profiles p ON au.id = p.id
  WHERE p.id IS NULL;
  
  RAISE NOTICE 'Usuários sem profile encontrados: %', missing_count;
END $$;

-- 2. Criar profiles para todos os usuários que não têm
-- Usando os dados de raw_user_meta_data do auth.users
INSERT INTO profiles (
  id,
  email,
  name,
  store_name,
  is_admin,
  created_at,
  updated_at
)
SELECT 
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'name',
    split_part(au.email, '@', 1) -- Usa a parte antes do @ como nome padrão
  ),
  COALESCE(
    au.raw_user_meta_data->>'store_name',
    'Minha Loja'
  ),
  false, -- Não é admin por padrão
  au.created_at,
  NOW()
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 3. Verificar se todos agora têm profile
DO $$
DECLARE
  total_users INTEGER;
  total_profiles INTEGER;
  still_missing INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM auth.users;
  SELECT COUNT(*) INTO total_profiles FROM profiles;
  
  SELECT COUNT(*)
  INTO still_missing
  FROM auth.users au
  LEFT JOIN profiles p ON au.id = p.id
  WHERE p.id IS NULL;
  
  RAISE NOTICE '=================================';
  RAISE NOTICE 'Total de usuários: %', total_users;
  RAISE NOTICE 'Total de profiles: %', total_profiles;
  RAISE NOTICE 'Ainda sem profile: %', still_missing;
  RAISE NOTICE '=================================';
  
  IF still_missing = 0 THEN
    RAISE NOTICE '✓ Todos os usuários agora têm profiles!';
  ELSE
    RAISE WARNING '⚠ Ainda há % usuários sem profile', still_missing;
  END IF;
END $$;

-- 4. Criar subscriptions 'free' para usuários que não têm
-- Primeiro verifica se o plano 'free' existe
INSERT INTO plans (id, name, description, price, currency, interval, is_active, features)
VALUES (
  'free',
  'Plano Gratuito',
  'Plano gratuito com recursos básicos',
  0,
  'BRL',
  'month',
  true,
  '{"max_orders": 100, "max_integrations": 1}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Agora cria subscriptions para profiles sem subscription
INSERT INTO subscriptions (
  user_id,
  plan_id,
  status,
  current_period_start,
  current_period_end,
  created_at,
  updated_at
)
SELECT 
  p.id,
  'free',
  'active',
  NOW(),
  NOW() + INTERVAL '1 year',
  NOW(),
  NOW()
FROM profiles p
LEFT JOIN subscriptions s ON p.id = s.user_id
WHERE s.id IS NULL
ON CONFLICT DO NOTHING;

-- 5. Verificar o resultado final
DO $$
DECLARE
  users_count INTEGER;
  profiles_count INTEGER;
  subscriptions_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO users_count FROM auth.users;
  SELECT COUNT(*) INTO profiles_count FROM profiles;
  SELECT COUNT(*) INTO subscriptions_count FROM subscriptions WHERE status = 'active';
  
  RAISE NOTICE '=================================';
  RAISE NOTICE 'RESULTADO FINAL:';
  RAISE NOTICE 'Usuários (auth.users): %', users_count;
  RAISE NOTICE 'Profiles (profiles): %', profiles_count;
  RAISE NOTICE 'Subscriptions ativas: %', subscriptions_count;
  RAISE NOTICE '=================================';
END $$;

-- 6. Recriar o trigger para garantir que profiles sejam criados no futuro
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar profile para o novo usuário
  INSERT INTO public.profiles (
    id,
    email,
    name,
    store_name,
    is_admin,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'store_name', 'Minha Loja'),
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, profiles.name),
    store_name = COALESCE(EXCLUDED.store_name, profiles.store_name),
    updated_at = NOW();

  -- Criar subscription gratuita
  INSERT INTO public.subscriptions (
    user_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    'free',
    'active',
    NOW(),
    NOW() + INTERVAL '1 year',
    NOW(),
    NOW()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar o trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 7. Verificar se o trigger foi criado corretamente
DO $$
DECLARE
  trigger_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.triggers
    WHERE trigger_name = 'on_auth_user_created'
    AND event_object_schema = 'auth'
    AND event_object_table = 'users'
  ) INTO trigger_exists;
  
  IF trigger_exists THEN
    RAISE NOTICE '✓ Trigger on_auth_user_created criado com sucesso!';
  ELSE
    RAISE WARNING '⚠ Falha ao criar trigger on_auth_user_created';
  END IF;
END $$;

-- ============================================================================
-- INSTRUÇÕES:
-- ============================================================================
-- 
-- 1. Execute este script no SQL Editor do Supabase
-- 2. Verifique os NOTICES no console para confirmar que tudo foi corrigido
-- 3. Teste criando um novo usuário para ver se o profile é criado automaticamente
-- 4. Atualize a página do Admin para ver os usuários que estavam faltando
--
-- ============================================================================
