/**
 * Types e Interfaces para Integração Smartenvios
 * Sistema de rastreamento e envio de encomendas
 */

import { OrderStatus } from './order';

// ============================================
// Configuração e Credenciais
// ============================================

export interface SmartenviosConfig {
  api_key: string;
  api_secret?: string;
  environment: 'production' | 'sandbox';
  webhook_url?: string;
  user_id?: string;
}

export interface SmartenviosCredentials {
  api_key: string;
  api_secret?: string;
}

// ============================================
// Rastreamento (Tracking)
// ============================================

export interface SmartenviosTracking {
  tracking_code: string;
  status: SmartenviosStatus;
  carrier: string;
  service_type?: string;
  events: SmartenviosEvent[];
  estimated_delivery?: string;
  actual_delivery?: string;
  current_location?: SmartenviosLocation;
  origin?: SmartenviosLocation;
  destination?: SmartenviosLocation;
  package_info?: SmartenviosPackage;
  created_at: string;
  updated_at: string;
}

export type SmartenviosStatus =
  | 'pending'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'returned'
  | 'cancelled'
  | 'exception';

export interface SmartenviosEvent {
  id?: string;
  date: string;
  time: string;
  timestamp: string;
  status: SmartenviosStatus;
  description: string;
  location: SmartenviosLocation;
  details?: string;
}

export interface SmartenviosLocation {
  city: string;
  state: string;
  country: string;
  zipcode?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface SmartenviosPackage {
  weight: number;
  height: number;
  width: number;
  length: number;
  declared_value?: number;
  description?: string;
}

// ============================================
// Envios (Shipments)
// ============================================

export interface SmartenviosShipment {
  id: string;
  tracking_code: string;
  service_type: string;
  carrier: string;
  sender: SmartenviosContact;
  recipient: SmartenviosContact;
  package: SmartenviosPackage;
  status: SmartenviosStatus;
  shipping_cost: number;
  insurance_cost?: number;
  total_cost: number;
  estimated_delivery_days: number;
  created_at: string;
  shipped_at?: string;
  label_url?: string;
  invoice_url?: string;
}

export interface SmartenviosContact {
  name: string;
  email?: string;
  phone: string;
  document?: string;
  address: SmartenviosAddress;
}

export interface SmartenviosAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  zipcode: string;
}

export interface SmartenviosShipmentRequest {
  sender: SmartenviosContact;
  recipient: SmartenviosContact;
  package: SmartenviosPackage;
  service_type: string;
  insurance?: boolean;
  additional_services?: string[];
  reference_id?: string;
  notes?: string;
}

// ============================================
// Cotação (Quote)
// ============================================

export interface SmartenviosQuote {
  service_type: string;
  carrier: string;
  price: number;
  estimated_delivery_days: number;
  delivery_min_days: number;
  delivery_max_days: number;
  insurance_available: boolean;
  insurance_cost?: number;
}

export interface SmartenviosQuoteRequest {
  origin_zipcode: string;
  destination_zipcode: string;
  package: SmartenviosPackage;
  insurance?: boolean;
}

// ============================================
// Webhooks
// ============================================

export interface SmartenviosWebhook {
  id: string;
  url: string;
  events: SmartenviosWebhookEvent[];
  is_active: boolean;
  secret?: string;
  created_at: string;
  updated_at: string;
}

export type SmartenviosWebhookEvent =
  | 'tracking.update'
  | 'tracking.delivered'
  | 'tracking.exception'
  | 'tracking.returned'
  | 'shipment.created'
  | 'shipment.cancelled';

export interface SmartenviosWebhookPayload {
  event: SmartenviosWebhookEvent;
  tracking_code: string;
  status: SmartenviosStatus;
  timestamp: string;
  data: SmartenviosTracking | SmartenviosShipment;
  signature?: string;
}

// ============================================
// Respostas da API
// ============================================

export interface SmartenviosApiResponse<T> {
  success: boolean;
  data?: T;
  error?: SmartenviosApiError;
  message?: string;
}

export interface SmartenviosApiError {
  code: string;
  message: string;
  details?: any;
}

export interface SmartenviosPaginatedResponse<T> {
  data: T[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

// ============================================
// Filtros e Queries
// ============================================

export interface SmartenviosTrackingFilters {
  status?: SmartenviosStatus;
  carrier?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}

// ============================================
// Mapeamento de Status
// ============================================

export const SMARTENVIOS_STATUS_MAP: Record<SmartenviosStatus, OrderStatus> = {
  pending: 'pending',
  in_transit: 'in_transit',
  out_for_delivery: 'out_for_delivery',
  delivered: 'delivered',
  failed: 'failed',
  returned: 'returned',
  cancelled: 'failed',
  exception: 'delayed',
};

export const TRACKY_TO_SMARTENVIOS_STATUS: Record<OrderStatus, SmartenviosStatus> = {
  pending: 'pending',
  in_transit: 'in_transit',
  out_for_delivery: 'out_for_delivery',
  delivered: 'delivered',
  delayed: 'exception',
  failed: 'failed',
  returned: 'returned',
};

// ============================================
// Padrões de Código de Rastreamento
// ============================================

export const SMARTENVIOS_TRACKING_PATTERNS = [
  /^SE[A-Z0-9]{10,15}$/i, // Padrão Smartenvios genérico
  /^SM[0-9]{12,16}$/i, // Padrão alternativo
  /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/i, // Padrão Correios via Smartenvios
];

// ============================================
// Configuração de Integração
// ============================================

export interface SmartenviosIntegration {
  id: string;
  user_id: string;
  carrier: string;
  name: string;
  api_key: string;
  api_secret?: string;
  environment: 'production' | 'sandbox';
  webhook_url?: string;
  webhook_secret?: string;
  is_active: boolean;
  last_sync?: string;
  settings?: {
    auto_track: boolean;
    webhook_enabled: boolean;
    notification_enabled: boolean;
  };
  created_at: string;
  updated_at: string;
}

// ============================================
// Estatísticas
// ============================================

export interface SmartenviosStats {
  total_trackings: number;
  pending: number;
  in_transit: number;
  delivered: number;
  failed: number;
  average_delivery_days: number;
  on_time_delivery_rate: number;
}

// ============================================
// Validação
// ============================================

export interface SmartenviosValidationResult {
  is_valid: boolean;
  carrier?: string;
  pattern_matched?: string;
  errors?: string[];
}

// ============================================
// Erros Customizados
// ============================================

export class SmartenviosApiErrorClass extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'SmartenviosApiError';
  }
}

export class SmartenviosAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SmartenviosAuthError';
  }
}

export class SmartenviosWebhookError extends Error {
  constructor(message: string, public payload?: any) {
    super(message);
    this.name = 'SmartenviosWebhookError';
  }
}

export class SmartenviosTrackingError extends Error {
  constructor(
    message: string,
    public trackingCode?: string
  ) {
    super(message);
    this.name = 'SmartenviosTrackingError';
  }
}

// ============================================
// Utilitários
// ============================================

export interface SmartenviosBatchTrackingRequest {
  tracking_codes: string[];
}

export interface SmartenviosBatchTrackingResponse {
  results: SmartenviosTracking[];
  errors: Array<{
    tracking_code: string;
    error: string;
  }>;
}

// ============================================
// Labels e Documentos
// ============================================

export interface SmartenviosLabel {
  shipment_id: string;
  format: 'pdf' | 'zpl' | 'png';
  url: string;
  size: 'A4' | '10x15cm';
  expires_at: string;
}

export interface SmartenviosInvoice {
  shipment_id: string;
  invoice_number: string;
  url: string;
  amount: number;
  issued_at: string;
}
