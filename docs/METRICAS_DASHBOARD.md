# 📊 Sistema de Métricas do Dashboard

## Visão Geral

O sistema de métricas foi completamente implementado com dados reais do banco de dados, substituindo as métricas mock/estáticas anteriores.

## ✅ Funcionalidades Implementadas

### 1. Queries Reais para Cálculo de Métricas

**Serviço: `src/services/metrics.ts`**

- ✅ `getDashboardMetrics()` - Métricas principais do dashboard
- ✅ `getCarrierMetrics()` - Métricas por transportadora
- ✅ `getTimeSeriesMetrics()` - Série temporal de pedidos
- ✅ `getStatusDistribution()` - Distribuição de status

**Métricas Calculadas:**
- Total de pedidos
- Pedidos entregues
- Pedidos em trânsito
- Pedidos atrasados
- Pedidos pendentes
- Taxa de entrega (%)
- Tempo médio de entrega (dias)
- Taxa de entrega no prazo (%)

### 2. Atualização em Tempo Real

**Hook: `src/hooks/useDashboardMetrics.ts`**

```typescript
const { metrics, refetch } = useDashboardMetrics({
  period: currentPeriod,
  enableComparison: true,
  enableRealtime: true, // ✅ Ativa Supabase Realtime
});
```

**Características:**
- ✅ Subscrição via Supabase Realtime
- ✅ Invalidação automática do cache
- ✅ Atualização instantânea quando pedidos mudam
- ✅ Suporte a múltiplos usuários simultâneos

### 3. Caching Inteligente

**Implementado via React Query:**

```typescript
staleTime: 5 * 60 * 1000,    // 5 minutos - dados considerados frescos
gcTime: 10 * 60 * 1000,       // 10 minutos - mantém em cache
refetchInterval: false,       // Não refaz automaticamente (usa realtime)
```

**Estratégias de Cache:**
- ✅ Cache por período e usuário
- ✅ Invalidação seletiva por tipo de métrica
- ✅ Pré-carregamento de períodos comuns
- ✅ Garbage collection automático

**Hook auxiliar:**
```typescript
const { invalidateAll, prefetchPeriod } = useMetricsCache();
```

### 4. Agregações por Período

**Períodos Disponíveis:**
- Hoje
- Ontem
- Últimos 7 dias
- Últimos 30 dias
- Este mês
- Mês passado
- Este ano

**Agrupamento Temporal:**
```typescript
getTimeSeriesMetrics(userId, period, 'day')   // Agrupado por dia
getTimeSeriesMetrics(userId, period, 'week')  // Agrupado por semana
getTimeSeriesMetrics(userId, period, 'month') // Agrupado por mês
```

**Comparação de Períodos:**
```typescript
const { comparison } = usePeriodComparison(currentPeriod, previousPeriod);
// Retorna: current, previous, changes, percentageChanges
```

## 📁 Arquitetura

```
src/
├── services/
│   └── metrics.ts           # Lógica de negócio e queries
├── hooks/
│   ├── useDashboardMetrics.ts  # Hook principal com realtime
│   └── useOrders.ts         # Queries de pedidos otimizadas
├── components/
│   ├── MetricCard.tsx       # Card individual de métrica
│   └── PeriodSelector.tsx   # Seletor de período visual
└── pages/
    └── Dashboard.tsx        # Dashboard completo com métricas
```

## 🎯 Uso Básico

### Dashboard Completo

```typescript
import { useDashboardMetrics, usePeriods } from '@/hooks/useDashboardMetrics';

function Dashboard() {
  const { currentPeriod, setSelectedPeriod } = usePeriods();
  const { 
    metrics,           // Métricas principais
    carrierMetrics,    // Métricas por transportadora
    timeSeries,        // Série temporal
    statusDistribution,// Distribuição de status
    isLoading,
    refetch 
  } = useDashboardMetrics({
    period: currentPeriod,
    enableComparison: true,
    enableRealtime: true,
  });

  return (
    <div>
      {/* Métricas principais */}
      <MetricCard 
        title="Total de Pedidos"
        value={metrics?.total || 0}
        trend={{ 
          value: `${metrics?.totalChange}% vs período anterior`,
          isPositive: metrics?.totalChange > 0
        }}
      />
      
      {/* Gráficos */}
      <LineChart data={timeSeries} />
      <BarChart data={carrierMetrics} />
    </div>
  );
}
```

### Métrica Individual

```typescript
import { useMetric } from '@/hooks/useDashboardMetrics';

function QuickStat() {
  const { data: total } = useMetric('total');
  return <div>{total} pedidos</div>;
}
```

### Cache Personalizado

```typescript
import { useMetricsCache } from '@/hooks/useDashboardMetrics';

function Settings() {
  const cache = useMetricsCache();
  
  return (
    <button onClick={() => cache.invalidateAll()}>
      Limpar Cache
    </button>
  );
}
```

## 🔄 Fluxo de Dados

1. **Requisição Inicial**
   ```
   Usuario -> Hook -> React Query -> Supabase -> Banco de Dados
   ```

2. **Cache Hit (dados já carregados)**
   ```
   Usuario -> Hook -> React Query (retorna cache)
   ```

3. **Atualização em Tempo Real**
   ```
   Banco de Dados -> Supabase Realtime -> Hook -> React Query (invalida) -> Refetch
   ```

4. **Comparação de Períodos**
   ```
   Hook -> [Query Período Atual, Query Período Anterior] -> Cálculo de Mudanças
   ```

## ⚡ Performance

### Otimizações Implementadas

1. **Queries Paralelas**
   ```typescript
   // Busca métricas, carriers, e série temporal em paralelo
   const results = await Promise.all([...]);
   ```

2. **Agregação no Banco**
   ```sql
   -- Evita transferir dados desnecessários
   SELECT status, COUNT(*) FROM orders GROUP BY status
   ```

3. **Cache Estratificado**
   - Métricas principais: 5 min
   - Série temporal: 5 min
   - Pedidos individuais: 2 min

4. **Invalidação Seletiva**
   ```typescript
   // Só invalida o necessário
   queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
   ```

## 📈 Métricas de Performance Esperadas

- **Tempo de Carregamento Inicial:** < 500ms
- **Atualização em Tempo Real:** < 100ms
- **Cache Hit Rate:** > 80%
- **Queries Simultâneas:** Suporta 1000+ usuários

## 🧪 Testes

### Testar Realtime

1. Abra o dashboard em duas abas
2. Adicione um pedido em uma aba
3. Veja a atualização automática na outra aba

### Testar Cache

1. Abra o dashboard
2. Mude de período
3. Volte ao período anterior (deve ser instantâneo)

### Testar Comparações

1. Selecione "Últimos 30 dias"
2. Verifique as métricas de variação percentual
3. Compare com "Mês passado"

## 🔮 Próximas Melhorias

- [ ] Exportar métricas em tempo real
- [ ] Alertas baseados em thresholds
- [ ] Machine Learning para previsões
- [ ] Dashboard customizável
- [ ] Relatórios agendados

## 📚 Referências

- [React Query Documentation](https://tanstack.com/query/latest)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Dashboard Best Practices](https://uxdesign.cc/dashboard-design-best-practices)

---

**Status:** ✅ 100% Implementado  
**Última Atualização:** 23 de outubro de 2025
