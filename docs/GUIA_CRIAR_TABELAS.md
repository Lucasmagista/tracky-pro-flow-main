# 🔧 Guia para Criar Tabelas Faltantes no Supabase

## ❌ Problema Identificado

As seguintes tabelas não existem no banco de dados do Supabase:

1. ❌ `notification_settings`
2. ❌ `marketplace_integrations`
3. ❌ `carrier_integrations`
4. ❌ `webhook_configs`
5. ❌ `webhook_events`
6. ❌ `sync_logs`

## ✅ Solução Rápida (Recomendado)

### Passo 1: Acessar o Supabase Dashboard

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto **tracky-pro-flow**
3. No menu lateral esquerdo, clique em **SQL Editor**

### Passo 2: Executar o Script

1. Clique em **New Query** (ou use Ctrl+Enter)
2. Abra o arquivo `CREATE_MISSING_TABLES.sql` que acabei de criar
3. Copie TODO o conteúdo do arquivo
4. Cole no editor SQL do Supabase
5. Clique em **Run** (ou pressione Ctrl+Enter)

### Passo 3: Verificar Criação

Após executar o script, execute esta query para verificar se as tabelas foram criadas:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'notification_settings',
  'marketplace_integrations', 
  'carrier_integrations',
  'webhook_configs',
  'webhook_events',
  'sync_logs'
)
ORDER BY table_name;
```

**Resultado esperado:** Deve retornar 6 linhas com os nomes das tabelas.

### Passo 4: Atualizar Tipos TypeScript (Opcional)

Após criar as tabelas, regenere os tipos do Supabase:

```bash
npx supabase gen types typescript --project-id swcmlwtyinsdppncxfqe > src/integrations/supabase/types.ts
```

## 📋 O que o Script Faz?

1. ✅ Cria as 6 tabelas faltantes
2. ✅ Configura Row Level Security (RLS)
3. ✅ Cria policies de acesso (usuário só vê seus próprios dados)
4. ✅ Cria índices para otimizar queries
5. ✅ Configura triggers para atualizar `updated_at` automaticamente
6. ✅ Estabelece foreign keys e constraints

## 🔍 Estrutura das Tabelas Criadas

### 1. notification_settings
- Configurações de notificações do usuário
- Campos: whatsapp_enabled, email_enabled, sms_enabled, etc.

### 2. marketplace_integrations
- Integrações com marketplaces (Shopify, WooCommerce, Mercado Livre)
- Campos: marketplace, api_key, api_secret, access_token, store_url, etc.

### 3. carrier_integrations
- Integrações com transportadoras (Correios, Jadlog, etc.)
- Campos: carrier, credentials (JSONB), settings (JSONB)

### 4. webhook_configs
- Configurações de webhooks para sincronização automática
- Campos: platform, webhook_url, webhook_secret, events, is_active

### 5. webhook_events
- Eventos recebidos dos webhooks
- Campos: event_type, payload (JSONB), status, error_message

### 6. sync_logs
- Logs de sincronização bidirecional
- Campos: order_id, platform, sync_type, status, error_message

## ⚠️ Importante

- ✅ Todas as tabelas têm RLS habilitado
- ✅ Usuários só podem acessar seus próprios dados
- ✅ Foreign keys garantem integridade referencial
- ✅ Triggers mantêm `updated_at` sincronizado automaticamente

## 🚀 Após a Execução

Depois de criar as tabelas:

1. ✅ Recarregue a aplicação (F5)
2. ✅ Os erros 404 devem desaparecer
3. ✅ As funcionalidades de integração estarão disponíveis
4. ✅ Configurações de notificação funcionarão normalmente

## 🆘 Problemas Comuns

### Erro: "permission denied for schema public"
**Solução:** Certifique-se de estar logado como administrador do projeto no Supabase.

### Erro: "relation already exists"
**Solução:** As tabelas já existem. Verifique se o script já foi executado anteriormente.

### Erro: "column does not exist"
**Solução:** Execute o script completo novamente. Algumas tabelas podem estar com schema incompleto.

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do Supabase
2. Execute as queries de verificação
3. Confirme que está usando a versão correta do projeto Supabase
