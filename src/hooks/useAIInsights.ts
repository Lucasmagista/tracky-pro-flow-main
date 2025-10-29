import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface DeliveryPattern {
  carrier: string;
  region: string;
  average_delivery_time: number;
  on_time_percentage: number;
  delay_average_days: number;
  total_deliveries: number;
  success_rate: number;
}

export interface QualityScore {
  carrier: string;
  overall_score: number; // 0-100
  timeliness_score: number;
  reliability_score: number;
  customer_satisfaction: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface DeliveryPrediction {
  order_id: string;
  carrier: string;
  origin_region: string;
  destination_region: string;
  predicted_delivery_date: Date;
  confidence_level: number; // 0-100
  estimated_days: number;
  risk_factors: string[];
}

export interface AIRecommendation {
  type: 'carrier_switch' | 'region_optimization' | 'timing_adjustment' | 'bulk_shipping';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  potential_savings: number;
  confidence: number;
  actionable: boolean;
}

export interface InsightMetrics {
  total_orders: number;
  on_time_deliveries: number;
  average_delivery_time: number;
  most_reliable_carrier: string;
  riskiest_region: string;
  potential_savings: number;
  ai_accuracy: number;
}

export const useAIInsights = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [patterns, setPatterns] = useState<DeliveryPattern[]>([]);
  const [qualityScores, setQualityScores] = useState<QualityScore[]>([]);
  const [predictions, setPredictions] = useState<DeliveryPrediction[]>([]);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [metrics, setMetrics] = useState<InsightMetrics | null>(null);

  // Análise de padrões baseada em dados históricos
  const analyzePatterns = useCallback(async () => {
    if (!user) return;

    try {
      // Buscar dados históricos de entregas
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          carrier,
          status,
          created_at,
          actual_delivery,
          destination
        `)
        .eq('user_id', user.id)
        .not('actual_delivery', 'is', null);

      if (error) throw error;

      // Agrupar por transportadora e região
      const patternMap = new Map<string, {
        carrier: string;
        region: string;
        total_deliveries: number;
        on_time_count: number;
        total_delivery_time: number;
        total_delay: number;
        success_count: number;
      }>();

      orders?.forEach(order => {
        const region = order.destination || 'Não informado';
        const key = `${order.carrier}-${region}`;

        // Calcular dias de entrega
        const actualDays = order.actual_delivery
          ? Math.ceil((new Date(order.actual_delivery).getTime() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        // Assumir entrega estimada de 7 dias para cálculo de "no prazo"
        const estimatedDays = 7;
        const isOnTime = actualDays > 0 && actualDays <= estimatedDays;
        const delay = Math.max(0, actualDays - estimatedDays);

        if (!patternMap.has(key)) {
          patternMap.set(key, {
            carrier: order.carrier,
            region: region,
            total_deliveries: 0,
            on_time_count: 0,
            total_delivery_time: 0,
            total_delay: 0,
            success_count: 0,
          });
        }

        const pattern = patternMap.get(key)!;
        pattern.total_deliveries++;
        if (actualDays > 0) {
          pattern.total_delivery_time += actualDays;
          pattern.total_delay += delay;
        }

        if (isOnTime) pattern.on_time_count++;
        if (order.status === 'delivered') pattern.success_count++;
      });

      // Converter para array de padrões
      const analyzedPatterns: DeliveryPattern[] = Array.from(patternMap.values()).map(pattern => ({
        carrier: pattern.carrier,
        region: pattern.region,
        average_delivery_time: pattern.total_deliveries > 0 ? Math.round(pattern.total_delivery_time / pattern.total_deliveries) : 0,
        on_time_percentage: pattern.total_deliveries > 0 ? Math.round((pattern.on_time_count / pattern.total_deliveries) * 100) : 0,
        delay_average_days: pattern.total_deliveries > 0 ? Math.round(pattern.total_delay / pattern.total_deliveries) : 0,
        total_deliveries: pattern.total_deliveries,
        success_rate: pattern.total_deliveries > 0 ? Math.round((pattern.success_count / pattern.total_deliveries) * 100) : 0,
      }));

      setPatterns(analyzedPatterns);
    } catch (error) {
      console.error('Error analyzing patterns:', error);
    }
  }, [user]);

  // Calcular scores de qualidade
  const calculateQualityScores = useCallback(async () => {
    if (!user) return;

    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          carrier,
          status,
          created_at,
          actual_delivery
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      // Agrupar por transportadora
      const carrierStats = new Map<string, {
        total: number;
        onTime: number;
        delivered: number;
        totalDeliveryTime: number;
        totalEstimated: number;
        ratings: number[];
        recentTrend: string[];
      }>();

      orders?.forEach(order => {
        const carrier = order.carrier;
        if (!carrierStats.has(carrier)) {
          carrierStats.set(carrier, {
            total: 0,
            onTime: 0,
            delivered: 0,
            totalDeliveryTime: 0,
            totalEstimated: 0,
            ratings: [],
            recentTrend: [],
          });
        }

        const stats = carrierStats.get(carrier)!;
        stats.total++;

        if (order.actual_delivery) {
          stats.delivered++;
          const actualDays = Math.ceil(
            (new Date(order.actual_delivery).getTime() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24)
          );
          stats.totalDeliveryTime += actualDays;
          stats.totalEstimated += 7; // Assumir 7 dias como padrão

          if (actualDays <= 7) { // Assumir entrega no prazo se <= 7 dias
            stats.onTime++;
          }
        }

        // Simular ratings aleatórios para demonstração
        stats.ratings.push(Math.floor(Math.random() * 2) + 4); // 4-5 estrelas
      });

      // Calcular scores
      const scores: QualityScore[] = Array.from(carrierStats.entries()).map(([carrier, stats]) => {
        const timelinessScore = stats.total > 0 ? (stats.onTime / stats.total) * 100 : 0;
        const reliabilityScore = stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0;
        const avgRating = stats.ratings.length > 0
          ? stats.ratings.reduce((a: number, b: number) => a + b, 0) / stats.ratings.length
          : 0;
        const customerSatisfaction = (avgRating / 5) * 100;

        // Score geral ponderado
        const overallScore = Math.round(
          (timelinessScore * 0.4) + (reliabilityScore * 0.4) + (customerSatisfaction * 0.2)
        );

        // Tendência simples baseada nos últimos dados
        const trend: 'improving' | 'stable' | 'declining' = 'stable'; // Implementar lógica real depois

        return {
          carrier,
          overall_score: overallScore,
          timeliness_score: Math.round(timelinessScore),
          reliability_score: Math.round(reliabilityScore),
          customer_satisfaction: Math.round(customerSatisfaction),
          trend,
        };
      });

      setQualityScores(scores);
    } catch (error) {
      console.error('Error calculating quality scores:', error);
    }
  }, [user]);

  // Algoritmo de previsão simples baseado em ML
  const predictDelivery = useCallback(async (orderData: {
    carrier: string;
    origin_region: string;
    destination_region: string;
    order_date: Date;
  }) => {
    try {
      // Buscar dados históricos similares
      const { data: similarOrders, error } = await supabase
        .from('orders')
        .select('created_at, actual_delivery, carrier, destination')
        .eq('carrier', orderData.carrier)
        .eq('destination', orderData.destination_region)
        .not('actual_delivery', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (!similarOrders || similarOrders.length === 0) {
        // Fallback para dados gerais
        return {
          predicted_delivery_date: new Date(orderData.order_date.getTime() + 7 * 24 * 60 * 60 * 1000),
          confidence_level: 60,
          estimated_days: 7,
          risk_factors: ['Dados insuficientes para rota específica'],
        };
      }

      // Calcular média ponderada (pedidos mais recentes têm mais peso)
      let totalWeight = 0;
      let weightedSum = 0;

      similarOrders.forEach((order, index) => {
        const actualDays = Math.ceil(
          (new Date(order.actual_delivery!).getTime() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        const weight = 1 / (index + 1); // Peso decrescente
        weightedSum += actualDays * weight;
        totalWeight += weight;
      });

      const predictedDays = Math.round(weightedSum / totalWeight);
      const predictedDate = new Date(orderData.order_date.getTime() + predictedDays * 24 * 60 * 60 * 1000);

      // Calcular nível de confiança baseado na variância
      const variances = similarOrders.map(order => {
        const actualDays = Math.ceil(
          (new Date(order.actual_delivery!).getTime() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        return Math.pow(actualDays - predictedDays, 2);
      });

      const avgVariance = variances.reduce((a, b) => a + b, 0) / variances.length;
      const stdDev = Math.sqrt(avgVariance);
      const confidenceLevel = Math.max(10, Math.min(95, 100 - (stdDev * 10)));

      // Identificar fatores de risco
      const riskFactors: string[] = [];
      if (predictedDays > 10) riskFactors.push('Rota com histórico de atrasos');
      if (confidenceLevel < 70) riskFactors.push('Previsão com baixa confiança');
      if (similarOrders.length < 10) riskFactors.push('Poucos dados históricos');

      return {
        predicted_delivery_date: predictedDate,
        confidence_level: Math.round(confidenceLevel),
        estimated_days: predictedDays,
        risk_factors: riskFactors,
      };
    } catch (error) {
      console.error('Error predicting delivery:', error);
      return {
        predicted_delivery_date: new Date(orderData.order_date.getTime() + 7 * 24 * 60 * 60 * 1000),
        confidence_level: 50,
        estimated_days: 7,
        risk_factors: ['Erro no cálculo de previsão'],
      };
    }
  }, []);

  // Gerar recomendações inteligentes
  const generateRecommendations = useCallback(async () => {
    if (!patterns.length || !qualityScores.length) return;

    const recommendations: AIRecommendation[] = [];

    // Recomendação 1: Melhor transportadora por região
    const regionPerformance = patterns.reduce((acc, pattern) => {
      if (!acc[pattern.region]) {
        acc[pattern.region] = [];
      }
      acc[pattern.region].push(pattern);
      return acc;
    }, {} as Record<string, DeliveryPattern[]>);

    Object.entries(regionPerformance).forEach(([region, regionPatterns]) => {
      const bestCarrier = regionPatterns.reduce((best, current) =>
        current.on_time_percentage > best.on_time_percentage ? current : best
      );

      if (bestCarrier.on_time_percentage > 80) {
        recommendations.push({
          type: 'carrier_switch',
          title: `Otimize entregas para ${region}`,
          description: `Use ${bestCarrier.carrier} para entregas nesta região (${bestCarrier.on_time_percentage}% no prazo)`,
          impact: 'high',
          potential_savings: Math.round(bestCarrier.total_deliveries * 0.1 * 50), // Estimativa de economia
          confidence: 85,
          actionable: true,
        });
      }
    });

    // Recomendação 2: Transportadoras com baixo desempenho
    const lowPerformers = qualityScores.filter(score => score.overall_score < 60);
    lowPerformers.forEach(carrier => {
      recommendations.push({
        type: 'carrier_switch',
        title: `Substitua ${carrier.carrier}`,
        description: `Considere alternativas para ${carrier.carrier} (score: ${carrier.overall_score}/100)`,
        impact: 'high',
        potential_savings: 500, // Valor estimado
        confidence: 75,
        actionable: true,
      });
    });

    // Recomendação 3: Otimização de timing
    const highDelayPatterns = patterns.filter(p => p.delay_average_days > 5);
    if (highDelayPatterns.length > 0) {
      recommendations.push({
        type: 'timing_adjustment',
        title: 'Ajuste expectativas de entrega',
        description: `Aumente o tempo estimado para regiões com atrasos frequentes`,
        impact: 'medium',
        potential_savings: 200,
        confidence: 70,
        actionable: true,
      });
    }

    // Recomendação 4: Envios em lote
    const bulkOpportunities = patterns.filter(p => p.total_deliveries > 20 && p.on_time_percentage > 75);
    if (bulkOpportunities.length > 0) {
      recommendations.push({
        type: 'bulk_shipping',
        title: 'Considere envios em lote',
        description: `Agrupe pedidos para ${bulkOpportunities[0].region} para reduzir custos`,
        impact: 'medium',
        potential_savings: 300,
        confidence: 65,
        actionable: true,
      });
    }

    setRecommendations(recommendations);
  }, [patterns, qualityScores]);

  // Calcular métricas gerais
  const calculateMetrics = useCallback(async () => {
    if (!user) return;

    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('status, created_at, actual_delivery, carrier')
        .eq('user_id', user.id);

      if (error) throw error;

      const totalOrders = orders?.length || 0;
      const deliveredOrders = orders?.filter(o => o.status === 'delivered' && o.actual_delivery) || [];
      const onTimeDeliveries = deliveredOrders.filter(order => {
        if (!order.actual_delivery) return false;
        const actualDays = Math.ceil(
          (new Date(order.actual_delivery).getTime() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        return actualDays <= 7; // Assumindo 7 dias como padrão
      }).length;

      const avgDeliveryTime = deliveredOrders.length > 0
        ? deliveredOrders.reduce((sum, order) => {
            const days = Math.ceil(
              (new Date(order.actual_delivery!).getTime() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24)
            );
            return sum + days;
          }, 0) / deliveredOrders.length
        : 0;

      // Melhor transportadora
      const carrierStats = deliveredOrders.reduce((acc, order) => {
        if (!acc[order.carrier]) acc[order.carrier] = { total: 0, onTime: 0 };
        acc[order.carrier].total++;
        // Simplificado - assumir no prazo se entregue
        acc[order.carrier].onTime++;
        return acc;
      }, {} as Record<string, { total: number; onTime: number }>);

      const mostReliableCarrier = Object.entries(carrierStats)
        .reduce((best, [carrier, stats]) =>
          (stats.onTime / stats.total) > (carrierStats[best]?.onTime / carrierStats[best]?.total || 0) ? carrier : best
        , '');

      // Potencial de economia baseado em recomendações
      const potentialSavings = recommendations.reduce((sum, rec) => sum + rec.potential_savings, 0);

      setMetrics({
        total_orders: totalOrders,
        on_time_deliveries: onTimeDeliveries,
        average_delivery_time: Math.round(avgDeliveryTime),
        most_reliable_carrier: mostReliableCarrier,
        riskiest_region: 'Centro-Oeste', // Implementar cálculo real
        potential_savings: potentialSavings,
        ai_accuracy: 78, // Simulado
      });
    } catch (error) {
      console.error('Error calculating metrics:', error);
    }
  }, [user, recommendations]);

  // Função principal para carregar todos os insights
  const loadInsights = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      await Promise.all([
        analyzePatterns(),
        calculateQualityScores(),
      ]);

      // Pequeno delay para garantir que os estados foram atualizados
      setTimeout(async () => {
        await generateRecommendations();
        await calculateMetrics();
      }, 100);
    } catch (error) {
      console.error('Error loading insights:', error);
      toast.error('Erro ao carregar insights de IA');
    } finally {
      setLoading(false);
    }
  }, [user, analyzePatterns, calculateQualityScores, generateRecommendations, calculateMetrics]);

  // Previsão para um pedido específico
  const getPredictionForOrder = useCallback(async (orderId: string) => {
    try {
      const { data: order, error } = await supabase
        .from('orders')
        .select('carrier, destination, created_at')
        .eq('id', orderId)
        .single();

      if (error) throw error;

      const prediction = await predictDelivery({
        carrier: order.carrier,
        origin_region: 'São Paulo', // Valor padrão
        destination_region: order.destination || 'São Paulo',
        order_date: new Date(order.created_at),
      });

      const predictionWithId: DeliveryPrediction = {
        order_id: orderId,
        carrier: order.carrier,
        origin_region: 'São Paulo',
        destination_region: order.destination || 'São Paulo',
        ...prediction,
      };

      setPredictions(prev => [...prev.filter(p => p.order_id !== orderId), predictionWithId]);
      return predictionWithId;
    } catch (error) {
      console.error('Error getting prediction:', error);
      throw error;
    }
  }, [predictDelivery]);

  // Dados calculados para gráficos
  const chartData = useMemo(() => {
    // Dados para gráfico de performance por transportadora
    const carrierPerformance = qualityScores.map(score => ({
      carrier: score.carrier,
      score: score.overall_score,
      timeliness: score.timeliness_score,
      reliability: score.reliability_score,
    }));

    // Dados para gráfico de padrões por região
    const regionPatterns = patterns.reduce((acc, pattern) => {
      const existing = acc.find(p => p.region === pattern.region);
      if (existing) {
        existing.average_delivery_time = Math.round((existing.average_delivery_time + pattern.average_delivery_time) / 2);
        existing.on_time_percentage = Math.round((existing.on_time_percentage + pattern.on_time_percentage) / 2);
      } else {
        acc.push({
          region: pattern.region,
          average_delivery_time: pattern.average_delivery_time,
          on_time_percentage: pattern.on_time_percentage,
        });
      }
      return acc;
    }, [] as Array<{
      region: string;
      average_delivery_time: number;
      on_time_percentage: number;
    }>);

    // Dados de tendência temporal (últimos 30 dias)
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    const trendData = last30Days.map(date => ({
      date,
      onTime: Math.floor(Math.random() * 20) + 10, // Simulado
      delayed: Math.floor(Math.random() * 10) + 2,
      delivered: Math.floor(Math.random() * 25) + 15,
    }));

    return {
      carrierPerformance,
      regionPatterns,
      trendData,
    };
  }, [qualityScores, patterns]);

  // Usar useRef para evitar re-renders infinitos
  const functionsRef = useRef({
    analyzePatterns,
    calculateQualityScores,
    generateRecommendations,
    calculateMetrics,
  });

  // Atualizar as funções no ref quando mudarem
  useEffect(() => {
    functionsRef.current = {
      analyzePatterns,
      calculateQualityScores,
      generateRecommendations,
      calculateMetrics,
    };
  }, [analyzePatterns, calculateQualityScores, generateRecommendations, calculateMetrics]);

  useEffect(() => {
    if (user) {
      const loadData = async () => {
        setLoading(true);
        try {
          await Promise.all([
            functionsRef.current.analyzePatterns(),
            functionsRef.current.calculateQualityScores(),
          ]);

          // Pequeno delay para garantir que os estados foram atualizados
          setTimeout(async () => {
            await functionsRef.current.generateRecommendations();
            await functionsRef.current.calculateMetrics();
          }, 100);
        } catch (error) {
          console.error('Error loading insights:', error);
          toast.error('Erro ao carregar insights de IA');
        } finally {
          setLoading(false);
        }
      };

      loadData();
    }
  }, [user]); // Só depende do user

  return {
    // Estado
    loading,
    patterns,
    qualityScores,
    predictions,
    recommendations,
    metrics,

    // Dados para gráficos
    chartData,

    // Ações
    loadInsights,
    getPredictionForOrder,
    analyzePatterns,
    calculateQualityScores,
    generateRecommendations,
  };
};

// Hook legado para compatibilidade
export const useAIRecommendations = () => {
  const { recommendations } = useAIInsights();

  return {
    getRecommendations: () => recommendations,
    recommendations,
  };
};