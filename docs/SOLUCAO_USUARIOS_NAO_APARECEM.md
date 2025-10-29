# 🔧 Solução: Usuários não aparecem no Admin

## 📋 Problema Identificado

Quando você cria uma conta de teste, o usuário não aparece no painel de administração em `/admin/users`.

### Causa Raiz

O painel Admin busca usuários da tabela `profiles`:

```typescript
// src/services/admin.ts - linha 295
static async getAllUsers(...) {
  let query = supabase
    .from('profiles')  // ← Busca APENAS da tabela profiles
    .select(...)
}
```

**Se o profile não for criado, o usuário não aparece!**

### Por que o profile não é criado?

1. **Trigger falha ou não existe**: O trigger `on_auth_user_created` deveria criar o profile automaticamente
2. **Função tem erro**: A função `handle_new_user()` pode ter um erro que impede a criação
3. **Plano 'free' não existe**: Se o trigger tenta criar uma subscription mas o plano não existe, falha tudo
4. **Constraints impedem**: Foreign keys ou constraints podem bloquear a inserção

## 🔍 Diagnóstico

### Passo 1: Execute o diagnóstico

1. Abra o SQL Editor do Supabase:
   ```
   https://supabase.com/dashboard/project/swcmlwtyinsdppncxfqe/sql/new
   ```

2. Cole e execute o conteúdo de: `diagnose-user-registration.sql`

3. Analise os resultados:

**Query 3 - Usuários sem profile:**
```sql
-- Se retornar registros, há usuários sem profile
SELECT au.id, au.email FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE p.id IS NULL;
```

**Query 4 - Triggers ativos:**
```sql
-- Deve mostrar o trigger on_auth_user_created
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'users';
```

**Query 7 - Plano free:**
```sql
-- Deve retornar o plano 'free'
SELECT * FROM plans WHERE id = 'free';
```

## ✅ Solução

### Opção 1: Script Automático (Recomendado)

Execute o script PowerShell:

```powershell
.\fix-missing-profiles.ps1
```

Este script vai:
1. Executar o diagnóstico
2. Aplicar todas as correções necessárias
3. Verificar se funcionou

### Opção 2: Manual

1. **Criar profiles para usuários existentes:**

```sql
-- Criar profiles faltantes
INSERT INTO profiles (id, email, name, store_name, is_admin, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  COALESCE(au.raw_user_meta_data->>'store_name', 'Minha Loja'),
  false,
  au.created_at,
  NOW()
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
```

2. **Criar plano 'free' se não existir:**

```sql
INSERT INTO plans (id, name, description, price, interval, features)
VALUES (
  'free',
  'Plano Gratuito',
  'Plano gratuito com recursos básicos',
  0,
  'month',
  '{"max_orders": 100, "max_integrations": 1}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
```

3. **Criar subscriptions para todos os profiles:**

```sql
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
```

4. **Recriar o trigger:**

```sql
-- Recriar função
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar profile
  INSERT INTO public.profiles (
    id, email, name, store_name, is_admin, created_at, updated_at
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
    updated_at = NOW();

  -- Criar subscription gratuita
  INSERT INTO public.subscriptions (
    user_id, plan_id, status, 
    current_period_start, current_period_end,
    created_at, updated_at
  )
  VALUES (
    NEW.id, 'free', 'active',
    NOW(), NOW() + INTERVAL '1 year',
    NOW(), NOW()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

## 🧪 Teste

### 1. Verificar se os usuários aparecem agora

1. Acesse: `http://localhost:5173/admin/users`
2. Clique em **"Atualizar"**
3. Os usuários devem aparecer agora

### 2. Testar novo cadastro

1. Acesse: `http://localhost:5173/cadastro`
2. Crie uma nova conta de teste
3. Vá para o admin e verifique se o usuário aparece **imediatamente**

### 3. Verificar no banco

```sql
-- Deve retornar mesmo número
SELECT 
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(*) FROM profiles) as total_profiles,
  (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') as active_subscriptions;
```

## 🔄 Checklist de Verificação

- [ ] Query 3 não retorna nenhum registro (todos os usuários têm profile)
- [ ] Query 4 mostra o trigger `on_auth_user_created`
- [ ] Query 7 retorna o plano 'free'
- [ ] Usuários aparecem em `/admin/users`
- [ ] Novo cadastro cria profile automaticamente
- [ ] Novo cadastro cria subscription 'free' automaticamente
- [ ] Nenhum erro 500 no cadastro
- [ ] Console do navegador não mostra erros

## 🚨 Se ainda não funcionar

### 1. Verificar RLS (Row Level Security)

```sql
-- Ver policies ativas
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

Se houver policies muito restritivas, pode estar bloqueando a visualização.

### 2. Verificar permissões do Admin

```sql
-- Verificar se seu usuário é admin
SELECT id, email, is_admin, admin_role 
FROM profiles 
WHERE email = 'seu-email@example.com';
```

Se `is_admin = false`, torne-se admin:

```sql
UPDATE profiles 
SET is_admin = true, admin_role = 'super_admin'
WHERE email = 'seu-email@example.com';
```

### 3. Verificar logs de erro

Abra o console do navegador (F12) e veja se há erros na requisição:

```
Network → profiles → Response
```

### 4. Verificar constraints

```sql
-- Ver todas as constraints
SELECT 
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name IN ('profiles', 'subscriptions')
ORDER BY tc.table_name, tc.constraint_type;
```

## 📊 Estrutura Correta

### Relacionamentos:

```
auth.users (Supabase Auth)
    ↓ (id)
profiles (Dados públicos do usuário)
    ↓ (id → user_id)
subscriptions (Assinaturas)
    ↓ (plan_id)
plans (Planos disponíveis)
```

### Trigger Flow:

```
1. Usuário se registra
   ↓
2. auth.users → INSERT
   ↓
3. Trigger: on_auth_user_created
   ↓
4. Função: handle_new_user()
   ↓
5. INSERT em profiles
   ↓
6. INSERT em subscriptions (plano 'free')
   ↓
7. Usuário aparece no admin
```

## 📝 Arquivos Relacionados

- **Diagnóstico**: `diagnose-user-registration.sql`
- **Correção SQL**: `supabase/migrations/20250128_fix_missing_profiles.sql`
- **Script PS**: `fix-missing-profiles.ps1`
- **Service Admin**: `src/services/admin.ts` (linha 295)
- **Página Admin**: `src/pages/admin/AdminUsers.tsx`
- **Cadastro**: `src/pages/Cadastro.tsx` (linha 170)

## 🎯 Resumo

**Problema**: Usuários criados mas não aparecem no admin  
**Causa**: Profiles não sendo criados no trigger  
**Solução**: Recriar trigger + criar profiles faltantes  
**Teste**: Novo cadastro deve aparecer imediatamente no admin  

---

**Status**: ✅ Correção aplicada  
**Data**: 28/10/2025  
**Versão**: 1.0
