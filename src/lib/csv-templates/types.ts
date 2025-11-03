/**
 * Sistema de Templates de E-commerce para Importação CSV
 * Tipos e interfaces compartilhadas
 */

// ===== PLATAFORMAS SUPORTADAS =====
export type EcommercePlatform = 
  | 'nuvemshop'
  | 'mercadolivre'
  | 'shopify'
  | 'shopee'
  | 'magalu'
  | 'custom'
  | 'unknown';

// ===== STATUS PADRONIZADOS =====
export type OrderStatus = 
  | 'open'           // Aberto
  | 'paid'           // Pago
  | 'cancelled'      // Cancelado
  | 'completed';     // Concluído

export type ShippingStatus = 
  | 'pending'        // Pendente
  | 'shipped'        // Enviado
  | 'in_transit'     // Em trânsito
  | 'delivered'      // Entregue
  | 'returned';      // Devolvido

// ===== ENDEREÇO =====
export interface Address {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
}

// ===== PRODUTO DO PEDIDO =====
export interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  sku?: string;
}

// ===== PEDIDO NORMALIZADO =====
export interface NormalizedOrder {
  order_id: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  customer_phone_alt?: string;
  order_date: string; // ISO 8601
  order_status: OrderStatus;
  shipping_status: ShippingStatus;
  tracking_code: string;
  total: number;
  shipping_cost?: number;
  shipping_method?: string;
  payment_method?: string;
  shipping_address: Address;
  items: OrderItem[];
  notes?: string;
  
  // Metadados
  source_platform: EcommercePlatform;
  raw_data?: Record<string, unknown>; // Dados originais para debug
}

// ===== MAPEAMENTO DE COLUNAS =====
export interface ColumnMapping {
  // Campos obrigatórios
  order_id: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  order_date: string;
  order_status: string;
  shipping_status: string;
  tracking_code: string;
  total: string;
  
  // Endereço
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  
  // Produto
  product_name: string;
  product_price: string;
  product_quantity: string;
  
  // Opcionais
  customer_phone_alt?: string;
  shipping_cost?: string;
  shipping_method?: string;
  payment_method?: string;
  product_sku?: string;
  notes?: string;
}

// ===== PADRÕES DE DETECÇÃO =====
export interface DetectionPattern {
  // Headers que identificam unicamente a plataforma
  uniqueHeaders: string[];
  
  // Headers que devem estar presentes (mas não únicos)
  requiredHeaders: string[];
  
  // Score mínimo para considerar match (0-100)
  minConfidence: number;
  
  // Padrões de dados específicos (ex: formato de tracking code)
  dataPatterns?: {
    tracking?: RegExp;
    orderId?: RegExp;
    status?: string[];
  };
}

// ===== TRANSFORMADORES DE DADOS =====
export interface DataTransformer {
  // Transforma telefone (ex: notação científica → string)
  phone?: (value: string) => string;
  
  // Transforma data (ex: PT-BR → ISO)
  date?: (value: string) => string;
  
  // Transforma status (ex: "Entregue" → "delivered")
  orderStatus?: (value: string) => OrderStatus;
  shippingStatus?: (value: string) => ShippingStatus;
  
  // Transforma valores monetários
  money?: (value: string) => number;
  
  // Transforma CEP
  zipCode?: (value: string) => string;
}

// ===== TEMPLATE DE E-COMMERCE =====
export interface EcommerceTemplate {
  platform: EcommercePlatform;
  name: string;
  detection: DetectionPattern;
  mapping: ColumnMapping;
  transformers: DataTransformer;
  
  // Função customizada para processar CSV
  customProcessor?: (rows: Record<string, string>[]) => NormalizedOrder[];
}

// ===== RESULTADO DA DETECÇÃO =====
export interface DetectionResult {
  platform: EcommercePlatform;
  confidence: number; // 0-100
  matchedHeaders: string[];
  template?: EcommerceTemplate;
  suggestions?: string[];
}

// ===== ERRO DE VALIDAÇÃO =====
export interface ValidationError {
  row: number;
  field: string;
  value: string | number | null;
  message: string;
  severity: 'error' | 'warning';
}

// ===== RESULTADO DA VALIDAÇÃO =====
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  fixedRows: number;
  totalRows: number;
  stats: {
    validOrders: number;
    invalidOrders: number;
    multiProductOrders: number;
  };
}

// ===== RESULTADO DO PROCESSAMENTO =====
export interface ProcessingResult {
  success: boolean;
  detection: DetectionResult;
  orders: NormalizedOrder[];
  validation: ValidationResult;
  preview: NormalizedOrder[]; // Primeiras 5 linhas
}

// ===== CONFIGURAÇÃO DE IMPORTAÇÃO =====
export interface ImportConfig {
  // Template customizado (se usuário salvou)
  customTemplate?: EcommerceTemplate;
  
  // Opções de validação
  strictValidation?: boolean;
  autoFix?: boolean;
  
  // Filtros
  dateRange?: { from: string; to: string };
  statusFilter?: ShippingStatus[];
}
