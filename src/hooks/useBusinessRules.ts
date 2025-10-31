import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import type { Database } from '@/types/supabase';

type BusinessRuleRow = Database['public']['Tables']['business_rules']['Row'];

// Tipagem para o conteúdo de rule_json
export interface BusinessRuleJson {
  type: 'min_value' | 'max_value' | 'required_field' | 'format_validation' | 'custom_logic';
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'regex';
  value: string | number | boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface BusinessRuleValidation {
  ruleId: string;
  isValid: boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
  field: string;
  value: string | number | boolean | null;
  suggestion?: string;
}

export interface BusinessRulesAnalysis {
  validations: BusinessRuleValidation[];
  summary: {
    totalRules: number;
    passedRules: number;
    failedRules: number;
    errors: number;
    warnings: number;
  };
}

export const useBusinessRules = () => {
  const { user } = useAuth();
  const [rules, setRules] = useState<BusinessRuleRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Carregar regras do usuário
  const loadRules = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('business_rules')
        .select('*')
        // .eq('user_id', user.id) // descomente se existir user_id na tabela
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRules(data ?? []);
    } catch (error) {
      console.error('Erro ao carregar regras de negócio:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Salvar nova regra
  const saveRule = useCallback(async (
    rule: Omit<BusinessRuleRow, 'id' | 'created_at' | 'updated_at'>
  ): Promise<BusinessRuleRow | null> => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('business_rules')
        .insert({ ...rule })
        .select()
        .single();
      if (error) throw error;
      setRules(prev => [data, ...prev]);
      return data;
    } catch (error) {
      console.error('Erro ao salvar regra de negócio:', error);
      return null;
    }
  }, [user]);

  // Aplicar regras de negócio aos dados
  const validateBusinessRules = useCallback((
    data: Record<string, string | number | boolean | null>[],
    activeRules: BusinessRuleRow[] = rules
  ): BusinessRulesAnalysis => {
    const validations: BusinessRuleValidation[] = [];
    const summary = {
      totalRules: activeRules.length,
      passedRules: 0,
      failedRules: 0,
      errors: 0,
      warnings: 0
    };
    data.forEach((record, recordIndex) => {
      activeRules.forEach(rule => {
  // Supondo que rule_json armazene a lógica da regra
  const ruleLogic = rule.rule_json as unknown as BusinessRuleJson;
  const field = ruleLogic?.field || 'field';
  const fieldValue = record[field];
  const validation = validateSingleRule(rule, fieldValue, recordIndex);
        validations.push(validation);
        if (validation.isValid) {
          summary.passedRules++;
        } else {
          summary.failedRules++;
          if (validation.severity === 'error') summary.errors++;
          if (validation.severity === 'warning') summary.warnings++;
        }
      });
    });
    return { validations, summary };
  }, [rules]);

  // Validar uma única regra
  const validateSingleRule = (
    rule: BusinessRuleRow,
    fieldValue: string | number | boolean | null,
    recordIndex: number
  ): BusinessRuleValidation => {
    let isValid = false;
    let suggestion = '';
  // Supondo que rule_json armazene a lógica da regra
  const ruleLogic = rule.rule_json as unknown as BusinessRuleJson;
  const operator = ruleLogic?.operator || 'equals';
  const value = ruleLogic?.value;
  const field = ruleLogic?.field || 'field';
  const severity = ruleLogic?.severity || 'error';
  const message = ruleLogic?.message || 'Regra não passou';

    if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
      if (ruleLogic?.type === 'required_field') {
        return {
          ruleId: rule.id,
          isValid: false,
          severity,
          message,
          field,
          value: fieldValue,
          suggestion: `Campo obrigatório não preenchido`
        };
      }
      return {
        ruleId: rule.id,
        isValid: true,
        severity: 'info',
        message: 'Campo vazio - validação ignorada',
        field,
        value: fieldValue
      };
    }

    switch (operator) {
      case 'equals':
        isValid = fieldValue == value;
        break;
      case 'not_equals':
        isValid = fieldValue != value;
        break;
      case 'greater_than':
        isValid = Number(fieldValue) > Number(value);
        if (!isValid) suggestion = `Valor deve ser maior que ${value}`;
        break;
      case 'less_than':
        isValid = Number(fieldValue) < Number(value);
        if (!isValid) suggestion = `Valor deve ser menor que ${value}`;
        break;
      case 'contains':
        isValid = String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
        break;
      case 'not_contains':
        isValid = !String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
        break;
      case 'regex':
        try {
          const regex = new RegExp(String(value));
          isValid = regex.test(String(fieldValue));
        } catch (error) {
          isValid = false;
          suggestion = 'Expressão regular inválida';
        }
        break;
    }

    return {
      ruleId: rule.id,
      isValid,
      severity,
      message: isValid ? 'Regra validada com sucesso' : message,
      field,
      value: fieldValue,
      suggestion
    };
  };

  // Regras pré-definidas comuns
  const getCommonRules = useCallback((): Omit<BusinessRuleRow, 'id' | 'created_at' | 'updated_at'>[] => {
    return [
      {
        name: 'Valor Mínimo do Pedido',
        description: 'Garante que pedidos tenham valor mínimo',
        is_active: true,
        rule_json: {
          type: 'min_value',
          field: 'order_value',
          operator: 'greater_than',
          value: 10.00,
          severity: 'error',
          message: 'Valor do pedido abaixo do mínimo permitido'
        }
      },
      {
        name: 'Campo E-mail Obrigatório',
        description: 'E-mail é obrigatório para todos os pedidos',
        is_active: true,
        rule_json: {
          type: 'required_field',
          field: 'customer_email',
          operator: 'not_equals',
          value: '',
          severity: 'error',
          message: 'E-mail do cliente é obrigatório'
        }
      },
      {
        name: 'Formato de Telefone',
        description: 'Telefone deve seguir formato brasileiro',
        is_active: true,
        rule_json: {
          type: 'format_validation',
          field: 'customer_phone',
          operator: 'regex',
          value: '^\\(\\d{2}\\)\\s\\d{4,5}-\\d{4}$',
          severity: 'warning',
          message: 'Telefone deve estar no formato (11) 99999-9999'
        }
      },
      {
        name: 'Valor Máximo do Pedido',
        description: 'Alertar para pedidos muito altos',
        is_active: true,
        rule_json: {
          type: 'max_value',
          field: 'order_value',
          operator: 'less_than',
          value: 5000.00,
          severity: 'warning',
          message: 'Valor do pedido muito alto - verificar se é válido'
        }
      }
    ];
  }, []);

  // Carregar regras na inicialização
  useEffect(() => {
    loadRules();
  }, [loadRules]);

  return {
    rules,
    isLoading,
    loadRules,
    saveRule,
    validateBusinessRules,
    getCommonRules
  };
};