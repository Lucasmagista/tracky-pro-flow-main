# Checklist de Deploy - Smartenvios + Nuvemshop

## 📋 Pré-Deploy

### Ambiente de Desenvolvimento

- [ ] Todas as migrations aplicadas localmente
- [ ] Testes manuais completos (ver PLANO_DE_TESTES.md)
- [ ] Zero erros de compilação TypeScript
- [ ] Todas as funcionalidades testadas

### Código

- [ ] Branch main atualizada
- [ ] Código revisado (code review)
- [ ] Comentários e documentação atualizados
- [ ] Variáveis de ambiente documentadas

### Banco de Dados

- [ ] Migration 005_smartenvios_nuvemshop.sql revisada
- [ ] RLS policies testadas
- [ ] Indexes criados
- [ ] Triggers funcionando

---

## 🚀 Deploy Staging

### 1. Preparar Ambiente

```powershell
# Clone ou pull da main
git checkout main
git pull origin main

# Instalar dependências
npm install

# Build para staging
npm run build:dev
```

### 2. Aplicar Migrations

```powershell
# Conectar ao banco staging
npx supabase link --project-ref <staging-project-ref>

# Aplicar migrations
npx supabase db push

# Verificar sucesso
npx supabase db inspect
```

### 3. Configurar Variáveis de Ambiente

```env
# .env.staging
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx

# URLs de callback
VITE_NUVEMSHOP_REDIRECT_URI=https://staging.tracky.com/integrations/nuvemshop/callback
VITE_SMARTENVIOS_WEBHOOK_URL=https://staging.tracky.com/api/webhooks/smartenvios
VITE_NUVEMSHOP_WEBHOOK_URL=https://staging.tracky.com/api/webhooks/nuvemshop
```

### 4. Deploy Aplicação

```powershell
# Deploy para Vercel/Netlify
vercel --prod

# Ou build estático
npm run build
# Upload para servidor
```

### 5. Verificar Deploy

- [ ] Aplicação carrega sem erros
- [ ] Autenticação funciona
- [ ] Dashboard exibe corretamente
- [ ] Console do navegador sem erros

---

## 🧪 Testes em Staging

### Integração Nuvemshop

- [ ] Criar app de teste no Nuvemshop Partners
- [ ] Configurar redirect URI para staging
- [ ] Testar OAuth flow completo
- [ ] Sincronizar pedidos de teste
- [ ] Verificar dados no banco
- [ ] Testar desconexão

### Integração Smartenvios

- [ ] Usar API Key de sandbox
- [ ] Testar conexão
- [ ] Rastrear código de teste
- [ ] Verificar cache funcionando
- [ ] Testar validação de códigos

### Webhooks

```powershell
# Usar ngrok ou similar para testar webhooks
ngrok http 3000

# Registrar webhook de teste
# URL: https://xxx.ngrok.io/api/webhooks/nuvemshop
```

- [ ] Webhook Nuvemshop recebe eventos
- [ ] Webhook Smartenvios recebe eventos
- [ ] Eventos são processados corretamente
- [ ] Erros são logados

### Dashboard

- [ ] Widget Nuvemshop carrega
- [ ] Widget Smartenvios carrega
- [ ] Estatísticas corretas
- [ ] Busca rápida funciona
- [ ] Links funcionam

---

## 🔐 Segurança

### Pré-Deploy

- [ ] API Keys não estão no código
- [ ] Secrets estão em variáveis de ambiente
- [ ] RLS policies ativas
- [ ] CORS configurado corretamente
- [ ] Rate limiting implementado

### Webhooks

- [ ] Assinatura de webhooks validada
- [ ] HTTPS obrigatório
- [ ] Headers de segurança configurados
- [ ] Logs de acesso habilitados

### Dados Sensíveis

- [ ] Access tokens criptografados
- [ ] API Keys não expostas no frontend
- [ ] Logs não contêm dados sensíveis
- [ ] Backup de banco configurado

---

## 📊 Monitoramento

### Métricas a Acompanhar

- [ ] Taxa de sucesso de OAuth
- [ ] Tempo de sincronização de pedidos
- [ ] Taxa de erro de webhooks
- [ ] Tempo de resposta de APIs
- [ ] Uso de cache

### Alertas

```javascript
// Configurar alertas para:
- Erros 5xx > 1%
- Tempo de resposta > 5s
- Webhooks falhando > 5%
- Banco de dados offline
```

### Logs

- [ ] Application logs configurados
- [ ] Error tracking (Sentry/Rollbar)
- [ ] Performance monitoring (APM)
- [ ] Database slow queries

---

## 🚀 Deploy Produção

### Checklist Final

- [ ] Staging testado completamente
- [ ] Todos os bugs resolvidos
- [ ] Documentação atualizada
- [ ] Usuários notificados
- [ ] Rollback plan pronto

### 1. Backup

```powershell
# Backup do banco de produção
npx supabase db dump > backup_pre_deploy_$(date +%Y%m%d).sql

# Backup de arquivos
tar -czf backup_files_$(date +%Y%m%d).tar.gz dist/
```

### 2. Aplicar Migrations

```powershell
# Conectar ao banco produção
npx supabase link --project-ref <prod-project-ref>

# ATENÇÃO: Confirme 3x antes de rodar!
npx supabase db push

# Verificar
npx supabase db inspect
```

### 3. Deploy Aplicação

```powershell
# Build de produção
npm run build

# Deploy
vercel --prod
# ou
npm run deploy
```

### 4. Configurar Apps de Produção

#### Nuvemshop

1. Criar app de produção em https://partners.nuvemshop.com.br/
2. Configurar:
   - Redirect URI: `https://tracky.com/integrations/nuvemshop/callback`
   - Webhook URL: `https://tracky.com/api/webhooks/nuvemshop`
   - Escopos: `read_orders, write_orders, read_shipping, write_shipping`

#### Smartenvios

1. Obter API Key de produção
2. Configurar:
   - Webhook URL: `https://tracky.com/api/webhooks/smartenvios`
   - Eventos: `tracking.update, tracking.delivered`

### 5. Smoke Tests

- [ ] Homepage carrega
- [ ] Login funciona
- [ ] Dashboard exibe
- [ ] Nuvemshop OAuth funciona
- [ ] Smartenvios rastreamento funciona
- [ ] Webhooks recebem eventos

---

## 📢 Comunicação

### Pré-Deploy (24h antes)

```
🚀 Deploy Programado

Data: 27/10/2025 22:00 BRT
Duração: ~30 minutos
Impacto: Nenhum downtime esperado

Novidades:
✨ Integração com Nuvemshop
✨ Integração com Smartenvios
✨ Novos widgets no Dashboard

Docs: https://docs.tracky.com/integrações
```

### Durante Deploy

```
🔧 Deploy em andamento...

Etapa 1/5: Backup ✅
Etapa 2/5: Migrations ✅
Etapa 3/5: Deploy app 🔄
Etapa 4/5: Testes
Etapa 5/5: Validação
```

### Pós-Deploy

```
✅ Deploy Concluído!

As novas integrações estão disponíveis:
- 🛒 Nuvemshop: Sincronize pedidos automaticamente
- 📦 Smartenvios: Rastreamento inteligente

Como usar:
1. Vá em Configurações → Integrações
2. Conecte sua conta
3. Comece a usar!

Docs: https://docs.tracky.com/quickstart
Suporte: suporte@tracky.com
```

---

## 🔄 Rollback Plan

### Se algo der errado:

#### 1. Rollback Imediato (< 5 min)

```powershell
# Reverter deploy da aplicação
vercel rollback

# Ou usar versão anterior
git revert HEAD
npm run build
npm run deploy
```

#### 2. Rollback de Migration (10-15 min)

```sql
-- Remover tabelas criadas
DROP TABLE IF EXISTS nuvemshop_orders_cache CASCADE;
DROP TABLE IF EXISTS smartenvios_trackings CASCADE;
-- Manter carrier_integrations, apenas remover registros
DELETE FROM carrier_integrations WHERE carrier IN ('smartenvios', 'nuvemshop');
```

#### 3. Notificar Usuários

```
⚠️ Rollback Realizado

Revertemos para versão anterior devido a [motivo].
Novas integrações temporariamente indisponíveis.

Estimativa de retorno: [data/hora]

Pedimos desculpas pelo inconveniente.
```

---

## ✅ Validação Pós-Deploy

### Imediatamente Após (0-30 min)

- [ ] Aplicação está online
- [ ] Sem erros 5xx
- [ ] Login funciona
- [ ] Dashboard carrega
- [ ] Integrações aparecem

### Primeiras 24h

- [ ] Monitorar logs de erro
- [ ] Verificar uso de recursos
- [ ] Acompanhar taxa de erro
- [ ] Validar webhooks funcionando
- [ ] Responder dúvidas de usuários

### Primeira Semana

- [ ] Análise de métricas
- [ ] Feedback de usuários
- [ ] Ajustes de performance
- [ ] Documentação de issues
- [ ] Planejamento de melhorias

---

## 📈 Métricas de Sucesso

### Técnicas

- ✅ Uptime > 99.9%
- ✅ Erro rate < 0.1%
- ✅ Response time < 200ms
- ✅ Zero data loss

### Negócio

- 📊 Integrações ativas: Meta 50+
- 📊 Pedidos sincronizados: Meta 1000+
- 📊 Taxa de adoção: Meta 30%
- 📊 NPS > 8

### Usuários

- ⭐ Facilidade de setup: 4.5/5
- ⭐ Satisfação geral: 4.7/5
- ⭐ Suporte responsivo: < 1h

---

## 📚 Documentos de Referência

- ✅ INTEGRACAO_SMARTENVIOS_NUVEMSHOP.md - Planning completo
- ✅ PLANO_DE_TESTES.md - Testes manuais
- ✅ GUIA_RAPIDO.md - Quick start
- ✅ FINAL_IMPLEMENTATION_SUMMARY.md - Resumo técnico
- ✅ INTEGRACAO_README.md - README das integrações

---

## 🆘 Contatos de Emergência

### Time de Deploy

- 👨‍💻 Dev Lead: [nome] - [telefone]
- 🔧 DevOps: [nome] - [telefone]
- 🎨 Product: [nome] - [telefone]

### Serviços

- ☁️ Supabase Support: support@supabase.com
- 🚀 Vercel Support: support@vercel.com
- 🛒 Nuvemshop: developers@nuvemshop.com
- 📦 Smartenvios: suporte@smartenvios.com

---

**Checklist Version**: 1.0  
**Last Updated**: 26/10/2025  
**Status**: ✅ Pronto para Deploy Staging  
**Next Step**: Aplicar migration em staging
