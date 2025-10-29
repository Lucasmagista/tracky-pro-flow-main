-- ============================================================================
-- SCRIPT DE DIAGNÓSTICO - Erro no Signup
-- ============================================================================
-- Este script ajuda a identificar problemas com o processo de registro

-- 1. Verificar triggers ativos em auth.users
SELECT 
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'users'
AND event_object_schema = 'auth'
ORDER BY trigger_name;

-- 2. Verificar se as funções existem e são válidas
SELECT 
  proname as function_name,
  prosrc as function_body
FROM pg_proc
WHERE proname IN ('handle_new_user', 'create_free_subscription_on_signup');

-- 3. Verificar se o plano 'free' existe
SELECT * FROM plans WHERE id = 'free';

-- 4. Verificar policies em tables relacionadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('profiles', 'subscriptions')
ORDER BY tablename, policyname;

-- 5. Verificar constraints em profiles
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'profiles'
ORDER BY tc.constraint_type, tc.constraint_name;

-- 6. Verificar constraints em subscriptions
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'subscriptions'
ORDER BY tc.constraint_type, tc.constraint_name;
