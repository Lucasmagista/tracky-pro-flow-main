# 🔧 SOLUÇÃO RÁPIDA: Erros em Admin Orders

## ❌ Erros

1. `PGRST200: Could not find a relationship between 'orders' and 'profiles'`
2. `42703: column profiles_1.email does not exist`

## ✅ Solução em 3 Passos

### 1. Abra o Supabase SQL Editor

- Acesse: https://supabase.com/dashboard
- Selecione seu projeto
- Vá em **SQL Editor**

### 2. Execute estas 2 Migrations

#### Migration 1: Fix Foreign Key Relationship

```sql
-- Fix Orders-Profiles Relationship
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_user_id_fkey;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);

-- Fix billing_history too
ALTER TABLE public.billing_history
  DROP CONSTRAINT IF EXISTS billing_history_user_id_fkey;

ALTER TABLE public.billing_history
  ADD CONSTRAINT billing_history_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_billing_history_user_id ON public.billing_history(user_id);
```

#### Migration 2: Add Email to Profiles

```sql
-- Add email and other columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS store_email TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS store_phone TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS store_address TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Sync email from auth.users
CREATE OR REPLACE FUNCTION public.sync_user_email()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id)
  DO UPDATE SET email = NEW.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_email();

-- Update existing profiles with email
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
AND p.email IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
```

### 3. Teste

- Atualize o navegador
- Acesse **Admin Panel → Orders**
- Deve carregar sem erro! ✅

## 📖 O que isso faz?

### Migration 1: Foreign Key

Muda a foreign key de `orders.user_id`:

- **Antes:** `auth.users(id)` ❌
- **Depois:** `profiles(id)` ✅

Permite que o PostgREST faça join entre orders e profiles.

### Migration 2: Email Column

Adiciona coluna `email` na tabela `profiles`:

- Copia email de `auth.users` automaticamente
- Cria trigger para sincronizar emails novos
- Adiciona outras colunas úteis (store_email, store_phone, etc)

## 📁 Arquivos Criados

1. **Migration 1:** `supabase/migrations/20250127_fix_orders_profiles_relationship.sql`
2. **Migration 2:** `supabase/migrations/20250127_add_email_to_profiles.sql`
3. **Script:** `apply-orders-fix.ps1` (opcional, copia SQL para clipboard)
4. **Docs:** `docs/FIX_ORDERS_PROFILES_RELATIONSHIP.md` (detalhes completos)

---

**Precisa de ajuda?** Veja o documento completo em `docs/FIX_ORDERS_PROFILES_RELATIONSHIP.md`
