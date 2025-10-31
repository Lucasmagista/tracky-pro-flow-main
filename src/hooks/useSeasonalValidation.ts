import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/types/supabase';

export interface SeasonalPattern {
  id: string;
  name: string;
  description?: string;
  field: string;
  pattern: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  customPattern?: string;
  expectedRange: {
    min: number;
    max: number;
    unit: 'count' | 'percentage' | 'value';
  };
  baselinePeriod: {
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
  };
  tolerance: number; // percentage
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemporalValidation {
  patternId: string;
  isValid: boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
  field: string;
  currentValue: number;
  expectedRange: { min: number; max: number };
  deviation: number;
  suggestion?: string;
}

export interface SeasonalAnalysis {
  validations: TemporalValidation[];
  summary: {
    totalPatterns: number;
    passedPatterns: number;
    failedPatterns: number;
    anomalies: number;
    warnings: number;
  };
  trends: {
    field: string;
    trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    confidence: number;
    description: string;
  }[];
}

export const useSeasonalValidation = () => {
  const { user } = useAuth();
  const [patterns, setPatterns] = useState<SeasonalPattern[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Carregar padrões sazonais
  const loadPatterns = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('seasonal_patterns')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

  const formattedPatterns: SeasonalPattern[] = (data ?? []).map((pattern: Database['public']['Tables']['seasonal_patterns']['Row']) => ({
        id: pattern.id,
        name: pattern.name,
        description: pattern.description ?? undefined,
        field: pattern.field_name,
        pattern: ["daily","weekly","monthly","quarterly","yearly","custom"].includes(pattern.pattern_type)
          ? pattern.pattern_type as SeasonalPattern['pattern']
          : 'custom',
        customPattern: pattern.custom_pattern ?? undefined,
        expectedRange: typeof pattern.expected_range === 'string'
          ? JSON.parse(pattern.expected_range)
          : pattern.expected_range,
        baselinePeriod: typeof pattern.baseline_period === 'string'
          ? JSON.parse(pattern.baseline_period)
          : pattern.baseline_period,
        tolerance: typeof pattern.tolerance_percentage === 'number'
          ? pattern.tolerance_percentage
          : parseFloat(pattern.tolerance_percentage) || 0,
        isActive: !!pattern.is_active,
        createdAt: pattern.created_at ?? '',
        updatedAt: pattern.updated_at ?? ''
      }));

      setPatterns(formattedPatterns);
    } catch (error) {
      console.error('Erro ao carregar padrões sazonais:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Salvar novo padrão sazonal
  const savePattern = useCallback(async (
    name: string,
    field: string,
    pattern: SeasonalPattern['pattern'],
    expectedRange: SeasonalPattern['expectedRange'],
    baselinePeriod: SeasonalPattern['baselinePeriod'],
    tolerance: number,
    customPattern?: string,
    description?: string
  ): Promise<SeasonalPattern | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('seasonal_patterns')
        .insert({
          user_id: user.id,
          name,
          description,
          field_name: field,
          pattern_type: pattern,
          custom_pattern: customPattern,
          expected_range: expectedRange,
          baseline_period: baselinePeriod,
          tolerance_percentage: tolerance,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      const newPattern: SeasonalPattern = {
        id: data.id,
        name: data.name,
        description: data.description ?? undefined,
        field: data.field_name,
        pattern: ["daily","weekly","monthly","quarterly","yearly","custom"].includes(data.pattern_type)
          ? data.pattern_type as SeasonalPattern['pattern']
          : 'custom',
        customPattern: data.custom_pattern ?? undefined,
        expectedRange: typeof data.expected_range === 'string'
          ? JSON.parse(data.expected_range)
          : data.expected_range,
        baselinePeriod: typeof data.baseline_period === 'string'
          ? JSON.parse(data.baseline_period)
          : data.baseline_period,
        tolerance: typeof data.tolerance_percentage === 'number'
          ? data.tolerance_percentage
          : parseFloat(data.tolerance_percentage) || 0,
        isActive: !!data.is_active,
        createdAt: data.created_at ?? '',
        updatedAt: data.updated_at ?? ''
      };

      setPatterns(prev => [newPattern, ...prev]);
      return newPattern;
    } catch (error) {
      console.error('Erro ao salvar padrão sazonal:', error);
      return null;
    }
  }, [user]);

  // Analisar padrões sazonais nos dados
  const analyzeSeasonalPatterns = useCallback((
    data: Record<string, string | number | boolean | null>[],
    dateField: string,
    activePatterns: SeasonalPattern[] = patterns
  ): SeasonalAnalysis => {
    const validations: TemporalValidation[] = [];
    const trends: SeasonalAnalysis['trends'] = [];
    const summary = {
      totalPatterns: activePatterns.length,
      passedPatterns: 0,
      failedPatterns: 0,
      anomalies: 0,
      warnings: 0
    };

    // Agrupar dados por período baseado nos padrões
    activePatterns.forEach(pattern => {
      // Filtrar dados do período baseline
      const baselineData = data.filter(record => {
        const recordDate = new Date(record[dateField] as string);
        const startDate = new Date(pattern.baselinePeriod.start);
        const endDate = new Date(pattern.baselinePeriod.end);
        return recordDate >= startDate && recordDate <= endDate;
      });

      // Calcular estatísticas do baseline
      const baselineValues = baselineData.map(record => {
        const value = record[pattern.field];
        return typeof value === 'number' ? value : parseFloat(value as string) || 0;
      });

      const baselineAvg = baselineValues.reduce((sum, val) => sum + val, 0) / baselineValues.length;

      // Calcular valores atuais (último período similar)
      const currentPeriodData = getCurrentPeriodData(data, dateField, pattern);
      const currentValues = currentPeriodData.map(record => {
        const value = record[pattern.field];
        return typeof value === 'number' ? value : parseFloat(value as string) || 0;
      });

      const currentAvg = currentValues.length > 0
        ? currentValues.reduce((sum, val) => sum + val, 0) / currentValues.length
        : 0;

      // Verificar se está dentro da faixa esperada
      const expectedMin = pattern.expectedRange.min;
      const expectedMax = pattern.expectedRange.max;
      const tolerance = pattern.tolerance / 100;

      const isWithinRange = currentAvg >= expectedMin * (1 - tolerance) &&
                           currentAvg <= expectedMax * (1 + tolerance);

      const deviation = Math.abs(currentAvg - (expectedMin + expectedMax) / 2) /
                       ((expectedMin + expectedMax) / 2);

      let severity: 'error' | 'warning' | 'info' = 'info';
      let message = '';
      let suggestion = '';

      if (!isWithinRange) {
        if (deviation > 0.5) {
          severity = 'error';
          message = `Valor atual (${currentAvg.toFixed(2)}) está muito fora do padrão esperado`;
          suggestion = 'Verifique se há fatores externos influenciando os dados';
        } else {
          severity = 'warning';
          message = `Valor atual (${currentAvg.toFixed(2)}) diverge do padrão sazonal`;
          suggestion = 'Monitore este padrão nos próximos períodos';
        }
      } else {
        message = `Padrão sazonal mantido - valor atual: ${currentAvg.toFixed(2)}`;
      }

      const validation: TemporalValidation = {
        patternId: pattern.id,
        isValid: isWithinRange,
        severity,
        message,
        field: pattern.field,
        currentValue: currentAvg,
        expectedRange: { min: expectedMin, max: expectedMax },
        deviation: deviation * 100,
        suggestion
      };

      validations.push(validation);

      if (validation.isValid) {
        summary.passedPatterns++;
      } else {
        summary.failedPatterns++;
        if (validation.severity === 'error') summary.anomalies++;
        if (validation.severity === 'warning') summary.warnings++;
      }
    });

    // Analisar tendências gerais
    const trendAnalysis = analyzeTrends(data, dateField);
    trends.push(...trendAnalysis);

    return { validations, summary, trends };
  }, [patterns]);

  // Obter dados do período atual baseado no padrão
  const getCurrentPeriodData = (
    data: Record<string, string | number | boolean | null>[],
    dateField: string,
    pattern: SeasonalPattern
  ): Record<string, string | number | boolean | null>[] => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (pattern.pattern) {
      case 'daily': {
        // Últimas 24 horas
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      }
      case 'weekly': {
        // Semana atual
        startDate = new Date(now.setDate(now.getDate() - now.getDay()));
        endDate = new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000);
        break;
      }
      case 'monthly': {
        // Mês atual
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      }
      case 'quarterly': {
        // Trimestre atual
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), quarterStart, 1);
        endDate = new Date(now.getFullYear(), quarterStart + 3, 0);
        break;
      }
      case 'yearly': {
        // Ano atual
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      }
      default: {
        // Padrão customizado - usar último mês como fallback
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      }
    }

    return data.filter(record => {
      const recordDate = new Date(record[dateField] as string);
      return recordDate >= startDate && recordDate <= endDate;
    });
  };

  // Analisar tendências gerais
  const analyzeTrends = (
    data: Record<string, string | number | boolean | null>[],
    dateField: string
  ): SeasonalAnalysis['trends'] => {
    const trends: SeasonalAnalysis['trends'] = [];
    const numericFields = ['order_value', 'quantity'];

    numericFields.forEach(field => {
      const fieldData = data
        .filter(record => {
          const dateVal = record[dateField];
          const fieldVal = record[field];
          return (typeof dateVal === 'string' || typeof dateVal === 'number') &&
                 (typeof fieldVal === 'number' || typeof fieldVal === 'string');
        })
        .map(record => ({
          date: new Date(
            typeof record[dateField] === 'string' || typeof record[dateField] === 'number'
              ? record[dateField] as string | number
              : Date.now()
          ),
          value: typeof record[field] === 'number'
            ? record[field] as number
            : (typeof record[field] === 'string' ? parseFloat(record[field] as string) || 0 : 0)
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      if (fieldData.length < 5) return; // Precisa de dados suficientes

      // Calcular tendência linear
      const n = fieldData.length;
      const sumX = fieldData.reduce((sum, _, i) => sum + i, 0);
      const sumY = fieldData.reduce((sum, item) => sum + item.value, 0);
      const sumXY = fieldData.reduce((sum, item, i) => sum + i * item.value, 0);
      const sumXX = fieldData.reduce((sum, _, i) => sum + i * i, 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

      // Calcular volatilidade
      const mean = sumY / n;
      const variance = fieldData.reduce((sum, item) => sum + Math.pow(item.value - mean, 2), 0) / n;
      const volatility = Math.sqrt(variance) / mean;

      let trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
      let confidence: number;
      let description: string;

      if (volatility > 0.5) {
        trend = 'volatile';
        confidence = 0.8;
        description = 'Alta volatilidade - padrões irregulares detectados';
      } else if (Math.abs(slope) < 0.01) {
        trend = 'stable';
        confidence = 0.9;
        description = 'Tendência estável - valores consistentes';
      } else if (slope > 0.01) {
        trend = 'increasing';
        confidence = Math.min(Math.abs(slope) * 100, 0.95);
        description = `Tendência de crescimento (${(slope * 100).toFixed(2)}% por período)`;
      } else {
        trend = 'decreasing';
        confidence = Math.min(Math.abs(slope) * 100, 0.95);
        description = `Tendência de declínio (${(slope * 100).toFixed(2)}% por período)`;
      }

      trends.push({
        field,
        trend,
        confidence,
        description
      });
    });

    return trends;
  };

  // Padrões pré-definidos comuns
  const getCommonPatterns = useCallback((): Omit<SeasonalPattern, 'id' | 'createdAt' | 'updatedAt'>[] => {
    return [
      {
        name: 'Volume de Pedidos Diários',
        description: 'Padrão esperado de pedidos por dia da semana',
        field: 'order_count',
        pattern: 'weekly',
        expectedRange: { min: 10, max: 50, unit: 'count' },
        baselinePeriod: {
          start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0]
        },
        tolerance: 20,
        isActive: true
      },
      {
        name: 'Valor Médio de Pedidos',
        description: 'Faixa esperada do valor médio dos pedidos',
        field: 'order_value',
        pattern: 'monthly',
        expectedRange: { min: 50, max: 200, unit: 'value' },
        baselinePeriod: {
          start: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0]
        },
        tolerance: 15,
        isActive: true
      },
      {
        name: 'Sazonalidade de Fim de Ano',
        description: 'Aumento esperado nas vendas de dezembro',
        field: 'order_value',
        pattern: 'yearly',
        expectedRange: { min: 150, max: 300, unit: 'percentage' },
        baselinePeriod: {
          start: '2022-12-01',
          end: '2022-12-31'
        },
        tolerance: 25,
        isActive: true
      }
    ];
  }, []);

  // Carregar padrões na inicialização
  useEffect(() => {
    loadPatterns();
  }, [loadPatterns]);

  return {
    patterns,
    isLoading,
    loadPatterns,
    savePattern,
    analyzeSeasonalPatterns,
    getCommonPatterns
  };
};