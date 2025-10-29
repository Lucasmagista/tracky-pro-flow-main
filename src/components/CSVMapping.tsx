import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, AlertTriangle, XCircle, ArrowRight, RefreshCw } from "lucide-react";

interface CSVFieldMapping {
  csvColumn: string;
  systemField: string;
  required: boolean;
  sampleValue: string;
  validationStatus: 'valid' | 'warning' | 'error' | 'unmapped';
}

interface CSVMappingProps {
  csvHeaders: string[];
  csvSampleData: Record<string, string>[];
  onMappingComplete: (mapping: Record<string, string>) => void;
  onCancel: () => void;
}

const SYSTEM_FIELDS = [
  { key: 'tracking_code', label: 'Código de Rastreio', required: true, description: 'Código único de rastreamento' },
  { key: 'customer_name', label: 'Nome do Cliente', required: true, description: 'Nome completo do cliente' },
  { key: 'customer_email', label: 'E-mail do Cliente', required: true, description: 'Endereço de e-mail válido' },
  { key: 'customer_phone', label: 'Telefone', required: false, description: 'Número de telefone/WhatsApp' },
  { key: 'carrier', label: 'Transportadora', required: false, description: 'Nome da transportadora' },
  { key: 'order_value', label: 'Valor do Pedido', required: false, description: 'Valor total do pedido' },
  { key: 'destination', label: 'Destino', required: false, description: 'Cidade/Estado de destino' },
  { key: 'order_date', label: 'Data do Pedido', required: false, description: 'Data em que o pedido foi feito' },
  { key: 'estimated_delivery', label: 'Previsão de Entrega', required: false, description: 'Data estimada de entrega' },
  { key: 'product_name', label: 'Nome do Produto', required: false, description: 'Nome do produto principal' },
  { key: 'quantity', label: 'Quantidade', required: false, description: 'Quantidade de itens' },
];

const CSVMapping: React.FC<CSVMappingProps> = ({
  csvHeaders,
  csvSampleData,
  onMappingComplete,
  onCancel
}) => {
  const [mappings, setMappings] = useState<CSVFieldMapping[]>([]);
  const [autoMapped, setAutoMapped] = useState(false);

  // Inicializar mapeamentos
  useEffect(() => {
    const initialMappings: CSVFieldMapping[] = csvHeaders.map(header => {
      const sampleValue = csvSampleData.length > 0 ? csvSampleData[0][header] || '' : '';

      return {
        csvColumn: header,
        systemField: '',
        required: false,
        sampleValue,
        validationStatus: 'unmapped' as const,
      };
    });

    setMappings(initialMappings);
  }, [csvHeaders, csvSampleData]);

  // Mapeamento automático inteligente
  const performAutoMapping = () => {
    const newMappings = mappings.map(mapping => {
      const csvColumn = mapping.csvColumn.toLowerCase().trim();
      let bestMatch = '';
      let isRequired = false;

      // Mapeamentos inteligentes baseados em padrões comuns
      const mappingRules = [
        // Código de rastreio
        { patterns: ['codigo_rastreio', 'codigo de rastreio', 'tracking_code', 'tracking code', 'rastreio', 'tracking'], field: 'tracking_code', required: true },
        // Nome do cliente
        { patterns: ['nome_cliente', 'nome cliente', 'cliente', 'customer_name', 'customer name', 'nome', 'name'], field: 'customer_name', required: true },
        // Email
        { patterns: ['email_cliente', 'email cliente', 'email', 'e-mail', 'customer_email', 'customer email'], field: 'customer_email', required: true },
        // Telefone
        { patterns: ['telefone', 'phone', 'whatsapp', 'celular', 'customer_phone'], field: 'customer_phone', required: false },
        // Transportadora
        { patterns: ['transportadora', 'carrier', 'transportadora', 'correios', 'jadlog'], field: 'carrier', required: false },
        // Valor
        { patterns: ['valor', 'value', 'preco', 'preço', 'total', 'order_value'], field: 'order_value', required: false },
        // Destino
        { patterns: ['destino', 'destination', 'cidade', 'estado', 'uf', 'local'], field: 'destination', required: false },
        // Data do pedido
        { patterns: ['data_pedido', 'data pedido', 'order_date', 'created_at', 'data'], field: 'order_date', required: false },
        // Previsão
        { patterns: ['previsao', 'estimativa', 'estimated_delivery', 'prazo'], field: 'estimated_delivery', required: false },
        // Produto
        { patterns: ['produto', 'product', 'product_name', 'nome_produto'], field: 'product_name', required: false },
        // Quantidade
        { patterns: ['quantidade', 'quantity', 'qtd', 'qty'], field: 'quantity', required: false },
      ];

      for (const rule of mappingRules) {
        if (rule.patterns.some(pattern => csvColumn.includes(pattern))) {
          bestMatch = rule.field;
          isRequired = rule.required;
          break;
        }
      }

      return {
        ...mapping,
        systemField: bestMatch,
        required: isRequired,
        validationStatus: bestMatch ? 'valid' : 'unmapped' as const,
      };
    });

    setMappings(newMappings);
    setAutoMapped(true);
  };

  // Atualizar mapeamento manual
  const updateMapping = (csvColumn: string, systemField: string) => {
    setMappings(prevMappings =>
      prevMappings.map(mapping => {
        if (mapping.csvColumn === csvColumn) {
          const systemFieldInfo = SYSTEM_FIELDS.find(f => f.key === systemField);
          return {
            ...mapping,
            systemField,
            required: systemFieldInfo?.required || false,
            validationStatus: systemField ? 'valid' : 'unmapped' as const,
          };
        }
        return mapping;
      })
    );
  };

  // Validar mapeamentos
  const validateMappings = () => {
    const requiredFields = SYSTEM_FIELDS.filter(f => f.required).map(f => f.key);
    const mappedFields = mappings.map(m => m.systemField).filter(f => f);

    const missingRequired = requiredFields.filter(field => !mappedFields.includes(field));

    // Atualizar status de validação
    setMappings(prevMappings =>
      prevMappings.map(mapping => {
        let status: 'valid' | 'warning' | 'error' | 'unmapped' = 'unmapped';

        if (mapping.systemField) {
          if (SYSTEM_FIELDS.find(f => f.key === mapping.systemField)?.required) {
            status = 'valid';
          } else {
            status = 'valid';
          }
        }

        // Verificar duplicatas
        const duplicateCount = prevMappings.filter(m => m.systemField === mapping.systemField).length;
        if (duplicateCount > 1 && mapping.systemField) {
          status = 'error';
        }

        return { ...mapping, validationStatus: status };
      })
    );

    return missingRequired.length === 0;
  };

  // Verificar se pode prosseguir
  const canProceed = () => {
    const requiredFields = SYSTEM_FIELDS.filter(f => f.required).map(f => f.key);
    const mappedRequiredFields = mappings
      .filter(m => m.systemField && requiredFields.includes(m.systemField))
      .map(m => m.systemField);

    // Verificar duplicatas
    const mappedFields = mappings.map(m => m.systemField).filter(f => f);
    const hasDuplicates = mappedFields.length !== new Set(mappedFields).size;

    return requiredFields.every(field => mappedRequiredFields.includes(field)) && !hasDuplicates;
  };

  // Finalizar mapeamento
  const handleComplete = () => {
    if (!validateMappings()) return;

    const mappingObject: Record<string, string> = {};
    mappings.forEach(mapping => {
      if (mapping.systemField) {
        mappingObject[mapping.csvColumn] = mapping.systemField;
      }
    });

    onMappingComplete(mappingObject);
  };

  // Obter ícone de status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;
    }
  };

  // Obter badge de status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid': return <Badge variant="default" className="bg-green-500">Válido</Badge>;
      case 'warning': return <Badge variant="secondary">Aviso</Badge>;
      case 'error': return <Badge variant="destructive">Erro</Badge>;
      default: return <Badge variant="outline">Não mapeado</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5" />
            Mapeamento de Campos CSV
          </CardTitle>
          <CardDescription>
            Mapeie as colunas do seu arquivo CSV para os campos correspondentes do sistema.
            Campos obrigatórios devem ser mapeados para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Botão de mapeamento automático */}
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-medium">Mapeamento Automático</h4>
              <p className="text-sm text-muted-foreground">
                O sistema tenta mapear automaticamente baseado em padrões comuns
              </p>
            </div>
            <Button
              variant="outline"
              onClick={performAutoMapping}
              disabled={autoMapped}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {autoMapped ? 'Mapeamento Aplicado' : 'Mapear Automaticamente'}
            </Button>
          </div>

          {/* Tabela de mapeamento */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Coluna CSV</TableHead>
                  <TableHead>Valor Exemplo</TableHead>
                  <TableHead>Campo do Sistema</TableHead>
                  <TableHead>Obrigatório</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {getStatusIcon(mapping.validationStatus)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {mapping.csvColumn}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {mapping.sampleValue || '-'}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={mapping.systemField}
                        onValueChange={(value) => updateMapping(mapping.csvColumn, value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione um campo..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Não mapear</SelectItem>
                          {SYSTEM_FIELDS.map(field => (
                            <SelectItem key={field.key} value={field.key}>
                              {field.label} {field.required && '*'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {mapping.required && (
                        <Badge variant="destructive">Obrigatório</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Resumo de validação */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Campos obrigatórios mapeados:</span>
                  <span className="font-medium">
                    {mappings.filter(m => m.required && m.systemField).length} / {SYSTEM_FIELDS.filter(f => f.required).length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Campos mapeados:</span>
                  <span className="font-medium">
                    {mappings.filter(m => m.systemField).length} / {mappings.length}
                  </span>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Ações */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              onClick={handleComplete}
              disabled={!canProceed()}
            >
              Continuar com Importação
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ajuda */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-lg">Campos do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {SYSTEM_FIELDS.map(field => (
              <div key={field.key} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{field.label}</span>
                  {field.required && <Badge variant="destructive" className="text-xs">Obrigatório</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{field.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CSVMapping;