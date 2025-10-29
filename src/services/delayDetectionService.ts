import { supabase } from '@/integrations/supabase/client';

interface CarrierSLA {
  carrier: string;
  service_type: string;
  min_days: number;
  max_days: number;
  regions: string[];
}

interface DelayAnalysis {
  tracking_code: string;
  order_id: string;
  carrier: string;
  current_status: string;
  days_in_transit: number;
  expected_delivery: string;
  estimated_delivery?: string;
  is_delayed: boolean;
  delay_severity: 'none' | 'warning' | 'critical' | 'urgent';
  delay_days: number;
  predicted_delivery?: string;
  confidence: number; // 0-100
  factors: string[];
}

interface DelayPrediction {
  will_be_delayed: boolean;
  probability: number; // 0-100
  estimated_delay_days: number;
  factors: Array<{
    factor: string;
    impact: number; // -100 a 100
    description: string;
  }>;
}

// SLAs padrão por transportadora (em dias úteis)
const DEFAULT_SLAS: CarrierSLA[] = [
  {
    carrier: 'correios',
    service_type: 'PAC',
    min_days: 7,
    max_days: 15,
    regions: ['all'],
  },
  {
    carrier: 'correios',
    service_type: 'SEDEX',
    min_days: 1,
    max_days: 3,
    regions: ['all'],
  },
  {
    carrier: 'jadlog',
    service_type: 'Package',
    min_days: 2,
    max_days: 7,
    regions: ['all'],
  },
  {
    carrier: 'jadlog',
    service_type: 'Express',
    min_days: 1,
    max_days: 2,
    regions: ['all'],
  },
  {
    carrier: 'melhorenvio',
    service_type: 'Standard',
    min_days: 3,
    max_days: 10,
    regions: ['all'],
  },
];

class DelayDetectionService {
  // Calcular dias úteis entre duas datas
  private calculateBusinessDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Não é sábado ou domingo
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  // Adicionar dias úteis a uma data
  private addBusinessDays(date: Date, days: number): Date {
    const result = new Date(date);
    let added = 0;

    while (added < days) {
      result.setDate(result.getDate() + 1);
      const dayOfWeek = result.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        added++;
      }
    }

    return result;
  }

  // Obter SLA da transportadora
  private getCarrierSLA(carrier: string, serviceType?: string): CarrierSLA | null {
    return (
      DEFAULT_SLAS.find(
        (sla) =>
          sla.carrier === carrier &&
          (!serviceType || sla.service_type === serviceType)
      ) || DEFAULT_SLAS.find((sla) => sla.carrier === carrier)
    );
  }

  // Determinar severidade do atraso
  private getDelaySeverity(delayDays: number): 'none' | 'warning' | 'critical' | 'urgent' {
    if (delayDays <= 0) return 'none';
    if (delayDays <= 2) return 'warning';
    if (delayDays <= 5) return 'critical';
    return 'urgent';
  }

  // Analisar atraso de um pedido
  async analyzeDelay(
    orderId: string,
    trackingCode: string,
    carrier: string
  ): Promise<DelayAnalysis | null> {
    try {
      // Buscar dados do pedido
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: order, error: orderError } = await (supabase as any)
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        console.error('Order not found:', orderError);
        return null;
      }

      // Buscar cache de rastreamento
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cache } = await (supabase as any)
        .from('tracking_cache')
        .select('*')
        .eq('tracking_code', trackingCode)
        .single();

      const postedDate = new Date(order.created_at);
      const today = new Date();
      const daysInTransit = this.calculateBusinessDays(postedDate, today);

      // Obter SLA
      const sla = this.getCarrierSLA(carrier);
      if (!sla) {
        console.warn(`No SLA found for carrier: ${carrier}`);
        return null;
      }

      // Calcular data esperada
      const expectedDelivery = this.addBusinessDays(postedDate, sla.max_days);
      const estimatedDelivery = cache?.estimated_delivery
        ? new Date(cache.estimated_delivery)
        : expectedDelivery;

      // Verificar atraso
      const isDelayed = today > expectedDelivery;
      const delayDays = isDelayed
        ? this.calculateBusinessDays(expectedDelivery, today)
        : 0;

      // Analisar fatores de atraso
      const factors: string[] = [];

      // Verificar status atual
      const status = order.status || cache?.current_status;
      if (status === 'exception' || status === 'delayed') {
        factors.push('Exceção ou atraso reportado pela transportadora');
      }

      // Verificar eventos sem movimentação
      if (cache?.events && cache.events.length > 0) {
        const lastEvent = cache.events[0];
        const lastEventDate = new Date(lastEvent.date);
        const daysSinceLastUpdate = this.calculateBusinessDays(lastEventDate, today);

        if (daysSinceLastUpdate > 3) {
          factors.push(`Sem movimentação há ${daysSinceLastUpdate} dias`);
        }
      }

      // Verificar padrões históricos
      const historicalData = await this.getHistoricalPerformance(carrier);
      if (historicalData && historicalData.avg_delay > 0) {
        factors.push(
          `Histórico da transportadora indica atrasos médios de ${historicalData.avg_delay} dias`
        );
      }

      // Prever entrega usando ML simples
      const prediction = await this.predictDelivery(order, cache, sla);

      return {
        tracking_code: trackingCode,
        order_id: orderId,
        carrier: carrier,
        current_status: status,
        days_in_transit: daysInTransit,
        expected_delivery: expectedDelivery.toISOString(),
        estimated_delivery: estimatedDelivery.toISOString(),
        is_delayed: isDelayed,
        delay_severity: this.getDelaySeverity(delayDays),
        delay_days: delayDays,
        predicted_delivery: prediction.predicted_date,
        confidence: prediction.confidence,
        factors: factors,
      };
    } catch (error) {
      console.error('Error analyzing delay:', error);
      return null;
    }
  }

  // Obter performance histórica da transportadora
  private async getHistoricalPerformance(carrier: string): Promise<{
    avg_delay: number;
    on_time_rate: number;
    total_deliveries: number;
  } | null> {
    try {
      // Buscar pedidos entregues dos últimos 90 dias
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: orders } = await (supabase as any)
        .from('orders')
        .select('created_at, delivered_at, carrier')
        .eq('carrier', carrier)
        .eq('status', 'delivered')
        .gte('delivered_at', ninetyDaysAgo.toISOString());

      if (!orders || orders.length === 0) return null;

      const sla = this.getCarrierSLA(carrier);
      if (!sla) return null;

      let totalDelay = 0;
      let onTimeCount = 0;

      orders.forEach((order: { created_at: string; delivered_at: string }) => {
        const posted = new Date(order.created_at);
        const delivered = new Date(order.delivered_at);
        const actualDays = this.calculateBusinessDays(posted, delivered);
        const expectedDays = sla.max_days;

        const delay = actualDays - expectedDays;
        totalDelay += Math.max(0, delay);

        if (delay <= 0) onTimeCount++;
      });

      return {
        avg_delay: totalDelay / orders.length,
        on_time_rate: (onTimeCount / orders.length) * 100,
        total_deliveries: orders.length,
      };
    } catch (error) {
      console.error('Error getting historical performance:', error);
      return null;
    }
  }

  // Prever data de entrega usando algoritmo simples
  private async predictDelivery(
    order: { created_at: string; status: string },
    cache: { events?: Array<{ date: string }>; current_status?: string } | null,
    sla: CarrierSLA
  ): Promise<{ predicted_date: string; confidence: number }> {
    try {
      const postedDate = new Date(order.created_at);
      let predictedDays = sla.max_days;
      let confidence = 70; // Base confidence

      // Ajustar baseado no status atual
      const status = cache?.current_status || order.status;
      
      if (status === 'out_for_delivery') {
        predictedDays = 0; // Será entregue hoje
        confidence = 95;
      } else if (status === 'in_transit') {
        // Calcular baseado na velocidade média
        if (cache?.events && cache.events.length > 1) {
          const firstEvent = new Date(cache.events[cache.events.length - 1].date);
          const lastEvent = new Date(cache.events[0].date);
          const daysElapsed = this.calculateBusinessDays(firstEvent, lastEvent);
          const eventsPerDay = cache.events.length / Math.max(daysElapsed, 1);

          // Estimar dias restantes baseado na velocidade
          const expectedTotalEvents = 8; // Média de eventos até entrega
          const remainingEvents = Math.max(0, expectedTotalEvents - cache.events.length);
          const estimatedDaysRemaining = remainingEvents / eventsPerDay;

          predictedDays = Math.ceil(estimatedDaysRemaining);
          confidence = 75;
        }
      } else if (status === 'delayed' || status === 'exception') {
        // Adicionar atraso esperado
        predictedDays = sla.max_days + 5;
        confidence = 50;
      }

      const predictedDate = this.addBusinessDays(postedDate, predictedDays);

      return {
        predicted_date: predictedDate.toISOString(),
        confidence: confidence,
      };
    } catch (error) {
      console.error('Error predicting delivery:', error);
      const fallbackDate = this.addBusinessDays(new Date(order.created_at), sla.max_days);
      return {
        predicted_date: fallbackDate.toISOString(),
        confidence: 50,
      };
    }
  }

  // Prever se haverá atraso
  async predictDelay(
    orderId: string,
    trackingCode: string
  ): Promise<DelayPrediction | null> {
    try {
      // Buscar análise de atraso
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: order } = await (supabase as any)
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (!order) return null;

      const analysis = await this.analyzeDelay(orderId, trackingCode, order.carrier);
      if (!analysis) return null;

      const factors: Array<{
        factor: string;
        impact: number;
        description: string;
      }> = [];

      let delayProbability = 0;

      // Fator 1: Status atual
      if (analysis.current_status === 'delayed' || analysis.current_status === 'exception') {
        factors.push({
          factor: 'Status atual',
          impact: 80,
          description: 'Transportadora reportou atraso ou exceção',
        });
        delayProbability += 80;
      }

      // Fator 2: Dias em trânsito
      const sla = this.getCarrierSLA(order.carrier);
      if (sla && analysis.days_in_transit > sla.max_days * 0.8) {
        const impact = 50;
        factors.push({
          factor: 'Tempo em trânsito',
          impact: impact,
          description: `Já decorreram ${analysis.days_in_transit} de ${sla.max_days} dias esperados`,
        });
        delayProbability += impact;
      }

      // Fator 3: Performance histórica
      const historical = await this.getHistoricalPerformance(order.carrier);
      if (historical && historical.on_time_rate < 70) {
        const impact = 30;
        factors.push({
          factor: 'Histórico da transportadora',
          impact: impact,
          description: `Taxa de entrega no prazo de apenas ${historical.on_time_rate.toFixed(1)}%`,
        });
        delayProbability += impact;
      }

      // Fator 4: Falta de movimentação
      if (analysis.factors.some(f => f.includes('Sem movimentação'))) {
        const impact = 60;
        factors.push({
          factor: 'Falta de atualizações',
          impact: impact,
          description: 'Sem movimentação recente no rastreamento',
        });
        delayProbability += impact;
      }

      // Normalizar probabilidade (0-100)
      delayProbability = Math.min(100, delayProbability / factors.length);

      // Estimar dias de atraso
      const estimatedDelayDays = delayProbability > 50
        ? Math.ceil((delayProbability - 50) / 10)
        : 0;

      return {
        will_be_delayed: delayProbability > 50,
        probability: Math.round(delayProbability),
        estimated_delay_days: estimatedDelayDays,
        factors: factors,
      };
    } catch (error) {
      console.error('Error predicting delay:', error);
      return null;
    }
  }

  // Escanear todos os pedidos em busca de atrasos
  async scanAllOrders(): Promise<DelayAnalysis[]> {
    try {
      // Buscar pedidos ativos (não entregues/cancelados)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: orders, error } = await (supabase as any)
        .from('orders')
        .select('id, tracking_code, carrier, status')
        .not('tracking_code', 'is', null)
        .not('status', 'in', '(delivered,cancelled)');

      if (error || !orders) {
        console.error('Error fetching orders:', error);
        return [];
      }

      const analyses: DelayAnalysis[] = [];

      // Analisar em lotes
      for (const order of orders) {
        const analysis = await this.analyzeDelay(
          order.id,
          order.tracking_code,
          order.carrier
        );

        if (analysis && analysis.is_delayed) {
          analyses.push(analysis);
        }

        // Pequeno delay para não sobrecarregar
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      return analyses;
    } catch (error) {
      console.error('Error scanning orders:', error);
      return [];
    }
  }

  // Gerar alerta proativo para atraso
  async generateDelayAlert(analysis: DelayAnalysis): Promise<void> {
    try {
      const priority =
        analysis.delay_severity === 'urgent'
          ? 'urgent'
          : analysis.delay_severity === 'critical'
          ? 'high'
          : 'normal';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('proactive_alerts').insert({
        order_id: analysis.order_id,
        alert_type: 'delay_warning',
        priority: priority,
        title: `Pedido atrasado - ${analysis.delay_days} dias`,
        message: `O pedido com código de rastreamento ${analysis.tracking_code} está atrasado em ${analysis.delay_days} dias. ${analysis.factors.join('. ')}`,
        metadata: {
          tracking_code: analysis.tracking_code,
          delay_days: analysis.delay_days,
          delay_severity: analysis.delay_severity,
          factors: analysis.factors,
          predicted_delivery: analysis.predicted_delivery,
          confidence: analysis.confidence,
        },
        is_read: false,
        created_at: new Date().toISOString(),
      });

      console.log(`Delay alert created for order ${analysis.order_id}`);
    } catch (error) {
      console.error('Error generating delay alert:', error);
    }
  }
}

export const delayDetectionService = new DelayDetectionService();
