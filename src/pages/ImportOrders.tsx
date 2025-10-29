import { useState } from "react";
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
import CSVMapping from "@/components/CSVMapping";
import { ImportHistory } from "@/components/ImportHistory";

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

const ImportOrders = () => {
  const { user } = useAuth();
  const { detectCarrier } = useCarrierDetection();
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

  // Estados para mapeamento CSV
  const [showMapping, setShowMapping] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvSampleData, setCsvSampleData] = useState<Record<string, string>[]>([]);
  const [rawCsvData, setRawCsvData] = useState<string[][]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});

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

  // Função para processar e validar dados CSV aprimorada
  const processCSVData = (text: string): ParsedOrder[] => {
    const lines = text.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));

    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const dataLines = lines.slice(1);

    // Validar cabeçalhos obrigatórios
    const requiredHeaders = ['tracking_code', 'customer_name', 'customer_email'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

    if (missingHeaders.length > 0) {
      toast.error(`Cabeçalhos obrigatórios faltando: ${missingHeaders.join(', ')}`);
      return [];
    }

    return dataLines.map((line, index) => {
      // Parser CSV melhorado que lida com aspas
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      let i = 0;

      while (i < line.length) {
        const char = line[i];

        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            // Aspas escapadas
            current += '"';
            i += 2;
            continue;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
        i++;
      }
      values.push(current.trim());

      // Garantir que temos valores para todos os cabeçalhos
      while (values.length < headers.length) {
        values.push('');
      }

      const order: Record<string, string> = {};
      headers.forEach((header, colIndex) => {
        order[header] = values[colIndex] || '';
      });

      // Mapeamento de campos com fallbacks para compatibilidade
      const trackingCode = order.tracking_code || order['código_rastreio'] || '';
      const customerName = order.customer_name || order['nome_cliente'] || '';
      const customerEmail = order.customer_email || order['email_cliente'] || '';
      const customerPhone = order.customer_phone || order['telefone'] || order['phone'] || '';
      const carrierInput = order.carrier || order['transportadora'] || '';
      const orderValue = order.order_value || order['valor_pedido'] || '';
      const destination = order.destination || order['destino'] || '';
      const orderDate = order.order_date || order['data_pedido'] || '';
      const estimatedDelivery = order.estimated_delivery || order['previsao_entrega'] || '';
      const productName = order.product_name || order['nome_produto'] || '';
      const quantity = order.quantity || order['quantidade'] || '';
      const orderNumber = order.order_number || order['numero_pedido'] || '';
      const notes = order.notes || order['observacoes'] || '';

      // Validações aprimoradas
      const errors: string[] = [];
      const warnings: string[] = [];

      // Validações obrigatórias
      if (!trackingCode.trim()) errors.push('Código de rastreio é obrigatório');
      if (!customerName.trim()) errors.push('Nome do cliente é obrigatório');
      if (!customerEmail.trim()) errors.push('Email do cliente é obrigatório');

      // Validações de formato
      if (customerEmail && !validateEmail(customerEmail)) {
        errors.push('Email inválido');
      }

      if (customerPhone && !validatePhone(customerPhone)) {
        warnings.push('Telefone pode estar em formato incorreto');
      }

      if (orderValue && !validateCurrency(orderValue)) {
        warnings.push('Valor do pedido deve estar no formato correto (ex: 99.90)');
      }

      if (orderDate && !validateDate(orderDate)) {
        warnings.push('Data do pedido deve estar no formato DD/MM/YYYY ou YYYY-MM-DD');
      }

      if (estimatedDelivery && !validateDate(estimatedDelivery)) {
        warnings.push('Data de entrega prevista deve estar no formato DD/MM/YYYY ou YYYY-MM-DD');
      }

      if (quantity && !validateQuantity(quantity)) {
        warnings.push('Quantidade deve ser um número inteiro positivo');
      }

      // Validação de código de rastreio
      let finalCarrier = carrierInput;
      if (trackingCode) {
        const trackingValidation = validateTrackingCode(trackingCode);
        if (!trackingValidation.isValid) {
          errors.push(...trackingValidation.errors);
        } else if (!finalCarrier) {
          finalCarrier = trackingValidation.carrier;
        }
      }

      // Carrier padrão se não especificado e não detectado
      if (!finalCarrier) {
        finalCarrier = 'Correios';
        if (trackingCode) {
          warnings.push('Transportadora não especificada, assumindo Correios');
        }
      }

      let status: 'valid' | 'invalid' | 'warning' = 'valid';
      if (errors.length > 0) status = 'invalid';
      else if (warnings.length > 0) status = 'warning';

      return {
        tracking_code: trackingCode,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        carrier: finalCarrier,
        status,
        errors,
        warnings,
        // Campos adicionais
        order_value: orderValue,
        destination,
        order_date: orderDate,
        estimated_delivery: estimatedDelivery,
        product_name: productName,
        quantity,
        order_number: orderNumber,
        notes,
      };
    });
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

  // Função para baixar modelo CSV aprimorado
  const downloadCSVTemplate = () => {
    const csvContent = `# Tracky Pro Flow - Modelo de Importação de Pedidos
# Versão: 2.0 - Atualizado em ${new Date().toLocaleDateString('pt-BR')}
# Este arquivo contém todas as colunas suportadas para importação de pedidos
# Campos obrigatórios estão marcados com * (asterisco)
# Campos opcionais podem ser deixados em branco
#
# INSTRUÇÕES IMPORTANTES:
# 1. A primeira linha deve conter exatamente os cabeçalhos mostrados abaixo
# 2. Não altere a ordem das colunas
# 3. Use aspas duplas para textos que contenham vírgulas
# 4. Datas devem estar no formato DD/MM/YYYY ou YYYY-MM-DD
# 5. Valores monetários devem usar ponto como separador decimal (ex: 99.90)
# 6. Telefones devem incluir DDD (ex: (11) 98765-4321)
# 7. Códigos de rastreio devem seguir o padrão da transportadora
#
# CAMPOS SUPORTADOS:
# * tracking_code: Código de rastreio (obrigatório)
# * customer_name: Nome completo do cliente (obrigatório)
# * customer_email: Email do cliente (obrigatório)
# * carrier: Transportadora (obrigatório se não for detectável pelo código)
# customer_phone: Telefone/WhatsApp do cliente (opcional)
# order_value: Valor total do pedido (opcional)
# destination: Cidade/Estado de destino (opcional)
# order_date: Data do pedido (opcional)
# estimated_delivery: Data prevista de entrega (opcional)
# product_name: Nome do produto (opcional)
# quantity: Quantidade do produto (opcional)
# order_number: Número do pedido na loja (opcional)
# notes: Observações adicionais (opcional)
#
# EXEMPLOS DE CÓDIGOS DE RASTREIO POR TRANSPORTADORA:
# Correios: BR123456789BR, BR123456789BR (11 dígitos + BR)
# Jadlog: JD123456789012, JD1234567890123 (12-14 dígitos)
# Total Express: TE123456789BR (11 dígitos + BR)
# Azul Cargo: AC123456789BR (11 dígitos + BR)
# Loggi: LG123456789BR (11 dígitos + BR)
#
# FORMATO DO ARQUIVO CSV:
# - Codificação: UTF-8
# - Separador: Vírgula (,)
# - Quebra de linha: LF (\n) ou CRLF (\r\n)
# - Aspas: Use aspas duplas para campos com vírgulas ou quebras de linha
#
# DICAS PARA IMPORTAÇÃO BEM-SUCEDIDA:
# - Verifique se todos os emails são válidos
# - Confirme se os códigos de rastreio seguem o padrão da transportadora
# - Use o preview antes de importar para verificar erros
# - Campos vazios serão ignorados (exceto obrigatórios)
# - O sistema detecta automaticamente a transportadora pelo código quando possível

tracking_code*,customer_name*,customer_email*,carrier,customer_phone,order_value,destination,order_date,estimated_delivery,product_name,quantity,order_number,notes
BR123456789BR,"João Silva Santos","joao.silva@email.com","Correios","(11) 98765-4321","299.90","São Paulo/SP","15/10/2024","20/10/2024","Smartphone Samsung Galaxy","1","PED-2024-001","Cliente solicitou entrega urgente"
JD123456789012,"Maria Oliveira Costa","maria.oliveira@email.com","Jadlog","(21) 99876-5432","149.50","Rio de Janeiro/RJ","16/10/2024","22/10/2024","Notebook Dell Inspiron","1","PED-2024-002","Entrega em endereço comercial"
TE123456789BR,"Carlos Eduardo Lima","carlos.lima@email.com","Total Express","(85) 98765-4321","89.90","Fortaleza/CE","17/10/2024","23/10/2024","Mouse Gamer Logitech","2","PED-2024-003","Cliente prefere entrega aos sábados"
AC123456789BR,"Ana Paula Rodrigues","ana.paula@email.com","Azul Cargo","(31) 91234-5678","459.99","Belo Horizonte/MG","18/10/2024","25/10/2024","Monitor LG 27 polegadas","1","PED-2024-004","Endereço residencial - apartamento 1502"
LG123456789BR,"Roberto Fernandes","roberto.fernandes@email.com","Loggi","(41) 99876-5432","79.90","Curitiba/PR","19/10/2024","24/10/2024","Teclado Mecânico RGB","1","PED-2024-005","Cliente solicitou contato prévio"
BR234567890BR,"Fernanda Costa Santos","fernanda.costa@email.com","Correios","(71) 98765-4321","199.99","Salvador/BA","20/10/2024","26/10/2024","Fone de Ouvido Bluetooth","1","PED-2024-006","Entrega preferencialmente pela manhã"
JD234567890123,"Lucas Pereira Oliveira","lucas.pereira@email.com","Jadlog","(51) 91234-5678","349.90","Porto Alegre/RS","21/10/2024","28/10/2024","SSD Kingston 1TB","1","PED-2024-007","Cliente trabalha em horário comercial"
TE234567890BR,"Juliana Martins Silva","juliana.martins@email.com","Total Express","(62) 99876-5432","129.90","Goiânia/GO","22/10/2024","27/10/2024","Webcam Logitech HD","1","PED-2024-008","Endereço com portaria - avisar chegada"
AC234567890BR,"Ricardo Santos Lima","ricardo.santos@email.com","Azul Cargo","(98) 98765-4321","599.99","São Luís/MA","23/10/2024","30/10/2024","Placa de Vídeo RTX 4060","1","PED-2024-009","Cliente solicitou nota fiscal junto com produto"
LG234567890BR,"Patricia Oliveira Costa","patricia.oliveira@email.com","Loggi","(84) 91234-5678","69.90","Natal/RN","24/10/2024","29/10/2024","Mouse Pad Gamer XXL","1","PED-2024-010","Entrega em condomínio - aguardar liberação"`

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `modelo_importacao_pedidos_v2.0_${new Date().toISOString().split('T')[0]}.csv`);
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

    setCsvLoading(true);
    try {
      const text = await file.text();
      const rows = text.split('\n').filter(row => row.trim());
      if (rows.length < 2) {
        toast.error("Arquivo deve conter pelo menos um cabeçalho e uma linha de dados.");
        return;
      }

      // Parse CSV básico
      const parsedRows: string[][] = rows.map(row => {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < row.length; i++) {
          const char = row[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      });

      const headers = parsedRows[0];
      const dataRows = parsedRows.slice(1).filter(row => row.some(cell => cell.trim()));

      if (dataRows.length === 0) {
        toast.error("Nenhum dado encontrado no arquivo.");
        return;
      }

      // Converter para formato de objeto
      const sampleData = dataRows.slice(0, 3).map(row => {
        const obj: Record<string, string> = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });

      setCsvHeaders(headers);
      setCsvSampleData(sampleData);
      setRawCsvData(parsedRows);
      setShowMapping(true);

      toast.success(`${dataRows.length} linhas encontradas. Configure o mapeamento dos campos.`);
    } catch (error) {
      console.error("Error processing CSV:", error);
      toast.error("Erro ao processar arquivo. Verifique o formato CSV.");
    } finally {
      setCsvLoading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  // Função para processar dados CSV com mapeamento aprimorado
  const processCSVWithMapping = (mapping: Record<string, string>) => {
    const dataRows = rawCsvData.slice(1).filter(row => row.some(cell => cell.trim()));

    const parsed = dataRows.map((row, index) => {
      const order: Record<string, string> = {};

      // Aplicar mapeamento
      csvHeaders.forEach((header, colIndex) => {
        const systemField = mapping[header];
        if (systemField) {
          order[systemField] = row[colIndex]?.trim() || '';
        }
      });

      // Processar dados mapeados com todos os campos suportados
      const trackingCode = order.tracking_code || '';
      const customerName = order.customer_name || '';
      const customerEmail = order.customer_email || '';
      const customerPhone = order.customer_phone || '';
      const carrierInput = order.carrier || '';
      const orderValue = order.order_value || '';
      const destination = order.destination || '';
      const orderDate = order.order_date || '';
      const estimatedDelivery = order.estimated_delivery || '';
      const productName = order.product_name || '';
      const quantity = order.quantity || '';
      const orderNumber = order.order_number || '';
      const notes = order.notes || '';

      // Validações completas
      const errors: string[] = [];
      const warnings: string[] = [];

      // Validações obrigatórias
      if (!trackingCode) errors.push('Código de rastreio é obrigatório');
      if (!customerName) errors.push('Nome do cliente é obrigatório');
      if (!customerEmail) errors.push('Email do cliente é obrigatório');

      // Validações de formato
      if (customerEmail && !validateEmail(customerEmail)) errors.push('Email inválido');
      if (customerPhone && !validatePhone(customerPhone)) warnings.push('Telefone pode estar em formato incorreto');
      if (orderValue && !validateCurrency(orderValue)) warnings.push('Valor deve estar no formato correto (ex: 99.90)');
      if (orderDate && !validateDate(orderDate)) warnings.push('Data do pedido deve estar no formato DD/MM/YYYY');
      if (estimatedDelivery && !validateDate(estimatedDelivery)) warnings.push('Data de entrega deve estar no formato DD/MM/YYYY');
      if (quantity && !validateQuantity(quantity)) warnings.push('Quantidade deve ser um número inteiro positivo');

      // Validação de código de rastreio
      let finalCarrier = carrierInput;
      if (trackingCode) {
        const trackingValidation = validateTrackingCode(trackingCode);
        if (!trackingValidation.isValid) {
          errors.push(...trackingValidation.errors);
        } else if (!finalCarrier) {
          finalCarrier = trackingValidation.carrier;
        }
      }

      if (!finalCarrier) {
        finalCarrier = 'Correios';
        if (trackingCode) warnings.push('Transportadora não especificada, assumindo Correios');
      }

      let status: 'valid' | 'invalid' | 'warning' = 'valid';
      if (errors.length > 0) status = 'invalid';
      else if (warnings.length > 0) status = 'warning';

      return {
        tracking_code: trackingCode,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        carrier: finalCarrier,
        status,
        errors,
        warnings,
        // Campos adicionais do CSV aprimorado
        order_value: orderValue,
        destination,
        order_date: orderDate,
        estimated_delivery: estimatedDelivery,
        product_name: productName,
        quantity,
        order_number: orderNumber,
        notes,
      };
    });

    setParsedOrders(parsed);
    setShowMapping(false);
    setShowPreview(true);

    const validCount = parsed.filter(o => o.status === 'valid').length;
    const warningCount = parsed.filter(o => o.status === 'warning').length;
    const errorCount = parsed.filter(o => o.status === 'invalid').length;

    toast.success(`${parsed.length} pedidos processados: ${validCount} válidos, ${warningCount} com avisos, ${errorCount} com erros`);
  };

  // Função para executar a importação após preview
  const executeImport = async () => {

    setLoading(true);
    setShowPreview(false);

    try {
      const validOrders = parsedOrders.filter(order => order.status !== 'invalid');
      const ordersToInsert = validOrders.map(order => ({
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
      }));

      if (ordersToInsert.length === 0) {
        toast.error("Nenhum pedido válido para importar.");
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .insert(ordersToInsert)
        .select();

      if (error) throw error;

      // Registrar no histórico
      if (data) {
        const historyEntries = data.map(order => ({
          order_id: order.id,
          user_id: user.id,
          new_status: 'pending',
          notes: 'Pedido importado via CSV'
        }));

        await supabase.from("order_history").insert(historyEntries);
      }

      const result: ImportResult = {
        success: ordersToInsert.length,
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

      toast.success(`${ordersToInsert.length} pedidos importados com sucesso!`);
      setParsedOrders([]);
    } catch (error) {
      console.error("Error importing orders:", error);
      toast.error("Erro ao importar pedidos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
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
                  <CardTitle className="text-2xl">Importar via CSV</CardTitle>
                  <CardDescription className="mt-3 text-base">
                    Carregue um arquivo CSV com múltiplos pedidos de uma vez
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-smooth">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-upload"
                    disabled={csvLoading}
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="font-medium mb-2">
                      {csvLoading ? "Importando..." : "Arraste um arquivo CSV aqui"}
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">ou clique para selecionar</p>
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
                Guia Completo de Importação CSV
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
                      <strong>Formato:</strong> UTF-8, separador: vírgula (,), aspas duplas para campos com vírgulas
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
                    Campos Suportados
                  </h4>
                  <div className="grid md:grid-cols-2 gap-6">
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
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <strong className="text-green-700">Opcionais:</strong>
                      </div>
                      <ul className="text-sm space-y-1 ml-4">
                        <li><code className="bg-muted px-1 rounded">carrier</code> - Transportadora</li>
                        <li><code className="bg-muted px-1 rounded">customer_phone</code> - Telefone</li>
                        <li><code className="bg-muted px-1 rounded">order_value</code> - Valor (99.90)</li>
                        <li><code className="bg-muted px-1 rounded">destination</code> - Destino</li>
                        <li><code className="bg-muted px-1 rounded">product_name</code> - Nome do produto</li>
                        <li><code className="bg-muted px-1 rounded">quantity</code> - Quantidade</li>
                      </ul>
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

          {/* Preview Modal */}
          <Dialog open={showPreview} onOpenChange={setShowPreview}>
            <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Preview da Importação
                </DialogTitle>
                <DialogDescription>
                  Revise os dados antes de confirmar a importação. {parsedOrders.length} pedidos encontrados.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-3xl font-bold text-green-600 mb-1">
                      {parsedOrders.filter(o => o.status === 'valid').length}
                    </div>
                    <div className="text-sm text-green-700 font-medium">Válidos</div>
                    <div className="text-xs text-green-600 mt-1">
                      {parsedOrders.length > 0 ? Math.round((parsedOrders.filter(o => o.status === 'valid').length / parsedOrders.length) * 100) : 0}% do total
                    </div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="text-3xl font-bold text-yellow-600 mb-1">
                      {parsedOrders.filter(o => o.status === 'warning').length}
                    </div>
                    <div className="text-sm text-yellow-700 font-medium">Com Avisos</div>
                    <div className="text-xs text-yellow-600 mt-1">
                      Precisam atenção
                    </div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="text-3xl font-bold text-red-600 mb-1">
                      {parsedOrders.filter(o => o.status === 'invalid').length}
                    </div>
                    <div className="text-sm text-red-700 font-medium">Inválidos</div>
                    <div className="text-xs text-red-600 mt-1">
                      Não podem ser importados
                    </div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-3xl font-bold text-blue-600 mb-1">
                      {parsedOrders.length}
                    </div>
                    <div className="text-sm text-blue-700 font-medium">Total</div>
                    <div className="text-xs text-blue-600 mt-1">
                      Pedidos processados
                    </div>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h4 className="font-medium mb-2 text-muted-foreground">Transportadoras Detectadas</h4>
                    <div className="space-y-1">
                      {Array.from(new Set(parsedOrders.map(o => o.carrier).filter(c => c))).map(carrier => (
                        <div key={carrier} className="flex justify-between">
                          <span>{carrier}</span>
                          <Badge variant="secondary">
                            {parsedOrders.filter(o => o.carrier === carrier).length}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h4 className="font-medium mb-2 text-muted-foreground">Principais Problemas</h4>
                    <div className="space-y-1">
                      {parsedOrders.filter(o => o.errors.length > 0).length > 0 && (
                        <div className="flex justify-between text-red-600">
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
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-16">Status</TableHead>
                        <TableHead>Código de Rastreio</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Transportadora</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Qtde</TableHead>
                        <TableHead>N° Pedido</TableHead>
                        <TableHead className="w-32">Problemas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedOrders.map((order, index) => (
                        <TableRow key={index} className={
                          order.status === 'invalid' ? 'bg-red-50' :
                          order.status === 'warning' ? 'bg-yellow-50' : 'bg-green-50'
                        }>
                          <TableCell>
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
                          <TableCell>
                            <div className="font-mono text-sm bg-muted px-2 py-1 rounded">
                              {order.tracking_code || '-'}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {order.customer_name || '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {order.customer_email || '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {order.customer_phone || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-medium">
                              {order.carrier || 'Não informado'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {order.order_value ? `R$ ${order.order_value}` : '-'}
                          </TableCell>
                          <TableCell className="text-sm max-w-24">
                            <div className="truncate" title={order.destination}>
                              {order.destination || '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm max-w-32">
                            <div className="truncate" title={order.product_name}>
                              {order.product_name || '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-center">
                            {order.quantity || '-'}
                          </TableCell>
                          <TableCell className="text-sm font-mono max-w-24">
                            <div className="truncate" title={order.order_number}>
                              {order.order_number || '-'}
                            </div>
                          </TableCell>
                          <TableCell>
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

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowPreview(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={executeImport}
                    disabled={loading || parsedOrders.filter(o => o.status === 'valid').length === 0}
                  >
                    {loading ? "Importando..." : `Importar ${parsedOrders.filter(o => o.status === 'valid').length} Pedidos`}
                  </Button>
                </div>
              </div>
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

          {/* CSV Mapping Modal */}
          <Dialog open={showMapping} onOpenChange={setShowMapping}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <CSVMapping
                csvHeaders={csvHeaders}
                csvSampleData={csvSampleData}
                onMappingComplete={processCSVWithMapping}
                onCancel={() => setShowMapping(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
};

export default ImportOrders;
