-- ============================================================================
-- DIAGNÓSTICO COMPLETO - Usuário não aparece no Admin
-- ============================================================================
-- Execute este script no SQL Editor do Supabase para diagnosticar o problema

-- 1. Verificar se o usuário foi criado em auth.users
SELECT 
  id,
  email,
  created_at,
  confirmed_at,
  email_confirmed_at,
  last_sign_in_at,
  raw_user_meta_data
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- 2. Verificar se o profile foi criado
SELECT 
  id,
  email,
  name,
  store_name,
  is_admin,
  created_at,
  updated_at
FROM profiles
ORDER BY created_at DESC
LIMIT 10;

-- 3. Verificar se há usuários em auth.users SEM profile
SELECT 
  au.id,
  au.email,
  au.created_at as auth_created,
  p.id as profile_id,
  p.created_at as profile_created
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE p.id IS NULL
ORDER BY au.created_at DESC;

-- 4. Verificar triggers ativos
SELECT 
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing,
  action_orientation
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
ORDER BY trigger_name;

-- 5. Verificar se a função handle_new_user existe e está correta
SELECT 
  proname as function_name,
  prosrc as function_body
FROM pg_proc
WHERE proname = 'handle_new_user';

-- 6. Verificar se há subscriptions sem profile
SELECT 
  s.id,
  s.user_id,
  s.plan_id,
  s.status,
  s.created_at,
  p.id as profile_exists,
  p.email
FROM subscriptions s
LEFT JOIN profiles p ON s.user_id = p.id
WHERE p.id IS NULL
ORDER BY s.created_at DESC;

-- 7. Verificar se o plano 'free' existe
SELECT * FROM plans WHERE id = 'free';

-- 8. Verificar RLS (Row Level Security) em profiles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 9. Verificar se há erros nos logs (se disponível)
-- Esta query pode falhar se a tabela não existir
SELECT 
  *
FROM admin_logs
WHERE severity IN ('error', 'critical')
ORDER BY created_at DESC
LIMIT 20;

-- 10. Tentar criar um profile manualmente para o último usuário sem profile
-- ATENÇÃO: Descomente apenas se quiser executar a correção
/*
INSERT INTO profiles (id, email, name, store_name, is_admin, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', 'Usuário'),
  COALESCE(au.raw_user_meta_data->>'store_name', 'Minha Loja'),
  false,
  NOW(),
  NOW()
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
*/

-- 11. Verificar se há constraint violations
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu 
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name IN ('profiles', 'subscriptions')
ORDER BY tc.table_name, tc.constraint_type;

-- 12. Verificar dados completos dos últimos 5 usuários criados
SELECT 
  au.id,
  au.email,
  au.created_at as auth_created,
  au.confirmed_at,
  au.raw_user_meta_data,
  p.id as profile_id,
  p.name,
  p.store_name,
  p.is_admin,
  p.created_at as profile_created,
  s.id as subscription_id,
  s.plan_id,
  s.status as subscription_status
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
LEFT JOIN subscriptions s ON p.id = s.user_id
ORDER BY au.created_at DESC
LIMIT 5;

-- ============================================================================
-- ANÁLISE DOS RESULTADOS:
-- ============================================================================
-- 
-- Se query 3 retornar registros: Usuários foram criados em auth.users mas não em profiles
--   → O trigger handle_new_user não está funcionando
--   → Execute a query 10 (descomente) para criar os profiles manualmente
--
-- Se query 4 não mostrar triggers: O trigger foi removido ou desabilitado
--   → Execute o script fix-signup-error.ps1 novamente
--
-- Se query 6 retornar registros: Subscriptions criadas mas profile não existe
--   → Há um problema de integridade referencial
--   → O user_id na subscription não corresponde a um profile válido
--
-- Se query 7 não retornar nada: O plano 'free' não existe
--   → Execute: INSERT INTO plans (id, name) VALUES ('free', 'Free Plan');
--
-- Se query 8 mostrar policies restritivas: RLS pode estar bloqueando a visualização
--   → Verifique se o usuário admin tem as permissões corretas
-- ============================================================================
