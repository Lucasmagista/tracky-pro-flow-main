/**
 * Types e Interfaces para Integração Nuvemshop
 * @see https://dev.nuvemshop.com.br/docs/developer-tools/nuvemshop-api
 */

import { OrderStatus } from './order';

// ============================================
// Configuração e Credenciais
// ============================================

export interface NuvemshopConfig {
  app_id: string;
  app_secret: string;
  access_token: string;
  store_id: string;
  store_url: string;
  user_id?: string;
}

export interface NuvemshopCredentials {
  app_id: string;
  app_secret: string;
  code?: string;
  redirect_uri?: string;
}

// ============================================
// Pedidos (Orders)
// ============================================

export interface NuvemshopOrder {
  id: number;
  number: number;
  token: string;
  store_id: string;
  contact_email: string;
  contact_name: string;
  contact_phone: string;
  contact_identification: string;
  shipping_status: NuvemshopShippingStatus;
  payment_status: NuvemshopPaymentStatus;
  status: NuvemshopOrderStatus;
  shipping_tracking_number?: string;
  shipping_tracking_url?: string;
  shipping_min_days?: number;
  shipping_max_days?: number;
  billing_name: string;
  billing_phone: string;
  billing_address: string;
  billing_number: string;
  billing_floor: string;
  billing_locality: string;
  billing_zipcode: string;
  billing_city: string;
  billing_province: string;
  billing_country: string;
  shipping_cost_owner: string;
  shipping_cost_customer: string;
  coupon: any[];
  promotional_discount: any;
  subtotal: string;
  discount: string;
  discount_coupon: string;
  discount_gateway: string;
  total: string;
  total_usd: string;
  checkout_enabled: boolean;
  weight: string;
  currency: string;
  language: string;
  gateway: string;
  gateway_id: string;
  shipping: string;
  shipping_option: string;
  shipping_option_code: string;
  shipping_option_reference: string;
  shipping_pickup_details: any;
  shipping_tracking_method: string;
  shipping_store_branch_name: string;
  shipping_store_branch_extra: string;
  shipping_pickup_type: string;
  shipping_suboption: any[];
  extra: any;
  storefront: string;
  note: string;
  created_at: string;
  updated_at: string;
  completed_at: any;
  next_action: string;
  payment_details: NuvemshopPaymentDetails;
  attributes: any[];
  customer: NuvemshopCustomer;
  products: NuvemshopProduct[];
  shipping_address?: NuvemshopAddress;
}

export type NuvemshopShippingStatus = 
  | 'unpacked'
  | 'packed' 
  | 'ready_for_pickup'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type NuvemshopPaymentStatus = 
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'voided'
  | 'refunded'
  | 'abandoned';

export type NuvemshopOrderStatus = 
  | 'open'
  | 'closed'
  | 'cancelled';

// ============================================
// Cliente (Customer)
// ============================================

export interface NuvemshopCustomer {
  id: number;
  name: string;
  email: string;
  identification: string;
  phone: string;
  note: string;
  default_address?: NuvemshopAddress;
  addresses?: NuvemshopAddress[];
  billing_name?: string;
  billing_phone?: string;
  billing_address?: string;
  billing_number?: string;
  billing_floor?: string;
  billing_locality?: string;
  billing_zipcode?: string;
  billing_city?: string;
  billing_province?: string;
  billing_country?: string;
  extra?: any;
  total_spent?: string;
  total_spent_currency?: string;
  last_order_id?: number;
  active?: boolean;
  first_interaction?: string;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// Endereço (Address)
// ============================================

export interface NuvemshopAddress {
  id?: number;
  address: string;
  number: string;
  floor: string;
  locality: string;
  city: string;
  province: string;
  zipcode: string;
  country: string;
  name?: string;
  phone?: string;
  between_streets?: string;
  reference?: string;
}

// ============================================
// Produto (Product)
// ============================================

export interface NuvemshopProduct {
  id: number;
  depth: string;
  height: string;
  name: string;
  price: string;
  product_id: number;
  image: NuvemshopProductImage;
  quantity: number;
  free_shipping: boolean;
  weight: string;
  width: string;
  variant_id: number;
  variant_values: string[];
  properties: any[];
  sku: string;
  barcode: string;
}

export interface NuvemshopProductImage {
  id: number;
  product_id: number;
  src: string;
  position: number;
  alt: string[];
  created_at: string;
  updated_at: string;
}

// ============================================
// Detalhes de Pagamento
// ============================================

export interface NuvemshopPaymentDetails {
  method: string;
  credit_card_company: string;
  installments: number;
}

// ============================================
// Webhooks
// ============================================

export interface NuvemshopWebhook {
  id: number;
  url: string;
  event: NuvemshopWebhookEvent;
  created_at: string;
  updated_at: string;
}

export type NuvemshopWebhookEvent =
  | 'order/created'
  | 'order/updated'
  | 'order/paid'
  | 'order/fulfilled'
  | 'order/cancelled'
  | 'order/packed'
  | 'product/created'
  | 'product/updated'
  | 'product/deleted';

export interface NuvemshopWebhookPayload {
  store_id: string;
  event: NuvemshopWebhookEvent;
  id: number;
  object_id?: number;
}

// ============================================
// Respostas da API
// ============================================

export interface NuvemshopApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface NuvemshopOrdersResponse {
  orders: NuvemshopOrder[];
  total: number;
  page: number;
  per_page: number;
}

export interface NuvemshopAuthResponse {
  access_token: string;
  token_type: string;
  scope: string;
  user_id: string;
}

// ============================================
// Filtros e Queries
// ============================================

export interface NuvemshopOrderFilters {
  created_at_min?: string;
  created_at_max?: string;
  updated_at_min?: string;
  updated_at_max?: string;
  status?: NuvemshopOrderStatus;
  payment_status?: NuvemshopPaymentStatus;
  shipping_status?: NuvemshopShippingStatus;
  page?: number;
  per_page?: number;
  fields?: string;
  sort_by?: string;
}

// ============================================
// Mapeamento de Status
// ============================================

export const NUVEMSHOP_STATUS_MAP: Record<NuvemshopShippingStatus, OrderStatus> = {
  unpacked: 'pending',
  packed: 'pending',
  ready_for_pickup: 'pending',
  shipped: 'in_transit',
  delivered: 'delivered',
  cancelled: 'failed',
};

// ============================================
// Configuração de Integração
// ============================================

export interface NuvemshopIntegration {
  id: string;
  user_id: string;
  store_id: string;
  store_url: string;
  access_token: string;
  is_active: boolean;
  last_sync?: string;
  sync_status?: 'idle' | 'syncing' | 'error' | 'success';
  error_message?: string;
  webhook_ids?: number[];
  settings?: {
    auto_import: boolean;
    auto_sync_status: boolean;
    import_from_date?: string;
  };
  created_at: string;
  updated_at: string;
}

// ============================================
// Store Information
// ============================================

export interface NuvemshopStore {
  id: number;
  name: string;
  url: string;
  original_domain: string;
  main_currency: string;
  languages: string[];
  country: string;
  address: string;
  phone: string;
  business_name: string;
  business_id: string;
  logo: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Erros Específicos
// ============================================

export class NuvemshopApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'NuvemshopApiError';
  }
}

export class NuvemshopAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NuvemshopAuthError';
  }
}

export class NuvemshopWebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NuvemshopWebhookError';
  }
}
