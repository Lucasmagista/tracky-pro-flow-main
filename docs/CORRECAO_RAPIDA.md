# 🔧 Correção Rápida - Erros 406 e 404

## 🚨 Problema Atual

- ❌ **406 (Not Acceptable)** em `notification_settings` → Problema de RLS/Policies
- ❌ **404 (Not Found)** em `notification_templates` → Tabela não existe

## ✅ Solução em 3 Passos

### Passo 1: Execute o Script de Correção

1. Abra o **Supabase Dashboard** → SQL Editor
2. Copie TODO o conteúdo do arquivo `FIX_DATABASE_ISSUES.sql`
3. Cole e execute (Run)

### Passo 2: Verifique as Criações

Execute esta query para verificar:

```sql
-- Deve retornar 7 tabelas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'notification_settings',
  'notification_templates',
  'marketplace_integrations', 
  'carrier_integrations',
  'webhook_configs',
  'webhook_events',
  'sync_logs'
)
ORDER BY table_name;
```

### Passo 3: Teste na Aplicação

1. Recarregue a aplicação (F5)
2. Acesse a página de **Settings/Configurações**
3. ✅ Os erros 406 e 404 devem desaparecer

## 📋 O que o Script Corrige

### 1. Cria tabela faltante
- ✅ `notification_templates` (com estrutura completa)

### 2. Corrige RLS Policies
- ✅ Remove policies antigas/incorretas
- ✅ Cria policies separadas para SELECT, INSERT, UPDATE, DELETE
- ✅ Garante que cada usuário só vê seus próprios dados

### 3. Insere dados padrão
- ✅ Templates padrão (Email, WhatsApp, SMS) para todos os usuários
- ✅ Configurações de notificação padrão
- ✅ Usa `ON CONFLICT DO NOTHING` para não duplicar

### 4. Cria índices e triggers
- ✅ Índices otimizados para queries
- ✅ Trigger `updated_at` automático

## 🔍 Verificações Incluídas no Script

O script inclui 4 queries de verificação no final:

1. **Verificar tabelas criadas** → Deve mostrar 7 tabelas com PK e policies
2. **Verificar policies** → Deve mostrar múltiplas policies por tabela
3. **Verificar templates padrão** → Deve mostrar 3 templates (email, whatsapp, sms)
4. **Verificar configurações** → Deve mostrar suas configurações de notificação

## ⚡ Diferenças deste Script

Este script é **diferente** do anterior porque:

- ✅ Cria a tabela `notification_templates` que estava faltando
- ✅ Corrige policies com separação por operação (SELECT/INSERT/UPDATE/DELETE)
- ✅ Insere dados padrão automaticamente
- ✅ Inclui queries de verificação no final

## 🎯 Resultado Esperado

### Antes:
```
❌ 406 (Not Acceptable) - notification_settings
❌ 404 (Not Found) - notification_templates
```

### Depois:
```
✅ 200 (OK) - notification_settings
✅ 200 (OK) - notification_templates
✅ Dados padrão carregados
✅ Settings funcionando normalmente
```

## 🆘 Se Ainda Houver Erro

### Erro: "permission denied"
```sql
-- Execute como admin:
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated;
```

### Erro: "column user_id does not exist"
```sql
-- Verifique a estrutura da tabela:
\d notification_settings
\d notification_templates
```

### Erro: "function auth.uid() does not exist"
Certifique-se de estar executando no projeto correto do Supabase.

## 📞 Logs Úteis

Após executar, verifique no console do navegador:
- ✅ Não deve haver mais erros 404 ou 406
- ✅ Dados devem carregar normalmente
- ✅ Settings deve mostrar seus dados

---

**Arquivo a executar:** `FIX_DATABASE_ISSUES.sql`

**Tempo estimado:** ~10 segundos para executar
