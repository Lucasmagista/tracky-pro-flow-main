# 🚀 Sistema de Assinaturas Completo - Guia de Implementação

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Pré-requisitos](#pré-requisitos)
3. [Configuração do Stripe](#configuração-do-stripe)
4. [Configuração do Resend](#configuração-do-resend)
5. [Deploy das Edge Functions](#deploy-das-edge-functions)
6. [Configuração do Cron Job](#configuração-do-cron-job)
7. [Variáveis de Ambiente](#variáveis-de-ambiente)
8. [Testes](#testes)
9. [Funcionalidades Implementadas](#funcionalidades-implementadas)

---

## 🎯 Visão Geral

Sistema completo de assinaturas com:
- ✅ Pagamentos recorrentes via Stripe
- ✅ Emails transacionais via Resend
- ✅ Gestão automática de limites
- ✅ Cron jobs para billing
- ✅ Geração de faturas PDF
- ✅ Analytics e métricas (MRR, Churn, LTV)
- ✅ Cupons de desconto
- ✅ Addons/complementos
- ✅ Trial gratuito
- ✅ Multi-moeda
- ✅ Logs de auditoria

---

## 📦 Pré-requisitos

### 1. Conta Stripe
- Criar conta em https://stripe.com
- Ativar modo de teste

### 2. Conta Resend
- Criar conta em https://resend.com
- Verificar domínio de email

### 3. Supabase CLI
```powershell
# Instalar Supabase CLI
scoop install supabase

# Verificar instalação
supabase --version
```

---

## 💳 Configuração do Stripe

### Passo 1: Obter Chaves da API

1. Acesse https://dashboard.stripe.com/apikeys
2. Copie as chaves:
   - **Publishable key** (pk_test_...)
   - **Secret key** (sk_test_...)

### Passo 2: Configurar Webhook

1. Acesse https://dashboard.stripe.com/webhooks
2. Clique em "Add endpoint"
3. URL: `https://seu-projeto.supabase.co/functions/v1/stripe-webhook`
4. Selecione eventos:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copie o **Signing secret** (whsec_...)

### Passo 3: Criar Produtos e Preços

Execute no console do Stripe ou via API:

```javascript
// Criar produtos
const starterProduct = await stripe.products.create({
  name: 'Starter',
  description: 'Plano perfeito para começar'
});

const starterPrice = await stripe.prices.create({
  product: starterProduct.id,
  unit_amount: 2900, // R$ 29,00
  currency: 'brl',
  recurring: { interval: 'month' }
});

// Repetir para Professional e Enterprise
```

### Passo 4: Atualizar IDs no Banco

```sql
UPDATE plans SET 
  stripe_product_id = 'prod_xxxxx',
  stripe_price_id = 'price_xxxxx'
WHERE name = 'Starter';
```

---

## 📧 Configuração do Resend

### Passo 1: Obter API Key

1. Acesse https://resend.com/api-keys
2. Crie uma nova API key
3. Copie a key (re_...)

### Passo 2: Verificar Domínio

1. Acesse https://resend.com/domains
2. Adicione seu domínio
3. Configure registros DNS (SPF, DKIM, DMARC)
4. Aguarde verificação (até 48h)

### Passo 3: Configurar Email de Envio

Edite em `supabase/functions/_shared/resend.ts`:
```typescript
from: data.from || 'Tracky Pro <noreply@seudominio.com>'
```

---

## 🔧 Deploy das Edge Functions

### Passo 1: Aplicar Migrations

```powershell
# Navegar até o projeto
cd "C:\Users\Lucas TI\Pictures\tracky-pro-flow-main"

# Aplicar migration básica (já feito)
# Agora aplicar migration avançada
supabase db push
```

Ou via Supabase Dashboard:
1. Acesse SQL Editor
2. Copie conteúdo de `supabase/migrations/20250127_subscription_advanced.sql`
3. Execute

### Passo 2: Criar Bucket de Storage

```sql
-- No SQL Editor do Supabase
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true);

-- Policy para upload
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoices');

-- Policy para leitura
CREATE POLICY "Allow public downloads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'invoices');
```

### Passo 3: Deploy das Functions

```powershell
# Login no Supabase
supabase login

# Link com projeto
supabase link --project-ref seu-projeto-ref

# Deploy functions
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
supabase functions deploy billing-cron
supabase functions deploy analytics
supabase functions deploy generate-invoice

# Verificar deploy
supabase functions list
```

---

## ⏰ Configuração do Cron Job

### Opção 1: pg_cron (Recomendado para produção)

```sql
-- Habilitar extensão pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Configurar job diário às 00:00 UTC
SELECT cron.schedule(
  'billing-daily-job',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url:='https://seu-projeto.supabase.co/functions/v1/billing-cron',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
  );
  $$
);

-- Verificar jobs
SELECT * FROM cron.job;
```

### Opção 2: GitHub Actions (Para desenvolvimento)

Criar `.github/workflows/billing-cron.yml`:
```yaml
name: Daily Billing Cron

on:
  schedule:
    - cron: '0 0 * * *' # Diariamente às 00:00 UTC
  workflow_dispatch: # Permite execução manual

jobs:
  run-billing:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Billing Cron
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            https://seu-projeto.supabase.co/functions/v1/billing-cron
```

---

## 🔑 Variáveis de Ambiente

### No Supabase Dashboard

1. Acesse: Project Settings > Edge Functions > Secrets
2. Adicione as secrets:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
```

### No Frontend (.env.local)

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## 🧪 Testes

### 1. Testar Checkout

```typescript
// No frontend
const response = await supabase.functions.invoke('create-checkout', {
  body: {
    planId: 'uuid-do-plano',
    userId: 'uuid-do-usuario'
  }
});

console.log(response.data.url); // URL do checkout Stripe
```

### 2. Testar Webhook (Stripe CLI)

```powershell
# Instalar Stripe CLI
scoop install stripe

# Login
stripe login

# Escutar webhooks
stripe listen --forward-to https://seu-projeto.supabase.co/functions/v1/stripe-webhook

# Em outro terminal, testar evento
stripe trigger checkout.session.completed
```

### 3. Testar Cron Job

```powershell
curl -X POST `
  -H "Authorization: Bearer SEU_SERVICE_ROLE_KEY" `
  https://seu-projeto.supabase.co/functions/v1/billing-cron
```

### 4. Testar Analytics

```typescript
const { data } = await supabase.functions.invoke('analytics', {
  body: { userId: 'uuid', timeRange: '30d' }
});

console.log(data);
// { mrr: 1500, churnRate: 5.2, ltv: 450, ... }
```

---

## ✨ Funcionalidades Implementadas

### 1. Pagamentos e Billing
- ✅ Checkout via Stripe
- ✅ Cobranças recorrentes automáticas
- ✅ Webhooks para eventos de pagamento
- ✅ Histórico de faturas
- ✅ Geração de faturas PDF
- ✅ Retry automático de pagamentos falhos

### 2. Gestão de Assinaturas
- ✅ Upgrade/Downgrade de planos
- ✅ Cancelamento com feedback
- ✅ Reativação de assinatura
- ✅ Trial gratuito (7/14 dias)
- ✅ Cupons de desconto
- ✅ Addons/complementos

### 3. Limites e Uso
- ✅ Tracking automático de uso
- ✅ Bloqueio ao exceder limites
- ✅ Reset automático no novo período
- ✅ Alertas em 80% de uso
- ✅ Dashboard de uso em tempo real

### 4. Emails Transacionais
- ✅ Boas-vindas ao assinar
- ✅ Confirmação de pagamento
- ✅ Lembrete 3 dias antes
- ✅ Alerta de limite próximo
- ✅ Confirmação de cancelamento
- ✅ Templates profissionais

### 5. Analytics e Métricas
- ✅ MRR (Monthly Recurring Revenue)
- ✅ Churn Rate
- ✅ LTV (Lifetime Value)
- ✅ Revenue por plano
- ✅ Histórico de crescimento
- ✅ Métricas de subscription

### 6. Segurança
- ✅ RLS em todas as tabelas
- ✅ Validação de webhooks Stripe
- ✅ Logs de auditoria
- ✅ Proteção contra uso excessivo

### 7. Multi-moeda
- ✅ BRL, USD, EUR
- ✅ Conversão automática
- ✅ Preços por região

---

## 📊 Estrutura do Banco de Dados

```
profiles
├── stripe_customer_id

subscriptions
├── stripe_subscription_id
├── trial_start
├── trial_end

plans
├── stripe_price_id
├── stripe_product_id
├── trial_period_days

billing_history
├── stripe_invoice_id
├── invoice_url
├── currency

coupons (novo)
├── code
├── discount_type
├── discount_value
├── stripe_coupon_id

addons (novo)
├── name
├── price
├── limits

subscription_addons (novo)
├── subscription_id
├── addon_id

audit_logs (novo)
├── user_id
├── action
├── resource_type
```

---

## 🔄 Fluxo de Assinatura

1. **Usuário seleciona plano** → Frontend
2. **Cria checkout session** → `create-checkout` function
3. **Redireciona para Stripe** → Stripe Checkout
4. **Usuário paga** → Stripe
5. **Webhook recebido** → `stripe-webhook` function
6. **Cria subscription no banco** → Supabase
7. **Envia email de boas-vindas** → Resend
8. **Gera fatura PDF** → `generate-invoice` function
9. **Envia email com fatura** → Resend

---

## 🆘 Troubleshooting

### Webhook não está funcionando
- Verifique se o `STRIPE_WEBHOOK_SECRET` está correto
- Teste com `stripe listen --forward-to`
- Veja logs em Functions > stripe-webhook

### Emails não estão sendo enviados
- Verifique se domínio está verificado no Resend
- Confirme `RESEND_API_KEY` está correta
- Veja logs em Functions > billing-cron

### Limites não estão bloqueando
- Verifique se trigger foi criado corretamente:
  ```sql
  SELECT * FROM pg_trigger WHERE tgname = 'check_order_limits';
  ```
- Teste manualmente:
  ```sql
  SELECT check_subscription_limits();
  ```

### Cron job não executa
- pg_cron: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`
- Verifique permissões do service role key
- Teste manualmente a function

---

## 📚 Próximos Passos

1. ✅ Aplicar migrations
2. ✅ Configurar Stripe e Resend
3. ✅ Deploy das Edge Functions
4. ✅ Configurar cron job
5. ⏳ Instalar dependências frontend
6. ⏳ Implementar UI com gráficos
7. ⏳ Testes E2E
8. ⏳ Deploy produção

---

## 💡 Dicas

- Use Stripe Test Mode durante desenvolvimento
- Configure webhooks para dev e produção separadamente
- Monitore logs das Edge Functions regularmente
- Teste todos os fluxos antes de produção
- Configure alertas para pagamentos falhos

---

## 🤝 Suporte

- Documentação Stripe: https://stripe.com/docs
- Documentação Resend: https://resend.com/docs
- Supabase Docs: https://supabase.com/docs
- Issues: Abra issue no repositório

---

**Sistema desenvolvido com ❤️ usando Stripe, Resend e Supabase**
