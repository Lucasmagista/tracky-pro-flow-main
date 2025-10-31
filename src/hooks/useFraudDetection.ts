import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface FraudPattern {
  id: string;
  name: string;
  description?: string;
  type: 'velocity' | 'amount' | 'location' | 'behavior' | 'custom';
  conditions: FraudCondition[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  action: 'flag' | 'block' | 'review' | 'allow';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FraudCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'regex' | 'velocity';
  value: string | number;
  timeWindow?: number; // em minutos, para condições de velocidade
  threshold?: number; // limite para acionar a condição
}

export interface FraudAlert {
  patternId: string;
  recordId: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  reasons: string[];
  suggestedAction: 'flag' | 'block' | 'review' | 'allow';
  metadata: Record<string, string | number | boolean | null>;
}

export interface FraudAnalysis {
  alerts: FraudAlert[];
  summary: {
    totalRecords: number;
    flaggedRecords: number;
    blockedRecords: number;
    reviewRecords: number;
    riskDistribution: Record<string, number>;
  };
  patterns: {
    patternId: string;
    matches: number;
    confidence: number;
  }[];
}

export const useFraudDetection = () => {
  const { user } = useAuth();
  const [patterns, setPatterns] = useState<FraudPattern[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Carregar padrões de fraude
  const loadPatterns = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('fraud_patterns')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedPatterns: FraudPattern[] = (data ?? []).map((pattern: Database['public']['Tables']['fraud_patterns']['Row']) => ({
        id: pattern.id,
        name: pattern.name,
        description: pattern.description ?? undefined,
        type: ["velocity","amount","location","behavior","custom"].includes(pattern.pattern_type) ? pattern.pattern_type as FraudPattern['type'] : 'custom',
        conditions: Array.isArray(pattern.conditions)
            ? pattern.conditions as unknown as FraudCondition[]
          : (typeof pattern.conditions === 'string' ? JSON.parse(pattern.conditions) : []),
        riskLevel: ["low","medium","high","critical"].includes(pattern.risk_level) ? pattern.risk_level as FraudPattern['riskLevel'] : 'low',
        action: ["flag","block","review","allow"].includes(pattern.action) ? pattern.action as FraudPattern['action'] : 'flag',
        isActive: pattern.is_active,
        createdAt: pattern.created_at ?? '',
        updatedAt: pattern.updated_at ?? ''
      }));

      setPatterns(formattedPatterns);
    } catch (error) {
      console.error('Erro ao carregar padrões de fraude:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Salvar novo padrão de fraude
  const savePattern = useCallback(async (
    name: string,
    type: FraudPattern['type'],
    conditions: FraudCondition[],
    riskLevel: FraudPattern['riskLevel'],
    action: FraudPattern['action'],
    description?: string
  ): Promise<FraudPattern | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('fraud_patterns')
        .insert({
          user_id: user.id,
          name,
          description,
          pattern_type: type,
            conditions: JSON.stringify(conditions),
          risk_level: riskLevel,
          action,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      const newPattern: FraudPattern = {
        id: data.id,
        name: data.name,
        description: data.description ?? undefined,
        type: ["velocity","amount","location","behavior","custom"].includes(data.pattern_type)
          ? data.pattern_type as FraudPattern['type']
          : 'custom',
        conditions: (() => {
          if (Array.isArray(data.conditions)) return data.conditions as unknown as FraudCondition[];
          if (typeof data.conditions === 'string') {
            try { return JSON.parse(data.conditions) as FraudCondition[]; } catch { return []; }
          }
          return [];
        })(),
        riskLevel: ["low","medium","high","critical"].includes(data.risk_level)
          ? data.risk_level as FraudPattern['riskLevel']
          : 'low',
        action: ["flag","block","review","allow"].includes(data.action)
          ? data.action as FraudPattern['action']
          : 'flag',
        isActive: data.is_active,
        createdAt: data.created_at ?? '',
        updatedAt: data.updated_at ?? ''
      };

      setPatterns(prev => [newPattern, ...prev]);
      return newPattern;
    } catch (error) {
      console.error('Erro ao salvar padrão de fraude:', error);
      return null;
    }
  }, [user]);

  // Analisar dados para detecção de fraudes
  const analyzeFraudPatterns = (
    data: Record<string, string | number | boolean | null>[],
    activePatterns: FraudPattern[] = patterns
  ): FraudAnalysis => {
    const evaluatePattern = (
      pattern: FraudPattern,
      record: Record<string, string | number | boolean | null>,
      allData: Record<string, string | number | boolean | null>[]
    ): { isMatch: boolean; confidence: number; reason: string } => {
      const totalConditions = pattern.conditions.length;
      let matchedConditions = 0;
      const reasons: string[] = [];

      pattern.conditions.forEach(condition => {
        const result = evaluateCondition(condition, record, allData);
        if (result.isMatch) {
          matchedConditions++;
          reasons.push(result.reason);
        }
      });

      const confidence = totalConditions > 0 ? matchedConditions / totalConditions : 0;
      const isMatch = confidence >= 0.8; // Threshold de 80% para considerar match

      return {
        isMatch,
        confidence,
        reason: reasons.join('; ')
      };
    };

    const alerts: FraudAlert[] = [];
    const patternStats: Record<string, { matches: number; confidence: number }> = {};
    const riskDistribution = { low: 0, medium: 0, high: 0, critical: 0 };

    // Para cada registro, verificar todos os padrões
    data.forEach((record, index) => {
      const recordId = `record_${index}`;
      let recordRiskLevel: FraudAlert['riskLevel'] = 'low';
      let recordConfidence = 0;
      const reasons: string[] = [];
      let suggestedAction: FraudAlert['suggestedAction'] = 'allow';

      activePatterns.forEach(pattern => {
        const match = evaluatePattern(pattern, record, data);

        if (match.isMatch) {
          // Inicializar estatísticas do padrão se necessário
          if (!patternStats[pattern.id]) {
            patternStats[pattern.id] = { matches: 0, confidence: 0 };
          }

          patternStats[pattern.id].matches++;
          patternStats[pattern.id].confidence = Math.max(
            patternStats[pattern.id].confidence,
            match.confidence
          );

          // Atualizar nível de risco do registro
          if (getRiskWeight(pattern.riskLevel) > getRiskWeight(recordRiskLevel)) {
            recordRiskLevel = pattern.riskLevel;
          }

          recordConfidence = Math.max(recordConfidence, match.confidence);
          reasons.push(`${pattern.name}: ${match.reason}`);
          suggestedAction = getSuggestedAction(suggestedAction, pattern.action);
        }
      });

      // Se houve alguma correspondência, criar alerta
      if (reasons.length > 0) {
        alerts.push({
          patternId: 'composite', // Pode ser múltiplos padrões
          recordId,
          riskLevel: recordRiskLevel,
          confidence: recordConfidence,
          reasons,
          suggestedAction,
          metadata: {
            recordIndex: index,
            matchedPatterns: reasons.length
          }
        });

        riskDistribution[recordRiskLevel]++;
      }
    });

    const patternsSummary = Object.entries(patternStats).map(([patternId, stats]) => ({
      patternId,
      matches: stats.matches,
      confidence: stats.confidence
    }));

    const summary = {
      totalRecords: data.length,
      flaggedRecords: alerts.length,
      blockedRecords: alerts.filter(a => a.suggestedAction === 'block').length,
      reviewRecords: alerts.filter(a => a.suggestedAction === 'review').length,
      riskDistribution
    };

    return { alerts, summary, patterns: patternsSummary };
  };

  // Avaliar um padrão específico contra um registro
  const evaluatePattern = (
    pattern: FraudPattern,
    record: Record<string, string | number | boolean | null>,
    allData: Record<string, string | number | boolean | null>[]
  ): { isMatch: boolean; confidence: number; reason: string } => {
    const totalConditions = pattern.conditions.length;
    let matchedConditions = 0;
    const reasons: string[] = [];

    pattern.conditions.forEach(condition => {
      const result = evaluateCondition(condition, record, allData);
      if (result.isMatch) {
        matchedConditions++;
        reasons.push(result.reason);
      }
    });

    const confidence = totalConditions > 0 ? matchedConditions / totalConditions : 0;
    const isMatch = confidence >= 0.8; // Threshold de 80% para considerar match

    return {
      isMatch,
      confidence,
      reason: reasons.join('; ')
    };
  };

  // Avaliar uma condição específica
  const evaluateCondition = (
    condition: FraudCondition,
    record: Record<string, string | number | boolean | null>,
    allData: Record<string, string | number | boolean | null>[]
  ): { isMatch: boolean; reason: string } => {
    const fieldValue = record[condition.field];

    if (condition.operator === 'velocity') {
      // Verificar velocidade (ex: múltiplas transações em pouco tempo)
      return evaluateVelocityCondition(condition, record, allData);
    }

    // Avaliação normal baseada no operador
    let isMatch = false;
    let reason = '';

    switch (condition.operator) {
      case 'equals':
        isMatch = fieldValue == condition.value;
        reason = `${condition.field} = ${condition.value}`;
        break;
      case 'not_equals':
        isMatch = fieldValue != condition.value;
        reason = `${condition.field} ≠ ${condition.value}`;
        break;
      case 'greater_than':
        isMatch = Number(fieldValue) > Number(condition.value);
        reason = `${condition.field} > ${condition.value}`;
        break;
      case 'less_than':
        isMatch = Number(fieldValue) < Number(condition.value);
        reason = `${condition.field} < ${condition.value}`;
        break;
      case 'contains':
        isMatch = String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
        reason = `${condition.field} contém "${condition.value}"`;
        break;
      case 'regex':
        try {
          const regex = new RegExp(String(condition.value));
          isMatch = regex.test(String(fieldValue));
          reason = `${condition.field} corresponde ao padrão`;
        } catch (error) {
          isMatch = false;
          reason = 'Expressão regular inválida';
        }
        break;
    }

    return { isMatch, reason };
  };

  // Avaliar condição de velocidade
  const evaluateVelocityCondition = (
    condition: FraudCondition,
    record: Record<string, string | number | boolean | null>,
    allData: Record<string, string | number | boolean | null>[]
  ): { isMatch: boolean; reason: string } => {
    const timeWindow = condition.timeWindow || 60; // minutos padrão
    const threshold = condition.threshold || 5; // limite padrão

    // Assumir que há um campo de timestamp
    const recordTime = new Date(
      typeof record.timestamp === 'string' ? record.timestamp :
      typeof record.created_at === 'string' ? record.created_at :
      Date.now()
    );
    const windowStart = new Date(recordTime.getTime() - timeWindow * 60 * 1000);

    // Contar registros similares no período
    const similarRecords = allData.filter(otherRecord => {
      if (otherRecord === record) return false;

      const otherTime = new Date(
        typeof otherRecord.timestamp === 'string' ? otherRecord.timestamp :
        typeof otherRecord.created_at === 'string' ? otherRecord.created_at :
        Date.now()
      );
      const isInWindow = otherTime >= windowStart && otherTime <= recordTime;

      // Verificar se é "similar" baseado no campo da condição
      const isSimilar = otherRecord[condition.field] === record[condition.field];

      return isInWindow && isSimilar;
    });

    const isMatch = similarRecords.length >= threshold;
    const reason = isMatch
      ? `${similarRecords.length} ocorrências similares em ${timeWindow} minutos (limite: ${threshold})`
      : `${similarRecords.length} ocorrências similares (abaixo do limite: ${threshold})`;

    return { isMatch, reason };
  };

  // Obter peso do nível de risco
  const getRiskWeight = (riskLevel: FraudAlert['riskLevel']): number => {
    const weights = { low: 1, medium: 2, high: 3, critical: 4 };
    return weights[riskLevel];
  };

  // Obter ação sugerida baseada na combinação de ações
  const getSuggestedAction = (
    currentAction: FraudAlert['suggestedAction'],
    newAction: FraudPattern['action']
  ): FraudAlert['suggestedAction'] => {
    const actionWeights = { allow: 0, flag: 1, review: 2, block: 3 };

    if (actionWeights[newAction] > actionWeights[currentAction]) {
      return newAction;
    }

    return currentAction;
  };

  // Padrões pré-definidos comuns de fraude
  const getCommonFraudPatterns = useCallback((): Omit<FraudPattern, 'id' | 'createdAt' | 'updatedAt'>[] => {
    return [
      {
        name: 'Pedidos Muito Frequentes',
        description: 'Múltiplos pedidos do mesmo cliente em curto período',
        type: 'velocity',
        conditions: [
          {
            field: 'customer_email',
            operator: 'velocity',
            value: '',
            timeWindow: 30, // 30 minutos
            threshold: 3 // 3 pedidos
          }
        ],
        riskLevel: 'high',
        action: 'review',
        isActive: true
      },
      {
        name: 'Valor Muito Alto',
        description: 'Pedidos com valor excepcionalmente alto',
        type: 'amount',
        conditions: [
          {
            field: 'order_value',
            operator: 'greater_than',
            value: 5000
          }
        ],
        riskLevel: 'medium',
        action: 'flag',
        isActive: true
      },
      {
        name: 'CEP Suspeito',
        description: 'CEPs associados a alta taxa de fraudes',
        type: 'location',
        conditions: [
          {
            field: 'delivery_zipcode',
            operator: 'regex',
            value: '^(01310|01311|04578)' // CEPs de alto risco em SP
          }
        ],
        riskLevel: 'low',
        action: 'flag',
        isActive: true
      },
      {
        name: 'Telefone Sequencial',
        description: 'Telefones com números sequenciais (possível geração automática)',
        type: 'behavior',
        conditions: [
          {
            field: 'customer_phone',
            operator: 'regex',
            value: '.*(0123456789|1234567890|9876543210).*'
          }
        ],
        riskLevel: 'high',
        action: 'block',
        isActive: true
      },
      {
        name: 'E-mail Temporário',
        description: 'E-mails de provedores temporários',
        type: 'behavior',
        conditions: [
          {
            field: 'customer_email',
            operator: 'regex',
            value: '@(10minutemail|guerrillamail|mailinator|temp-mail)\\.'
          }
        ],
        riskLevel: 'critical',
        action: 'block',
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
    analyzeFraudPatterns,
    getCommonFraudPatterns
  };
};