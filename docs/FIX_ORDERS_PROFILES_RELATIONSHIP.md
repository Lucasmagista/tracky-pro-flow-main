# Fix: Orders-Profiles Relationship (PGRST200 Error)

## 🔴 Problema

**Erro:** `PGRST200 - Could not find a relationship between 'orders' and 'profiles' in the schema cache`

**Onde ocorre:** Admin Orders page ao tentar fazer query:

```sql
SELECT *, user:profiles(email, name) FROM orders
```

## 🔍 Causa Raiz

O PostgREST (API do Supabase) não consegue encontrar uma relação direta entre as tabelas `orders` e `profiles`.

**Situação atual:**

- `orders.user_id` → `auth.users(id)` ❌
- `profiles.id` → `auth.users(id)` ✅
- Não há FK direta entre `orders` ↔ `profiles` ❌

**O que o PostgREST precisa:**

- `orders.user_id` → `profiles.id` ✅

## ✅ Solução

Criar uma foreign key direta entre `orders.user_id` e `profiles.id`.

### Migração SQL

Arquivo: `supabase/migrations/20250127_fix_orders_profiles_relationship.sql`

**O que a migração faz:**

1. **Remove FK antiga** de `orders.user_id` → `auth.users(id)`
2. **Cria FK nova** de `orders.user_id` → `profiles.id`
3. **Remove FK antiga** de `billing_history.user_id` → `auth.users(id)`
4. **Cria FK nova** de `billing_history.user_id` → `profiles.id`
5. **Cria índices** para melhor performance em joins
6. **Recria policies RLS** (mesma lógica, só garante compatibilidade)
7. **Verifica** se as relações foram criadas com sucesso

### Por que isso funciona?

Como `profiles.id` também é uma foreign key para `auth.users(id)`, a relação é **transitiva**:

- `orders.user_id` → `profiles.id` → `auth.users(id)`

Isso permite que o PostgREST descubra a relação e faça o join corretamente.

## 🚀 Como Aplicar

### Opção 1: Script PowerShell (Recomendado)

```powershell
.\apply-orders-fix.ps1
```

Este script:

- ✅ Valida se o arquivo de migração existe
- ✅ Mostra o conteúdo do SQL
- ✅ Oferece copiar para clipboard
- ✅ Fornece instruções passo a passo

### Opção 2: Manual

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **SQL Editor**
4. Crie uma nova query
5. Cole o conteúdo de `20250127_fix_orders_profiles_relationship.sql`
6. Clique em **Run**

## ✅ Verificação

Após aplicar a migração:

1. **Verifique no SQL Editor:**

```sql
-- Verifica se a FK foi criada
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'orders'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'user_id';
```

**Resultado esperado:**

```
constraint_name: orders_user_id_fkey
table_name: orders
column_name: user_id
foreign_table_name: profiles
foreign_column_name: id
```

2. **Teste na aplicação:**
   - Acesse Admin Panel → Orders
   - A lista de pedidos deve carregar sem erro PGRST200
   - As colunas de usuário (email, name) devem aparecer

## 🎯 Impacto

### ✅ O que melhora

- ✅ Queries com joins entre `orders` e `profiles` funcionam
- ✅ Admin Orders page carrega corretamente
- ✅ Embedded resources do PostgREST funcionam
- ✅ Performance melhorada com índices

### ⚠️ Não afeta

- ✅ Dados existentes (nenhuma perda de dados)
- ✅ Lógica de autenticação (RLS policies permanecem as mesmas)
- ✅ Outras queries (compatibilidade mantida)
- ✅ Funcionalidade de usuário (tudo continua funcionando)

## 📝 Tabelas Afetadas

1. **orders**

   - FK: `user_id` agora referencia `profiles(id)`
   - Index: `idx_orders_user_id` criado

2. **billing_history**
   - FK: `user_id` agora referencia `profiles(id)`
   - Index: `idx_billing_history_user_id` criado

## 🔄 Rollback (Se necessário)

Se precisar reverter:

```sql
-- Reverter orders
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_user_id_fkey;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Reverter billing_history
ALTER TABLE public.billing_history
  DROP CONSTRAINT IF EXISTS billing_history_user_id_fkey;

ALTER TABLE public.billing_history
  ADD CONSTRAINT billing_history_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;
```

## 📚 Referências

- [PostgREST Relationships](https://postgrest.org/en/stable/api.html#resource-embedding)
- [Supabase Foreign Keys](https://supabase.com/docs/guides/database/tables#foreign-keys)
- [PGRST200 Error](https://postgrest.org/en/stable/errors.html#pgrst200)

## ✅ Status

- [x] Migração criada
- [x] Script de aplicação criado
- [ ] **Migração aplicada no banco** ← VOCÊ ESTÁ AQUI
- [ ] Testado na aplicação

## 🎉 Resultado Esperado

Após aplicar a migração:

```typescript
// Esta query agora funciona! ✅
const { data } = await supabase.from("orders").select(`
    *,
    user:profiles(email, name)
  `);
```

**Antes:** ❌ PGRST200 Error  
**Depois:** ✅ Dados carregam corretamente com informações do usuário
