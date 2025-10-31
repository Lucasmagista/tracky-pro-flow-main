import React, { useState } from 'react';
import { useBusinessRules, BusinessRule } from '@/hooks/useBusinessRules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

interface BusinessRulesManagerProps {
  onRulesChange?: (rules: BusinessRule[]) => void;
}

export const BusinessRulesManager: React.FC<BusinessRulesManagerProps> = ({ onRulesChange }) => {
  const { rules, isLoading, saveRule, getCommonRules } = useBusinessRules();
  const [isCreating, setIsCreating] = useState(false);
  const [editingRule, setEditingRule] = useState<BusinessRule | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'required_field' as BusinessRule['type'],
    field: '',
    operator: 'equals' as BusinessRule['operator'],
    value: '',
    severity: 'error' as BusinessRule['severity'],
    message: ''
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'required_field',
      field: '',
      operator: 'equals',
      value: '',
      severity: 'error',
      message: ''
    });
  };

  const handleCreateRule = async () => {
    if (!formData.name || !formData.field || !formData.message) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const value = formData.type === 'min_value' || formData.type === 'max_value'
      ? parseFloat(formData.value)
      : formData.value;

    const newRule = await saveRule(
      formData.name,
      formData.type,
      formData.field,
      formData.operator,
      value,
      formData.severity,
      formData.message,
      formData.description
    );

    if (newRule) {
      toast.success('Regra criada com sucesso!');
      resetForm();
      setIsCreating(false);
      onRulesChange?.([...rules, newRule]);
    } else {
      toast.error('Erro ao criar regra');
    }
  };

  const handleAddCommonRules = async () => {
    const commonRules = getCommonRules();
    let successCount = 0;

    for (const rule of commonRules) {
      const newRule = await saveRule(
        rule.name,
        rule.type,
        rule.field,
        rule.operator,
        rule.value,
        rule.severity,
        rule.message,
        rule.description
      );

      if (newRule) successCount++;
    }

    if (successCount > 0) {
      toast.success(`${successCount} regras comuns adicionadas!`);
      onRulesChange?.(rules); // Trigger refresh
    }
  };

  const getSeverityColor = (severity: BusinessRule['severity']) => {
    switch (severity) {
      case 'error': return 'destructive';
      case 'warning': return 'secondary';
      case 'info': return 'outline';
      default: return 'outline';
    }
  };

  const getOperatorLabel = (operator: BusinessRule['operator']) => {
    const labels = {
      equals: 'Igual a',
      not_equals: 'Diferente de',
      greater_than: 'Maior que',
      less_than: 'Menor que',
      contains: 'Contém',
      not_contains: 'Não contém',
      regex: 'Regex'
    };
    return labels[operator];
  };

  if (isLoading) {
    return <div className="flex justify-center p-4">Carregando regras...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Regras de Negócio</h3>
          <p className="text-sm text-muted-foreground">
            Configure validações personalizadas para seus dados de importação
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleAddCommonRules}
            disabled={isLoading}
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Regras Comuns
          </Button>
          <Button
            onClick={() => setIsCreating(true)}
            disabled={isLoading}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Regra
          </Button>
        </div>
      </div>

      {/* Formulário de criação/edição */}
      {(isCreating || editingRule) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isCreating ? <Plus className="w-5 h-5" /> : <Edit className="w-5 h-5" />}
              {isCreating ? 'Criar Nova Regra' : 'Editar Regra'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rule-name">Nome da Regra *</Label>
                <Input
                  id="rule-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Valor mínimo do pedido"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-type">Tipo de Regra</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: BusinessRule['type']) =>
                    setFormData(prev => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="required_field">Campo Obrigatório</SelectItem>
                    <SelectItem value="min_value">Valor Mínimo</SelectItem>
                    <SelectItem value="max_value">Valor Máximo</SelectItem>
                    <SelectItem value="format_validation">Validação de Formato</SelectItem>
                    <SelectItem value="custom_logic">Lógica Personalizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-description">Descrição</Label>
              <Textarea
                id="rule-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição opcional da regra"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rule-field">Campo *</Label>
                <Input
                  id="rule-field"
                  value={formData.field}
                  onChange={(e) => setFormData(prev => ({ ...prev, field: e.target.value }))}
                  placeholder="Ex: order_value"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-operator">Operador</Label>
                <Select
                  value={formData.operator}
                  onValueChange={(value: BusinessRule['operator']) =>
                    setFormData(prev => ({ ...prev, operator: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">Igual a</SelectItem>
                    <SelectItem value="not_equals">Diferente de</SelectItem>
                    <SelectItem value="greater_than">Maior que</SelectItem>
                    <SelectItem value="less_than">Menor que</SelectItem>
                    <SelectItem value="contains">Contém</SelectItem>
                    <SelectItem value="not_contains">Não contém</SelectItem>
                    <SelectItem value="regex">Regex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-value">Valor</Label>
                <Input
                  id="rule-value"
                  value={formData.value}
                  onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="Valor para comparação"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rule-severity">Severidade</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(value: BusinessRule['severity']) =>
                    setFormData(prev => ({ ...prev, severity: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="error">Erro (bloqueia importação)</SelectItem>
                    <SelectItem value="warning">Aviso (permite continuar)</SelectItem>
                    <SelectItem value="info">Informação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-message">Mensagem de Erro *</Label>
                <Input
                  id="rule-message"
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Mensagem exibida quando a regra falhar"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreating(false);
                  setEditingRule(null);
                  resetForm();
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleCreateRule}>
                <Save className="w-4 h-4 mr-2" />
                {isCreating ? 'Criar Regra' : 'Salvar Alterações'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de regras existentes */}
      <div className="space-y-4">
        {rules.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <p className="text-muted-foreground mb-4">Nenhuma regra de negócio configurada</p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeira Regra
              </Button>
            </CardContent>
          </Card>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{rule.name}</h4>
                      <Badge variant={getSeverityColor(rule.severity)}>
                        {rule.severity === 'error' ? 'Erro' :
                         rule.severity === 'warning' ? 'Aviso' : 'Info'}
                      </Badge>
                    </div>
                    {rule.description && (
                      <p className="text-sm text-muted-foreground mb-2">{rule.description}</p>
                    )}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Campo:</span> {rule.field}
                      </div>
                      <div>
                        <span className="font-medium">Operador:</span> {getOperatorLabel(rule.operator)}
                      </div>
                      <div>
                        <span className="font-medium">Valor:</span> {rule.value}
                      </div>
                      <div>
                        <span className="font-medium">Mensagem:</span> {rule.message}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingRule(rule);
                        setFormData({
                          name: rule.name,
                          description: rule.description || '',
                          type: rule.type,
                          field: rule.field,
                          operator: rule.operator,
                          value: String(rule.value),
                          severity: rule.severity,
                          message: rule.message
                        });
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};