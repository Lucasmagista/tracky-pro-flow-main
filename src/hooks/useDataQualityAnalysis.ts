import { useState, useCallback } from 'react';

export interface QualityMetric {
  name: string;
  score: number; // 0-100
  weight: number; // Peso na pontuação geral
  description: string;
  issues: string[];
  recommendations: string[];
}

export interface DataQualityReport {
  overallScore: number;
  metrics: QualityMetric[];
  summary: {
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    criticalIssues: number;
    warnings: number;
  };
  fieldAnalysis: Record<string, FieldQualityAnalysis>;
  recommendations: string[];
}

export interface FieldQualityAnalysis {
  field: string;
  completeness: number; // % de valores não vazios
  validity: number; // % de valores válidos
  consistency: number; // % de valores consistentes
  uniqueness: number; // % de valores únicos
  issues: string[];
  sampleValues: string[];
}

export interface QualityThresholds {
  completeness: number; // % mínimo aceitável
  validity: number; // % mínimo aceitável
  consistency: number; // % mínimo aceitável
  uniqueness: number; // % mínimo aceitável para campos únicos
}

const DEFAULT_THRESHOLDS: QualityThresholds = {
  completeness: 95,
  validity: 90,
  consistency: 85,
  uniqueness: 98
};

export const useDataQualityAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [thresholds, setThresholds] = useState<QualityThresholds>(DEFAULT_THRESHOLDS);

  const analyzeFieldCompleteness = useCallback((values: string[]): number => {
    if (values.length === 0) return 100;

    const nonEmptyValues = values.filter(v => v && v.trim() !== '');
    return (nonEmptyValues.length / values.length) * 100;
  }, []);

  const analyzeFieldValidity = useCallback((values: string[], fieldType: string): number => {
    if (values.length === 0) return 100;

    let validCount = 0;

    values.forEach(value => {
      if (!value || value.trim() === '') return;

      let isValid = false;

      switch (fieldType) {
        case 'customer_email':
          isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value);
          break;
        case 'customer_phone':
          isValid = /(\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}/.test(value);
          break;
        case 'tracking_code':
          isValid = /^[A-Z]{2}\d{9}[A-Z]{2}$|^[A-Z]{2}\d{10}[A-Z]{2}$|^\d{12,14}$|^LG\d{9}BR$|^TE\d{9}BR$|^AC\d{9}BR$/i.test(value);
          break;
        case 'order_value':
          isValid = /^\d+([,.]\d{1,2})?$/.test(value.replace(/[R$\s]/g, ''));
          break;
        case 'delivery_zipcode':
          isValid = /^\d{5}-?\d{3}$/.test(value);
          break;
        case 'order_date':
        case 'estimated_delivery':
          // Aceitar vários formatos de data
          isValid = !isNaN(Date.parse(value)) ||
                   /^\d{2}\/\d{2}\/\d{4}$/.test(value) ||
                   /^\d{4}-\d{2}-\d{2}$/.test(value);
          break;
        default:
          isValid = true; // Campos genéricos são considerados válidos se não vazios
      }

      if (isValid) validCount++;
    });

    return (validCount / values.length) * 100;
  }, []);

  const analyzeFieldConsistency = useCallback((values: string[], fieldType: string): number => {
    if (values.length === 0) return 100;

    // Verificar consistência de formato
    let consistencyScore = 100;

    switch (fieldType) {
      case 'customer_phone': {
        // Verificar se todos os telefones seguem o mesmo padrão
        const phonePatterns = values.map(v => {
          if (/^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(v)) return 'formatted';
          if (/^\d{2}\d{4,5}\d{4}$/.test(v)) return 'digits_only';
          return 'other';
        });
        const uniquePatterns = new Set(phonePatterns);
        if (uniquePatterns.size > 1) {
          consistencyScore -= (uniquePatterns.size - 1) * 20;
        }
        break;
      }

      case 'order_value': {
        // Verificar se todos os valores usam o mesmo separador decimal
        const decimalPatterns = values.map(v => {
          if (v.includes(',')) return 'comma';
          if (v.includes('.')) return 'dot';
          return 'none';
        });
        const uniqueDecimals = new Set(decimalPatterns);
        if (uniqueDecimals.size > 1) {
          consistencyScore -= (uniqueDecimals.size - 1) * 25;
        }
        break;
      }

      case 'order_date': {
        // Verificar se todas as datas seguem o mesmo formato
        const datePatterns = values.map(v => {
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return 'dd/mm/yyyy';
          if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'yyyy-mm-dd';
          if (/^\d{2}-\d{2}-\d{4}$/.test(v)) return 'dd-mm-yyyy';
          return 'other';
        });
        const uniqueDateFormats = new Set(datePatterns);
        if (uniqueDateFormats.size > 1) {
          consistencyScore -= (uniqueDateFormats.size - 1) * 15;
        }
        break;
      }
    }

    return Math.max(consistencyScore, 0);
  }, []);

  const analyzeFieldUniqueness = useCallback((values: string[]): number => {
    if (values.length === 0) return 100;

    const nonEmptyValues = values.filter(v => v && v.trim() !== '');
    const uniqueValues = new Set(nonEmptyValues);

    return (uniqueValues.size / nonEmptyValues.length) * 100;
  }, []);

  const analyzeDataQuality = useCallback(async (
    data: Record<string, string>[],
    fieldMappings: Record<string, string>
  ): Promise<DataQualityReport> => {
    setIsAnalyzing(true);

    try {
      const metrics: QualityMetric[] = [];
      const fieldAnalysis: Record<string, FieldQualityAnalysis> = {};
      const recommendations: string[] = [];

      let totalScore = 0;
      let totalWeight = 0;
      let criticalIssues = 0;
      let warnings = 0;

      // Analisar cada campo mapeado
      Object.entries(fieldMappings).forEach(([csvColumn, systemField]) => {
        const values = data.map(row => row[csvColumn] || '');
        const sampleValues = values.slice(0, 5);

        // Calcular métricas
        const completeness = analyzeFieldCompleteness(values);
        const validity = analyzeFieldValidity(values, systemField);
        const consistency = analyzeFieldConsistency(values, systemField);
        const uniqueness = analyzeFieldUniqueness(values);

        // Determinar peso baseado no tipo de campo
        const isRequired = ['tracking_code', 'customer_name', 'customer_email'].includes(systemField);
        const weight = isRequired ? 2 : 1;

        // Calcular score ponderado do campo
        const fieldScore = (
          completeness * 0.3 +
          validity * 0.4 +
          consistency * 0.2 +
          uniqueness * 0.1
        );

        // Identificar problemas
        const issues: string[] = [];
        const fieldRecommendations: string[] = [];

        if (completeness < thresholds.completeness) {
          issues.push(`Completude baixa: ${completeness.toFixed(1)}%`);
          fieldRecommendations.push(`Melhorar preenchimento do campo ${csvColumn}`);
          if (isRequired) criticalIssues++;
        }

        if (validity < thresholds.validity) {
          issues.push(`Validade baixa: ${validity.toFixed(1)}%`);
          fieldRecommendations.push(`Corrigir formato dos dados em ${csvColumn}`);
          if (isRequired) criticalIssues++;
        }

        if (consistency < thresholds.consistency) {
          issues.push(`Consistência baixa: ${consistency.toFixed(1)}%`);
          fieldRecommendations.push(`Padronizar formato dos dados em ${csvColumn}`);
          warnings++;
        }

        if (uniqueness < thresholds.uniqueness && ['tracking_code', 'order_number'].includes(systemField)) {
          issues.push(`Duplicatas encontradas: ${(100 - uniqueness).toFixed(1)}%`);
          fieldRecommendations.push(`Verificar duplicatas no campo ${csvColumn}`);
          criticalIssues++;
        }

        // Adicionar análise do campo
        fieldAnalysis[systemField] = {
          field: systemField,
          completeness,
          validity,
          consistency,
          uniqueness,
          issues,
          sampleValues
        };

        // Adicionar métrica
        metrics.push({
          name: `${csvColumn} → ${systemField}`,
          score: fieldScore,
          weight,
          description: `Qualidade do campo ${csvColumn} mapeado para ${systemField}`,
          issues,
          recommendations: fieldRecommendations
        });

        // Atualizar totais
        totalScore += fieldScore * weight;
        totalWeight += weight;

        // Adicionar recomendações gerais
        recommendations.push(...fieldRecommendations);
      });

      // Calcular score geral
      const overallScore = totalWeight > 0 ? totalScore / totalWeight : 100;

      // Adicionar métricas gerais
      metrics.unshift({
        name: 'Qualidade Geral dos Dados',
        score: overallScore,
        weight: 3,
        description: 'Score geral da qualidade dos dados baseado em todas as métricas',
        issues: overallScore < 70 ? ['Qualidade geral baixa - revisar dados'] : [],
        recommendations: overallScore < 70 ? ['Realizar limpeza de dados antes da importação'] : []
      });

      // Estatísticas do relatório
      const validRecords = data.filter(row => {
        // Um registro é válido se todos os campos obrigatórios estão preenchidos e válidos
        return ['tracking_code', 'customer_name', 'customer_email'].every(field => {
          const csvColumn = Object.keys(fieldMappings).find(key => fieldMappings[key] === field);
          if (!csvColumn) return true; // Campo não mapeado

          const value = row[csvColumn];
          if (!value || value.trim() === '') return false;

          return analyzeFieldValidity([value], field) > thresholds.validity;
        });
      }).length;

      return {
        overallScore,
        metrics,
        summary: {
          totalRecords: data.length,
          validRecords,
          invalidRecords: data.length - validRecords,
          criticalIssues,
          warnings
        },
        fieldAnalysis,
        recommendations: [...new Set(recommendations)] // Remover duplicatas
      };
    } finally {
      setIsAnalyzing(false);
    }
  }, [thresholds, analyzeFieldCompleteness, analyzeFieldValidity, analyzeFieldConsistency, analyzeFieldUniqueness]);

  const updateThresholds = useCallback((newThresholds: Partial<QualityThresholds>) => {
    setThresholds(prev => ({ ...prev, ...newThresholds }));
  }, []);

  const resetThresholds = useCallback(() => {
    setThresholds(DEFAULT_THRESHOLDS);
  }, []);

  return {
    isAnalyzing,
    thresholds,
    analyzeDataQuality,
    updateThresholds,
    resetThresholds
  };
};