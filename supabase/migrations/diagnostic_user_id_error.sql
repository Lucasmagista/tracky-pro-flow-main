-- Script de diagnóstico para encontrar referências a user_id em admin_logs
-- Execute este script no SQL Editor do Supabase para identificar o problema

-- 1. Verificar estrutura da tabela admin_logs
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'admin_logs'
ORDER BY ordinal_position;

-- 2. Verificar funções que referenciam admin_logs e user_id
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE pg_get_functiondef(p.oid) ILIKE '%admin_logs%'
  AND pg_get_functiondef(p.oid) ILIKE '%user_id%'
  AND n.nspname = 'public';

-- 3. Verificar triggers que envolvem admin_logs
SELECT 
  t.tgname as trigger_name,
  c.relname as table_name,
  pg_get_triggerdef(t.oid) as trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE pg_get_triggerdef(t.oid) ILIKE '%admin_logs%'
  AND pg_get_triggerdef(t.oid) ILIKE '%user_id%';

-- 4. Verificar policies RLS em admin_logs
SELECT 
  polname as policy_name,
  pg_get_expr(polqual, polrelid) as policy_expression
FROM pg_policy
WHERE polrelid = 'admin_logs'::regclass;
