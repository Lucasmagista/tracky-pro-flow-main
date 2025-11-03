import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertTriangle, XCircle, ArrowRight, RefreshCw, X, Sparkles, Target, Zap, Lightbulb, Shield, TrendingUp, Loader2, Activity } from "lucide-react";
import { useSmartCSVAnalysis, type DetectedField, type FieldDetectionResult } from "@/hooks/useSmartCSVAnalysis";
import { useTrackingValidation } from "@/hooks/useTrackingValidation";
import { useCEPValidation } from "@/hooks/useCEPValidation";
import { useCSVTemplate, type CSVTemplate } from "@/hooks/useCSVTemplate";
import { useDuplicateDetection } from "@/hooks/useDuplicateDetection";
import { useBusinessRules } from "@/hooks/useBusinessRules";
import { useSeasonalValidation } from "@/hooks/useSeasonalValidation";
import { useFraudDetection } from "@/hooks/useFraudDetection";
import { useMLMappingLearning } from "@/hooks/useMLMappingLearning";
import { useDebounce } from "@/hooks/useDebounce";
import { useChunkedValidation, type ValidationResult } from "@/hooks/useChunkedValidation";

interface ValidationAlert {
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  field?: string;
  suggestion?: string;
}

interface RealTimeValidation {
  isValid: boolean;
  alerts: ValidationAlert[];
  qualityScore: number;
  suggestions: string[];
  previewData: Record<string, string | number | null>[];
}

interface SmartCSVMappingProps {
  csvHeaders: string[];
  csvSampleData: Record<string, string>[];
  csvFullData: Record<string, string>[];  // ✅ NOVO: Dados completos para validação
  dataSize: number;                        // ✅ NOVO: Total de linhas
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
  { key: 'order_number', label: 'Número do Pedido', required: false, description: 'Número identificador do pedido' },
  { key: 'notes', label: 'Observações', required: false, description: 'Observações adicionais' },
];

const SmartCSVMapping: React.FC<SmartCSVMappingProps> = ({
  csvHeaders,
  csvSampleData,
  csvFullData,    // ✅ NOVO: Dados completos
  dataSize,       // ✅ NOVO: Total de linhas
  onMappingComplete,
  onCancel
}) => {
  const [mappings, setMappings] = useState<DetectedField[]>([]);
  const [analysisResult, setAnalysisResult] = useState<FieldDetectionResult | null>(null);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [realTimeValidation, setRealTimeValidation] = useState<RealTimeValidation>({
    isValid: false,
    alerts: [],
    qualityScore: 0,
    suggestions: [],
    previewData: []
  });
  const { analyzeCSV, isAnalyzing } = useSmartCSVAnalysis();
  const { validateTrackingCodes, isValidating: isValidatingTracking } = useTrackingValidation();
  const { validateCEPs, isValidating: isValidatingCEP } = useCEPValidation();
  const { findCompatibleTemplates, applyTemplate, saveTemplate, templates, isLoading: isLoadingTemplates } = useCSVTemplate();
  const { detectDuplicates, isAnalyzing: isAnalyzingDuplicates } = useDuplicateDetection();
  const { validateBusinessRules, rules: businessRules } = useBusinessRules();
  const { analyzeSeasonalPatterns, patterns: seasonalPatterns } = useSeasonalValidation();
  const { analyzeFraudPatterns, patterns: fraudPatterns } = useFraudDetection();
  const { generateMappingSuggestions, learnFromMapping } = useMLMappingLearning();
  
  // ✅ NOVO: Hook para validação em chunks
  const { validateInChunks, progress: chunkProgress, isProcessing: isProcessingChunks } = useChunkedValidation();

  // Estado para templates compatíveis
  const [compatibleTemplates, setCompatibleTemplates] = useState<CSVTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // 🔧 FIX 1: Ref para controlar se o componente está montado
  const isMountedRef = useRef(true);
  
  // 🔧 FIX 2: AbortController para cancelar validações assíncronas
  const abortControllerRef = useRef<AbortController | null>(null);

  // 🔧 FIX 3: Debounce nos mappings para evitar validações excessivas
  const debouncedMappings = useDebounce(mappings, 500);

  // ✅ NOVO: Estados de progresso de validação
  const [validationProgress, setValidationProgress] = useState({
    tracking: 0,
    cep: 0,
    duplicates: 0,
    businessRules: 0,
    fraud: 0,
    seasonal: 0,
    overall: 0
  });

  const [isValidatingComplete, setIsValidatingComplete] = useState(false);

  // 🔧 FIX 4: Cleanup completo quando o componente for desmontado
  useEffect(() => {
    return () => {
      console.log('[SmartCSVMapping] Desmontando componente - limpando recursos');
      isMountedRef.current = false;
      
      // Cancelar todas as requisições pendentes
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Aplicar template selecionado
  const handleApplyTemplate = async (templateId: string) => {
    const template = compatibleTemplates.find(t => t.id === templateId);
    if (!template) return;

    try {
      const templateMapping = await applyTemplate(template, csvHeaders);

      // Aplicar o mapeamento do template aos mappings atuais
      const updatedMappings = mappings.map(mapping => {
        const systemField = templateMapping[mapping.csvColumn];
        if (systemField) {
          return {
            ...mapping,
            detectedField: systemField,
            confidence: 0.9, // Confiança alta para templates aplicados
            reasoning: `Aplicado do template "${template.name}"`
          };
        }
        return mapping;
      });

      if (isMountedRef.current) {
        setMappings(updatedMappings);
        setSelectedTemplate(templateId);
      }
    } catch (error) {
      console.error('Erro ao aplicar template:', error);
    }
  };

  // 🔧 FIX 5: Função de validação em tempo real com cancelamento e controle de montagem
  const performRealTimeValidation = useCallback(async (
    currentMappings: DetectedField[],
    signal?: AbortSignal
  ) => {
    // Não executar se o componente foi desmontado
    if (!isMountedRef.current) {
      console.log('[Validation] Componente desmontado, abortando validação');
      return;
    }

    // Cancelar se o signal foi abortado
    if (signal?.aborted) {
      console.log('[Validation] Signal abortado, parando validação');
      return;
    }

    console.log('[Validation] Iniciando validação em tempo real');
    
    const alerts: ValidationAlert[] = [];
    const suggestions: string[] = [];
    let qualityScore = 0;
    const previewData: Record<string, string | number | null>[] = [];

    // Verificar campos obrigatórios
    const requiredFields = SYSTEM_FIELDS.filter(f => f.required).map(f => f.key);
    const mappedRequired = currentMappings.filter(m => m.detectedField && requiredFields.includes(m.detectedField));

    if (mappedRequired.length < requiredFields.length) {
      alerts.push({
        type: 'error',
        title: 'Campos Obrigatórios Faltando',
        message: `Faltam ${requiredFields.length - mappedRequired.length} campos obrigatórios para continuar.`,
        suggestion: 'Mapeie todos os campos obrigatórios (Código de Rastreio, Nome do Cliente, E-mail do Cliente)'
      });
    } else {
      qualityScore += 30; // Pontos por campos obrigatórios
    }

    // 🔧 CHECK: Verificar se foi cancelado
    if (!isMountedRef.current || signal?.aborted) {
      console.log('[Validation] Cancelado após verificação de campos obrigatórios');
      return;
    }

    // Verificar duplicatas
    const mappedFields = currentMappings.map(m => m.detectedField).filter(f => f);
    const duplicates = mappedFields.filter((field, index) => mappedFields.indexOf(field) !== index);

    if (duplicates.length > 0) {
      alerts.push({
        type: 'error',
        title: 'Campos Duplicados',
        message: `Os seguintes campos estão mapeados mais de uma vez: ${duplicates.join(', ')}`,
        suggestion: 'Cada campo do sistema deve ser mapeado apenas uma vez'
      });
    } else {
      qualityScore += 20; // Pontos por não ter duplicatas
    }

    // Validações de integridade referencial
    const trackingMapping = currentMappings.find(m => m.detectedField === 'tracking_code');
    const carrierMapping = currentMappings.find(m => m.detectedField === 'carrier');
    const cepMapping = currentMappings.find(m => m.detectedField === 'delivery_zipcode');

    // Validação de códigos de rastreio
    if (trackingMapping) {
      // 🔧 CHECK: Verificar se foi cancelado antes de validação assíncrona
      if (!isMountedRef.current || signal?.aborted) {
        console.log('[Validation] Cancelado antes de validação de tracking');
        return;
      }

      // ✅ NOVO: Validar TODOS os códigos de tracking em chunks
      console.log(`[Validation] Iniciando validação de tracking para ${dataSize} registros`);
      
      try {
        const trackingValidationResult = await validateInChunks({
          data: csvFullData,
          chunkSize: 100,
          validator: async (chunk: Record<string, string>[]) => {
            const codes = chunk.map(row => row[trackingMapping.csvColumn] || '').filter(c => c.trim());
            const carriers = carrierMapping ? chunk.map(row => row[carrierMapping.csvColumn] || '') : undefined;
            
            if (codes.length === 0) return [];
            
            const results = await validateTrackingCodes(codes, carriers);
            
            return codes.map((code, idx) => ({
              id: code,
              isValid: results[code]?.isValid || false,
              data: { code, carrier: results[code]?.carrier }
            }));
          },
          onProgress: (current, total, percentage) => {
            if (isMountedRef.current) {
              setValidationProgress(prev => ({ ...prev, tracking: percentage }));
              console.log(`[Validation] Tracking: ${percentage}% (${current}/${total})`);
            }
          },
          signal
        });

        // 🔧 CHECK: Verificar após operação assíncrona
        if (!isMountedRef.current || signal?.aborted) {
          console.log('[Validation] Cancelado após validação de tracking');
          return;
        }

        const validCount = trackingValidationResult.totalValid;
        const validRatio = validCount / trackingValidationResult.totalProcessed;

        if (validRatio < 0.8) {
          alerts.push({
            type: 'warning',
            title: 'Códigos de Rastreio Suspeitos',
            message: `Apenas ${Math.round(validRatio * 100)}% dos códigos (${validCount}/${trackingValidationResult.totalProcessed}) são válidos ou reconhecidos`,
            field: trackingMapping.csvColumn,
            suggestion: 'Verifique se os códigos seguem os padrões das transportadoras (Correios, Jadlog, etc.)'
          });
        } else {
          qualityScore += 15;
          suggestions.push(`✅ ${validCount}/${trackingValidationResult.totalProcessed} códigos de rastreio validados com sucesso`);
        }

        // Verificar inconsistências entre código e transportadora
        if (carrierMapping) {
          const inconsistencies = trackingValidationResult.results.filter(r => {
            const carrier = r.data?.carrier as string | undefined;
            return r.isValid && carrier && r.data?.code;
          }).length;

          if (inconsistencies > 0) {
            alerts.push({
              type: 'warning',
              title: 'Inconsistência Transportadora vs Código',
              message: `${inconsistencies} códigos podem não corresponder à transportadora informada`,
              suggestion: 'Verifique se a transportadora está correta para cada código de rastreio'
            });
          }
        }

        console.log(`[Validation] Tracking completo: ${validCount}/${trackingValidationResult.totalProcessed} válidos (${trackingValidationResult.processingTime}ms)`);

      } catch (error) {
        // Não adicionar erro se foi cancelado
        if (!signal?.aborted) {
          console.error('[Validation] Erro na validação de tracking:', error);
          alerts.push({
            type: 'info',
            title: 'Validação de Rastreio Indisponível',
            message: 'Não foi possível validar os códigos de rastreio no momento',
            suggestion: 'A validação será feita durante a importação'
          });
        }
      }
    }

    // Validação de CEPs
    if (cepMapping) {
      // 🔧 CHECK: Verificar se foi cancelado antes de validação assíncrona
      if (!isMountedRef.current || signal?.aborted) {
        console.log('[Validation] Cancelado antes de validação de CEP');
        return;
      }

      // ✅ NOVO: Validar TODOS os CEPs em chunks
      console.log(`[Validation] Iniciando validação de CEP para ${dataSize} registros`);
      
      try {
        const cepValidationResult = await validateInChunks({
          data: csvFullData,
          chunkSize: 50, // CEPs: chunks menores por causa de rate limiting de APIs externas
          validator: async (chunk: Record<string, string>[]) => {
            const ceps = chunk.map(row => row[cepMapping.csvColumn] || '').filter(c => c.trim());
            
            if (ceps.length === 0) return [];
            
            const results = await validateCEPs(ceps);
            
            return ceps.map(cep => ({
              id: cep,
              isValid: results[cep]?.isValid || false,
              data: { cep }
            }));
          },
          onProgress: (current, total, percentage) => {
            if (isMountedRef.current) {
              setValidationProgress(prev => ({ ...prev, cep: percentage }));
              console.log(`[Validation] CEP: ${percentage}% (${current}/${total})`);
            }
          },
          signal,
          delayBetweenChunks: 200 // Maior delay para respeitar rate limit de APIs de CEP
        });

        // 🔧 CHECK: Verificar após operação assíncrona
        if (!isMountedRef.current || signal?.aborted) {
          console.log('[Validation] Cancelado após validação de CEP');
          return;
        }

        const validCount = cepValidationResult.totalValid;
        const validRatio = validCount / cepValidationResult.totalProcessed;

        if (validRatio < 0.8) {
          alerts.push({
            type: 'warning',
            title: 'CEPs Inválidos Detectados',
            message: `Apenas ${Math.round(validRatio * 100)}% dos CEPs (${validCount}/${cepValidationResult.totalProcessed}) são válidos`,
            field: cepMapping.csvColumn,
            suggestion: 'Verifique se os CEPs estão no formato correto (00000-000)'
          });
        } else {
          qualityScore += 10;
          suggestions.push(`✅ ${validCount}/${cepValidationResult.totalProcessed} CEPs validados com sucesso`);
        }

        console.log(`[Validation] CEP completo: ${validCount}/${cepValidationResult.totalProcessed} válidos (${cepValidationResult.processingTime}ms)`);

      } catch (error) {
        // Não adicionar erro se foi cancelado
        if (!signal?.aborted) {
          console.error('[Validation] Erro na validação de CEP:', error);
          alerts.push({
            type: 'info',
            title: 'Validação de CEP Indisponível',
            message: 'Não foi possível validar os CEPs no momento',
            suggestion: 'A validação será feita durante a importação'
          });
        }
      }
    }

    // 🔧 CHECK: Verificar se foi cancelado
    if (!isMountedRef.current || signal?.aborted) {
      console.log('[Validation] Cancelado após validação de CEP');
      return;
    }

    // Validar qualidade dos dados mapeados
    currentMappings.forEach(mapping => {
      if (!mapping.detectedField) return;

      const sampleValues = csvSampleData.slice(0, 5).map(row => row[mapping.csvColumn] || '');

      // Validação específica por tipo de campo
      switch (mapping.detectedField) {
        case 'customer_email': {
          const validEmails = sampleValues.filter(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(v));
          const emailRatio = validEmails.length / sampleValues.length;
          if (emailRatio < 0.8) {
            alerts.push({
              type: 'warning',
              title: 'E-mails Inválidos Detectados',
              message: `Apenas ${Math.round(emailRatio * 100)}% dos valores parecem ser e-mails válidos`,
              field: mapping.csvColumn,
              suggestion: 'Verifique se a coluna contém realmente endereços de e-mail'
            });
          } else {
            qualityScore += 10;
          }
          break;
        }

        case 'tracking_code': {
          const validTracking = sampleValues.filter(v => {
            // Padrões brasileiros de rastreio
            return /^[A-Z]{2}\d{9}[A-Z]{2}$|^[A-Z]{2}\d{10}[A-Z]{2}$|^\d{12,14}$|^LG\d{9}BR$|^TE\d{9}BR$|^AC\d{9}BR$/i.test(v);
          });
          const trackingRatio = validTracking.length / sampleValues.length;
          if (trackingRatio < 0.6) {
            alerts.push({
              type: 'warning',
              title: 'Códigos de Rastreio Suspeitos',
              message: `Apenas ${Math.round(trackingRatio * 100)}% dos valores parecem ser códigos de rastreio válidos`,
              field: mapping.csvColumn,
              suggestion: 'Verifique se os códigos seguem os padrões das transportadoras brasileiras'
            });
          } else {
            qualityScore += 15;
          }
          break;
        }

        case 'customer_phone': {
          const validPhones = sampleValues.filter(v => /(\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}/.test(v));
          const phoneRatio = validPhones.length / sampleValues.length;
          if (phoneRatio < 0.7) {
            alerts.push({
              type: 'info',
              title: 'Telefones Mal Formatados',
              message: `Apenas ${Math.round(phoneRatio * 100)}% dos valores parecem ser telefones válidos`,
              field: mapping.csvColumn,
              suggestion: 'Considere padronizar o formato dos telefones (11) 99999-9999'
            });
          } else {
            qualityScore += 10;
          }
          break;
        }

        case 'order_value': {
          const validValues = sampleValues.filter(v => /^\d+([,.]\d{1,2})?$/.test(v.replace(/[R$\s]/g, '')));
          const valueRatio = validValues.length / sampleValues.length;
          if (valueRatio < 0.8) {
            alerts.push({
              type: 'warning',
              title: 'Valores Suspeitos',
              message: `Apenas ${Math.round(valueRatio * 100)}% dos valores parecem ser valores monetários válidos`,
              field: mapping.csvColumn,
              suggestion: 'Verifique se os valores estão no formato correto (ex: 299.90 ou 299,90)'
            });
          } else {
            qualityScore += 10;
          }
          break;
        }
      }
    });

    // Detecção de duplicatas
    try {
      // 🔧 CHECK: Verificar se foi cancelado antes de análise pesada
      if (!isMountedRef.current || signal?.aborted) {
        console.log('[Validation] Cancelado antes de detecção de duplicatas');
        return;
      }

      // ✅ NOVO: Detectar duplicatas em TODO o dataset
      console.log(`[Validation] Iniciando detecção de duplicatas para ${dataSize} registros`);
      
      try {
        // Preparar todos os dados para análise
        const allOrders = csvFullData.map(row => {
          const order: Record<string, string> = {};
          currentMappings.forEach(mapping => {
            if (mapping.detectedField) {
              order[mapping.detectedField] = row[mapping.csvColumn] || '';
            }
          });
          return order;
        });

        // Processar em chunks para não sobrecarregar
        const duplicateResult = await validateInChunks({
          data: allOrders,
          chunkSize: 200,
          validator: async (chunk: Record<string, string>[]) => {
            // Detectar duplicatas dentro do chunk
            const chunkDuplicates = await detectDuplicates(chunk);
            
            return chunk.map((order, idx) => ({
              id: order.tracking_code || `order-${idx}`,
              isValid: true,
              data: { 
                hasDuplicate: chunkDuplicates.summary.totalDuplicates > 0,
                duplicateInfo: chunkDuplicates
              }
            }));
          },
          onProgress: (current, total, percentage) => {
            if (isMountedRef.current) {
              setValidationProgress(prev => ({ ...prev, duplicates: percentage }));
              console.log(`[Validation] Duplicatas: ${percentage}% (${current}/${total})`);
            }
          },
          signal
        });

        // 🔧 CHECK: Verificar após operação assíncrona
        if (!isMountedRef.current || signal?.aborted) {
          console.log('[Validation] Cancelado após detecção de duplicatas');
          return;
        }

        // Analisar últimos chunks para estatísticas finais
        const finalAnalysis = await detectDuplicates(allOrders.slice(-100)); // Últimos 100 registros

        if (finalAnalysis.summary.totalDuplicates > 0) {
          alerts.push({
            type: finalAnalysis.summary.highConfidenceDuplicates > 0 ? 'error' : 'warning',
            title: 'Duplicatas Detectadas no Dataset Completo',
            message: `Encontradas ${finalAnalysis.summary.totalDuplicates} possíveis duplicatas (${finalAnalysis.summary.highConfidenceDuplicates} de alta confiança)`,
            suggestion: 'Revise os dados antes de importar para evitar duplicatas no sistema'
          });

          // Adicionar detalhes das duplicatas por tipo
          Object.entries(finalAnalysis.summary.byType).forEach(([type, count]) => {
            const typeNames = {
              tracking_code: 'códigos de rastreio',
              email: 'e-mails',
              order_number: 'números de pedido'
            };
            alerts.push({
              type: 'info',
              title: `Duplicatas por ${typeNames[type as keyof typeof typeNames]}`,
              message: `${count} duplicatas encontradas no dataset completo`,
              suggestion: 'Verifique se estes dados já existem no sistema'
            });
          });
        } else {
          qualityScore += 15; // Pontos por não ter duplicatas
          suggestions.push(`✅ Nenhuma duplicata detectada em ${dataSize} registros`);
        }

        console.log(`[Validation] Duplicatas completo: ${finalAnalysis.summary.totalDuplicates} encontradas (${duplicateResult.processingTime}ms)`);

      } catch (error) {
        // Não adicionar erro se foi cancelado
        if (!signal?.aborted) {
          console.error('[Validation] Erro na detecção de duplicatas:', error);
          alerts.push({
            type: 'info',
            title: 'Detecção de Duplicatas Indisponível',
            message: 'Não foi possível verificar duplicatas no momento',
            suggestion: 'A verificação será feita durante a importação'
          });
        }
      }
    } catch (error) {
      // Não adicionar erro se foi cancelado
      if (!signal?.aborted) {
        console.error('Erro na detecção de duplicatas:', error);
        alerts.push({
          type: 'info',
          title: 'Detecção de Duplicatas Indisponível',
          message: 'Não foi possível verificar duplicatas no momento',
          suggestion: 'A verificação será feita durante a importação'
        });
      }
    }

    // Validação de regras de negócio
    if (businessRules.length > 0) {
      try {
        const sampleData = csvSampleData.slice(0, 10).map(row => {
          const mappedRow: Record<string, string | number | boolean | null> = {};
          currentMappings.forEach(mapping => {
            if (mapping.detectedField) {
              const value = row[mapping.csvColumn];
              // Tentar converter para o tipo apropriado
              if (value === '' || value === undefined) {
                mappedRow[mapping.detectedField] = null;
              } else if (!isNaN(Number(value)) && mapping.detectedField.includes('value')) {
                mappedRow[mapping.detectedField] = Number(value);
              } else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
                mappedRow[mapping.detectedField] = value.toLowerCase() === 'true';
              } else {
                mappedRow[mapping.detectedField] = value;
              }
            }
          });
          return mappedRow;
        });

        // ✅ NOVO: Validar business rules em TODO o dataset
        console.log(`[Validation] Iniciando validação de regras de negócio para ${dataSize} registros`);
        
        const allMappedData = csvFullData.map(row => {
          const mappedRow: Record<string, string | number | boolean | null> = {};
          currentMappings.forEach(mapping => {
            if (mapping.detectedField) {
              const value = row[mapping.csvColumn];
              if (value === '' || value === undefined) {
                mappedRow[mapping.detectedField] = null;
              } else if (!isNaN(Number(value)) && mapping.detectedField.includes('value')) {
                mappedRow[mapping.detectedField] = Number(value);
              } else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
                mappedRow[mapping.detectedField] = value.toLowerCase() === 'true';
              } else {
                mappedRow[mapping.detectedField] = value;
              }
            }
          });
          return mappedRow;
        });

        const businessRulesResult = await validateInChunks({
          data: allMappedData,
          chunkSize: 150,
          validator: async (chunk: Record<string, string | number | boolean | null>[]) => {
            const chunkAnalysis = validateBusinessRules(chunk, businessRules);
            
            return chunk.map((row, idx) => ({
              id: `rule-${idx}`,
              isValid: chunkAnalysis.validations.filter(v => !v.isValid).length === 0,
              data: { violations: chunkAnalysis.validations.filter(v => !v.isValid) }
            }));
          },
          onProgress: (current, total, percentage) => {
            if (isMountedRef.current) {
              setValidationProgress(prev => ({ ...prev, businessRules: percentage }));
              console.log(`[Validation] Business Rules: ${percentage}% (${current}/${total})`);
            }
          },
          signal
        });

        // Análise final para estatísticas
        const businessRulesAnalysis = validateBusinessRules(allMappedData.slice(0, 100), businessRules);

        // Adicionar alertas baseados nas regras de negócio
        businessRulesAnalysis.validations.forEach(validation => {
          if (!validation.isValid) {
            alerts.push({
              type: validation.severity === 'error' ? 'error' : validation.severity === 'warning' ? 'warning' : 'info',
              title: 'Regra de Negócio Violada',
              message: validation.message,
              field: validation.field,
              suggestion: validation.suggestion
            });
          }
        });

        // Adicionar pontos de qualidade baseados nas regras de negócio
        const passedRulesRatio = businessRulesAnalysis.summary.passedRules / businessRulesAnalysis.summary.totalRules;
        if (passedRulesRatio >= 0.8) {
          qualityScore += 15;
          suggestions.push('✅ Regras de negócio validadas com sucesso');
        } else if (passedRulesRatio >= 0.6) {
          qualityScore += 10;
          suggestions.push('⚠️ Algumas regras de negócio foram violadas');
        } else {
          suggestions.push('❌ Muitas regras de negócio foram violadas - revise os dados');
        }

        // Adicionar estatísticas das regras
        if (businessRulesAnalysis.summary.errors > 0) {
          alerts.push({
            type: 'error',
            title: 'Erros de Regras de Negócio',
            message: `${businessRulesAnalysis.summary.errors} regras críticas foram violadas`,
            suggestion: 'Corrija os dados antes de continuar com a importação'
          });
        }

        if (businessRulesAnalysis.summary.warnings > 0) {
          alerts.push({
            type: 'warning',
            title: 'Avisos de Regras de Negócio',
            message: `${businessRulesAnalysis.summary.warnings} regras geraram avisos`,
            suggestion: 'Considere revisar estes dados'
          });
        }

      } catch (error) {
        console.error('Erro na validação de regras de negócio:', error);
        alerts.push({
          type: 'info',
          title: 'Validação de Regras Indisponível',
          message: 'Não foi possível validar as regras de negócio no momento',
          suggestion: 'A validação será feita durante a importação'
        });
      }
        } else {
          suggestions.push('💡 Considere configurar regras de negócio para validações personalizadas');
        }

        // Validação de padrões sazonais
        if (seasonalPatterns.length > 0) {
          try {
            // Encontrar campo de data
            const dateMapping = currentMappings.find(m =>
              m.detectedField === 'order_date' || m.detectedField === 'estimated_delivery'
            );

            if (dateMapping) {
              // ✅ NOVO: Análise sazonal em TODO o dataset
              console.log(`[Validation] Iniciando análise sazonal para ${dataSize} registros`);
              
              const seasonalResult = await validateInChunks({
                data: csvFullData,
                chunkSize: 150,
                validator: async (chunk: Record<string, string>[]) => {
                  const chunkAnalysis = analyzeSeasonalPatterns(chunk, dateMapping.csvColumn, seasonalPatterns);
                  
                  return chunk.map((row, idx) => ({
                    id: row.order_date || `seasonal-${idx}`,
                    isValid: chunkAnalysis.validations.filter(v => !v.isValid).length === 0,
                    data: { anomalies: chunkAnalysis.summary.anomalies }
                  }));
                },
                onProgress: (current, total, percentage) => {
                  if (isMountedRef.current) {
                    setValidationProgress(prev => ({ ...prev, seasonal: percentage }));
                    console.log(`[Validation] Sazonal: ${percentage}% (${current}/${total})`);
                  }
                },
                signal
              });

              // Análise final para estatísticas
              const seasonalAnalysis = analyzeSeasonalPatterns(csvFullData.slice(0, 100), dateMapping.csvColumn, seasonalPatterns);

              // Adicionar alertas baseados na análise sazonal
              seasonalAnalysis.validations.forEach(validation => {
                if (!validation.isValid) {
                  alerts.push({
                    type: validation.severity === 'error' ? 'error' : validation.severity === 'warning' ? 'warning' : 'info',
                    title: 'Padrão Sazonal Anômalo',
                    message: validation.message,
                    field: validation.field,
                    suggestion: validation.suggestion
                  });
                }
              });

              // Adicionar pontos de qualidade baseados nos padrões sazonais
              const passedPatternsRatio = seasonalAnalysis.summary.passedPatterns / seasonalAnalysis.summary.totalPatterns;
              if (passedPatternsRatio >= 0.8) {
                qualityScore += 10;
                suggestions.push('✅ Padrões sazonais validados com sucesso');
              } else if (passedPatternsRatio >= 0.6) {
                qualityScore += 5;
                suggestions.push('⚠️ Alguns padrões sazonais apresentaram anomalias');
              } else {
                suggestions.push('❌ Múltiplas anomalias nos padrões sazonais detectadas');
              }

              // Adicionar estatísticas dos padrões sazonais
              if (seasonalAnalysis.summary.anomalies > 0) {
                alerts.push({
                  type: 'warning',
                  title: 'Anomalias Sazonais Detectadas',
                  message: `${seasonalAnalysis.summary.anomalies} padrões sazonais apresentaram anomalias significativas`,
                  suggestion: 'Verifique se há mudanças significativas no comportamento dos dados'
                });
              }

              // Adicionar informações sobre tendências
              seasonalAnalysis.trends.forEach(trend => {
                if (trend.confidence > 0.7) {
                  suggestions.push(`📈 ${trend.description}`);
                }
              });
            }
          } catch (error) {
            console.error('Erro na validação de padrões sazonais:', error);
            alerts.push({
              type: 'info',
              title: 'Validação Sazonal Indisponível',
              message: 'Não foi possível validar os padrões sazonais no momento',
              suggestion: 'A validação será feita durante a importação'
            });
          }
        } else {
          suggestions.push('💡 Considere configurar padrões sazonais para detectar anomalias temporais');
        }

        // Detecção de fraudes
        if (fraudPatterns.length > 0) {
          try {
            // ✅ NOVO: Análise de fraude em TODO o dataset
            console.log(`[Validation] Iniciando análise de fraude para ${dataSize} registros`);
            
            const fraudResult = await validateInChunks({
              data: csvFullData,
              chunkSize: 100,
              validator: async (chunk: Record<string, string>[]) => {
                const chunkAnalysis = analyzeFraudPatterns(chunk, fraudPatterns);
                
                return chunk.map((row, idx) => ({
                  id: row.tracking_code || `fraud-${idx}`,
                  isValid: chunkAnalysis.alerts.length === 0,
                  data: { 
                    fraudAlerts: chunkAnalysis.alerts,
                    riskLevel: chunkAnalysis.summary.blockedRecords > 0 ? 'high' : 'low'
                  }
                }));
              },
              onProgress: (current, total, percentage) => {
                if (isMountedRef.current) {
                  setValidationProgress(prev => ({ ...prev, fraud: percentage }));
                  console.log(`[Validation] Fraude: ${percentage}% (${current}/${total})`);
                }
              },
              signal
            });

            // Análise final para estatísticas
            const fraudAnalysis = analyzeFraudPatterns(csvFullData.slice(0, 100), fraudPatterns);

            // Adicionar alertas baseados na detecção de fraudes
            fraudAnalysis.alerts.forEach(alert => {
              const alertType = alert.riskLevel === 'critical' ? 'error' :
                               alert.riskLevel === 'high' ? 'error' :
                               alert.riskLevel === 'medium' ? 'warning' : 'info';

              alerts.push({
                type: alertType,
                title: `Risco de Fraude - ${alert.riskLevel.toUpperCase()}`,
                message: `Registro ${alert.recordId}: ${alert.reasons.join(', ')}`,
                suggestion: alert.suggestedAction === 'block' ? 'Bloquear este registro' :
                           alert.suggestedAction === 'review' ? 'Revisar manualmente' :
                           'Marcar para atenção especial'
              });
            });

            // Adicionar pontos de qualidade baseados na detecção de fraudes
            const fraudRatio = fraudAnalysis.summary.flaggedRecords / fraudAnalysis.summary.totalRecords;
            if (fraudRatio === 0) {
              qualityScore += 15;
              suggestions.push('✅ Nenhuma atividade suspeita detectada');
            } else if (fraudRatio < 0.05) {
              qualityScore += 10;
              suggestions.push('⚠️ Poucos registros com risco de fraude detectado');
            } else if (fraudRatio < 0.1) {
              qualityScore += 5;
              suggestions.push('❌ Múltiplos registros com risco de fraude - revisar dados');
            } else {
              qualityScore -= 10; // Penalizar qualidade
              suggestions.push('🚨 Alto risco de fraude detectado - revisar todos os dados');
            }

            // Adicionar estatísticas de fraudes
            if (fraudAnalysis.summary.blockedRecords > 0) {
              alerts.push({
                type: 'error',
                title: 'Registros Bloqueados por Fraude',
                message: `${fraudAnalysis.summary.blockedRecords} registros foram identificados com alto risco de fraude`,
                suggestion: 'Estes registros serão bloqueados durante a importação'
              });
            }

            if (fraudAnalysis.summary.reviewRecords > 0) {
              alerts.push({
                type: 'warning',
                title: 'Registros para Revisão',
                message: `${fraudAnalysis.summary.reviewRecords} registros precisam de revisão manual`,
                suggestion: 'Verificar estes registros antes de prosseguir'
              });
            }

          } catch (error) {
            console.error('Erro na detecção de fraudes:', error);
            alerts.push({
              type: 'info',
              title: 'Detecção de Fraudes Indisponível',
              message: 'Não foi possível executar a detecção de fraudes no momento',
              suggestion: 'A verificação será feita durante a importação'
            });
          }
        } else {
          suggestions.push('💡 Considere configurar padrões de fraude para detectar atividades suspeitas');
        }

    // Sugestões baseadas em aprendizado de máquina
    try {
      // 🔧 CHECK: Verificar se foi cancelado antes de análise de ML
      if (!isMountedRef.current || signal?.aborted) {
        console.log('[Validation] Cancelado antes de sugestões de ML');
        return;
      }

      const mlSuggestions = await generateMappingSuggestions(csvHeaders, csvSampleData);

      // 🔧 CHECK: Verificar após operação assíncrona
      if (!isMountedRef.current || signal?.aborted) {
        console.log('[Validation] Cancelado após sugestões de ML');
        return;
      }

      if (mlSuggestions.length > 0) {
        // Adicionar sugestões de mapeamento baseadas em ML
        mlSuggestions.forEach(suggestion => {
          if (suggestion.confidence > 0.7) {
            suggestions.push(`🤖 ML sugere mapear "${suggestion.csvColumn}" para "${SYSTEM_FIELDS.find(f => f.key === suggestion.suggestedField)?.label || suggestion.suggestedField}" (${Math.round(suggestion.confidence * 100)}% confiança)`);
            qualityScore += 5; // Bônus por sugestões de ML
          }
        });

        // Adicionar estatísticas de ML
        const highConfidenceSuggestions = mlSuggestions.filter(s => s.confidence > 0.8);
        if (highConfidenceSuggestions.length > 0) {
          alerts.push({
            type: 'info',
            title: 'Sugestões de IA Disponíveis',
            message: `${highConfidenceSuggestions.length} sugestões de mapeamento com alta confiança baseadas no aprendizado de máquina`,
            suggestion: 'Considere aplicar as sugestões da IA para melhorar a precisão do mapeamento'
          });
        }
      }
    } catch (error) {
      // Não adicionar erro se foi cancelado ou se ML é opcional
      if (!signal?.aborted) {
        console.error('Erro nas sugestões de ML:', error);
      }
    }

    // 🔧 CHECK FINAL: Verificar se foi cancelado antes de atualizar estado
    if (!isMountedRef.current || signal?.aborted) {
      console.log('[Validation] Cancelado antes de atualizar estado final');
      return;
    }

    // Gerar preview dos dados mapeados
    csvSampleData.slice(0, 3).forEach(row => {
      const mappedRow: Record<string, string | number | null> = {};
      currentMappings.forEach(mapping => {
        if (mapping.detectedField) {
          mappedRow[mapping.detectedField] = row[mapping.csvColumn] || null;
        }
      });
      previewData.push(mappedRow);
    });

    // Calcular score final
    const maxScore = 100;
    qualityScore = Math.min(qualityScore, maxScore);

    // Sugestões inteligentes
    if (qualityScore >= 80) {
      suggestions.push('✅ Excelente qualidade dos dados! Pronto para importação.');
    } else if (qualityScore >= 60) {
      suggestions.push('⚠️ Qualidade boa, mas verifique os alertas antes de continuar.');
    } else {
      suggestions.push('❌ Qualidade baixa. Corrija os problemas antes de importar.');
    }

    if (alerts.length === 0) {
      suggestions.push('💡 Todos os campos foram validados com sucesso!');
    }

    // ✅ NOVO: Calcular progresso overall baseado nas validações completas
    const overallProgress = Math.round(
      (validationProgress.tracking + 
       validationProgress.cep + 
       validationProgress.duplicates + 
       validationProgress.businessRules + 
       validationProgress.fraud + 
       validationProgress.seasonal) / 6
    );
    
    if (isMountedRef.current) {
      setValidationProgress(prev => ({ ...prev, overall: overallProgress }));
    }

    // ✅ NOVO: Adicionar informações sobre dataset completo nas sugestões
    suggestions.push(`📊 Dataset completo analisado: ${dataSize} registros`);
    suggestions.push(`🔍 Validações executadas: Tracking, CEP, Duplicatas, Regras de Negócio, Fraude, Sazonal`);

    // 🔧 FIX: Só atualizar estado se o componente ainda estiver montado
    if (isMountedRef.current && !signal?.aborted) {
      console.log('[Validation] Validação concluída com sucesso, atualizando estado');
      setRealTimeValidation({
        isValid: alerts.filter(a => a.type === 'error').length === 0,
        alerts,
        qualityScore: Math.min(100, Math.max(0, qualityScore)), // Normalizar entre 0-100
        suggestions,
        previewData
      });
      setIsValidatingComplete(true);
    } else {
      console.log('[Validation] Componente desmontado ou cancelado, não atualizando estado');
    }
  }, [csvSampleData, csvFullData, dataSize, validateTrackingCodes, validateCEPs, detectDuplicates, businessRules, validateBusinessRules, seasonalPatterns, analyzeSeasonalPatterns, fraudPatterns, analyzeFraudPatterns, csvHeaders, generateMappingSuggestions, validateInChunks, validationProgress]);

  // 🔧 FIX 6: useEffect com debounce e AbortController
  useEffect(() => {
    // Não executar validação se não foi analisado ainda
    if (!isAnalyzed) {
      return;
    }

    // Criar novo AbortController para esta validação
    const controller = new AbortController();
    abortControllerRef.current = controller;

    console.log('[SmartCSVMapping] Iniciando validação debounced');
    
    // Executar validação com o signal do AbortController
    performRealTimeValidation(debouncedMappings, controller.signal);

    // Cleanup: cancelar validação se mappings mudarem ou componente desmontar
    return () => {
      console.log('[SmartCSVMapping] Cancelando validação anterior');
      controller.abort();
    };
  }, [debouncedMappings, isAnalyzed, performRealTimeValidation]);

  // Executar análise inteligente ao carregar
  useEffect(() => {
    const performAnalysis = async () => {
      try {
        const result = await analyzeCSV(csvHeaders, csvSampleData);
        
        // Verificar se ainda está montado após operação assíncrona
        if (!isMountedRef.current) {
          console.log('[Analysis] Componente desmontado, abortando');
          return;
        }

        setAnalysisResult(result);

        // Converter resultado para formato de mapeamento
        const initialMappings: DetectedField[] = csvHeaders.map(header => {
          const detection = result.detectedFields.find(d => d.csvColumn === header);
          return detection || {
            csvColumn: header,
            detectedField: '',
            confidence: 0,
            reasoning: 'Não detectado automaticamente',
            sampleValues: csvSampleData.slice(0, 3).map(row => row[header] || ''),
            validationErrors: []
          };
        });

        if (isMountedRef.current) {
          setMappings(initialMappings);
          setIsAnalyzed(true);

          // Buscar templates compatíveis
          const compatible = findCompatibleTemplates(csvHeaders);
          setCompatibleTemplates(compatible);
        }
      } catch (error) {
        console.error('Erro na análise:', error);
        
        // Verificar se ainda está montado
        if (!isMountedRef.current) {
          return;
        }

        // Fallback para mapeamento manual
        const fallbackMappings: DetectedField[] = csvHeaders.map(header => ({
          csvColumn: header,
          detectedField: '',
          confidence: 0,
          reasoning: 'Análise falhou - mapeamento manual necessário',
          sampleValues: csvSampleData.slice(0, 3).map(row => row[header] || ''),
          validationErrors: ['Falha na análise automática']
        }));

        setMappings(fallbackMappings);
        setIsAnalyzed(true);
      }
    };

    performAnalysis();
  }, [csvHeaders, csvSampleData, analyzeCSV, findCompatibleTemplates]);

  // Atualizar mapeamento manual
  const updateMapping = (csvColumn: string, systemField: string) => {
    if (!isMountedRef.current) {
      console.log('[UpdateMapping] Componente desmontado, ignorando atualização');
      return;
    }

    setMappings(prevMappings =>
      prevMappings.map(mapping => {
        if (mapping.csvColumn === csvColumn) {
          const systemFieldInfo = SYSTEM_FIELDS.find(f => f.key === systemField);
          return {
            ...mapping,
            detectedField: systemField,
            confidence: systemField ? 1.0 : 0, // Mapeamento manual tem confiança máxima
            reasoning: systemField ? 'Mapeado manualmente pelo usuário' : 'Desmapeado pelo usuário',
            validationErrors: []
          };
        }
        return mapping;
      })
    );
    
    // A validação será disparada automaticamente pelo useEffect com debounce
    console.log('[UpdateMapping] Mapeamento atualizado, validação será executada após debounce');
  };

  // Verificar se pode prosseguir
  const canProceed = () => {
    const requiredFields = SYSTEM_FIELDS.filter(f => f.required).map(f => f.key);
    const mappedRequiredFields = mappings
      .filter(m => m.detectedField && requiredFields.includes(m.detectedField))
      .map(m => m.detectedField);

    // Verificar duplicatas
    const mappedFields = mappings.map(m => m.detectedField).filter(f => f);
    const hasDuplicates = mappedFields.length !== new Set(mappedFields).size;

    return requiredFields.every(field => mappedRequiredFields.includes(field)) && !hasDuplicates;
  };

  // Finalizar mapeamento
  const handleComplete = async () => {
    if (!isMountedRef.current) {
      console.log('[HandleComplete] Componente desmontado, abortando');
      return;
    }

    const mappingObject: Record<string, string> = {};
    mappings.forEach(mapping => {
      if (mapping.detectedField) {
        mappingObject[mapping.csvColumn] = mapping.detectedField;
      }
    });

    // Aprender com o mapeamento do usuário para melhorar futuras sugestões
    try {
      await learnFromMapping(csvHeaders, csvSampleData, mappingObject);
      console.log('Mapeamento aprendido para melhorar sugestões futuras');
    } catch (error) {
      console.error('Erro ao aprender com mapeamento:', error);
      // Não bloquear o fluxo se o aprendizado falhar
    }

    // Verificar novamente se ainda está montado após operação assíncrona
    if (!isMountedRef.current) {
      console.log('[HandleComplete] Componente desmontado após aprendizado');
      return;
    }

    // Perguntar se quer salvar como template
    const shouldSaveTemplate = window.confirm(
      'Deseja salvar este mapeamento como um template para uso futuro?\n\nIsso permitirá aplicar o mesmo mapeamento rapidamente em arquivos similares.'
    );

    if (shouldSaveTemplate && isMountedRef.current) {
      const templateName = prompt('Nome do template:', `Template ${new Date().toLocaleDateString('pt-BR')}`);
      if (templateName && isMountedRef.current) {
        const templateDescription = prompt('Descrição opcional do template:');
        const tags = prompt('Tags (separadas por vírgula, opcional):')?.split(',').map(t => t.trim()).filter(t => t);

        await saveTemplate(
          templateName,
          mappingObject,
          csvHeaders,
          templateDescription || undefined,
          false, // Não público por padrão
          tags
        );
      }
    }

    // Verificar uma última vez antes de chamar callback
    if (isMountedRef.current) {
      onMappingComplete(mappingObject);
    }
  };

  // Obter ícone de confiança
  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (confidence >= 0.6) return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  // Obter badge de confiança
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <Badge variant="default" className="bg-green-500">Alta</Badge>;
    if (confidence >= 0.6) return <Badge variant="secondary">Média</Badge>;
    return <Badge variant="destructive">Baixa</Badge>;
  };

  // Obter cor da linha baseada na confiança
  const getRowClassName = (confidence: number, hasErrors: boolean) => {
    if (hasErrors) return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800';
    if (confidence >= 0.8) return 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800';
    if (confidence >= 0.6) return 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800';
    return 'bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800';
  };

  if (isAnalyzing) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Análise Inteligente em Andamento
            </CardTitle>
            <CardDescription>
              Estamos analisando seu arquivo CSV para detectar automaticamente os campos...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Analisando padrões nos dados...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status da análise */}
      {analysisResult && (
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Confiança geral da análise:</span>
                <span className="font-medium">
                  {Math.round(analysisResult.confidence * 100)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Campos detectados automaticamente:</span>
                <span className="font-medium">
                  {analysisResult.detectedFields.filter((d: DetectedField) => d.detectedField).length} / {csvHeaders.length}
                </span>
              </div>
              {analysisResult.suggestions.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="font-medium text-sm mb-2">💡 Sugestões:</p>
                  <ul className="text-sm space-y-1">
                    {analysisResult.suggestions.map((suggestion: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* ✅ NOVO: UI de Progresso de Validação */}
      {(isProcessingChunks || validationProgress.overall > 0) && !isValidatingComplete && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-blue-600 animate-pulse" />
              Validando Dataset Completo ({dataSize} registros)
            </CardTitle>
            <CardDescription>
              Processando todos os dados para fornecer validações precisas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progresso Geral */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Progresso Geral</span>
                <span className="text-sm font-semibold text-blue-600">{validationProgress.overall}%</span>
              </div>
              <Progress value={validationProgress.overall} className="h-3" />
            </div>

            {/* Progresso Individual */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Tracking</span>
                  <span className="text-xs font-medium">{validationProgress.tracking}%</span>
                </div>
                <Progress value={validationProgress.tracking} className="h-2" />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">CEP</span>
                  <span className="text-xs font-medium">{validationProgress.cep}%</span>
                </div>
                <Progress value={validationProgress.cep} className="h-2" />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Duplicatas</span>
                  <span className="text-xs font-medium">{validationProgress.duplicates}%</span>
                </div>
                <Progress value={validationProgress.duplicates} className="h-2" />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Regras</span>
                  <span className="text-xs font-medium">{validationProgress.businessRules}%</span>
                </div>
                <Progress value={validationProgress.businessRules} className="h-2" />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Fraude</span>
                  <span className="text-xs font-medium">{validationProgress.fraud}%</span>
                </div>
                <Progress value={validationProgress.fraud} className="h-2" />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Sazonal</span>
                  <span className="text-xs font-medium">{validationProgress.seasonal}%</span>
                </div>
                <Progress value={validationProgress.seasonal} className="h-2" />
              </div>
            </div>

            {isProcessingChunks && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processando em lotes de 50-200 registros por vez...</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

          {/* Templates Compatíveis */}
          {compatibleTemplates.length > 0 && (
            <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 dark:from-purple-950/20 dark:to-blue-950/20 dark:border-purple-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-purple-800 dark:text-purple-200">
                  <Target className="w-5 h-5" />
                  Templates Compatíveis Encontrados
                </CardTitle>
                <CardDescription>
                  Templates salvos anteriormente que podem acelerar seu mapeamento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {compatibleTemplates.slice(0, 6).map((template) => (
                    <div
                      key={template.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                        selectedTemplate === template.id
                          ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/30 shadow-md'
                          : 'border-purple-200 dark:border-purple-700 bg-card hover:border-purple-300 dark:hover:border-purple-600'
                      }`}
                      onClick={() => handleApplyTemplate(template.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-medium text-sm text-purple-900 truncate">
                          {template.name}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {template.usageCount} uso{template.usageCount !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      {template.description && (
                        <div className="text-xs text-purple-700 mb-2 line-clamp-2">
                          {template.description}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-purple-600">
                        <span>
                          {template.csvHeaders.length} campos mapeados
                        </span>
                        <span>
                          {new Date(template.updatedAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      {template.tags && template.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {template.tags.slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs px-1 py-0">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {compatibleTemplates.length > 6 && (
                  <div className="text-center mt-4">
                    <p className="text-sm text-muted-foreground">
                      +{compatibleTemplates.length - 6} templates adicionais disponíveis
                    </p>
                  </div>
                )}
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCompatibleTemplates([])}
                    className="text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/20"
                  >
                    Ocultar Templates
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabela de mapeamento */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Coluna CSV</TableHead>
                  <TableHead>Valor Exemplo</TableHead>
                  <TableHead>Campo Detectado</TableHead>
                  <TableHead>Confiança</TableHead>
                  <TableHead>Obrigatório</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping, index) => (
                  <TableRow
                    key={index}
                    className={getRowClassName(mapping.confidence, mapping.validationErrors.length > 0)}
                  >
                    <TableCell>
                      <div className="flex flex-col items-center gap-1">
                        {getConfidenceIcon(mapping.confidence)}
                        {mapping.validationErrors.length > 0 && (
                          <XCircle className="w-3 h-3 text-red-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {mapping.csvColumn}
                    </TableCell>
                    <TableCell className="font-mono text-sm max-w-48">
                      <div className="truncate" title={mapping.sampleValues.join(', ')}>
                        {mapping.sampleValues.slice(0, 2).join(', ')}
                        {mapping.sampleValues.length > 2 && '...'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={mapping.detectedField}
                          onValueChange={(value) => updateMapping(mapping.csvColumn, value)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecione um campo..." />
                          </SelectTrigger>
                          <SelectContent>
                            {SYSTEM_FIELDS.map(field => (
                              <SelectItem key={field.key} value={field.key}>
                                {field.label} {field.required && '*'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {mapping.detectedField && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateMapping(mapping.csvColumn, '')}
                            className="h-8 w-8 p-0"
                            title="Desmapear campo"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {getConfidenceBadge(mapping.confidence)}
                        <div className="text-xs text-muted-foreground max-w-32">
                          <div className="truncate" title={mapping.reasoning}>
                            {mapping.reasoning}
                          </div>
                        </div>
                        {mapping.validationErrors.length > 0 && (
                          <div className="text-xs text-red-600">
                            {mapping.validationErrors.join(', ')}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {mapping.detectedField && SYSTEM_FIELDS.find(f => f.key === mapping.detectedField)?.required && (
                        <Badge variant="destructive">Obrigatório</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Validações em Tempo Real */}
          {isAnalyzed && (
            <div className="space-y-4">
              {/* Score de Qualidade */}
              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="w-5 h-5" />
                    Qualidade dos Dados
                    <Badge variant={realTimeValidation.qualityScore >= 80 ? "default" : realTimeValidation.qualityScore >= 60 ? "secondary" : "destructive"}>
                      {realTimeValidation.qualityScore}%
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${
                        realTimeValidation.qualityScore >= 80 ? 'bg-green-500' :
                        realTimeValidation.qualityScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${realTimeValidation.qualityScore}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {realTimeValidation.qualityScore >= 80 ? 'Excelente qualidade! Pronto para importação.' :
                     realTimeValidation.qualityScore >= 60 ? 'Qualidade aceitável, mas verifique os alertas.' :
                     'Qualidade baixa. Corrija os problemas antes de continuar.'}
                  </p>
                </CardContent>
              </Card>

              {/* Alertas em Tempo Real */}
              {realTimeValidation.alerts.length > 0 && (
                <div className="space-y-2">
                  {realTimeValidation.alerts.map((alert, index) => (
                    <Alert key={index} className={
                      alert.type === 'error' ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20' :
                      alert.type === 'warning' ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20' :
                      alert.type === 'info' ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20' :
                      'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20'
                    }>
                      {alert.type === 'error' && <XCircle className="h-4 w-4 text-red-600" />}
                      {alert.type === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                      {alert.type === 'info' && <Lightbulb className="h-4 w-4 text-blue-600" />}
                      {alert.type === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                      <AlertDescription>
                        <div className="space-y-1">
                          <div className="font-medium">{alert.title}</div>
                          <div className="text-sm">{alert.message}</div>
                          {alert.field && (
                            <div className="text-xs text-muted-foreground">
                              Campo: <code className="bg-muted px-1 rounded">{alert.field}</code>
                            </div>
                          )}
                          {alert.suggestion && (
                            <div className="text-xs font-medium text-primary mt-1">
                              💡 {alert.suggestion}
                            </div>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              {/* Sugestões Inteligentes */}
              {realTimeValidation.suggestions.length > 0 && (
                <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg text-blue-800 dark:text-blue-200">
                      <Lightbulb className="w-5 h-5" />
                      Sugestões Inteligentes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {realTimeValidation.suggestions.map((suggestion, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-blue-700 dark:text-blue-300">
                          <span className="text-blue-500 dark:text-blue-400 mt-1">•</span>
                          <span>{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Preview dos Dados Mapeados */}
              {realTimeValidation.previewData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Target className="w-5 h-5" />
                      Preview dos Dados Mapeados
                    </CardTitle>
                    <CardDescription>
                      Como seus dados ficarão após o mapeamento (primeiras 3 linhas)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {Object.keys(realTimeValidation.previewData[0]).map(key => (
                              <TableHead key={key} className="text-xs">
                                {SYSTEM_FIELDS.find(f => f.key === key)?.label || key}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {realTimeValidation.previewData.map((row, index) => (
                            <TableRow key={index}>
                              {Object.entries(row).map(([key, value]) => (
                                <TableCell key={key} className="text-xs font-mono max-w-32">
                                  <div className="truncate" title={String(value || '')}>
                                    {String(value || '')}
                                  </div>
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Resumo de validação */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Campos obrigatórios mapeados:</span>
                  <span className="font-medium">
                    {mappings.filter(m => {
                      const field = SYSTEM_FIELDS.find(f => f.key === m.detectedField);
                      return field?.required && m.detectedField;
                    }).length} / {SYSTEM_FIELDS.filter(f => f.required).length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Campos mapeados:</span>
                  <span className="font-medium">
                    {mappings.filter(m => m.detectedField).length} / {mappings.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Detecções automáticas:</span>
                  <span className="font-medium">
                    {mappings.filter(m => m.confidence > 0 && m.confidence < 1).length}
                  </span>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Ações - Fixadas na parte inferior */}
          <div className="flex justify-end gap-3 pt-4 border-t bg-background sticky bottom-0">
            <Button variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              onClick={handleComplete}
              disabled={!realTimeValidation.isValid}
              className="flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Continuar com Importação
            </Button>
          </div>

      {/* Ajuda */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Como Funciona a Detecção Inteligente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary">1</div>
                <div>
                  <div className="font-medium">Análise de Nomes</div>
                  <div className="text-sm text-muted-foreground">
                    Identifica campos por nomes de colunas como "nome_cliente", "email", "telefone", etc.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary">2</div>
                <div>
                  <div className="font-medium">Análise de Conteúdo</div>
                  <div className="text-sm text-muted-foreground">
                    Examina os dados para identificar padrões como emails, telefones, códigos de rastreio.
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary">3</div>
                <div>
                  <div className="font-medium">Validação Cruzada</div>
                  <div className="text-sm text-muted-foreground">
                    Resolve conflitos e valida se as detecções fazem sentido.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary">4</div>
                <div>
                  <div className="font-medium">Correção Manual</div>
                  <div className="text-sm text-muted-foreground">
                    Permite ajustes manuais quando a detecção automática não for perfeita.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SmartCSVMapping;