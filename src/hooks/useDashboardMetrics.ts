import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { MetricsService, MetricsPeriod } from '@/services/metrics';
import { useEffect, useMemo, useState } from 'react';

export interface UseDashboardMetricsOptions {
  period?: MetricsPeriod;
  enableComparison?: boolean;
  enableRealtime?: boolean;
  refetchInterval?: number | false;
}

/**
 * Hook principal para métricas do dashboard com:
 * - Queries reais do banco de dados
 * - Caching inteligente via React Query
 * - Atualização em tempo real via Supabase Realtime
 * - Agregações por período
 */
export function useDashboardMetrics(options: UseDashboardMetricsOptions = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const {
    period = MetricsService.getPeriods().last30Days,
    enableComparison = true,
    enableRealtime = true,
    refetchInterval = false,
  } = options;

  const previousPeriod = useMemo(
    () => enableComparison ? MetricsService.getPreviousPeriod(period) : undefined,
    [period, enableComparison]
  );

  // Query principal de métricas com caching
  const metricsQuery = useQuery({
    queryKey: ['dashboard-metrics', user?.id, period.start, period.end],
    queryFn: () => {
      if (!user?.id) throw new Error('User not authenticated');
      return MetricsService.getDashboardMetrics(user.id, period, previousPeriod);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos (antigo cacheTime)
    refetchInterval,
  });

  // Query de métricas por transportadora
  const carrierMetricsQuery = useQuery({
    queryKey: ['carrier-metrics', user?.id, period.start, period.end],
    queryFn: () => {
      if (!user?.id) throw new Error('User not authenticated');
      return MetricsService.getCarrierMetrics(user.id, period);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Query de série temporal
  const timeSeriesQuery = useQuery({
    queryKey: ['time-series', user?.id, period.start, period.end],
    queryFn: () => {
      if (!user?.id) throw new Error('User not authenticated');
      return MetricsService.getTimeSeriesMetrics(user.id, period, 'day');
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Query de distribuição de status
  const statusDistributionQuery = useQuery({
    queryKey: ['status-distribution', user?.id, period.start, period.end],
    queryFn: () => {
      if (!user?.id) throw new Error('User not authenticated');
      return MetricsService.getStatusDistribution(user.id, period);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Subscrição para atualizações em tempo real
  useEffect(() => {
    if (!enableRealtime || !user?.id) return;

    const unsubscribe = MetricsService.subscribeToMetricsUpdates(
      user.id,
      () => {
        // Invalidar todas as queries de métricas para forçar refetch
        queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
        queryClient.invalidateQueries({ queryKey: ['carrier-metrics'] });
        queryClient.invalidateQueries({ queryKey: ['time-series'] });
        queryClient.invalidateQueries({ queryKey: ['status-distribution'] });
      }
    );

    return unsubscribe;
  }, [enableRealtime, user?.id, queryClient]);

  return {
    // Métricas principais
    metrics: metricsQuery.data,
    isLoadingMetrics: metricsQuery.isLoading,
    isErrorMetrics: metricsQuery.isError,
    errorMetrics: metricsQuery.error,

    // Métricas por transportadora
    carrierMetrics: carrierMetricsQuery.data,
    isLoadingCarriers: carrierMetricsQuery.isLoading,

    // Série temporal
    timeSeries: timeSeriesQuery.data,
    isLoadingTimeSeries: timeSeriesQuery.isLoading,

    // Distribuição de status
    statusDistribution: statusDistributionQuery.data,
    isLoadingStatus: statusDistributionQuery.isLoading,

    // Estado geral
    isLoading: metricsQuery.isLoading || 
               carrierMetricsQuery.isLoading || 
               timeSeriesQuery.isLoading || 
               statusDistributionQuery.isLoading,

    // Funções de controle
    refetch: () => {
      metricsQuery.refetch();
      carrierMetricsQuery.refetch();
      timeSeriesQuery.refetch();
      statusDistributionQuery.refetch();
    },
  };
}

/**
 * Hook para períodos comuns pré-configurados
 */
export function usePeriods() {
  const [selectedPeriod, setSelectedPeriod] = useState<keyof ReturnType<typeof MetricsService.getPeriods>>('last30Days');
  
  const periods = useMemo(() => MetricsService.getPeriods(), []);
  
  const currentPeriod = useMemo(() => periods[selectedPeriod], [periods, selectedPeriod]);

  return {
    periods,
    selectedPeriod,
    setSelectedPeriod,
    currentPeriod,
  };
}

/**
 * Hook otimizado para métricas específicas (menor footprint)
 */
export function useMetric(
  metricType: 'total' | 'delivered' | 'inTransit' | 'delayed',
  period?: MetricsPeriod
) {
  const { user } = useAuth();
  const defaultPeriod = useMemo(() => MetricsService.getPeriods().last30Days, []);
  const activePeriod = period || defaultPeriod;

  return useQuery({
    queryKey: ['metric', metricType, user?.id, activePeriod.start, activePeriod.end],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');
      const metrics = await MetricsService.getDashboardMetrics(user.id, activePeriod);
      return metrics[metricType];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook para comparação de períodos
 */
export function usePeriodComparison(
  currentPeriod: MetricsPeriod,
  previousPeriod: MetricsPeriod
) {
  const { user } = useAuth();

  const currentQuery = useQuery({
    queryKey: ['period-comparison-current', user?.id, currentPeriod.start, currentPeriod.end],
    queryFn: () => {
      if (!user?.id) throw new Error('User not authenticated');
      return MetricsService.getDashboardMetrics(user.id, currentPeriod);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const previousQuery = useQuery({
    queryKey: ['period-comparison-previous', user?.id, previousPeriod.start, previousPeriod.end],
    queryFn: () => {
      if (!user?.id) throw new Error('User not authenticated');
      return MetricsService.getDashboardMetrics(user.id, previousPeriod);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const comparison = useMemo(() => {
    if (!currentQuery.data || !previousQuery.data) return null;

    return {
      current: currentQuery.data,
      previous: previousQuery.data,
      changes: {
        total: currentQuery.data.total - previousQuery.data.total,
        delivered: currentQuery.data.delivered - previousQuery.data.delivered,
        delayed: currentQuery.data.delayed - previousQuery.data.delayed,
        deliveryRate: currentQuery.data.deliveryRate - previousQuery.data.deliveryRate,
      },
      percentageChanges: {
        total: currentQuery.data.totalChange,
        delivered: currentQuery.data.deliveredChange,
        delayed: currentQuery.data.delayedChange,
      },
    };
  }, [currentQuery.data, previousQuery.data]);

  return {
    comparison,
    isLoading: currentQuery.isLoading || previousQuery.isLoading,
    isError: currentQuery.isError || previousQuery.isError,
  };
}

/**
 * Hook para cache inteligente com estratégias de invalidação
 */
export function useMetricsCache() {
  const queryClient = useQueryClient();

  return {
    // Invalidar todas as métricas
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['carrier-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['time-series'] });
      queryClient.invalidateQueries({ queryKey: ['status-distribution'] });
    },

    // Invalidar apenas métricas principais
    invalidateMetrics: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    },

    // Pré-carregar dados para um período
    prefetchPeriod: async (userId: string, period: MetricsPeriod) => {
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: ['dashboard-metrics', userId, period.start, period.end],
          queryFn: () => MetricsService.getDashboardMetrics(userId, period),
        }),
        queryClient.prefetchQuery({
          queryKey: ['carrier-metrics', userId, period.start, period.end],
          queryFn: () => MetricsService.getCarrierMetrics(userId, period),
        }),
      ]);
    },

    // Limpar cache antigo
    clearOldCache: () => {
      queryClient.clear();
    },
  };
}
