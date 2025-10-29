import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MetricsService } from "@/services/metrics";
import { useEffect } from "react";

/**
 * Hook para buscar pedidos com caching inteligente
 */
export const useOrders = (options?: {
  enableRealtime?: boolean;
  refetchInterval?: number | false;
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { enableRealtime = true, refetchInterval = false } = options || {};

  const query = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchInterval,
  });

  // Subscrição em tempo real
  useEffect(() => {
    if (!enableRealtime || !user?.id) return;

    const channel = supabase
      .channel(`orders:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Invalidar query de pedidos
          queryClient.invalidateQueries({ queryKey: ['orders', user.id] });
          // Invalidar métricas também
          queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enableRealtime, user?.id, queryClient]);

  return query;
};

/**
 * Hook para métricas calculadas a partir dos pedidos
 * @deprecated Use useDashboardMetrics para métricas mais completas
 */
export const useOrderMetrics = () => {
  const { data: orders = [], isLoading } = useOrders({ enableRealtime: false });

  const metrics = {
    total: orders.length,
    delivered: orders.filter(o => o.status === "delivered").length,
    inTransit: orders.filter(o => o.status === "in_transit").length,
    delayed: orders.filter(o => o.status === "delayed").length,
    deliveryRate: orders.length > 0
      ? ((orders.filter(o => o.status === "delivered").length / orders.length) * 100).toFixed(1)
      : "0",
  };

  return { metrics, isLoading };
};

/**
 * Hook avançado para métricas do dashboard com queries otimizadas
 */
export const useAdvancedOrderMetrics = (period = MetricsService.getPeriods().last30Days) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["advanced-metrics", user?.id, period.start, period.end],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');
      return MetricsService.getDashboardMetrics(user.id, period);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

/**
 * Hook para buscar um pedido específico
 */
export const useOrder = (orderId: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!orderId,
    staleTime: 1 * 60 * 1000,
  });
};

/**
 * Hook para estatísticas rápidas (sem comparação de períodos)
 */
export const useQuickStats = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["quick-stats", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from("orders")
        .select("status")
        .eq("user_id", user.id);

      if (error) throw error;

      const total = data.length;
      const statusCounts = data.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        total,
        delivered: statusCounts.delivered || 0,
        inTransit: statusCounts.in_transit || 0,
        delayed: statusCounts.delayed || 0,
        pending: statusCounts.pending || 0,
      };
    },
    enabled: !!user?.id,
    staleTime: 1 * 60 * 1000,
  });
};