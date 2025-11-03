import { useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import { SkeletonForm, SkeletonTable } from "@/components/SkeletonLoaders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, Plus, Download, Eye, CheckCircle, XCircle, AlertTriangle, ArrowLeft, Globe, RefreshCw, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useShopifyIntegrationReal } from "@/hooks/useShopifyIntegrationReal";
import { useWooCommerceIntegrationReal } from "@/hooks/useWooCommerceIntegrationReal";
import { useMercadoLivreIntegrationReal } from "@/hooks/useMercadoLivreIntegrationReal";
import { useCarrierDetection } from "@/hooks/useTracking";
import EmptyState from "@/components/EmptyState";
import SmartCSVMapping from "@/components/SmartCSVMapping";
import { ImportHistory } from "@/components/ImportHistory";
import { ImportMetricsDashboard } from "@/components/ImportMetricsDashboard";
import { MappingTemplatesManager, MappingTemplate } from "@/components/MappingTemplatesManager";
import { parseCSVFile, parseCSVText, formatParsingErrors } from "@/utils/csvParser";
import { processImport, type ProcessingResult, type NormalizedOrder } from "@/lib/csv-templates";

interface ParsedOrder {
  tracking_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  carrier: string;
  status: 'valid' | 'invalid' | 'warning';
  errors: string[];
  warnings: string[];
  // Campos adicionais do CSV aprimorado
  order_value?: string;
  destination?: string;
  order_date?: string;
  estimated_delivery?: string;
  product_name?: string;
  quantity?: string;
  order_number?: string;
  notes?: string;
  // Campos adicionais da NuvemShop
  sku?: string;
  channel?: string;
  seller?: string;
  payment_method?: string;
  cpf_cnpj?: string;
  delivery_address?: string;
  delivery_number?: string;
  delivery_complement?: string;
  delivery_neighborhood?: string;
  delivery_city?: string;
  delivery_state?: string;
  delivery_zipcode?: string;
  delivery_country?: string;
  subtotal?: string;
  discount?: string;
  shipping_cost?: string;
  total?: string;
  payment_status?: string;
  order_status?: string;
  shipping_status?: string;
  product_value?: string;
  // Campos adicionais para datas e transações
  payment_date?: string;
  shipping_date?: string;
  transaction_id?: string;
  physical_product?: string;
  cancellation_date?: string;
  cancellation_reason?: string;
}

interface ImportResult {
  success: number;
  errors: number;
  warnings: number;
  details: Array<{
    tracking_code: string;
    status: 'success' | 'error' | 'warning';
    message: string;
  }>;
}

interface ImportMetrics {
  totalOrders: number;
  processedOrders: number;
  successfulImports: number;
  failedImports: number;
  warningImports: number;
  startTime: Date;
  estimatedEndTime?: Date;
  currentChunk: number;
  totalChunks: number;
  averageProcessingTime: number;
  memoryUsage?: number;
  networkRequests: number;
  errors: Array<{
    code: string;
    message: string;
    count: number;
  }>;
  warnings: Array<{
    code: string;
    message: string;
    count: number;
  }>;
}

const ImportOrders = () => {
  const { user } = useAuth();
  const { detectCarrier } = useCarrierDetection();

  // Função para gerenciar notificações push
  const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('Este navegador não suporta notificações push');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Erro ao solicitar permissão de notificação:', error);
      return false;
    }
  };

  // Função para mostrar notificação push
  const showImportNotification = (result: ImportResult, totalTime: number) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const title = result.success > 0 ? '✅ Importação Concluída!' : '❌ Importação Finalizada';
    const body = result.success > 0
      ? `${result.success} pedidos importados com sucesso em ${totalTime.toFixed(1)}s`
      : `Importação finalizada. ${result.errors} erros encontrados.`;

    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'import-completion',
      requireInteraction: false,
      silent: false
    });

    // Auto-close após 5 segundos
    setTimeout(() => {
      notification.close();
    }, 5000);

    // Click na notificação volta para a página
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  };
  const [manualOrder, setManualOrder] = useState({
    trackingCode: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    carrier: "",
  });
  const [loading, setLoading] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [parsedOrders, setParsedOrders] = useState<ParsedOrder[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Estados para métricas de importação
  const [importMetrics, setImportMetrics] = useState<ImportMetrics | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);

  // 🆕 Estados para sistema inteligente de detecção CSV
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [showIntelligentPreview, setShowIntelligentPreview] = useState(false);

  // Estados para mapeamento CSV
  const [showMapping, setShowMapping] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvSampleData, setCsvSampleData] = useState<Record<string, string>[]>([]);
  const [rawCsvData, setRawCsvData] = useState<string[][]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  
  // ✅ NOVO: Estados para dados completos (não apenas amostras)
  const [csvFullData, setCsvFullData] = useState<Record<string, string>[]>([]);
  const [dataSize, setDataSize] = useState<number>(0);

  // 🔧 FIX: Controlar fechamento seguro dos modais
  const handleCloseMapping = useCallback(() => {
    console.log('[ImportOrders] Fechando modal de mapeamento');
    setShowMapping(false);
    // Limpar dados CSV após fechar
    setTimeout(() => {
      setCsvHeaders([]);
      setCsvSampleData([]);
      setRawCsvData([]);
    }, 300); // Aguardar animação de fechamento
  }, []);

  const handleClosePreview = useCallback(() => {
    console.log('[ImportOrders] Fechando modal de preview');
    setShowPreview(false);
    // Limpar dados após fechar
    setTimeout(() => {
      setParsedOrders([]);
    }, 300); // Aguardar animação de fechamento
  }, []);

  // Marketplace integrations - REAL hooks
  const shopify = useShopifyIntegrationReal();
  const woocommerce = useWooCommerceIntegrationReal();
  const mercadolivre = useMercadoLivreIntegrationReal();

  // Connection states - Agora gerenciado pelos hooks reais
  // Os hooks já possuem .config que indica se está conectado

  // Função para validar código de rastreio
  const validateTrackingCode = (code: string): { isValid: boolean; carrier: string; errors: string[] } => {
    if (!code || code.trim() === '') {
      return { isValid: false, carrier: '', errors: ['Código de rastreio é obrigatório'] };
    }

    const cleanCode = code.replace(/\s/g, '').toUpperCase();
    const detectedCarrier = detectCarrier(cleanCode);

    if (detectedCarrier === 'Correios') {
      // Validação específica para Correios
      if (!/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(cleanCode) && !/^[A-Z]{2}\d{10}[A-Z]{2}$/.test(cleanCode)) {
        return { isValid: false, carrier: detectedCarrier, errors: ['Formato de código dos Correios inválido'] };
      }
    } else if (detectedCarrier === 'Jadlog') {
      // Validação específica para Jadlog
      if (!/^\d{12,14}$/.test(cleanCode)) {
        return { isValid: false, carrier: detectedCarrier, errors: ['Formato de código Jadlog inválido'] };
      }
    }

    return { isValid: true, carrier: detectedCarrier, errors: [] };
  };

  // Função para validar email
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Função para validar telefone
  const validatePhone = (phone: string): boolean => {
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length >= 10 && cleanPhone.length <= 11;
  };

  // Função para validar data
  const validateDate = (dateStr: string): boolean => {
    if (!dateStr) return true; // Campo opcional

    // Aceita formatos DD/MM/YYYY ou YYYY-MM-DD
    const dateRegex1 = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const dateRegex2 = /^(\d{4})-(\d{2})-(\d{2})$/;

    let day, month, year;

    if (dateRegex1.test(dateStr)) {
      [, day, month, year] = dateStr.match(dateRegex1)!;
    } else if (dateRegex2.test(dateStr)) {
      [, year, month, day] = dateStr.match(dateRegex2)!;
    } else {
      return false;
    }

    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.getFullYear() === parseInt(year) &&
           date.getMonth() === parseInt(month) - 1 &&
           date.getDate() === parseInt(day);
  };

  // Função para validar valor monetário
  const validateCurrency = (value: string): boolean => {
    if (!value) return true; // Campo opcional
    const currencyRegex = /^\d+(\.\d{1,2})?$/;
    return currencyRegex.test(value);
  };

  // Função para validar quantidade
  const validateQuantity = (quantity: string): boolean => {
    if (!quantity) return true; // Campo opcional
    const num = parseInt(quantity);
    return !isNaN(num) && num > 0 && num <= 999;
  };

  // Função para validar CPF/CNPJ brasileiro
  const validateCpfCnpj = (cpfCnpj: string): boolean => {
    if (!cpfCnpj) return true; // Campo opcional

    const cleanValue = cpfCnpj.replace(/\D/g, '');

    // CPF: 11 dígitos
    if (cleanValue.length === 11) {
      return validateCpf(cleanValue);
    }

    // CNPJ: 14 dígitos
    if (cleanValue.length === 14) {
      return validateCnpj(cleanValue);
    }

    return false;
  };

  // Função auxiliar para validar CPF
  const validateCpf = (cpf: string): boolean => {
    if (cpf.length !== 11) return false;

    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cpf)) return false;

    // Calcula primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(9))) return false;

    // Calcula segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10) remainder = 0;

    return remainder === parseInt(cpf.charAt(10));
  };

  // Função auxiliar para validar CNPJ
  const validateCnpj = (cnpj: string): boolean => {
    if (cnpj.length !== 14) return false;

    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cnpj)) return false;

    // Calcula primeiro dígito verificador
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cnpj.charAt(i)) * weights1[i];
    }
    let remainder = sum % 11;
    if (remainder < 2) remainder = 0;
    else remainder = 11 - remainder;
    if (remainder !== parseInt(cnpj.charAt(12))) return false;

    // Calcula segundo dígito verificador
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cnpj.charAt(i)) * weights2[i];
    }
    remainder = sum % 11;
    if (remainder < 2) remainder = 0;
    else remainder = 11 - remainder;

    return remainder === parseInt(cnpj.charAt(13));
  };

  // Função para validar endereço brasileiro
  const validateAddress = (address: string, number: string, city: string, state: string, zipcode: string): { isValid: boolean; warnings: string[] } => {
    const warnings: string[] = [];

    // Validações básicas
    if (address && address.trim().length < 3) {
      warnings.push('Endereço deve ter pelo menos 3 caracteres');
    }

    if (number && !/^\d+[A-Za-z]?$/.test(number.trim())) {
      warnings.push('Número deve conter apenas dígitos (opcionalmente seguido de uma letra)');
    }

    if (city && city.trim().length < 2) {
      warnings.push('Cidade deve ter pelo menos 2 caracteres');
    }

    // Valida estado brasileiro
    if (state) {
      const validStates = [
        'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
      ];
      const normalizedState = state.trim().toUpperCase();
      if (!validStates.includes(normalizedState)) {
        warnings.push('Estado deve ser uma sigla válida do Brasil (ex: SP, RJ, MG)');
      }
    }

    // Valida CEP brasileiro
    if (zipcode) {
      const cleanZipcode = zipcode.replace(/\D/g, '');
      if (cleanZipcode.length !== 8) {
        warnings.push('CEP deve ter exatamente 8 dígitos');
      } else if (!/^[0-9]{8}$/.test(cleanZipcode)) {
        warnings.push('CEP deve conter apenas números');
      }
    }

    return {
      isValid: warnings.length === 0,
      warnings
    };
  };

  // Função para processar CSV com mapeamento de campos
  // Corrigir assinatura para aceitar apenas o mapping, conforme esperado pelo SmartCSVMapping
  const processCSVWithMapping = async (mapping: Record<string, string>) => {
    console.log('[ProcessCSV] Iniciando processamento com mapeamento:', mapping);

    // Reconstrói os dados do CSV conforme o novo mapping
    // csvHeaders: headers originais do arquivo
    // csvSampleData: array de objetos {header: valor}
    if (!csvHeaders || !csvSampleData || csvSampleData.length === 0) {
      toast.error('Dados do CSV não encontrados para processar o mapeamento.');
      handleCloseMapping();
      return;
    }

    // Gera os headers mapeados (ordem do sistema)
    const mappedHeaders = Object.keys(mapping);
    // Gera as linhas de dados conforme o mapping
    const csvLines = [
      mappedHeaders.join(','),
      ...csvSampleData.map(rowObj => {
        return mappedHeaders.map(header => {
          const originalHeader = mapping[header];
          const value = rowObj[originalHeader] || '';
          // Escapar valores que contenham vírgulas ou aspas
          return value.includes(',') || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value;
        }).join(',');
      })
    ];

    const csvText = csvLines.join('\n');

    // Processa os pedidos usando a função existente
    const parsedOrders = await processCSVData(csvText);
    setParsedOrders(parsedOrders);
    handleCloseMapping(); // Usar função de fechamento seguro
    setShowPreview(true);
  };

  // Função para processar e validar dados CSV aprimorada
  const processCSVData = async (text: string): Promise<ParsedOrder[]> => {
    // ✅ NOVO: Usar parser robusto
    const parseResult = parseCSVText(text, {
      skipEmptyLines: 'greedy'
    });

    // Verificar erros de parsing
    if (parseResult.errors.length > 0) {
      console.warn('[processCSVData] Erros encontrados:', parseResult.errors);
      const formattedErrors = formatParsingErrors(parseResult.errors);
      if (formattedErrors.length > 0) {
        toast.warning(`Problemas no CSV: ${formattedErrors.slice(0, 3).join(', ')}`);
      }
    }

    if (parseResult.data.length === 0) {
      toast.error("Nenhum dado válido encontrado no CSV.");
      return [];
    }

    // Validar cabeçalhos obrigatórios
    const headers = parseResult.headers;
    const requiredHeaders = ['tracking_code', 'customer_name', 'customer_email'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

    if (missingHeaders.length > 0) {
      toast.error(`Cabeçalhos obrigatórios faltando: ${missingHeaders.join(', ')}`);
      return [];
    }

    console.log('[processCSVData] Processando', parseResult.data.length, 'linhas');

    return parseResult.data.map((order, index) => {
      // Mapeamento de campos com fallbacks para compatibilidade
      const trackingCode = order.tracking_code || order['código_rastreio'] || order['código de rastreio do envio'] || '';
      const customerName = order.customer_name || order['nome_cliente'] || order['nome do comprador'] || order['nome para a entrega'] || '';
      const customerEmail = order.customer_email || order['email_cliente'] || order['e-mail'] || '';
      const customerPhone = order.customer_phone || order['telefone'] || order['phone'] || order['telefone para a entrega'] || '';
      const carrierInput = order.carrier || order['transportadora'] || order['forma de entrega'] || '';
      const orderValue = order.order_value || order['valor_pedido'] || order['total'] || '';
      const destination = order.destination || order['destino'] || order['cidade'] || '';
      const orderDate = order.order_date || order['data_pedido'] || order['data'] || '';
      const estimatedDelivery = order.estimated_delivery || order['previsao_entrega'] || order['data de envio'] || '';
      const productName = order.product_name || order['nome_produto'] || order['nome do produto'] || '';
      const quantity = order.quantity || order['quantidade'] || order['quantidade comprada'] || '';
      const orderNumber = order.order_number || order['numero_pedido'] || order['número do pedido'] || order['identificador do pedido'] || '';
      const notes = order.notes || order['observacoes'] || order['anotações do comprador'] || order['anotações do vendedor'] || '';

      // Campos adicionais NuvemShop
      const cpfCnpj = order.cpf_cnpj || order['cpf / cnpj'] || '';
      const paymentMethod = order.payment_method || order['forma de pagamento'] || '';
      const paymentStatus = order.payment_status || order['status do pagamento'] || '';
      const orderStatus = order.order_status || order['status do pedido'] || '';
      const shippingStatus = order.shipping_status || order['status do envio'] || '';
      const subtotal = order.subtotal || order['subtotal'] || '';
      const discount = order.discount || order['desconto'] || order['cupom de desconto'] || '';
      const shippingCost = order.shipping_cost || order['valor do frete'] || '';
      const productValue = order.product_value || order['valor do produto'] || '';
      const sku = order.sku || order['sku'] || '';
      const channel = order.channel || order['canal'] || '';
      const seller = order.seller || order['vendedor'] || order['pessoa que registrou a venda'] || order['local de venda'] || '';
      const paymentDate = order.payment_date || order['data de pagamento'] || '';
      const shippingDate = order.shipping_date || order['data de envio'] || '';
      const transactionId = order.transaction_id || order['identificador da transação no meio de pagamento'] || '';
      const physicalProduct = order.physical_product || order['produto fisico'] || '';
      const cancellationDate = order.cancellation_date || order['data e hora do cancelamento'] || '';
      const cancellationReason = order.cancellation_reason || order['motivo do cancelamento'] || '';

      // Campos de endereço NuvemShop
      const deliveryAddress = order.delivery_address || order['endereço'] || '';
      const deliveryNumber = order.delivery_number || order['número'] || '';
      const deliveryComplement = order.delivery_complement || order['complemento'] || '';
      const deliveryNeighborhood = order.delivery_neighborhood || order['bairro'] || '';
      const deliveryCity = order.delivery_city || order['cidade'] || '';
      const deliveryState = order.delivery_state || order['estado'] || '';
      const deliveryZipcode = order.delivery_zipcode || order['código postal'] || '';
      const deliveryCountry = order.delivery_country || order['país'] || '';

      return {
        tracking_code: trackingCode,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        carrier: carrierInput || '',
        status: 'warning', // Status inicial válido para ParsedOrder
        errors: [],
        warnings: [],
        // Campos adicionais
        order_value: orderValue,
        destination,
        order_date: orderDate,
        estimated_delivery: estimatedDelivery,
        product_name: productName,
        quantity,
        order_number: orderNumber,
        notes,
        // Campos NuvemShop adicionais
        cpf_cnpj: cpfCnpj,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        order_status: orderStatus,
        shipping_status: shippingStatus,
        subtotal,
        discount,
        shipping_cost: shippingCost,
        product_value: productValue,
        sku,
        channel,
        seller,
        payment_date: paymentDate,
        shipping_date: shippingDate,
        transaction_id: transactionId,
        physical_product: physicalProduct,
        cancellation_date: cancellationDate,
        cancellation_reason: cancellationReason,
        // Campos de endereço NuvemShop
        delivery_address: deliveryAddress,
        delivery_number: deliveryNumber,
        delivery_complement: deliveryComplement,
        delivery_neighborhood: deliveryNeighborhood,
        delivery_city: deliveryCity,
        delivery_state: deliveryState,
        delivery_zipcode: deliveryZipcode,
        delivery_country: deliveryCountry,
      };
    });

    // Detectar duplicatas antes de aplicar validações
    const { duplicates, warnings: duplicateWarnings } = await detectDuplicates(parsedOrders);

    // Aplicar validações e atualizar status considerando duplicatas
    const validatedOrders = parsedOrders.map((order, index) => {
      const errors: string[] = [];
      const warnings: string[] = [...duplicateWarnings];

      // Verificar se este pedido é uma duplicata
      const duplicateInfo = duplicates.find(d => d.new_order === order);
      if (duplicateInfo) {
        warnings.push(`Duplicata encontrada: pedido existente de ${duplicateInfo.existing_order.customer_name} (${duplicateInfo.existing_order.created_at})`);
      }

      // Validações obrigatórias
      if (!order.tracking_code.trim()) errors.push('Código de rastreio é obrigatório');
      if (!order.customer_name.trim()) errors.push('Nome do cliente é obrigatório');
      if (!order.customer_email.trim()) errors.push('Email do cliente é obrigatório');

      // Validações de formato
      if (order.customer_email && !validateEmail(order.customer_email)) {
        errors.push('Email inválido');
      }

      if (order.customer_phone && !validatePhone(order.customer_phone)) {
        warnings.push('Telefone pode estar em formato incorreto');
      }

      if (order.order_value && !validateCurrency(order.order_value)) {
        warnings.push('Valor do pedido deve estar no formato correto (ex: 99.90)');
      }

      if (order.order_date && !validateDate(order.order_date)) {
        warnings.push('Data do pedido deve estar no formato DD/MM/YYYY ou YYYY-MM-DD');
      }

      if (order.estimated_delivery && !validateDate(order.estimated_delivery)) {
        warnings.push('Data de entrega prevista deve estar no formato DD/MM/YYYY ou YYYY-MM-DD');
      }

      if (order.quantity && !validateQuantity(order.quantity)) {
        warnings.push('Quantidade deve ser um número inteiro positivo');
      }

      // Validação de CPF/CNPJ
      if (order.cpf_cnpj && !validateCpfCnpj(order.cpf_cnpj)) {
        warnings.push('CPF/CNPJ inválido - deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ)');
      }

      // Validação de endereço brasileiro
      const addressValidation = validateAddress(
        order.delivery_address,
        order.delivery_number,
        order.delivery_city,
        order.delivery_state,
        order.delivery_zipcode
      );
      if (!addressValidation.isValid) {
        warnings.push(...addressValidation.warnings);
      }

      // Validação de código de rastreio
      let finalCarrier = order.carrier;
      if (order.tracking_code) {
        const trackingValidation = validateTrackingCode(order.tracking_code);
        if (!trackingValidation.isValid) {
          errors.push(...trackingValidation.errors);
        } else if (!finalCarrier) {
          finalCarrier = trackingValidation.carrier;
        }
      }

      // Carrier padrão se não especificado e não detectado
      if (!finalCarrier) {
        finalCarrier = 'Correios';
        if (order.tracking_code) {
          warnings.push('Transportadora não especificada, assumindo Correios');
        }
      }

      let status: 'valid' | 'invalid' | 'warning' = 'valid';
      if (errors.length > 0) status = 'invalid';
      else if (warnings.length > 0) status = 'warning';

      return {
        ...order,
        carrier: finalCarrier,
        status,
        errors,
        warnings,
      };
    });

    setParsedOrders(validatedOrders);
  };

  // Função para conectar com Shopify - OAuth real
  const connectShopify = async () => {
    const shopUrl = prompt('Digite a URL da sua loja Shopify (ex: minha-loja.myshopify.com):');
    
    if (!shopUrl) return;
    
    await shopify.connect(shopUrl);
  };

  // Função para conectar com WooCommerce - Basic Auth real
  const connectWooCommerce = async () => {
    const storeUrl = prompt('Digite a URL da sua loja WooCommerce (ex: https://minha-loja.com):');
    const consumerKey = prompt('Digite sua Consumer Key:');
    const consumerSecret = prompt('Digite sua Consumer Secret:');

    if (!storeUrl || !consumerKey || !consumerSecret) return;

    // O hook real fará a conexão
    // Precisamos adicionar um método connect que aceite params
    toast.info('Configure as credenciais WooCommerce nas configurações de integração');
  };

  // Função para conectar com Mercado Livre - OAuth real
  const connectMercadoLivre = async () => {
    await mercadolivre.connect();
  };

  // Função para importar pedidos do Shopify - Hook real
  const importShopifyOrders = async () => {
    if (!shopify.config) {
      toast.error('Conecte-se ao Shopify primeiro');
      return;
    }

    await shopify.importOrders();
  };

  // Função para importar pedidos do WooCommerce - Hook real
  const importWooCommerceOrders = async () => {
    if (!woocommerce.config) {
      toast.error('Conecte-se ao WooCommerce primeiro');
      return;
    }

    await woocommerce.importOrders();
  };

  // Função para importar pedidos do Mercado Livre - Hook real
  const importMercadoLivreOrders = async () => {
    if (!mercadolivre.config) {
      toast.error('Conecte-se ao Mercado Livre primeiro');
      return;
    }

    await mercadolivre.importOrders();
  };

  // Função para baixar modelo CSV aprimorado baseado na NuvemShop
  const downloadCSVTemplate = () => {
    const csvContent = `# Modelo de Importação - Compatível com NuvemShop
# Tracky Pro Flow - Atualizado para NuvemShop
# Versão: 3.0 - Atualizado em ${new Date().toLocaleDateString('pt-BR')}
# Este arquivo usa a mesma estrutura da NuvemShop para máxima compatibilidade
# Campos obrigatórios estão marcados com * (asterisco)
# Campos opcionais podem ser deixados em branco
#
# CAMPOS SUPORTADOS (Mapeamento Automático):
# * Número do Pedido: Identificador único do pedido (order_number)
# * E-mail: Email do cliente (customer_email) *
# * Data: Data do pedido (order_date)
# * Nome do comprador: Nome completo (customer_name) *
# * Telefone: Telefone/WhatsApp (customer_phone)
# * Código de rastreio do envio: Código de rastreio (tracking_code)
# * Forma de Entrega: Transportadora (carrier)
# * Total: Valor total do pedido (order_value)
# * Cidade: Cidade de destino (destination)
# * Estado: Estado de destino (destination)
# * Nome do Produto: Nome do produto (product_name)
# * Quantidade Comprada: Quantidade (quantity)
# * Anotações do Comprador: Observações (notes)
# * Anotações do Vendedor: Observações adicionais (notes)
#
# FORMATO DE DATAS:
# - Use DD/MM/YYYY HH:mm (exemplo: 30/09/2025 21:15)
# - Ou apenas DD/MM/YYYY (exemplo: 30/09/2025)
#
# TRANSPORTADORAS SUPORTADAS:
# - Correios (códigos iniciam com BR)
# - JadLog (códigos iniciam com JD ou SM)
# - Loggi (códigos iniciam com LG)
# - Total Express (códigos iniciam com TE)
# - Azul Cargo (códigos iniciam com AC)
#
# DICAS IMPORTANTES:
# 1. Mantenha os cabeçalhos exatamente como mostrado
# 2. O sistema detecta automaticamente os campos pela análise inteligente
# 3. Campos vazios são ignorados (exceto obrigatórios)
# 4. Use aspas duplas para textos com vírgulas
# 5. Salve em UTF-8 para caracteres especiais

Número do Pedido*,E-mail*,Data,Status do Pedido,Status do Pagamento,Status do Envio,Moeda,Subtotal,Desconto,Valor do Frete,Total,Nome do comprador*,CPF / CNPJ,Telefone,Nome para a entrega,Telefone para a entrega,Endereço,Número,Complemento,Bairro,Cidade,Código postal,Estado,País,Forma de Entrega,Forma de Pagamento,Cupom de Desconto,Anotações do Comprador,Anotações do Vendedor,Data de pagamento,Data de envio,Nome do Produto,Valor do Produto,Quantidade Comprada,SKU,Canal,Código de rastreio do envio,Identificador da transação no meio de pagamento,Identificador do pedido,Produto Fisico,Pessoa que registrou a venda,Local de venda,Vendedor,Data e hora do cancelamento,Motivo do cancelamento
175,sebastiaocamara@gmail.com,30/09/2025 21:15,Aberto,Confirmado,Entregue,BRL,195.5,7.82,62,249.68,Sebastião Ramos da Câmara Filho,45929637415,(11) 98765-4321,Sebastião Ramos da Câmara Filho,(11) 98765-4321,Rua Gervásio Pires,436,1309,Boa Vista,Recife,50050070,Pernambuco,Brasil,JadLog via SmartEnvios,PagarMe,,Cliente solicitou entrega urgente,,30/09/2025,10/10/2025,Mesa e Escrivaninha Dobrável com Pés em Aço (Freijó),195.5,1,170-FREIJO-UN,Mobile,SM9681306764ZUJ,ch_96ADLzoIrF2aOQvW,1799093204,Sim,,,,,
174,souzadeniseregina@gmail.com,30/09/2025 14:48,Aberto,Confirmado,Enviado,BRL,195.5,7.82,46.32,234,Dênise régina Souza,81288867972,(21) 99876-5432,Dênise régina Souza,(21) 99876-5432,Rua Desembargador Antônio Ferreira da Costa,3596,Sala 4,Zona I,Umuarama,87501200,Paraná,Brasil,JadLog via SmartEnvios,PagarMe,,Entrega em endereço comercial,,30/09/2025,01/10/2025,Mesa e Escrivaninha Dobrável com Pés em Aço (Freijó),195.5,1,170-FREIJO-UN,Mobile,SM0054088974ZUJ,ch_ObokR5DFyFnrVK9B,1798839261,Sim,,,,,
171,alexandra_cogo@hotmail.com,29/09/2025 16:33,Aberto,Confirmado,Entregue,BRL,169.9,16.99,31.7,184.61,Alexandra Vedovatti Bueno Cogo,89493303934,(19) 99999-9999,Alexandra Vedovatti Bueno Cogo,(19) 99999-9999,Rua Antônio Rodrigues Moreira Neto,669,BL E-apto32,Jardim Paulicéia,Campinas,13060073,São Paulo,Brasil,Nuvem Envio Correios PAC,PagarMe,BEMVINDO10,,Cliente solicitou entrega rápida,,29/09/2025,02/10/2025,Mesa e Escrivaninha Multiuso Master 90x60cm (Freijó),169.9,1,185-FREIJO-UN,Loja virtual,SM2035534625ZUJ,ch_mlK83MFVbhlpNADj,1798221988,Sim,,,,,
169,vaniaoliver67@gmail.com,29/09/2025 12:54,Aberto,Confirmado,Entregue,BRL,195.5,7.82,58.79,246.47,Edivania Alves de Oliveira,33784053840,(11) 99699-9999,Edivania Alves de Oliveira,(11) 99699-9999,Rua Comendador Cesar Alfieri,270,Casa 2 portão do lado,Parque São Luís,São Paulo,2840130,São Paulo,Brasil,Loggi via SmartEnvios,PagarMe,,Cliente prefere entrega pela manhã,,29/09/2025,03/10/2025,Mesa e Escrivaninha Dobrável com Pés em Aço (Freijó),195.5,1,170-FREIJO-UN,Mobile,SM8373299291ZUJ,ch_Qe1NWzVSELuYw7lX,1798076761,Sim,,,,,
168,srpg30@gmail.com,29/09/2025 02:37,Aberto,Confirmado,Enviado,BRL,189.5,7.58,35.78,217.7,Sergio Guimarães,57195706672,(53) 20000-0000,Sergio Guimarães,(53) 20000-0000,Rua Batista de Figueiredo,127,Ap 501,Vila Paris,Belo Horizonte,30380720,Minas Gerais,Brasil,JadLog via SmartEnvios,PagarMe,,Entrega em apartamento,,29/09/2025,29/09/2025,Aparador e Buffet Roma Cobre (Off-White),189.5,1,351-OFFWHITE-OFFWHITE-UN,Mobile,SM7879020131ZUJ,ch_XP6A540CDCJ54pyR,1797866506,Sim,,,,,
167,aroeirabraga@gmail.com,25/09/2025 18:43,Aberto,Confirmado,Entregue,BRL,180.9,0.00,38.74,219.64,Marcelo Aroeira Braga,28010833649,(53) 20000-0000,Marcelo Aroeira Braga,(53) 20000-0000,Avenida Prudente de Morais,287,Salas 1105-1106,Santo Antônio,Belo Horizonte,30350093,Minas Gerais,Brasil,JadLog via SmartEnvios,PagarMe,,Cliente trabalha em escritório,,26/09/2025,03/10/2025,Mesa e Escrivaninha Multiuso Grande Estilo Industrial (Gianduia),180.9,1,190-GIANDUIA-PRETO-UN,Mobile,SM8943585094ZUJ,ch_qErORWZhdhBldvxe,1792097280,Sim,,,,,
166,taniareginapdias@hotmail.com,25/09/2025 13:23,Aberto,Confirmado,Entregue,BRL,428.8,58.32,69.27,439.75,Tania Dias,7867528822,(52) 00000-0000,Tania dias,(52) 00000-0000,Rua Alfredo Guedes,2020,SALA 11,Cidade Alta,Piracicaba,13419080,São Paulo,Brasil,JadLog via SmartEnvios,PagarMe,BEMVINDO10,,Cliente solicitou montagem,,25/09/2025,03/10/2025,Mesa e Escrivaninha Multiuso Grande Estilo Industrial (Gianduia),180.9,1,190-GIANDUIA-PRETO-UN,Loja virtual,SM1549375904ZUJ,ch_B9a0L4vs6seP5QwE,1795543874,Sim,,,,,
165,cinthiadecor@hotmail.com,24/09/2025 22:31,Aberto,Confirmado,Entregue,BRL,372.9,50.71,133.6,455.79,Cinthia Virgínia Figueiredo,82538123534,(58) 00000-0000,Cinthia Virgínia Figueiredo,(58) 00000-0000,Avenida Deputado Pedro Valadares,900,603,Jardins,Aracaju,49025090,Sergipe,Brasil,JadLog via SmartEnvios,PagarMe,BEMVINDO10,,Entrega em condomínio,,24/09/2025,01/10/2025,Mesa de Jantar Dobrável Industrial 6 Lugares - Praticidade e Estilo em Qualquer Ambiente (Freijó),372.9,1,700-FREIJO-PRETO-UN,Mobile,SM2148862269ZUJ,ch_Z3OGLNrtVtmL1mMB,1795339074,Sim,,,,,
163,nilo.goncalves@gmail.com,23/09/2025 21:20,Aberto,Confirmado,Entregue,BRL,745.8,0.00,93.01,838.81,Nilo Gonçalves,90514777753,(52) 19999-9999,Nilo Gonçalves,(52) 19999-9999,Rua João Vicente,1643,Sobrado,Marechal Hermes,Rio de Janeiro,21610210,Rio de Janeiro,Brasil,Buslog via SmartEnvios,PagarMe,,Cliente solicitou entrega discreta,,23/09/2025,07/10/2025,Mesa de Jantar Dobrável Industrial 6 Lugares - Praticidade e Estilo em Qualquer Ambiente (Gianduia),372.9,2,700-GIANDUIA-PRETO-UN,Mobile,SM1932805645ZUJ,ch_0YzPQyzcDXtbBGrK,1794658978,Sim,,,,,
162,aryengracia@gmail.com,23/09/2025 20:59,Aberto,Confirmado,Entregue,BRL,195.5,26.59,29.59,198.5,Ary Engracia Garcia Neto,35042840800,(51) 70000-0000,Ary Engracia Garcia Neto,(51) 70000-0000,Estrada da Limeirinha,1560,Casa 295,Boa Vista,Boituva,18550000,São Paulo,Brasil,JadLog via SmartEnvios,PagarMe,BEMVINDO10,,Entrega em zona rural,,23/09/2025,29/09/2025,Mesa e Escrivaninha Dobrável com Pés em Aço (Gianduia),195.5,1,170-GIANDUIA-UN,Mobile,SM7543645922ZUJ,ch_aMVrKnWHYEiLqj0g,1794647880,Sim,,,,,
161,mylka.sousa@visionone.com.br,23/09/2025 14:28,Aberto,Confirmado,Entregue,BRL,149.6,0.00,42.47,192.07,Cbv Cbv,6,16069E+12,(58) 20000-0000,Cbv CBV,(58) 20000-0000,Quadra SGAS 613,SN,BLOCO C,Asa Sul,Brasília,70200730,Distrito Federal,Brasil,JadLog via SmartEnvios,PagarMe,,Entrega em empresa,,30/09/2025,06/10/2025,Mesa Redonda Retrátil com Pés de Madeira Alta (Off-White),74.8,2,540-OFFWHITE-UN,Loja virtual,SM7410243632ZUJ,ch_1qoBjw6hDoUEWvm8,1794418137,Sim,,,,,
160,lcbconsultoria2024@gmail.com,22/09/2025 20:03,Aberto,Confirmado,Entregue,BRL,372.9,50.71,138.16,460.35,Luiz Carlos Barboza,66716578820,(53) 49999-9999,Luiz Carlos Barboza,(53) 49999-9999,Rua Dário Meira,737,Ap 22 Condomínio Casaredo,Itapuã,Salvador,41620820,Bahia,Brasil,JadLog via SmartEnvios,PagarMe,BEMVINDO10,,Cliente solicitou contato prévio,,22/09/2025,01/10/2025,Mesa de Jantar Dobrável Industrial 6 Lugares - Praticidade e Estilo em Qualquer Ambiente (Freijó),372.9,1,700-FREIJO-PRETO-UN,Mobile,SM9030664589ZUJ,ch_PRy19JbF1Fo943lx,1793954222,Sim,,,,,
159,izamaramoreira@bol.com.br,22/09/2025 12:25,Aberto,Confirmado,Entregue,BRL,157.9,6.32,29.03,180.61,Izamara Moreira,93000723820,(51) 69999-9999,Izamara Moreira,(51) 69999-9999,Rua Arnaud Capuzzo,125,Ap 42,Nova Aliança,Ribeirão Preto,14026594,São Paulo,Brasil,JadLog via SmartEnvios,PagarMe,,Entrega em apartamento,,22/09/2025,26/09/2025,Mesa e Escrivaninha Multiuso Estilo Industrial (Freijó),157.9,1,180-FREIJO-UN,Mobile,SM7748652172ZUJ,ch_Vjv857WCxCA5BZzD,1793670953,Sim,,,,,
158,marinadiasdsantos@gmail.com,22/09/2025 10:21,Aberto,Confirmado,Entregue,BRL,195.5,19.55,41.4,217.35,Marina Dias,10337969647,(53) 19999-9999,Marina Dias,(53) 19999-9999,Rua Herbert Brant Aleixo,82,,Itapoã,Belo Horizonte,31710300,Minas Gerais,Brasil,JadLog via SmartEnvios,PagarMe,BEMVINDO10,,Cliente prefere entrega aos sábados,,22/09/2025,30/09/2025,Mesa e Escrivaninha Dobrável com Pés em Aço (Freijó),195.5,1,170-FREIJO-UN,Mobile,SM6034253200ZUJ,ch_4P0WrN8F1FRlMQjD,1793593220,Sim,,,,,
157,58borboletas@terra.com.br,22/09/2025 09:07,Aberto,Confirmado,Entregue,BRL,195.5,0.00,33.01,228.51,Maria José Alves de Oliveira Oliveira,63179482168,(56) 60000-0000,Maria José Alves de Oliveira Oliveira,(56) 60000-0000,Rua Euclides Machado,341,Apto 102 globo edifício residence,Canto,Florianópolis,88070720,Santa Catarina,Brasil,JadLog via SmartEnvios,PagarMe,,Entrega em prédio,,23/09/2025,29/09/2025,Mesa e Escrivaninha Dobrável com Pés em Aço (Gianduia),195.5,1,170-GIANDUIA-UN,Mobile,SM4188198336ZUJ,ch_Bpko4RnTYTm4QKl8,1788948024,Sim,,,,,
156,lucio.teixeira@terra.com.br,21/09/2025 20:17,Aberto,Confirmado,Entregue,BRL,169.9,23.11,49.04,195.83,Lucio Teixeira,17126000871,(51) 19799-9999,Lucio Teixeira,(51) 19799-9999,Rua 9 de Julho,267,Apto 3,Parque 9 de Julho,São Roque,18134020,São Paulo,Brasil,Sedex via SmartEnvios,PagarMe,BEMVINDO10,,Cliente trabalha até tarde,,21/09/2025,25/09/2025,Mesa e Escrivaninha Multiuso Master 90x60cm (Preto),169.9,1,185-PRETO-UN,Mobile,AB534093115BR,ch_5L1BJ6kfmf59VjpR,1792020404,Sim,,,,,
155,suzigan-@hotmail.com,19/09/2025 17:39,Aberto,Confirmado,Entregue,BRL,195.5,7.82,81.83,269.51,Leandro Jose Suzigan,7286920669,(53) 50000-0000,Leandro Jose Suzigan,(53) 50000-0000,Rua adalto Pereira de Almeida,45,,Alvorada,Araporã,38465000,Minas Gerais,Brasil,Loggi via SmartEnvios,PagarMe,,Entrega em zona rural,,19/09/2025,30/09/2025,Mesa e Escrivaninha Dobrável com Pés em Aço (Freijó),195.5,1,170-FREIJO-UN,Mobile,SM4746906680ZUJ,ch_OypG12JfZfx1VY7w,1792044245,Sim,,,,,
153,ellen.fernanda06@gmail.com,18/09/2025 15:33,Aberto,Confirmado,Enviado,BRL,218.8,29.76,77.13,266.17,Ellen Fernanda Rossetti Borges,11582760950,(54) 80000-0000,Ellen Fernanda Rossetti Borges,(54) 80000-0000,Rua Nove de Março,317,edificio le pont,Centro,Joinville,89201400,Santa Catarina,Brasil,JadLog via SmartEnvios,PagarMe,BEMVINDO10,,Cliente solicitou embalagem especial,,18/09/2025,19/09/2025,Aparador e Buffet Triplo Multiuso (Freijó),218.8,1,310-FREIJO-PRETO-UN,Loja virtual,SM6228855218I38,ch_8ogVg9Zfzt0E5QDv,1791323029,Sim,,,,,
147,demarchi@aasp.org.br,17/09/2025 01:03,Aberto,Confirmado,Entregue,BRL,195.5,0.00,35.28,230.78,Florence elizabeth Demarchi,14414683823,(51) 40000-0000,Florence elizabeth Demarchi,(51) 40000-0000,Rua Maria Cândida,606,APTO 24 OU ZELADOR,Vila Guilherme,São Paulo,2071001,São Paulo,Brasil,JadLog via SmartEnvios,PagarMe,,Entrega em prédio comercial,,17/09/2025,19/09/2025,Mesa e Escrivaninha Dobrável com Pés em Aço (Freijó),195.5,1,170-FREIJO-UN,Loja virtual,SM6046836534I38,ch_ay89QD6Tr2FpAPgK,1790319654,Sim,,,,,
145,panttilatonani@yahoo.com.br,16/09/2025 12:40,Aberto,Confirmado,Enviado,BRL,195.5,0.00,100.93,296.43,Panttila dos Santos Tonani,11376571706,(52) 98500-0000,Panttila dos Santos Tonani,(52) 98500-0000,Rua Alfredo Félix,627,,Itaputanga,Piúma,29285000,Espírito Santo,Brasil,Nuvem Envio Correios PAC,PagarMe,,Cliente mora em local de difícil acesso,,16/09/2025,16/09/2025,Mesa e Escrivaninha Dobrável com Pés em Aço (Freijó),195.5,1,170-FREIJO-UN,Mobile,SM5310238552I38,ch_9AMYQpAfXjtLV6zr,1789846258,Sim,,,,,
144,elaine.portuguesa@gmail.com,15/09/2025 19:28,Aberto,Confirmado,Entregue,BRL,195.5,19.55,35.28,211.23,Elaine Prates,16036973810,(51) 20000-0000,Elaine Prates,(51) 20000-0000,Avenida Tiradentes,3071,,Jardim Bom Clima,Guarulhos,7196000,São Paulo,Brasil,JadLog via SmartEnvios,PagarMe,BEMVINDO10,,Cliente solicitou entrega rápida,,15/09/2025,19/09/2025,Mesa e Escrivaninha Dobrável com Pés em Aço (Freijó),195.5,1,170-FREIJO-UN,Mobile,SM0924358814I38,ch_QDKzjGXFnkHqRgd8,1789360940,Sim,,,,,
143,alessandra.hansen@hotmail.com,15/09/2025 13:53,Aberto,Confirmado,Entregue,BRL,178.8,0.00,32.76,211.56,Alessandra Aparecida Hansen D'Agostini,13929960826,(51) 99999-9999,Alessandra Aparecida Hansen D'Agostini,(51) 99999-9999,Rua dos Abacateiros,27,,Residencial Vale das Nogueiras,Americana,13474372,São Paulo,Brasil,JadLog via SmartEnvios,PagarMe,,Entrega em condomínio fechado,,15/09/2025,19/09/2025,Aparador e Buffet Roma (Freijó),178.8,1,350-FREIJOCOMBORDAPRETA-UN,Mobile,SM9961843315I38,ch_GXRpODOsVRFemz8b,1789094090,Sim,,,,,
142,rnogueira20@gmail.com,15/09/2025 13:49,Aberto,Confirmado,Enviado,BRL,195.5,0.00,36.11,231.61,Renato Nogueira Souza,10940110709,(52) 19899-9999,Renato Nogueira Souza,(52) 19899-9999,Avenida Jaime Poggi,99,Bloco 5 1611,Barra Olímpica,Rio de Janeiro,22775130,Rio de Janeiro,Brasil,JadLog via SmartEnvios,PagarMe,,Cliente trabalha em home office,,15/09/2025,16/09/2025,Mesa e Escrivaninha Dobrável com Pés em Aço (Preto),195.5,1,170-PRETO-UN,Mobile,SM9462130770I38,ch_8lxdWr9sMULvo9Lg,1789090211,Sim,,,,,
141,alelacavalino@hotmail.com,15/09/2025 06:29,Aberto,Confirmado,Enviado,BRL,195.5,0.00,32.17,227.67,Alessandra Lacava,24728636836,(51) 19899-9999,Alessandra Lacava,(51) 19899-9999,Rua Doutor João Batista Vasques,55,,Vila Sorocabana,Guarulhos,7024210,São Paulo,Brasil,JadLog via SmartEnvios,PagarMe,,Entrega preferencial pela manhã,,15/09/2025,16/09/2025,Mesa e Escrivaninha Dobrável com Pés em Aço (Gianduia),195.5,1,170-GIANDUIA-UN,Mobile,SM3765186547I38,ch_JVKnmVbi5CY30Pqj,1788177535,Sim,,,,,
140,onemarmouradasilva@gmail.com,15/09/2025 00:15,Aberto,Confirmado,Enviado,BRL,157.9,15.79,44.75,186.86,Onemar Moura,28759085886,(51) 19999-9999,Onemar Moura,(51) 19999-9999,Rua Sílvio Barbini,251,Apto 52B,Conjunto Residencial José Bonifácio,São Paulo,8250650,São Paulo,Brasil,Loggi via SmartEnvios,PagarMe,BEMVINDO10,,Cliente solicitou entrega discreta,,15/09/2025,16/09/2025,Mesa e Escrivaninha Multiuso Estilo Industrial (Freijó),157.9,1,180-FREIJO-UN,Mobile,SM3746128700I38,ch_7B3MJwHl0IBQoqej,1788791346,Sim,,,,,
139,vanessaamacedo@hotmail.com,14/09/2025 20:26,Aberto,Confirmado,Enviado,BRL,195.5,19.55,35.28,211.23,Vanessa Macedo,30844850896,(51) 19999-9999,Vanessa Macedo,(51) 19999-9999,Avenida Parkinson,42,Apto 26,Alphaville Empresarial,Barueri,6465136,São Paulo,Brasil,JadLog via SmartEnvios,PagarMe,BEMVINDO10,,Cliente solicitou entrega em empresa,,14/09/2025,16/09/2025,Mesa e Escrivaninha Dobrável com Pés em Aço (Freijó),195.5,1,170-FREIJO-UN,Mobile,SM3904164367I38,ch_koBa6KRSpqC9kbjX,1788593700,Sim,,,,,
138,wagner.carrascosa@ymail.com,14/09/2025 18:56,Aberto,Confirmado,Enviado,BRL,195.5,0.00,35.28,230.78,Wagner Carrascosa,6892879845,(51) 19699-9999,Wagner Carrascosa,(51) 19699-9999,Avenida Tenente Haraldo Egídio de Souza Santos,732,,Jardim Chapadão,Campinas,13070160,São Paulo,Brasil,JadLog via SmartEnvios,PagarMe,,Entrega em casa,,14/09/2025,16/09/2025,Mesa e Escrivaninha Dobrável com Pés em Aço (Freijó),195.5,1,170-FREIJO-UN,Mobile,SM8911132643I38,ch_PGen7LQtnI4oY1AJ,1788580123,Sim,,,,,
137,admaracampos@yahoo.com.br,13/09/2025 20:29,Aberto,Confirmado,Enviado,BRL,81.8,8.18,21.04,94.66,Admara Campos,20267154836,(51) 29999-9999,Admara Campos,(51) 29999-9999,Rua dos Alecrins,107,Casa amarela,Jardim das Indústrias,São José dos Campos,12240030,São Paulo,Brasil,JadLog via SmartEnvios,PagarMe,BEMVINDO10,,Cliente solicitou entrega rápida,,13/09/2025,16/09/2025,Mesa de Centro Retangular Grande (Off-White Freijó),81.8,1,410-OFFWHITE-FREIJO-UN,Mobile,SM0534490775I38,ch_k1wNDeTAmc553bpd,1788017120,Sim,,,,,
136,lab.ambiental@acslab.com.br,11/09/2025 13:51,Aberto,Confirmado,Enviado,BRL,195.5,0.00,52.63,248.13,Acs Laboratórios Divisão Agroambiental,2,20819E+12,(56) 23111-0000,Acs Laboratórios DIVISÃO AGROAMBIENTAL,(56) 23111-0000,Avenida T 15,1438,Qd 152 Lt 08,Setor Bueno,Goiânia,74230010,Goiás,Brasil,JadLog via SmartEnvios,PagarMe,,Entrega em empresa,,12/09/2025,16/09/2025,Mesa e Escrivaninha Dobrável com Pés em Aço (Freijó),195.5,1,170-FREIJO-UN,Loja virtual,SM0534840835I38,ch_l2xwj7Ws6qTW7Jvm,1786596211,Sim,,,,,
135,mimi404172@gmail.com,09/09/2025 08:11,Aberto,Confirmado,Entregue,BRL,195.5,19.55,51.37,227.32,Miriam Moraes,1246531704,(52) 20000-0000,Miriam Moraes,(52) 20000-0000,Alameda das Laranjeiras,14,Casa ao lado do Bar da Tamires,Chácara Santo Antônio,Belford Roxo,26172140,Rio de Janeiro,Brasil,JadLog via SmartEnvios,PagarMe,BEMVINDO10,,Cliente mora em local de difícil acesso,,09/09/2025,16/09/2025,Mesa e Escrivaninha Dobrável com Pés em Aço (Freijó),195.5,1,170-FREIJO-UN,Mobile,SM4566570693I38,ch_9GDBydZURUj0K4Zl,1784999488,Sim,,,,,
134,marcos.brandolt@hotmail.com,08/09/2025 22:11,Aberto,Confirmado,Entregue,BRL,195.5,0.00,39.14,234.64,Marcos Brandolt,73533181049,(51) 19999-9999,Marcos Brandolt,(51) 19999-9999,Rua Henrique Bazanelli,227,,Jardim dos Ipês,Itu,13309870,São Paulo,Brasil,JadLog via SmartEnvios,PagarMe,,Entrega em casa,,08/09/2025,12/09/2025,Mesa e Escrivaninha Dobrável com Pés em Aço (Freijó),195.5,1,170-FREIJO-UN,Loja virtual,SM5547595609I38,ch_qOByxB8SYqFenbPV,1784848877,Sim,,,,,
133,gleice@uenf.br,08/09/2025 10:47,Aberto,Confirmado,Enviado,BRL,319.9,31.99,91.09,379,Gleice G Ponte Silva,1744185743,(52) 29899-9999,Gleice G Ponte Silva,(52) 29899-9999,Rua Domingos Viana,565,sobrado,Parque Turf Club,Campos dos Goytacazes,28013085,Rio de Janeiro,Brasil,Buslog via SmartEnvios,PagarMe,BEMVINDO10,,Cliente solicitou entrega urgente,,08/09/2025,09/09/2025,Mesa de Jantar Dobrável Industrial 6 Lugares - Praticidade e Estilo em Qualquer Ambiente (Freijó),319.9,1,700-FREIJO-PRETO-UN,Loja virtual,SM7703241595I38,ch_gy0ov7MfJfOX92OM,1784378255,Sim,,,,,
132,tatianalentz@hotmail.com,08/09/2025 10:19,Aberto,Confirmado,Enviado,BRL,170.5,0.00,84.04,254.54,Tatiana Lentz,91945623004,(55) 19899-9999,Tatiana Lentz,(55) 19899-9999,Rua Caxias do Sul,700,,Praia da Cal,Torres,95560000,Rio Grande do Sul,Brasil,Loggi via SmartEnvios,PagarMe,,Entrega em apartamento,,08/09/2025,09/09/2025,Aparador e Buffet Roma Cobre (Off-White),170.5,1,351-OFFWHITE-OFFWHITE-UN,Mobile,SM2945787821I38,ch_YA2yk4Vi7igKJL8G,1784357214,Sim,,,,,
131,cissaromariz@gmail.com,05/09/2025 18:27,Aberto,Confirmado,Entregue,BRL,479.2,0.00,112.14,591.34,Cecilia Romariz Batista Romariz,25621882091,(55) 39899-9999,Cecilia Romariz Batista Romariz,(55) 39899-9999,Avenida Bagé,1292,Apto 501,Petrópolis,Porto Alegre,90460080,Rio Grande do Sul,Brasil,JadLog via SmartEnvios,PagarMe,,Cliente solicitou entrega especial,,05/09/2025,17/09/2025,Banqueta e Puff Retrátil Classic (Areia),74,2,111-AREIA-UN,Mobile,SM8009786141I38,ch_dNmGYzPTMTJgRD1a,1782792459,Sim,,,,,
130,janiogalego@hotmail.com,04/09/2025 23:04,Aberto,Confirmado,Enviado,BRL,499.4,49.94,77.97,527.43,Janio Oliveira,1731667175,(54) 80000-0000,Janio Oliveira,(54) 80000-0000,Rua Doutor Pedrinho,27,Casa 01,Itoupava Central,Blumenau,89062213,Santa Catarina,Brasil,Buslog via SmartEnvios,PagarMe,BEMVINDO10,,Cliente solicitou montagem,,04/09/2025,05/09/2025,Mesa e Escrivaninha Dobrável com Pés em Aço (Freijó),171.9,1,170-FREIJO-UN,Mobile,SM6385048459I38,ch_RpkP3WOFB2iqPGb1,1781517906,Sim,,,,,
129,miguel@faret.adv.br,03/09/2025 22:33,Aberto,Confirmado,Entregue,BRL,140.9,14.09,35.23,162.04,Miguel Faret Neto,2,89492E+13,(54) 20000-0000,Miguel Faret Neto,(54) 20000-0000,Rua Doutor Heitor Valente,358,,Tarumã,Curitiba,82800050,Paraná,Brasil,JadLog via SmartEnvios,PagarMe,BEMVINDO10,,Cliente trabalha como advogado,,03/09/2025,09/09/2025,Mesa e Escrivaninha Multiuso Estilo Industrial (Freijó),140.9,1,180-FREIJO-UN,Mobile,SM1734110638I38,ch_jeJ3ALnFxF1ORZW7,1781619727,Sim,,,,,
128,isaac.dacruzaguiar@gmail.com,03/09/2025 12:34,Aberto,Confirmado,Entregue,BRL,171.9,0.00,59.35,231.25,Isaac aguiar,70008280134,(56) 20000-0000,Isaac aguiar,(56) 20000-0000,CNB 1 Lote 14,SN,Apt 805 Edf don juan,Taguatinga Norte (Taguatinga),Brasília,72115909,Distrito Federal,Brasil,JadLog via SmartEnvios,PagarMe,,Entrega em apartamento,,03/09/2025,09/09/2025,Mesa e Escrivaninha Dobrável com Pés em Aço (Freijó),171.9,1,170-FREIJO-UN,Mobile,SM7845032662I38,ch_7dvjG5wT2T0z2DBZ,1781219982,Sim,,,,,
127,eop.brasil@gmail.com,03/09/2025 12:02,Aberto,Confirmado,Entregue,BRL,145.5,0.00,43.14,188.64,Elienay Oliveira,84863021372,(58) 60000-0000,Elienay Oliveira,(58) 60000-0000,Rua Antônia de Andrade Mendes,430,Ap 1401 bocol 01,Palmeiras,Belo Horizonte,31710300,Minas Gerais,Brasil,JadLog via SmartEnvios,PagarMe,,Entrega em apartamento,,03/09/2025,11/09/2025,Mesa e Escrivaninha Multiuso Master 90x60cm (Freijó),145.5,1,185-FREIJO-UN,Mobile,SM7374282754I38,ch_q05rMq2hWhemy1Eo,1781190694,Sim,,,,,`

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `modelo_importacao_nuvemshop_v3.0_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("orders").insert({
        user_id: user.id,
        tracking_code: manualOrder.trackingCode,
        customer_name: manualOrder.customerName,
        customer_email: manualOrder.customerEmail,
        customer_phone: manualOrder.customerPhone,
        carrier: manualOrder.carrier,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Pedido adicionado com sucesso!");
      setManualOrder({
        trackingCode: "",
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        carrier: "",
      });
    } catch (error) {
      console.error("Error adding order:", error);
      toast.error("Erro ao adicionar pedido. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // ✅ Limites de segurança
    const SECURITY_LIMITS = {
      MAX_FILE_SIZE: 50 * 1024 * 1024,  // 50MB
      MAX_ROWS: 50000,                   // 50mil linhas
      MAX_COLUMNS: 100                    // 100 colunas
    };

    // Validar tamanho do arquivo
    if (file.size > SECURITY_LIMITS.MAX_FILE_SIZE) {
      toast.error(`Arquivo muito grande. Tamanho máximo: ${SECURITY_LIMITS.MAX_FILE_SIZE / 1024 / 1024}MB`);
      event.target.value = ''; // Reset input
      return;
    }

    setCsvLoading(true);
    setShowMetrics(true); // Mostrar painel de métricas durante processamento
    
    try {
      // 🆕 Usar sistema inteligente de detecção e processamento
      console.log('[ImportOrders] Iniciando processamento inteligente do arquivo...');
      toast.info('🔍 Detectando formato e validando dados...');
      
      const result = await processImport(file, {
        autoFix: true,  // Corrigir automaticamente problemas conhecidos
        strictValidation: false  // Validação flexível para permitir avisos
      });

      setProcessingResult(result);

      if (!result.success) {
        // Mostrar erros de detecção/validação
        toast.error(result.detection.suggestions?.join('. ') || 'Erro ao processar arquivo');
        
        if (result.detection.confidence === 0) {
          // Fallback para mapeamento manual
          toast.info('📋 Não foi possível detectar o formato automaticamente. Use o mapeamento manual.');
          
          // TODO: Abrir modal de mapeamento manual
          // Aqui você pode chamar a lógica antiga de mapeamento CSV
          setCsvLoading(false);
          return;
        }
      }

      // Mostrar resultados da detecção
      const platformName = result.detection.platform === 'nuvemshop' ? 'NuvemShop' :
                          result.detection.platform === 'shopify' ? 'Shopify' :
                          result.detection.platform === 'mercadolivre' ? 'Mercado Livre' :
                          'Formato Personalizado';
      
      toast.success(
        `✅ Formato detectado: ${platformName} (${result.detection.confidence}% de confiança)`,
        { duration: 6000 }
      );

      // Mostrar estatísticas
      console.log('[ImportOrders] Resultado do processamento:', {
        platform: result.detection.platform,
        confidence: result.detection.confidence,
        totalOrders: result.orders.length,
        validOrders: result.validation.stats.validOrders,
        invalidOrders: result.validation.stats.invalidOrders,
        warnings: result.validation.warnings.length,
        errors: result.validation.errors.length
      });

      // Converter orders para ParsedOrder format para compatibilidade com UI existente
      const convertedOrders: ParsedOrder[] = result.orders.map((order: NormalizedOrder) => {
        // Função para limpar e validar telefone
        const cleanPhone = (phone: string | undefined): string | undefined => {
          if (!phone) return undefined;
          
          // Remove todos os caracteres não numéricos
          const cleaned = phone.toString().replace(/\D/g, '');
          
          // Se não tem pelo menos 10 dígitos, não é válido
          if (cleaned.length < 10 || cleaned.length > 11) return undefined;
          
          // Se tem exatamente 10 ou 11 dígitos, é válido
          if (/^\d{10,11}$/.test(cleaned)) return cleaned;
          
          return undefined;
        };

        return {
          tracking_code: order.tracking_code,
          customer_name: order.customer_name,
          customer_email: order.customer_email,
          customer_phone: cleanPhone(order.customer_phone),
          carrier: order.shipping_address?.country || 'Brasil',
          status: result.validation.errors.some(e => e.row === result.orders.indexOf(order)) ? 'invalid' :
                  result.validation.warnings.some(w => w.row === result.orders.indexOf(order)) ? 'warning' : 'valid',
          errors: result.validation.errors
            .filter(e => e.row === result.orders.indexOf(order))
            .map(e => e.message),
          warnings: result.validation.warnings
            .filter(w => w.row === result.orders.indexOf(order))
            .map(w => w.message),
          // Campos adicionais
          order_value: order.total?.toString(),
          destination: order.shipping_address?.city,
          order_date: order.order_date,
          product_name: order.items?.[0]?.name,
          quantity: order.items?.[0]?.quantity?.toString(),
          order_number: order.order_id,
          notes: order.notes,
          // Campos de endereço
          delivery_address: order.shipping_address?.street,
          delivery_number: order.shipping_address?.number,
          delivery_complement: order.shipping_address?.complement,
          delivery_neighborhood: order.shipping_address?.neighborhood,
          delivery_city: order.shipping_address?.city,
          delivery_state: order.shipping_address?.state,
          delivery_zipcode: order.shipping_address?.zip_code,
          delivery_country: order.shipping_address?.country,
          // Campos de negócio
          subtotal: order.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0).toString(),
          shipping_cost: order.shipping_cost?.toString(),
          total: order.total.toString(),
          order_status: order.order_status,
          shipping_status: order.shipping_status,
          payment_method: order.payment_method,
          shipping_method: order.shipping_method
        };
      });

      setParsedOrders(convertedOrders);
      
      // Gerar notificação com estatísticas
      toast.success(
        `📊 ${result.orders.length} pedidos processados: ` +
        `${result.validation.stats.validOrders} válidos, ` +
        `${result.validation.warnings.length} avisos, ` +
        `${result.validation.errors.length} erros`,
        { duration: 8000 }
      );

      // Mostrar preview
      setShowPreview(true);
      setShowIntelligentPreview(true);

    } catch (error) {
      console.error('[ImportOrders] Erro ao processar arquivo:', error);
      toast.error(`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setCsvLoading(false);
      event.target.value = ''; // Reset file input
    }
  };

  // Função para detectar duplicados
  const detectDuplicates = async (orders: ParsedOrder[]): Promise<{
    duplicates: Array<{
      tracking_code: string;
      existing_order: {
        id: string;
        tracking_code: string;
        customer_name: string;
        customer_email: string;
        created_at: string;
      };
      new_order: ParsedOrder;
    }>;
    warnings: string[];
  }> => {
    const duplicates: Array<{
      tracking_code: string;
      existing_order: {
        id: string;
        tracking_code: string;
        customer_name: string;
        customer_email: string;
        created_at: string;
      };
      new_order: ParsedOrder;
    }> = [];
    const warnings: string[] = [];

    try {
      // Buscar pedidos existentes pelos códigos de rastreio
      const trackingCodes = orders.map(order => order.tracking_code).filter(code => code);
      const uniqueTrackingCodes = [...new Set(trackingCodes)];

      if (uniqueTrackingCodes.length > 0) {
        const { data: existingOrders, error } = await supabase
          .from('orders')
          .select('id, tracking_code, customer_name, customer_email, created_at')
          .eq('user_id', user?.id)
          .in('tracking_code', uniqueTrackingCodes);

        if (error) {
          console.error('Error checking duplicates:', error);
          warnings.push('Não foi possível verificar duplicatas devido a um erro na consulta');
          return { duplicates, warnings };
        }

        // Mapear pedidos existentes por código de rastreio
        const existingOrdersMap = new Map(
          existingOrders?.map(order => [order.tracking_code, order]) || []
        );

        // Verificar duplicatas
        for (const order of orders) {
          const existingOrder = existingOrdersMap.get(order.tracking_code);
          if (existingOrder) {
            duplicates.push({
              tracking_code: order.tracking_code,
              existing_order: {
                id: existingOrder.id,
                tracking_code: existingOrder.tracking_code,
                customer_name: existingOrder.customer_name,
                customer_email: existingOrder.customer_email,
                created_at: existingOrder.created_at
              },
              new_order: order
            });
          }
        }
      }

      // Verificar duplicatas dentro do próprio arquivo
      const trackingCodeCount = new Map<string, number>();
      for (const order of orders) {
        const count = trackingCodeCount.get(order.tracking_code) || 0;
        trackingCodeCount.set(order.tracking_code, count + 1);
      }

      const internalDuplicates = Array.from(trackingCodeCount.entries())
        .filter(([code, count]) => count > 1)
        .map(([code, count]) => `${code} aparece ${count} vezes no arquivo`);

      if (internalDuplicates.length > 0) {
        warnings.push(`Duplicatas no arquivo: ${internalDuplicates.join(', ')}`);
      }

    } catch (error) {
      console.error('Error in duplicate detection:', error);
      warnings.push('Erro ao verificar duplicatas');
    }

    return { duplicates, warnings };
  };
  async function retryWithBackoff(fn, maxRetries = 4, initialDelay = 800) {
    let attempt = 0;
    let lastError;
    let delay = initialDelay;
    while (attempt < maxRetries) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        attempt++;
        if (attempt < maxRetries) {
          await new Promise(res => setTimeout(res, delay));
          delay *= 2;
        }
      }
    }
    throw lastError;
  }

  // Função de importação em chunks para grandes volumes
  const executeImport = async () => {
    setLoading(true);
    handleClosePreview(); // Fechar preview de forma segura

    try {
      const validOrders = parsedOrders.filter(order => order.status !== 'invalid');
      const CHUNK_SIZE = 100;
      let totalImported = 0;
      let allInserted: unknown[] = [];
      let allHistory: unknown[] = [];

      if (validOrders.length === 0) {
        toast.error("Nenhum pedido válido para importar.");
        setLoading(false);
        return;
      }

      // Inicializar métricas
      const startTime = new Date();
      const totalChunks = Math.ceil(validOrders.length / CHUNK_SIZE);
      const metrics: ImportMetrics = {
        totalOrders: validOrders.length,
        processedOrders: 0,
        successfulImports: 0,
        failedImports: 0,
        warningImports: 0,
        startTime,
        currentChunk: 0,
        totalChunks,
        averageProcessingTime: 0,
        networkRequests: 0,
        errors: [],
        warnings: []
      };

      setImportMetrics(metrics);
      setShowMetrics(true);

      let totalProcessingTime = 0;
      let chunkCount = 0;

      for (let i = 0; i < validOrders.length; i += CHUNK_SIZE) {
        const chunkStartTime = Date.now();
        const chunk = validOrders.slice(i, i + CHUNK_SIZE);
        metrics.currentChunk = Math.floor(i / CHUNK_SIZE) + 1;

        const ordersToInsert = chunk.map(order => ({
          user_id: user.id,
          tracking_code: order.tracking_code,
          customer_name: order.customer_name,
          customer_email: order.customer_email,
          customer_phone: order.customer_phone || null,
          carrier: order.carrier,
          status: 'pending' as const,
          // Campos adicionais do CSV aprimorado
          order_value: order.order_value ? parseFloat(order.order_value) : null,
          destination: order.destination || null,
          order_date: order.order_date ? new Date(order.order_date.split('/').reverse().join('-')).toISOString() : null,
          estimated_delivery: order.estimated_delivery ? new Date(order.estimated_delivery.split('/').reverse().join('-')).toISOString() : null,
          product_name: order.product_name || null,
          quantity: order.quantity ? parseInt(order.quantity) : null,
          order_number: order.order_number || null,
          notes: order.notes || null,
          // Campos NuvemShop adicionais
          cpf_cnpj: order.cpf_cnpj || null,
          payment_method: order.payment_method || null,
          payment_status: order.payment_status || null,
          order_status: order.order_status || null,
          shipping_status: order.shipping_status || null,
          subtotal: order.subtotal ? parseFloat(order.subtotal) : null,
          discount: order.discount ? parseFloat(order.discount) : null,
          shipping_cost: order.shipping_cost ? parseFloat(order.shipping_cost) : null,
          product_value: order.product_value ? parseFloat(order.product_value) : null,
          sku: order.sku || null,
          channel: order.channel || null,
          seller: order.seller || null,
          payment_date: order.payment_date ? new Date(order.payment_date.split('/').reverse().join('-')).toISOString() : null,
          shipping_date: order.shipping_date ? new Date(order.shipping_date.split('/').reverse().join('-')).toISOString() : null,
          transaction_id: order.transaction_id || null,
          physical_product: order.physical_product || null,
          cancellation_date: order.cancellation_date ? new Date(order.cancellation_date).toISOString() : null,
          cancellation_reason: order.cancellation_reason || null,
          // Campos de endereço NuvemShop
          delivery_address: order.delivery_address || null,
          delivery_number: order.delivery_number || null,
          delivery_complement: order.delivery_complement || null,
          delivery_neighborhood: order.delivery_neighborhood || null,
          delivery_city: order.delivery_city || null,
          delivery_state: order.delivery_state || null,
          delivery_zipcode: order.delivery_zipcode || null,
          delivery_country: order.delivery_country || null,
        }));

        // Retry logic para inserção no Supabase
        const { data, error } = await retryWithBackoff(
          async () => {
            const result = await supabase
              .from("orders")
              .insert(ordersToInsert)
              .select();
            if (result.error) throw result.error;
            return result;
          },
          4,
          800
        );

        const chunkEndTime = Date.now();
        const chunkProcessingTime = chunkEndTime - chunkStartTime;
        totalProcessingTime += chunkProcessingTime;
        chunkCount++;

        metrics.averageProcessingTime = totalProcessingTime / chunkCount;
        metrics.networkRequests += 1;

        if (data) {
          allInserted = allInserted.concat(data);
          totalImported += data.length;
          metrics.processedOrders += data.length;
          metrics.successfulImports += data.length;

          // Registrar histórico
          const historyEntries = data.map(order => ({
            order_id: order.id,
            user_id: user.id,
            new_status: 'pending',
            notes: 'Pedido importado via CSV'
          }));
          allHistory = allHistory.concat(historyEntries);

          await retryWithBackoff(
            async () => {
              const result = await supabase.from("order_history").insert(historyEntries);
              if (result.error) throw result.error;
              return result;
            },
            3,
            600
          );
        } else {
          // Contabilizar erros
          metrics.failedImports += chunk.length;
          metrics.processedOrders += chunk.length;

          // Adicionar erro às métricas
          const errorEntry = metrics.errors.find(e => e.code === 'INSERT_FAILED');
          if (errorEntry) {
            errorEntry.count += chunk.length;
          } else {
            metrics.errors.push({
              code: 'INSERT_FAILED',
              message: 'Falha ao inserir pedidos no banco de dados',
              count: chunk.length
            });
          }
        }

        // Atualizar métricas em tempo real
        setImportMetrics({ ...metrics });

        // Feedback de progresso
        toast.info(`Chunk ${metrics.currentChunk}/${metrics.totalChunks}: ${chunk.length} pedidos processados...`);

        // Pequeno delay para UI respirar
        await new Promise(res => setTimeout(res, 100));
      }

      // Calcular métricas finais
      const endTime = new Date();
      const totalTime = (endTime.getTime() - startTime.getTime()) / 1000;

      metrics.estimatedEndTime = endTime;
      metrics.averageProcessingTime = totalProcessingTime / chunkCount;

      // Contabilizar avisos dos pedidos originais
      metrics.warningImports = parsedOrders.filter(o => o.status === 'warning').length;

      // Adicionar avisos às métricas
      const warningsByType = parsedOrders
        .filter(o => o.warnings.length > 0)
        .flatMap(o => o.warnings)
        .reduce((acc, warning) => {
          acc[warning] = (acc[warning] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      metrics.warnings = Object.entries(warningsByType).map(([message, count]) => ({
        code: 'VALIDATION_WARNING',
        message,
        count
      }));

      setImportMetrics({ ...metrics });

      const result: ImportResult = {
        success: totalImported,
        errors: parsedOrders.filter(o => o.status === 'invalid').length,
        warnings: parsedOrders.filter(o => o.status === 'warning').length,
        details: parsedOrders.map(order => ({
          tracking_code: order.tracking_code,
          status: order.status === 'invalid' ? 'error' : order.status === 'warning' ? 'warning' : 'success',
          message: order.errors.length > 0 ? order.errors.join(', ') :
                  order.warnings.length > 0 ? order.warnings.join(', ') : 'OK'
        }))
      };

      setImportResult(result);
      setShowResults(true);

      toast.success(`${totalImported} pedidos importados com sucesso em ${totalTime.toFixed(1)}s!`);
      
      // Mostrar notificação push se suportada
      showImportNotification(result, totalTime);
      
      setParsedOrders([]);
    } catch (error) {
      console.error("Error importing orders:", error);
      toast.error("Erro ao importar pedidos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1 pt-20 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl space-y-12">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-8 border-b">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-bold">Importar Pedidos</h1>
              <p className="text-muted-foreground text-base">
                Adicione pedidos manualmente ou importe em lote via CSV
              </p>
            </div>
            <Link to="/dashboard">
              <Button variant="outline" className="flex items-center gap-2 whitespace-nowrap">
                <ArrowLeft className="h-4 w-4" />
                Voltar ao Dashboard
              </Button>
            </Link>
          </div>

          {/* Import Methods */}
          <div className="grid lg:grid-cols-2 gap-10">
            {/* CSV Upload */}
            <Card className="hover:shadow-lg transition-all duration-300">
              <CardHeader className="space-y-5">
                <div className="p-4 rounded-lg bg-primary/10 w-fit mb-2">
                  <Upload className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Importar via CSV ou Excel</CardTitle>
                  <CardDescription className="mt-3 text-base">
                    Carregue um arquivo CSV ou Excel (.xlsx, .xls) com múltiplos pedidos de uma vez
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-smooth">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-upload"
                    disabled={csvLoading}
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="font-medium mb-2">
                      {csvLoading ? "Importando..." : "Arraste um arquivo CSV ou Excel aqui"}
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">ou clique para selecionar (.csv, .xlsx, .xls)</p>
                    <Button variant="outline" asChild disabled={csvLoading}>
                      <span>{csvLoading ? "Processando..." : "Selecionar Arquivo"}</span>
                    </Button>
                  </label>
                </div>
                
                <div className="pt-4 border-t">
                  <Button variant="ghost" className="w-full" onClick={downloadCSVTemplate}>
                    <Download className="mr-2 h-4 w-4" />
                    Baixar Modelo CSV
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Use nosso modelo para garantir a formatação correta
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* API Integration */}
            <Card className="hover:shadow-lg transition-all duration-300">
              <CardHeader className="space-y-5">
                <div className="p-4 rounded-lg bg-secondary/10 w-fit mb-2">
                  <FileText className="h-7 w-7 text-secondary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Integração via API</CardTitle>
                  <CardDescription className="mt-3 text-base">
                    Conecte sua loja virtual para sincronização automática
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                {shopify.config ||
                 woocommerce.config ||
                 mercadolivre.config ? (
                  <>
                    <div className="space-y-3">
                      {/* Shopify */}
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <img src="https://cdn.shopify.com/s/files/1/0070/7032/files/shopify-icon-64x64.png" className="h-8 w-8" alt="Shopify" />
                          <div>
                            <div className="font-medium">Shopify</div>
                            <div className="text-sm text-muted-foreground">
                              {shopify.config ? 'Conectado' : 'Não conectado'}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={connectShopify}
                            disabled={shopify.config !== null || shopify.isConnecting}
                          >
                            {shopify.config ? 'Conectado' : shopify.isConnecting ? 'Conectando...' : 'Conectar'}
                          </Button>
                          {shopify.config && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={importShopifyOrders}
                              disabled={shopify.isImporting}
                            >
                              {shopify.isImporting ? 'Importando...' : 'Importar Pedidos'}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* WooCommerce */}
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z"/>
                          </svg>
                          <div>
                            <div className="font-medium">WooCommerce</div>
                            <div className="text-sm text-muted-foreground">
                              {woocommerce.config ? 'Conectado' : 'Não conectado'}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={connectWooCommerce}
                            disabled={woocommerce.config !== null || woocommerce.isConnecting}
                          >
                            {woocommerce.config ? 'Conectado' : woocommerce.isConnecting ? 'Conectando...' : 'Conectar'}
                          </Button>
                          {woocommerce.config && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={importWooCommerceOrders}
                              disabled={woocommerce.isImporting}
                            >
                              {woocommerce.isImporting ? 'Importando...' : 'Importar Pedidos'}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Mercado Livre */}
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z"/>
                          </svg>
                          <div>
                            <div className="font-medium">Mercado Livre</div>
                            <div className="text-sm text-muted-foreground">
                              {mercadolivre.config ? 'Conectado' : 'Não conectado'}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={connectMercadoLivre}
                            disabled={mercadolivre.config !== null || mercadolivre.isConnecting}
                          >
                            {mercadolivre.config ? 'Conectado' : mercadolivre.isConnecting ? 'Conectando...' : 'Conectar'}
                          </Button>
                          {mercadolivre.config && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={importMercadoLivreOrders}
                              disabled={mercadolivre.isImporting}
                            >
                              {mercadolivre.isImporting ? 'Importando...' : 'Importar Pedidos'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t">
                      <Button variant="ghost" className="w-full">
                        Ver Documentação da API
                      </Button>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    variant="integrations"
                    title="Nenhuma integração configurada"
                    description="Conecte sua loja virtual para importar pedidos automaticamente e manter seu catálogo sempre atualizado com dados em tempo real."
                    actions={[
                      {
                        label: "Configurar Shopify",
                        onClick: connectShopify,
                        variant: "outline",
                        icon: Globe
                      },
                      {
                        label: "Configurar WooCommerce",
                        onClick: connectWooCommerce,
                        variant: "outline",
                        icon: Globe
                      },
                      {
                        label: "Configurar Mercado Livre",
                        onClick: connectMercadoLivre,
                        variant: "outline",
                        icon: Globe
                      }
                    ]}
                    badge={{ text: "Integrações", variant: "secondary" }}
                    metrics={[
                      { label: "Lojas Conectadas", value: "0", icon: Globe },
                      { label: "Pedidos Automáticos", value: "0", icon: RefreshCw },
                      { label: "Sincronização", value: "Manual", icon: Upload }
                    ]}
                    tips={[
                      "Conecte pelo menos uma plataforma de e-commerce",
                      "A sincronização automática economiza tempo",
                      "Integrações garantem dados sempre atualizados"
                    ]}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Manual Entry */}
          <Card className="hover:shadow-lg transition-all duration-300">
            <CardHeader className="space-y-5">
              <div className="p-4 rounded-lg bg-accent/10 w-fit mb-2">
                <Plus className="h-7 w-7 text-accent" />
              </div>
              <div>
                <CardTitle className="text-2xl">Adicionar Pedido Manualmente</CardTitle>
                <CardDescription className="mt-3 text-base">
                  Insira as informações do pedido para começar o rastreamento
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-8">
              {loading ? (
                <SkeletonForm />
              ) : (
                <form onSubmit={handleManualSubmit} className="space-y-10">
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className="space-y-2">
                      <Label htmlFor="trackingCode">Código de Rastreio *</Label>
                      <Input
                        id="trackingCode"
                        placeholder="BR123456789BR"
                        value={manualOrder.trackingCode}
                        onChange={(e) => setManualOrder({ ...manualOrder, trackingCode: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="carrier">Transportadora *</Label>
                      <select
                        id="carrier"
                        value={manualOrder.carrier}
                        onChange={(e) => setManualOrder({ ...manualOrder, carrier: e.target.value })}
                        className="w-full px-3 py-2 rounded-md border bg-background"
                        required
                      >
                        <option value="">Selecione...</option>
                        <option value="Correios">Correios</option>
                        <option value="Jadlog">Jadlog</option>
                        <option value="Total Express">Total Express</option>
                        <option value="Azul Cargo">Azul Cargo</option>
                        <option value="Loggi">Loggi</option>
                      </select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="customerName">Nome do Cliente *</Label>
                      <Input
                        id="customerName"
                        placeholder="João Silva"
                        value={manualOrder.customerName}
                        onChange={(e) => setManualOrder({ ...manualOrder, customerName: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="customerEmail">E-mail do Cliente *</Label>
                      <Input
                        id="customerEmail"
                        type="email"
                        placeholder="joao@email.com"
                        value={manualOrder.customerEmail}
                        onChange={(e) => setManualOrder({ ...manualOrder, customerEmail: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="customerPhone">Telefone (WhatsApp)</Label>
                      <Input
                        id="customerPhone"
                        placeholder="(11) 98765-4321"
                        value={manualOrder.customerPhone}
                        onChange={(e) => setManualOrder({ ...manualOrder, customerPhone: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-4 pt-8 border-t">
                    <Button type="button" variant="outline" size="lg" className="h-12 px-8">
                      Limpar
                    </Button>
                    <Button type="submit" variant="hero" disabled={loading} size="lg" className="h-12 px-8">
                      <Plus className="mr-2 h-5 w-5" />
                      {loading ? "Adicionando..." : "Adicionar Pedido"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card className="bg-muted/30 hover:shadow-lg transition-all duration-300">
            <CardHeader className="space-y-5">
              <CardTitle className="text-2xl flex items-center gap-3">
                <span className="text-3xl">📋</span>
                Guia Completo de Importação CSV/Excel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-10">
                <div>
                  <h4 className="font-medium mb-4 text-primary text-lg flex items-center gap-2">
                    <span>📄</span>
                    Estrutura do Arquivo CSV
                  </h4>
                  <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800 mb-2">
                      <strong>Formatos suportados:</strong> CSV (UTF-8, separador: vírgula), Excel (.xlsx, .xls)
                    </p>
                    <p className="text-sm text-blue-800 mb-2">
                      <strong>Estrutura:</strong> Primeira linha como cabeçalho, dados a partir da segunda linha
                    </p>
                    <div className="font-mono text-xs bg-white p-2 rounded border">
                      tracking_code*,customer_name*,customer_email*,carrier,customer_phone,order_value,destination,order_date,estimated_delivery,product_name,quantity,order_number,notes
                    </div>
                    <p className="text-xs text-blue-600 mt-2">
                      * Campos obrigatórios | Outros campos são opcionais
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-4 text-primary text-lg flex items-center gap-2">
                    <span>📊</span>
                    Campos Suportados - Compatível com NuvemShop
                  </h4>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                          <strong className="text-red-700">Obrigatórios:</strong>
                        </div>
                        <ul className="text-sm space-y-1 ml-4">
                          <li><code className="bg-muted px-1 rounded">tracking_code</code> - Código de rastreio</li>
                          <li><code className="bg-muted px-1 rounded">customer_name</code> - Nome do cliente</li>
                          <li><code className="bg-muted px-1 rounded">customer_email</code> - Email do cliente</li>
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          <strong className="text-blue-700">Cliente & Contato:</strong>
                        </div>
                        <ul className="text-sm space-y-1 ml-4">
                          <li><code className="bg-muted px-1 rounded">customer_phone</code> - Telefone/WhatsApp</li>
                          <li><code className="bg-muted px-1 rounded">cpf_cnpj</code> - CPF/CNPJ (válida automaticamente)</li>
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          <strong className="text-green-700">Pedido & Valores:</strong>
                        </div>
                        <ul className="text-sm space-y-1 ml-4">
                          <li><code className="bg-muted px-1 rounded">order_number</code> - Número do pedido</li>
                          <li><code className="bg-muted px-1 rounded">order_value</code> - Valor total</li>
                          <li><code className="bg-muted px-1 rounded">subtotal</code> - Subtotal</li>
                          <li><code className="bg-muted px-1 rounded">discount</code> - Desconto</li>
                          <li><code className="bg-muted px-1 rounded">shipping_cost</code> - Valor do frete</li>
                        </ul>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                          <strong className="text-purple-700">Produto & Quantidade:</strong>
                        </div>
                        <ul className="text-sm space-y-1 ml-4">
                          <li><code className="bg-muted px-1 rounded">product_name</code> - Nome do produto</li>
                          <li><code className="bg-muted px-1 rounded">product_value</code> - Valor unitário</li>
                          <li><code className="bg-muted px-1 rounded">quantity</code> - Quantidade</li>
                          <li><code className="bg-muted px-1 rounded">sku</code> - SKU do produto</li>
                          <li><code className="bg-muted px-1 rounded">physical_product</code> - Produto físico (Sim/Não)</li>
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                          <strong className="text-orange-700">Envio & Logística:</strong>
                        </div>
                        <ul className="text-sm space-y-1 ml-4">
                          <li><code className="bg-muted px-1 rounded">carrier</code> - Transportadora</li>
                          <li><code className="bg-muted px-1 rounded">order_status</code> - Status do pedido</li>
                          <li><code className="bg-muted px-1 rounded">shipping_status</code> - Status do envio</li>
                          <li><code className="bg-muted px-1 rounded">channel</code> - Canal de venda</li>
                          <li><code className="bg-muted px-1 rounded">seller</code> - Vendedor</li>
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                          <strong className="text-teal-700">Endereço Completo:</strong>
                        </div>
                        <ul className="text-sm space-y-1 ml-4">
                          <li><code className="bg-muted px-1 rounded">delivery_address</code> - Endereço</li>
                          <li><code className="bg-muted px-1 rounded">delivery_number</code> - Número</li>
                          <li><code className="bg-muted px-1 rounded">delivery_complement</code> - Complemento</li>
                          <li><code className="bg-muted px-1 rounded">delivery_neighborhood</code> - Bairro</li>
                          <li><code className="bg-muted px-1 rounded">delivery_city</code> - Cidade</li>
                          <li><code className="bg-muted px-1 rounded">delivery_state</code> - Estado (UF)</li>
                          <li><code className="bg-muted px-1 rounded">delivery_zipcode</code> - CEP</li>
                          <li><code className="bg-muted px-1 rounded">delivery_country</code> - País</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h5 className="font-medium text-blue-800 mb-2">🔄 Mapeamento Automático NuvemShop</h5>
                    <p className="text-sm text-blue-700 mb-3">
                      O sistema reconhece automaticamente os nomes dos campos da NuvemShop:
                    </p>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong className="text-blue-800">Campos NuvemShop → Sistema:</strong>
                        <ul className="mt-1 space-y-1 text-blue-600">
                          <li>"Código de rastreio do envio" → tracking_code</li>
                          <li>"Nome do comprador" → customer_name</li>
                          <li>"Nome para a entrega" → customer_name</li>
                          <li>"CPF / CNPJ" → cpf_cnpj</li>
                          <li>"Telefone para a entrega" → customer_phone</li>
                          <li>"Forma de Entrega" → carrier</li>
                          <li>"Total" → order_value</li>
                          <li>"Endereço" → delivery_address</li>
                          <li>"Número" → delivery_number</li>
                          <li>"Cidade" → delivery_city</li>
                          <li>"Estado" → delivery_state</li>
                          <li>"Código postal" → delivery_zipcode</li>
                        </ul>
                      </div>
                      <div>
                        <strong className="text-blue-800">Validações Especiais:</strong>
                        <ul className="mt-1 space-y-1 text-blue-600">
                          <li>✅ CPF/CNPJ brasileiro válido</li>
                          <li>✅ CEP com 8 dígitos</li>
                          <li>✅ Estados brasileiros (UF)</li>
                          <li>✅ Endereços completos</li>
                          <li>✅ Transportadoras por código</li>
                          <li>✅ Formatos de data/hora</li>
                          <li>✅ Valores monetários</li>
                          <li>✅ Emails válidos</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-4 text-primary text-lg flex items-center gap-2">
                    <span>🚚</span>
                    Códigos de Rastreio por Transportadora
                  </h4>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <div className="font-medium text-sm mb-1">📮 Correios</div>
                      <div className="text-xs space-y-1">
                        <div>BR123456789BR</div>
                        <div>BR123456789BR (11+BR)</div>
                      </div>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <div className="font-medium text-sm mb-1">📦 Jadlog</div>
                      <div className="text-xs space-y-1">
                        <div>JD123456789012</div>
                        <div>JD1234567890123 (12-14 díg)</div>
                      </div>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <div className="font-medium text-sm mb-1">🚛 Total Express</div>
                      <div className="text-xs space-y-1">
                        <div>TE123456789BR</div>
                        <div>TE123456789BR (11+BR)</div>
                      </div>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <div className="font-medium text-sm mb-1">✈️ Azul Cargo</div>
                      <div className="text-xs space-y-1">
                        <div>AC123456789BR</div>
                        <div>AC123456789BR (11+BR)</div>
                      </div>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <div className="font-medium text-sm mb-1">🏍️ Loggi</div>
                      <div className="text-xs space-y-1">
                        <div>LG123456789BR</div>
                        <div>LG123456789BR (11+BR)</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-4 text-primary text-lg flex items-center gap-2">
                    <span>📝</span>
                    Formatação de Dados
                  </h4>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                      <h5 className="font-medium text-amber-800 mb-3 text-base">✅ Formatos Aceitos</h5>
                      <ul className="text-sm text-amber-700 space-y-2">
                        <li><strong>Datas:</strong> 15/10/2024 ou 2024-10-15</li>
                        <li><strong>Valores:</strong> 299.90 (ponto como decimal)</li>
                        <li><strong>Telefones:</strong> (11) 98765-4321</li>
                        <li><strong>Emails:</strong> usuario@dominio.com</li>
                      </ul>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <h5 className="font-medium text-red-800 mb-3 text-base">❌ Evite Estes Erros</h5>
                      <ul className="text-sm text-red-700 space-y-2">
                        <li>• Códigos de rastreio inválidos</li>
                        <li>• Emails mal formatados</li>
                        <li>• Datas em formato incorreto</li>
                        <li>• Valores com vírgula como decimal</li>
                        <li>• Arquivos sem cabeçalhos</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-4 text-primary text-lg flex items-center gap-2">
                    <span>🔄</span>
                    Processo de Importação
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary">1</div>
                      <div>
                        <div className="font-medium">Baixe o Modelo</div>
                        <div className="text-sm text-muted-foreground">Use nosso modelo CSV completo com exemplos reais</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary">2</div>
                      <div>
                        <div className="font-medium">Preencha os Dados</div>
                        <div className="text-sm text-muted-foreground">Siga exatamente a estrutura do cabeçalho</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary">3</div>
                      <div>
                        <div className="font-medium">Faça Upload</div>
                        <div className="text-sm text-muted-foreground">O sistema fará o mapeamento automático dos campos</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary">4</div>
                      <div>
                        <div className="font-medium">Revise e Importe</div>
                        <div className="text-sm text-muted-foreground">Verifique erros e avisos antes de confirmar</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-800 mb-4 text-base flex items-center gap-2">
                    <span>💡</span>
                    Dicas para Importação Bem-Sucedida
                  </h4>
                  <ul className="text-sm text-green-700 space-y-2">
                    <li>• Sempre use o preview antes de importar para verificar erros</li>
                    <li>• O sistema detecta automaticamente a transportadora pelos códigos</li>
                    <li>• Campos vazios são ignorados (exceto obrigatórios)</li>
                    <li>• Use aspas duplas para textos que contenham vírgulas</li>
                    <li>• Salve o arquivo em UTF-8 para caracteres especiais</li>
                    <li>• Teste primeiro com poucos registros para validar</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

          {/* Import History - Componente Real com Rollback */}
          <ImportHistory />

          {/* Import Metrics Dashboard */}
          {showMetrics && (
            <ImportMetricsDashboard
              metrics={importMetrics}
              isImporting={loading}
              onExportReport={() => {
                // TODO: Implementar exportação de relatório
                toast.info("Funcionalidade de exportação será implementada em breve");
              }}
              onViewDetails={() => setShowResults(true)}
            />
          )}

          {/* Preview Modal */}
          <Dialog open={showPreview} onOpenChange={handleClosePreview}>
            <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] overflow-hidden flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle className="flex items-center gap-2 text-2xl">
                  <Eye className="h-6 w-6" />
                  Preview da Importação
                </DialogTitle>
                <DialogDescription className="text-base">
                  Revise os dados antes de confirmar a importação. {parsedOrders.length} pedidos encontrados.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                {/* 🆕 Informações de Detecção Inteligente */}
                {showIntelligentPreview && processingResult && (
                  <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-xl font-bold text-blue-900 flex items-center gap-2 mb-2">
                          <CheckCircle className="w-6 h-6 text-blue-600" />
                          Detecção Automática
                        </h4>
                        <p className="text-base text-blue-700">
                          Sistema identificou automaticamente o formato do arquivo
                        </p>
                      </div>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300 text-lg px-4 py-2">
                        {processingResult.detection.confidence}% confiança
                      </Badge>
                    </div>
                  
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-blue-600 uppercase">Plataforma</div>
                      <div className="font-semibold text-blue-900 text-lg">
                        {processingResult.detection.platform === 'nuvemshop' ? '🛒 NuvemShop' :
                         processingResult.detection.platform === 'shopify' ? '🛍️ Shopify' :
                         processingResult.detection.platform === 'mercadolivre' ? '🏪 Mercado Livre' :
                         '📦 Formato Personalizado'}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-blue-600 uppercase">Headers Detectados</div>
                      <div className="font-semibold text-blue-900 text-xl">
                        {processingResult.detection.matchedHeaders.length} de {processingResult.detection.matchedHeaders.length} campos
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-blue-600 uppercase">Validação</div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-base px-3 py-1">
                          {processingResult.validation.stats.validOrders} válidos
                        </Badge>
                        {processingResult.validation.warnings.length > 0 && (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 text-base px-3 py-1">
                            {processingResult.validation.warnings.length} avisos
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {processingResult.detection.suggestions && processingResult.detection.suggestions.length > 0 && (
                    <Alert className="mt-4 border-blue-300 bg-blue-50">
                      <AlertTriangle className="h-5 w-5 text-blue-600" />
                      <AlertDescription className="text-base text-blue-800">
                        <strong>Sugestões:</strong> {processingResult.detection.suggestions.join('. ')}
                      </AlertDescription>
                    </Alert>
                  )}
                  </div>
                )}

                <div className="space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="text-center p-6 bg-green-50 rounded-lg border-2 border-green-200">
                      <div className="text-5xl font-bold text-green-600 mb-2">
                        {parsedOrders.filter(o => o.status === 'valid').length}
                      </div>
                      <div className="text-base text-green-700 font-semibold">Válidos</div>
                      <div className="text-sm text-green-600 mt-2">
                        {parsedOrders.length > 0 ? Math.round((parsedOrders.filter(o => o.status === 'valid').length / parsedOrders.length) * 100) : 0}% do total
                      </div>
                    </div>
                  <div className="text-center p-6 bg-yellow-50 rounded-lg border-2 border-yellow-200">
                    <div className="text-5xl font-bold text-yellow-600 mb-2">
                      {parsedOrders.filter(o => o.status === 'warning').length}
                    </div>
                    <div className="text-base text-yellow-700 font-semibold">Com Avisos</div>
                    <div className="text-sm text-yellow-600 mt-2">
                      Precisam atenção
                    </div>
                  </div>
                  <div className="text-center p-6 bg-red-50 rounded-lg border-2 border-red-200">
                    <div className="text-5xl font-bold text-red-600 mb-2">
                      {parsedOrders.filter(o => o.status === 'invalid').length}
                    </div>
                    <div className="text-base text-red-700 font-semibold">Inválidos</div>
                    <div className="text-sm text-red-600 mt-2">
                      Não podem ser importados
                    </div>
                  </div>
                  <div className="text-center p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
                    <div className="text-5xl font-bold text-blue-600 mb-2">
                      {parsedOrders.length}
                    </div>
                    <div className="text-base text-blue-700 font-semibold">Total</div>
                    <div className="text-sm text-blue-600 mt-2">
                      Pedidos processados
                    </div>
                  </div>
                </div>

                {/* Field Mapping Summary */}
                <div className="bg-muted/30 p-6 rounded-lg border-2">
                  <h4 className="text-lg font-semibold mb-4 text-muted-foreground flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Mapeamento de Campos Detectado
                  </h4>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 text-base">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="font-semibold">Campos Obrigatórios:</span>
                      </div>
                      <div className="ml-7 space-y-2">
                        <div className="flex justify-between">
                          <span>Código de Rastreio</span>
                          <Badge variant="secondary" className="text-sm">
                            {parsedOrders.filter(o => o.tracking_code).length}/{parsedOrders.length}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Nome do Cliente</span>
                          <Badge variant="secondary" className="text-sm">
                            {parsedOrders.filter(o => o.customer_name).length}/{parsedOrders.length}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Email do Cliente</span>
                          <Badge variant="secondary" className="text-sm">
                            {parsedOrders.filter(o => o.customer_email).length}/{parsedOrders.length}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                        <span className="font-semibold">Campos Opcionais:</span>
                      </div>
                      <div className="ml-7 space-y-2">
                        <div className="flex justify-between">
                          <span>Telefone</span>
                          <Badge variant="outline" className="text-sm">
                            {parsedOrders.filter(o => o.customer_phone).length}/{parsedOrders.length}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Valor do Pedido</span>
                          <Badge variant="outline" className="text-sm">
                            {parsedOrders.filter(o => o.order_value).length}/{parsedOrders.length}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Produto</span>
                          <Badge variant="outline" className="text-sm">
                            {parsedOrders.filter(o => o.product_name).length}/{parsedOrders.length}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-purple-600" />
                        <span className="font-semibold">Transportadoras:</span>
                      </div>
                      <div className="ml-7 space-y-2">
                        {Array.from(new Set(parsedOrders.map(o => o.carrier).filter(c => c))).slice(0, 3).map(carrier => (
                          <div key={carrier} className="flex justify-between">
                            <span className="truncate mr-2">{carrier}</span>
                            <Badge variant="secondary" className="text-sm">
                              {parsedOrders.filter(o => o.carrier === carrier).length}
                            </Badge>
                          </div>
                        ))}
                        {Array.from(new Set(parsedOrders.map(o => o.carrier).filter(c => c))).length > 3 && (
                          <div className="text-sm text-muted-foreground">
                            +{Array.from(new Set(parsedOrders.map(o => o.carrier).filter(c => c))).length - 3} outras
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview Table or List of Orders */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-muted/30 p-6 rounded-lg border-2">
                    <h4 className="text-base font-semibold mb-3 text-muted-foreground">Transportadoras Detectadas</h4>
                    <div className="space-y-2">
                      {Array.from(new Set(parsedOrders.map(o => o.carrier).filter(c => c))).map(carrier => (
                        <div key={carrier} className="flex justify-between text-base">
                          <span>{carrier}</span>
                          <Badge variant="secondary" className="text-sm">
                            {parsedOrders.filter(o => o.carrier === carrier).length}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-muted/30 p-6 rounded-lg border-2">
                    <h4 className="text-base font-semibold mb-3 text-muted-foreground">Principais Problemas</h4>
                    <div className="space-y-2">
                      {parsedOrders.filter(o => o.errors.length > 0).length > 0 && (
                        <div className="flex justify-between text-red-600 text-base">
                          <span>Erros de validação</span>
                          <Badge variant="destructive">
                            {parsedOrders.filter(o => o.errors.length > 0).length}
                          </Badge>
                        </div>
                      )}
                      {parsedOrders.filter(o => o.warnings.length > 0).length > 0 && (
                        <div className="flex justify-between text-yellow-600">
                          <span>Avisos</span>
                          <Badge variant="secondary">
                            {parsedOrders.filter(o => o.warnings.length > 0).length}
                          </Badge>
                        </div>
                      )}
                      {parsedOrders.filter(o => !o.customer_email).length > 0 && (
                        <div className="flex justify-between text-orange-600">
                          <span>Sem e-mail</span>
                          <Badge variant="outline">
                            {parsedOrders.filter(o => !o.customer_email).length}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="border rounded-lg overflow-hidden bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-16">Status</TableHead>
                        <TableHead>Código de Rastreio</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>CPF/CNPJ</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Transportadora</TableHead>
                        <TableHead>Valor Total</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Qtde</TableHead>
                        <TableHead>Status Pedido</TableHead>
                        <TableHead>Status Envio</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>N° Pedido</TableHead>
                        <TableHead className="w-32">Problemas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="bg-background">
                      {parsedOrders.map((order, index) => (
                        <TableRow 
                          key={index} 
                          className="hover:bg-muted/30 bg-background"
                        >
                          <TableCell className="bg-inherit">
                            <div className="flex flex-col items-center gap-1">
                              {order.status === 'valid' && <CheckCircle className="w-5 h-5 text-green-600" />}
                              {order.status === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
                              {order.status === 'invalid' && <XCircle className="w-5 h-5 text-red-600" />}
                              <span className="text-xs font-medium">
                                {order.status === 'valid' ? 'OK' :
                                 order.status === 'warning' ? 'Aviso' : 'Erro'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="bg-inherit">
                            <div className="font-mono text-sm bg-muted px-2 py-1 rounded">
                              {order.tracking_code || <span className="text-muted-foreground italic">Não informado</span>}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium max-w-32 bg-inherit">
                            <div className="truncate" title={order.customer_name || 'Nome não informado'}>
                              {order.customer_name || <span className="text-muted-foreground italic">Nome não informado</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-mono bg-inherit">
                            {order.cpf_cnpj ? (
                              <span className={order.cpf_cnpj.replace(/\D/g, '').length === 11 ? 'text-blue-600' : 'text-purple-600'}>
                                {order.cpf_cnpj.replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ'}: {order.cpf_cnpj}
                              </span>
                            ) : <span className="text-muted-foreground italic">-</span>}
                          </TableCell>
                          <TableCell className="text-sm max-w-40 bg-inherit">
                            <div className="truncate" title={order.customer_email || 'Email não informado'}>
                              {order.customer_email || <span className="text-muted-foreground italic">Email não informado</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm bg-inherit">
                            {order.customer_phone && order.customer_phone.length >= 10 && order.customer_phone.length <= 11 && /^\d+$/.test(order.customer_phone) ? (
                              <span className="font-mono">{order.customer_phone}</span>
                            ) : (
                              <span className="text-muted-foreground italic">Telefone não informado</span>
                            )}
                          </TableCell>
                          <TableCell className="bg-inherit">
                            <Badge variant="outline" className="font-medium">
                              {order.carrier || <span className="text-muted-foreground italic">Não informado</span>}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-medium bg-inherit">
                            {order.order_value && !isNaN(parseFloat(order.order_value)) ? 
                              `R$ ${parseFloat(order.order_value).toFixed(2)}` : 
                              <span className="text-muted-foreground italic">Valor não informado</span>
                            }
                          </TableCell>
                          <TableCell className="text-sm max-w-40 bg-inherit">
                            <div className="truncate" title={order.product_name || 'Produto não informado'}>
                              {order.product_name || <span className="text-muted-foreground italic">Produto não informado</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-center bg-inherit">
                            {order.quantity || <span className="text-muted-foreground italic">-</span>}
                          </TableCell>
                          <TableCell className="bg-inherit">
                            <Badge variant={order.order_status ? "secondary" : "outline"} className="text-xs">
                              {order.order_status || <span className="text-muted-foreground italic">-</span>}
                            </Badge>
                          </TableCell>
                          <TableCell className="bg-inherit">
                            <Badge variant={order.shipping_status ? "secondary" : "outline"} className="text-xs">
                              {order.shipping_status || <span className="text-muted-foreground italic">-</span>}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm max-w-24 bg-inherit">
                            <div className="truncate" title={order.delivery_city || 'Cidade não informada'}>
                              {order.delivery_city || <span className="text-muted-foreground italic">Não informado</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-mono max-w-24 bg-inherit">
                            <div className="truncate" title={order.order_number || 'Pedido não informado'}>
                              {order.order_number || <span className="text-muted-foreground italic">-</span>}
                            </div>
                          </TableCell>
                          <TableCell className="bg-inherit">
                            <div className="space-y-1 max-w-32">
                              {order.errors.map((error, i) => (
                                <div key={i} className="text-xs text-red-600 flex items-start gap-1">
                                  <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  <span className="break-words">{error}</span>
                                </div>
                              ))}
                              {order.warnings.map((warning, i) => (
                                <div key={i} className="text-xs text-yellow-600 flex items-start gap-1">
                                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  <span className="break-words">{warning}</span>
                                </div>
                              ))}
                              {order.errors.length === 0 && order.warnings.length === 0 && (
                                <div className="text-xs text-green-600 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Tudo OK
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t mt-6">
                  <Button variant="outline" onClick={handleClosePreview} size="lg">
                    Cancelar
                  </Button>
                  <Button
                    onClick={executeImport}
                    disabled={loading || parsedOrders.filter(o => o.status === 'valid').length === 0}
                    size="lg"
                    className="min-w-[200px]"
                  >
                    {loading ? "Importando..." : `Importar ${parsedOrders.filter(o => o.status === 'valid').length} Pedidos`}
                  </Button>
                </div>
                </div> {/* Fecha space-y-6 */}
              </div> {/* Fecha flex-1 overflow-y-auto */}
            </DialogContent>
          </Dialog>

          {/* Results Modal */}
          <Dialog open={showResults} onOpenChange={setShowResults}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Resultado da Importação</DialogTitle>
                <DialogDescription>
                  Importação concluída. Veja os detalhes abaixo.
                </DialogDescription>
              </DialogHeader>

              {importResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{importResult.success}</div>
                      <div className="text-sm text-green-700">Importados</div>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">{importResult.warnings}</div>
                      <div className="text-sm text-yellow-700">Com Avisos</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{importResult.errors}</div>
                      <div className="text-sm text-red-700">Erros</div>
                    </div>
                  </div>

                  {importResult.details.some(d => d.status !== 'success') && (
                    <div className="border rounded-lg p-4 max-h-40 overflow-y-auto">
                      <h4 className="font-medium mb-2">Detalhes:</h4>
                      <div className="space-y-1 text-sm">
                        {importResult.details
                          .filter(d => d.status !== 'success')
                          .map((detail, index) => (
                            <div key={index} className="flex items-center gap-2">
                              {detail.status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                              {detail.status === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                              <span className="font-mono">{detail.tracking_code}:</span>
                              <span className={detail.status === 'error' ? 'text-red-600' : 'text-yellow-600'}>
                                {detail.message}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button onClick={() => setShowResults(false)}>
                      Fechar
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Smart CSV Mapping Modal */}
          <Dialog open={showMapping} onOpenChange={handleCloseMapping}>
            <DialogContent className="max-w-7xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Mapeamento Inteligente de Campos CSV
                </DialogTitle>
                <DialogDescription>
                  Configure o mapeamento dos campos do seu arquivo CSV para os campos do sistema.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto pr-2">
                <div className="space-y-4 mb-4">
                  <MappingTemplatesManager
                    currentMappings={fieldMapping}
                    csvHeaders={csvHeaders}
                    onApplyTemplate={(template) => {
                      setFieldMapping(template.field_mappings);
                      toast.success(`Template "${template.name}" aplicado!`);
                    }}
                    onSaveTemplate={(template) => {
                      // O componente já salva automaticamente
                      console.log('Template salvo:', template);
                    }}
                  />
                </div>
                {showMapping && csvHeaders.length > 0 && (
                  <SmartCSVMapping
                    csvHeaders={csvHeaders}
                    csvSampleData={csvSampleData}
                    csvFullData={csvFullData}
                    dataSize={dataSize}
                    onMappingComplete={processCSVWithMapping}
                    onCancel={handleCloseMapping}
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
};

export default ImportOrders;
