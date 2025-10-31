import { useState, useCallback } from 'react';

export interface CorrectionRule {
  id: string;
  field: string;
  pattern: string;
  replacement: string | ((match: string) => string);
  description: string;
  enabled: boolean;
  priority: number;
}

export interface CorrectionResult {
  originalValue: string;
  correctedValue: string;
  appliedRules: string[];
  confidence: number;
  field: string;
}

export interface SmartCorrectionAnalysis {
  corrections: CorrectionResult[];
  summary: {
    totalRecords: number;
    correctedRecords: number;
    totalCorrections: number;
    confidence: number;
  };
  rules: CorrectionRule[];
}

const DEFAULT_CORRECTION_RULES: CorrectionRule[] = [
  // Correção de e-mails
  {
    id: 'email-lowercase',
    field: 'customer_email',
    pattern: '^[A-Z]',
    replacement: (match: string) => match.toLowerCase(),
    description: 'Converter e-mails para minúsculas',
    enabled: true,
    priority: 1
  },
  {
    id: 'email-trim',
    field: 'customer_email',
    pattern: '\\s+$|^\\s+',
    replacement: '',
    description: 'Remover espaços em branco do início e fim',
    enabled: true,
    priority: 2
  },
  {
    id: 'email-common-typos',
    field: 'customer_email',
    pattern: '@gmai\\.com$|@gmial\\.com$|@hotmai\\.com$',
    replacement: '@gmail.com',
    description: 'Corrigir erros comuns em domínios de e-mail',
    enabled: true,
    priority: 3
  },

  // Correção de telefones
  {
    id: 'phone-br-format',
    field: 'customer_phone',
    pattern: '^(\\d{2})(\\d{4,5})(\\d{4})$',
    replacement: '($1) $2-$3',
    description: 'Formatar telefone brasileiro',
    enabled: true,
    priority: 1
  },
  {
    id: 'phone-clean',
    field: 'customer_phone',
    pattern: '[^\\d\\(\\)\\s\\-]',
    replacement: '',
    description: 'Remover caracteres inválidos de telefone',
    enabled: true,
    priority: 2
  },

  // Correção de códigos de rastreio
  {
    id: 'tracking-uppercase',
    field: 'tracking_code',
    pattern: '^[a-z]',
    replacement: (match: string) => match.toUpperCase(),
    description: 'Converter códigos de rastreio para maiúsculas',
    enabled: true,
    priority: 1
  },
  {
    id: 'tracking-clean',
    field: 'tracking_code',
    pattern: '[^A-Z0-9]',
    replacement: '',
    description: 'Remover caracteres especiais de códigos de rastreio',
    enabled: true,
    priority: 2
  },

  // Correção de valores monetários
  {
    id: 'value-br-format',
    field: 'order_value',
    pattern: '^R\\$\\s*([\\d.,]+)$',
    replacement: '$1',
    description: 'Remover símbolo R$ dos valores',
    enabled: true,
    priority: 1
  },
  {
    id: 'value-comma-to-dot',
    field: 'order_value',
    pattern: '^([\\d.]+),([\\d]{2})$',
    replacement: '$1.$2',
    description: 'Converter vírgula para ponto decimal',
    enabled: true,
    priority: 2
  },

  // Correção de nomes
  {
    id: 'name-trim',
    field: 'customer_name',
    pattern: '\\s+$|^\\s+|\\s{2,}',
    replacement: ' ',
    description: 'Remover espaços extras e normalizar',
    enabled: true,
    priority: 1
  },
  {
    id: 'name-title-case',
    field: 'customer_name',
    pattern: '\\b\\w',
    replacement: (match: string) => match.toUpperCase(),
    description: 'Converter primeira letra de cada palavra para maiúscula',
    enabled: true,
    priority: 2
  },

  // Correção de CEPs
  {
    id: 'cep-format',
    field: 'delivery_zipcode',
    pattern: '^(\\d{5})(\\d{3})$',
    replacement: '$1-$2',
    description: 'Formatar CEP brasileiro',
    enabled: true,
    priority: 1
  },
  {
    id: 'cep-clean',
    field: 'delivery_zipcode',
    pattern: '[^\\d\\-]',
    replacement: '',
    description: 'Remover caracteres inválidos de CEP',
    enabled: true,
    priority: 2
  }
];

export const useSmartCorrection = () => {
  const [rules, setRules] = useState<CorrectionRule[]>(DEFAULT_CORRECTION_RULES);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const applyCorrection = useCallback((value: string, field: string, rules: CorrectionRule[]): CorrectionResult => {
    if (!value || typeof value !== 'string') {
      return {
        originalValue: value,
        correctedValue: value,
        appliedRules: [],
        confidence: 1.0,
        field
      };
    }

    let correctedValue = value;
    const appliedRules: string[] = [];
    let totalConfidence = 0;
    let appliedCount = 0;

    // Filtrar regras aplicáveis para o campo
    const applicableRules = rules
      .filter(rule => rule.enabled && rule.field === field)
      .sort((a, b) => a.priority - b.priority);

    // Aplicar regras em ordem de prioridade
    applicableRules.forEach(rule => {
      try {
        const regex = new RegExp(rule.pattern, 'gi');
        if (regex.test(correctedValue)) {
          const originalValue = correctedValue;
          if (typeof rule.replacement === 'function') {
            correctedValue = correctedValue.replace(regex, rule.replacement);
          } else {
            correctedValue = correctedValue.replace(regex, rule.replacement);
          }

          if (correctedValue !== originalValue) {
            appliedRules.push(rule.id);
            appliedCount++;
            totalConfidence += rule.priority === 1 ? 0.9 : rule.priority === 2 ? 0.7 : 0.5;
          }
        }
      } catch (error) {
        console.warn(`Erro ao aplicar regra ${rule.id}:`, error);
      }
    });

    const averageConfidence = appliedCount > 0 ? totalConfidence / appliedCount : 1.0;

    return {
      originalValue: value,
      correctedValue,
      appliedRules,
      confidence: Math.min(averageConfidence, 1.0),
      field
    };
  }, []);

  const analyzeAndCorrect = useCallback(async (
    data: Record<string, string>[],
    fieldsToCorrect?: string[]
  ): Promise<SmartCorrectionAnalysis> => {
    setIsAnalyzing(true);

    try {
      const corrections: CorrectionResult[] = [];
      let totalCorrections = 0;
      let correctedRecords = 0;

      // Determinar quais campos corrigir
      const targetFields = fieldsToCorrect || ['customer_email', 'customer_phone', 'tracking_code', 'order_value', 'customer_name', 'delivery_zipcode'];

      // Processar cada registro
      data.forEach((record, index) => {
        let recordCorrected = false;

        targetFields.forEach(field => {
          const value = record[field];
          if (value) {
            const correction = applyCorrection(value, field, rules);
            if (correction.appliedRules.length > 0) {
              corrections.push({
                ...correction,
                originalValue: `${index + 1}: ${correction.originalValue}` // Adicionar índice do registro
              });
              totalCorrections += correction.appliedRules.length;
              recordCorrected = true;
            }
          }
        });

        if (recordCorrected) {
          correctedRecords++;
        }
      });

      // Calcular confiança geral
      const averageConfidence = corrections.length > 0
        ? corrections.reduce((sum, c) => sum + c.confidence, 0) / corrections.length
        : 1.0;

      return {
        corrections,
        summary: {
          totalRecords: data.length,
          correctedRecords,
          totalCorrections,
          confidence: averageConfidence
        },
        rules
      };
    } finally {
      setIsAnalyzing(false);
    }
  }, [rules, applyCorrection]);

  const addCustomRule = useCallback((rule: Omit<CorrectionRule, 'id'>) => {
    const newRule: CorrectionRule = {
      ...rule,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    setRules(prev => [...prev, newRule]);
    return newRule.id;
  }, []);

  const updateRule = useCallback((ruleId: string, updates: Partial<CorrectionRule>) => {
    setRules(prev => prev.map(rule =>
      rule.id === ruleId ? { ...rule, ...updates } : rule
    ));
  }, []);

  const deleteRule = useCallback((ruleId: string) => {
    setRules(prev => prev.filter(rule => rule.id !== ruleId));
  }, []);

  const toggleRule = useCallback((ruleId: string) => {
    setRules(prev => prev.map(rule =>
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    ));
  }, []);

  const resetToDefaults = useCallback(() => {
    setRules(DEFAULT_CORRECTION_RULES);
  }, []);

  return {
    rules,
    isAnalyzing,
    analyzeAndCorrect,
    addCustomRule,
    updateRule,
    deleteRule,
    toggleRule,
    resetToDefaults,
    applyCorrection
  };
};