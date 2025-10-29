# 🚚 Sistema de Rastreamento Inteligente - Documentação Completa

## 📋 Visão Geral

Sistema completo de rastreamento multi-transportadora com atualização automática, detecção de atrasos e alertas proativos.

## ✅ Componentes Implementados

### 1. **Edge Function - Rastreamento Multi-Transportadora** ✅
**Arquivo:** `supabase/functions/track-multi-carrier/index.ts`

**Recursos:**
- ✅ Suporte a múltiplas transportadoras:
  - **Correios** (via Linketrack API)
  - **Jadlog** (API direta)
  - **Melhor Envio** (Bearer token)
- ✅ Auto-detecção de transportadora por padrão de código
- ✅ Normalização de status entre transportadoras
- ✅ Cache de rastreamento para evitar chamadas redundantes
- ✅ Tratamento de erros e retry logic

**Padrões de Código:**
```typescript
// Correios: BR123456789BR
/^[A-Z]{2}\d{9}[A-Z]{2}$/

// Jadlog: 1234567890
/^\d{10,}[-.]?\d*$/

// Melhor Envio: 8b9f2e3a-...
/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
```

**Status Normalizados:**
- `posted` - Objeto postado
- `in_transit` - Em trânsito
- `out_for_delivery` - Saiu para entrega
- `delivered` - Entregue
- `delivery_failed` - Falha na entrega
- `delayed` - Atrasado
- `exception` - Exceção/Problema
- `unknown` - Status desconhecido

### 2. **Sistema de Webhooks** ✅
**Arquivo:** `supabase/functions/tracking-webhook/index.ts` (JÁ EXISTIA)

**Recursos:**
- ✅ Validação de assinatura HMAC (SHA-256, MD5)
- ✅ Atualização automática de pedidos
- ✅ Registro de histórico (order_history)
- ✅ Geração de alertas proativos
- ✅ Envio de notificações (email + WhatsApp)
- ✅ Retry logic com backoff exponencial
- ✅ Suporte multi-transportadora

**Tipos de Alertas Gerados:**
- `delay_warning` - Atraso detectado (prioridade: high)
- `delivery_reminder` - Lembrete de entrega (prioridade: normal)
- `exception_alert` - Exceção/Problema (prioridade: urgent)
- `status_change` - Mudança de status (prioridade: normal)

### 3. **Atualização Automática** ✅
**Arquivos:**
- `src/hooks/useAutoTrackingUpdates.ts` - Hook React
- `supabase/functions/auto-tracking-cron/index.ts` - Cron job

**Recursos:**
- ✅ Polling inteligente baseado em status
- ✅ Cache para evitar chamadas redundantes
- ✅ Atualização em lotes (batch processing)
- ✅ Intervalo adaptativo por status:
  - Saiu para entrega: 30 minutos
  - Em trânsito: 2 horas
  - Atrasado/Exceção: 1 hora
  - Postado: 4 horas
  - Pendente: 6 horas
  - Entregue: 24 horas (parado)
- ✅ Real-time via Supabase Realtime
- ✅ Notificações push no navegador

**Uso do Hook:**
```typescript
const { 
  isUpdating, 
  lastUpdate, 
  updatedCount,
  manualUpdate,
  updateSpecific 
} = useAutoTrackingUpdates({
  enabled: true,
  interval: 60 * 60 * 1000, // 1 hora
  onlyPending: true, // Apenas não entregues
  useCache: true
});
```

### 4. **Detecção de Atrasos** ✅
**Arquivo:** `src/services/delayDetectionService.ts`

**Recursos:**
- ✅ Cálculo de dias úteis (ignora fins de semana)
- ✅ SLA por transportadora e tipo de serviço
- ✅ Análise de severidade:
  - `none` - Sem atraso
  - `warning` - 1-2 dias de atraso
  - `critical` - 3-5 dias de atraso
  - `urgent` - Mais de 5 dias de atraso
- ✅ Performance histórica da transportadora
- ✅ Predição de entrega com confiança (0-100%)
- ✅ Fatores de atraso identificados
- ✅ Probabilidade de atraso futuro

**Análise de Atraso:**
```typescript
const analysis = await delayDetectionService.analyzeDelay(
  orderId,
  trackingCode,
  carrier
);

// Retorna:
{
  is_delayed: true,
  delay_severity: 'critical',
  delay_days: 4,
  predicted_delivery: '2025-01-28T00:00:00.000Z',
  confidence: 75,
  factors: [
    'Sem movimentação há 3 dias',
    'Histórico da transportadora indica atrasos'
  ]
}
```

**Predição de Atraso:**
```typescript
const prediction = await delayDetectionService.predictDelay(
  orderId,
  trackingCode
);

// Retorna:
{
  will_be_delayed: true,
  probability: 78,
  estimated_delay_days: 3,
  factors: [
    { factor: 'Status atual', impact: 80, description: '...' },
    { factor: 'Falta de atualizações', impact: 60, description: '...' }
  ]
}
```

### 5. **Dashboard de Alertas Proativos** ✅
**Arquivo:** `src/components/ProactiveAlertsManager.tsx`

**Recursos:**
- ✅ Estatísticas em tempo real:
  - Total de alertas
  - Não lidos
  - Urgentes
  - Alta prioridade
  - Resolvidos
- ✅ Filtros inteligentes (Todos, Não Lidos, Urgentes)
- ✅ Real-time via Supabase Realtime
- ✅ Detalhamento completo de alertas
- ✅ Ações:
  - Marcar como lido
  - Resolver alerta
  - Excluir alerta
- ✅ Badges de prioridade coloridas
- ✅ Ícones por tipo de alerta

**Uso do Componente:**
```tsx
import { ProactiveAlertsManager } from '@/components/ProactiveAlertsManager';

function AlertsPage() {
  return <ProactiveAlertsManager />;
}
```

## 🔧 Configuração

### 1. Configurar Edge Functions

```bash
# Deploy das edge functions
cd supabase

# Function de rastreamento
supabase functions deploy track-multi-carrier

# Function de webhook
supabase functions deploy tracking-webhook

# Function de cron
supabase functions deploy auto-tracking-cron
```

### 2. Configurar Secrets

```bash
# API Keys das transportadoras
supabase secrets set LINKETRACK_API_KEY=your_key_here
supabase secrets set JADLOG_API_KEY=your_key_here
supabase secrets set MELHOR_ENVIO_API_TOKEN=your_token_here

# Webhook secrets
supabase secrets set WEBHOOK_SECRET=your_secret_here
```

### 3. Configurar Cron Job

Adicionar ao `supabase/config.toml`:

```toml
[functions.auto-tracking-cron]
schedule = "0 * * * *"  # A cada hora
```

Ou usar serviço externo (cron-job.org, GitHub Actions):

```bash
curl -X POST https://your-project.supabase.co/functions/v1/auto-tracking-cron \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### 4. Configurar Webhooks nas Transportadoras

**Correios (Linketrack):**
```
URL: https://your-project.supabase.co/functions/v1/tracking-webhook
Method: POST
Secret: your_webhook_secret
```

**Jadlog:**
```
URL: https://your-project.supabase.co/functions/v1/tracking-webhook
Method: POST
Header: X-Jadlog-Signature
```

**Melhor Envio:**
```
URL: https://your-project.supabase.co/functions/v1/tracking-webhook
Method: POST
Header: X-Melhor-Envio-Signature
```

## 📊 Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                  RASTREAMENTO INTELIGENTE                    │
└─────────────────────────────────────────────────────────────┘

1. ATUALIZAÇÃO AUTOMÁTICA (Cron)
   ↓
   [auto-tracking-cron] → Verifica pedidos pendentes
   ↓
   Chama [track-multi-carrier] para cada pedido
   ↓
   Atualiza tracking_cache + orders
   ↓
   Detecta atrasos → Cria alertas proativos

2. WEBHOOKS (Tempo Real)
   ↓
   [tracking-webhook] → Recebe evento da transportadora
   ↓
   Valida assinatura HMAC
   ↓
   Atualiza pedido + histórico
   ↓
   Gera alertas + notificações

3. ATUALIZAÇÃO MANUAL (UI)
   ↓
   useAutoTrackingUpdates.updateSpecific()
   ↓
   Chama edge function
   ↓
   Atualização em tempo real via Realtime

4. DETECÇÃO DE ATRASOS
   ↓
   delayDetectionService.scanAllOrders()
   ↓
   Analisa SLA + histórico + padrões
   ↓
   Gera alertas de delay_warning

5. DASHBOARD DE ALERTAS
   ↓
   ProactiveAlertsManager
   ↓
   Carrega alertas da tabela proactive_alerts
   ↓
   Real-time updates via subscription
```

## 🎯 Casos de Uso

### Caso 1: Rastreamento Manual
```typescript
import { supabase } from '@/integrations/supabase/client';

// Rastrear código específico
const { data } = await supabase.functions.invoke('track-multi-carrier', {
  body: {
    tracking_code: 'BR123456789BR',
    carrier: 'correios' // Opcional (auto-detecta)
  }
});

console.log(data.current_status); // 'in_transit'
console.log(data.events); // Array de eventos
```

### Caso 2: Atualização Automática em Componente
```tsx
import { useAutoTrackingUpdates } from '@/hooks/useAutoTrackingUpdates';

function OrderTracking() {
  const { isUpdating, lastUpdate, manualUpdate } = useAutoTrackingUpdates({
    enabled: true,
    interval: 30 * 60 * 1000, // 30 min
    onlyPending: true,
    useCache: true
  });

  return (
    <div>
      <p>Última atualização: {lastUpdate?.toLocaleString()}</p>
      <button onClick={manualUpdate} disabled={isUpdating}>
        Atualizar Agora
      </button>
    </div>
  );
}
```

### Caso 3: Análise de Atraso
```typescript
import { delayDetectionService } from '@/services/delayDetectionService';

// Analisar atraso
const analysis = await delayDetectionService.analyzeDelay(
  orderId,
  'BR123456789BR',
  'correios'
);

if (analysis.is_delayed) {
  console.log(`Atrasado ${analysis.delay_days} dias`);
  console.log(`Severidade: ${analysis.delay_severity}`);
  console.log(`Fatores: ${analysis.factors.join(', ')}`);
}

// Prever atraso futuro
const prediction = await delayDetectionService.predictDelay(
  orderId,
  'BR123456789BR'
);

if (prediction.will_be_delayed) {
  console.log(`Probabilidade de atraso: ${prediction.probability}%`);
  console.log(`Atraso estimado: ${prediction.estimated_delay_days} dias`);
}
```

### Caso 4: Real-time Tracking
```tsx
import { useRealtimeTracking } from '@/hooks/useAutoTrackingUpdates';

function TrackingDetails({ trackingCode }) {
  const { updates } = useRealtimeTracking(trackingCode);

  return (
    <div>
      {updates.map((update, i) => (
        <div key={i}>
          <p>{update.status} - {update.last_updated}</p>
        </div>
      ))}
    </div>
  );
}
```

## 📈 Métricas e Performance

### KPIs do Sistema
- **Taxa de Atualização:** % de rastreamentos atualizados com sucesso
- **Tempo de Resposta:** Média de tempo de resposta das APIs
- **Taxa de Cache Hit:** % de consultas atendidas pelo cache
- **Alertas Gerados:** Número de alertas proativos criados
- **Precisão de Predição:** Acurácia das predições de atraso

### Otimizações Implementadas
- ✅ Cache de 15 minutos para evitar calls redundantes
- ✅ Batch processing (3-5 pedidos por vez)
- ✅ Rate limiting com delay entre lotes
- ✅ Intervalo adaptativo baseado em status
- ✅ Retry logic com backoff exponencial

## 🚀 Próximos Passos

### Melhorias Futuras
1. **Machine Learning:** Modelo de predição de atrasos mais sofisticado
2. **Mais Transportadoras:** Total Express, Azul Cargo, etc.
3. **Análise de Rotas:** Mapear rotas e identificar gargalos
4. **Benchmark de Transportadoras:** Comparar performance
5. **Alertas Preditivos:** Alertar ANTES do atraso acontecer
6. **Dashboard Analytics:** Visualizações avançadas de performance

### Integrações Pendentes
- [ ] API Real dos Correios (além do Linketrack)
- [ ] Kangu
- [ ] Loggi
- [ ] Total Express
- [ ] Azul Cargo

## 📝 Tabelas do Banco de Dados

### tracking_cache
```sql
- tracking_code (PK)
- carrier
- current_status
- events JSONB
- estimated_delivery
- last_updated
- metadata JSONB
```

### proactive_alerts
```sql
- id (PK)
- order_id (FK)
- alert_type
- priority (low, normal, high, urgent)
- title
- message
- metadata JSONB
- is_read
- is_resolved
- created_at
- resolved_at
```

### order_history
```sql
- id (PK)
- order_id (FK)
- event_type
- description
- metadata JSONB
- created_at
```

## 🐛 Troubleshooting

### Problema: Rastreamento não atualiza
**Solução:**
1. Verificar se o código de rastreamento está correto
2. Confirmar que a transportadora está configurada
3. Checar logs da edge function
4. Verificar se há rate limiting

### Problema: Alertas não aparecem
**Solução:**
1. Verificar permissões RLS na tabela proactive_alerts
2. Confirmar subscription do Realtime
3. Checar se o filtro está correto

### Problema: Cache não funciona
**Solução:**
1. Verificar se useCache está habilitado
2. Confirmar que tracking_cache tem dados
3. Checar timestamp do last_updated

## 📞 Suporte

Para dúvidas ou problemas:
1. Consultar logs das edge functions no Supabase Dashboard
2. Verificar tabela de erros (se implementada)
3. Revisar esta documentação

---

**Status:** ✅ 100% IMPLEMENTADO
**Última Atualização:** Janeiro 2025
