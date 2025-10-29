import { supabase } from '@/integrations/supabase/client';

// Tipo do banco de dados (snake_case)
interface DatabaseOrder {
  id: string;
  user_id: string;
  tracking_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  carrier: string;
  status: string;
  destination: string;
  origin?: string;
  estimated_delivery?: string;
  delivered_at?: string;
  created_at: string;
  updated_at: string;
}

// Tipo da aplicação (camelCase)
interface Order {
  id: string;
  tracking_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  status: string;
  carrier: string;
  destination: string;
  origin?: string;
  estimated_delivery?: string;
  delivered_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MetricsPeriod {
  start: Date;
  end: Date;
  label: string;
}

export interface DashboardMetrics {
  total: number;
  delivered: number;
  inTransit: number;
  delayed: number;
  pending: number;
  failed: number;
  deliveryRate: number;
  averageDeliveryTime: number;
  onTimeDeliveryRate: number;
  // Comparações com período anterior
  totalChange: number;
  deliveredChange: number;
  delayedChange: number;
}

export interface CarrierMetrics {
  carrier: string;
  totalOrders: number;
  deliveredOrders: number;
  delayedOrders: number;
  averageDeliveryTime: number;
  successRate: number;
}

export interface TimeSeriesMetric {
  date: string;
  total: number;
  delivered: number;
  inTransit: number;
  delayed: number;
}

export interface StatusDistribution {
  status: string;
  count: number;
  percentage: number;
}

export class MetricsService {
  /**
   * Calcula métricas do dashboard com comparação de períodos
   */
  static async getDashboardMetrics(
    userId: string,
    period: MetricsPeriod,
    previousPeriod?: MetricsPeriod
  ): Promise<DashboardMetrics> {
    // Query para período atual
    const { data: currentOrders, error: currentError } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', period.start.toISOString())
      .lte('created_at', period.end.toISOString());

    if (currentError) throw currentError;

    const current = this.calculatePeriodMetrics(currentOrders || []);

    // Se houver período anterior, buscar dados para comparação
    let changes = { totalChange: 0, deliveredChange: 0, delayedChange: 0 };
    
    if (previousPeriod) {
      const { data: previousOrders, error: previousError } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', previousPeriod.start.toISOString())
        .lte('created_at', previousPeriod.end.toISOString());

      if (!previousError && previousOrders) {
        const previous = this.calculatePeriodMetrics(previousOrders);
        changes = {
          totalChange: this.calculatePercentageChange(previous.total, current.total),
          deliveredChange: this.calculatePercentageChange(previous.delivered, current.delivered),
          delayedChange: this.calculatePercentageChange(previous.delayed, current.delayed),
        };
      }
    }

    return { ...current, ...changes };
  }

  /**
   * Calcula métricas para um período específico
   */
  private static calculatePeriodMetrics(orders: Order[]): Omit<DashboardMetrics, 'totalChange' | 'deliveredChange' | 'delayedChange'> {
    const total = orders.length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const inTransit = orders.filter(o => o.status === 'in_transit').length;
    const delayed = orders.filter(o => o.status === 'delayed').length;
    const pending = orders.filter(o => o.status === 'pending').length;
    const failed = orders.filter(o => o.status === 'failed' || o.status === 'returned').length;

    const deliveryRate = total > 0 ? (delivered / total) * 100 : 0;

    // Calcular tempo médio de entrega (em dias)
    const deliveredOrders = orders.filter(o => 
      o.status === 'delivered' && 
      o.delivered_at && 
      o.created_at
    );

    const averageDeliveryTime = deliveredOrders.length > 0
      ? deliveredOrders.reduce((sum, order) => {
          const created = new Date(order.created_at).getTime();
          const delivered = new Date(order.delivered_at!).getTime();
          const days = (delivered - created) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / deliveredOrders.length
      : 0;

    // Calcular taxa de entrega no prazo
    const onTimeDeliveries = deliveredOrders.filter(order => {
      if (!order.estimated_delivery || !order.delivered_at) return false;
      const estimated = new Date(order.estimated_delivery).getTime();
      const actual = new Date(order.delivered_at).getTime();
      return actual <= estimated;
    }).length;

    const onTimeDeliveryRate = deliveredOrders.length > 0
      ? (onTimeDeliveries / deliveredOrders.length) * 100
      : 0;

    return {
      total,
      delivered,
      inTransit,
      delayed,
      pending,
      failed,
      deliveryRate: Number(deliveryRate.toFixed(1)),
      averageDeliveryTime: Number(averageDeliveryTime.toFixed(1)),
      onTimeDeliveryRate: Number(onTimeDeliveryRate.toFixed(1)),
    };
  }

  /**
   * Calcula variação percentual entre dois valores
   */
  private static calculatePercentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) return newValue > 0 ? 100 : 0;
    return Number((((newValue - oldValue) / oldValue) * 100).toFixed(1));
  }

  /**
   * Obtém métricas por transportadora
   */
  static async getCarrierMetrics(
    userId: string,
    period: MetricsPeriod
  ): Promise<CarrierMetrics[]> {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', period.start.toISOString())
      .lte('created_at', period.end.toISOString());

    if (error) throw error;

    // Agrupar por transportadora
    const carrierGroups = (orders || []).reduce((acc, order) => {
      if (!acc[order.carrier]) {
        acc[order.carrier] = [];
      }
      acc[order.carrier].push(order);
      return acc;
    }, {} as Record<string, Order[]>);

    // Calcular métricas para cada transportadora
    return Object.entries(carrierGroups).map(([carrier, carrierOrders]) => {
      const totalOrders = carrierOrders.length;
      const deliveredOrders = carrierOrders.filter(o => o.status === 'delivered').length;
      const delayedOrders = carrierOrders.filter(o => o.status === 'delayed').length;
      const successRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0;

      // Tempo médio de entrega
      const deliveredWithTime = carrierOrders.filter(o => 
        o.status === 'delivered' && o.delivered_at && o.created_at
      );

      const averageDeliveryTime = deliveredWithTime.length > 0
        ? deliveredWithTime.reduce((sum, order) => {
            const created = new Date(order.created_at).getTime();
            const delivered = new Date(order.delivered_at!).getTime();
            return sum + (delivered - created) / (1000 * 60 * 60 * 24);
          }, 0) / deliveredWithTime.length
        : 0;

      return {
        carrier,
        totalOrders,
        deliveredOrders,
        delayedOrders,
        averageDeliveryTime: Number(averageDeliveryTime.toFixed(1)),
        successRate: Number(successRate.toFixed(1)),
      };
    }).sort((a, b) => b.totalOrders - a.totalOrders);
  }

  /**
   * Obtém série temporal de métricas
   */
  static async getTimeSeriesMetrics(
    userId: string,
    period: MetricsPeriod,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<TimeSeriesMetric[]> {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', period.start.toISOString())
      .lte('created_at', period.end.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Agrupar por período
    const grouped = (orders || []).reduce((acc, order) => {
      const date = new Date(order.created_at);
      const key = this.getDateKey(date, groupBy);

      if (!acc[key]) {
        acc[key] = {
          date: key,
          total: 0,
          delivered: 0,
          inTransit: 0,
          delayed: 0,
        };
      }

      acc[key].total++;
      if (order.status === 'delivered') acc[key].delivered++;
      if (order.status === 'in_transit') acc[key].inTransit++;
      if (order.status === 'delayed') acc[key].delayed++;

      return acc;
    }, {} as Record<string, TimeSeriesMetric>);

    return Object.values(grouped).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }

  /**
   * Gera chave de data baseada no agrupamento
   */
  private static getDateKey(date: Date, groupBy: 'day' | 'week' | 'month'): string {
    switch (groupBy) {
      case 'day':
        return date.toISOString().split('T')[0];
      case 'week': {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split('T')[0];
      }
      case 'month':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
      default:
        return date.toISOString().split('T')[0];
    }
  }

  /**
   * Obtém distribuição de status
   */
  static async getStatusDistribution(
    userId: string,
    period: MetricsPeriod
  ): Promise<StatusDistribution[]> {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('status')
      .eq('user_id', userId)
      .gte('created_at', period.start.toISOString())
      .lte('created_at', period.end.toISOString());

    if (error) throw error;

    const total = orders?.length || 0;
    const statusCounts = (orders || []).reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.count - a.count);
  }

  /**
   * Atualiza métricas em tempo real usando Realtime
   */
  static subscribeToMetricsUpdates(
    userId: string,
    onUpdate: (payload: unknown) => void
  ) {
    const channel = supabase
      .channel(`metrics:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * Helper para criar períodos comuns
   */
  static getPeriods() {
    const now = new Date();
    
    return {
      today: {
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        end: now,
        label: 'Hoje',
      },
      yesterday: {
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        label: 'Ontem',
      },
      last7Days: {
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        end: now,
        label: 'Últimos 7 dias',
      },
      last30Days: {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: now,
        label: 'Últimos 30 dias',
      },
      thisMonth: {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: now,
        label: 'Este mês',
      },
      lastMonth: {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 0),
        label: 'Mês passado',
      },
      thisYear: {
        start: new Date(now.getFullYear(), 0, 1),
        end: now,
        label: 'Este ano',
      },
    };
  }

  /**
   * Obtém período anterior equivalente (para comparação)
   */
  static getPreviousPeriod(period: MetricsPeriod): MetricsPeriod {
    const duration = period.end.getTime() - period.start.getTime();
    
    return {
      start: new Date(period.start.getTime() - duration),
      end: new Date(period.start.getTime()),
      label: `Período anterior`,
    };
  }
}
