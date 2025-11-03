/**
 * Template Shopify
 * Configuração para importação de pedidos do Shopify
 */

import type {
  EcommerceTemplate,
  OrderStatus,
  ShippingStatus,
  NormalizedOrder,
} from '../types';

// ===== TRANSFORMADORES SHOPIFY =====

export function transformShopifyDate(value: string): string {
  if (!value) return new Date().toISOString();
  
  // Shopify usa formato ISO ou "YYYY-MM-DD HH:mm:ss"
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export function transformShopifyOrderStatus(value: string): OrderStatus {
  const status = value.toLowerCase().trim();
  
  const statusMap: Record<string, OrderStatus> = {
    'pending': 'open',
    'authorized': 'paid',
    'partially_paid': 'open',
    'paid': 'paid',
    'partially_refunded': 'paid',
    'refunded': 'cancelled',
    'voided': 'cancelled',
    'cancelled': 'cancelled',
    'fulfilled': 'completed',
  };
  
  return statusMap[status] || 'open';
}

export function transformShopifyShippingStatus(value: string): ShippingStatus {
  const status = value.toLowerCase().trim();
  
  const statusMap: Record<string, ShippingStatus> = {
    'unfulfilled': 'pending',
    'partial': 'pending',
    'fulfilled': 'delivered',
    'shipped': 'shipped',
    'in_transit': 'in_transit',
    'out_for_delivery': 'in_transit',
    'delivered': 'delivered',
    'attempted_delivery': 'in_transit',
    'ready_for_pickup': 'shipped',
    'picked_up': 'delivered',
    'cancelled': 'returned',
  };
  
  return statusMap[status] || 'pending';
}

export function transformShopifyPhone(value: string): string {
  if (!value) return '';
  
  // Remove todos os caracteres não numéricos
  let cleaned = value.replace(/\D/g, '');
  
  // Se tem código do país, remove
  if (cleaned.startsWith('55') && cleaned.length > 11) {
    cleaned = cleaned.substring(2);
  }
  
  // Se tem 0 antes do DDD, remove
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }
  
  return cleaned;
}

export function transformShopifyMoney(value: string): number {
  if (!value) return 0;
  
  // Remove símbolos de moeda e espaços
  const cleaned = value.toString()
    .replace(/[R$\s]/g, '')
    .replace(',', '.');
  
  const number = parseFloat(cleaned);
  return isNaN(number) ? 0 : number;
}

// ===== TEMPLATE SHOPIFY =====

export const shopifyTemplate: EcommerceTemplate = {
  platform: 'shopify',
  name: 'Shopify',
  
  detection: {
    uniqueHeaders: [
      'Name',           // Nome do pedido (#1001)
      'Email',          // Email do cliente
      'Financial Status', // Status financeiro
      'Fulfillment Status', // Status de fulfillment
      'Lineitem name',  // Nome do produto
    ],
    requiredHeaders: [
      'Billing Name',
      'Shipping Name',
      'Total',
      'Shipping Address1',
      'Shipping City',
    ],
    minConfidence: 75,
    dataPatterns: {
      orderId: /^#?\d+$/,
    },
  },
  
  mapping: {
    // Identificação
    order_id: 'Name',
    customer_email: 'Email',
    customer_name: 'Billing Name',
    customer_phone: 'Billing Phone',
    
    // Datas
    order_date: 'Created at',
    
    // Status
    order_status: 'Financial Status',
    shipping_status: 'Fulfillment Status',
    
    // Rastreamento
    tracking_code: 'Tracking Number',
    shipping_method: 'Shipping Method',
    
    // Valores
    total: 'Total',
    shipping_cost: 'Shipping',
    
    // Endereço de Entrega
    street: 'Shipping Address1',
    number: 'Shipping Address2',
    city: 'Shipping City',
    state: 'Shipping Province',
    zip_code: 'Shipping Zip',
    country: 'Shipping Country',
    neighborhood: 'Shipping Address2', // Shopify não tem campo separado
    complement: 'Shipping Company',
    
    // Produto
    product_name: 'Lineitem name',
    product_quantity: 'Lineitem quantity',
    product_price: 'Lineitem price',
    product_sku: 'Lineitem sku',
    
    // Opcionais
    payment_method: 'Payment Method',
    notes: 'Notes',
  },
  
  transformers: {
    phone: transformShopifyPhone,
    date: transformShopifyDate,
    orderStatus: transformShopifyOrderStatus,
    shippingStatus: transformShopifyShippingStatus,
    money: transformShopifyMoney,
    zipCode: (value: string) => {
      // Shopify pode ter CEPs internacionais
      if (!value) return '';
      const cleaned = value.replace(/\D/g, '');
      
      // Se for brasileiro, adiciona zeros
      if (cleaned.length <= 8) {
        return cleaned.padStart(8, '0');
      }
      
      return cleaned;
    },
  },
  
  // Processador customizado para agrupar itens de linha
  customProcessor: (rows: Record<string, string>[]): NormalizedOrder[] => {
    const ordersMap = new Map<string, NormalizedOrder>();
    
    for (const row of rows) {
      const orderId = row['Name'] || '';
      
      if (!ordersMap.has(orderId)) {
        // Criar novo pedido
        ordersMap.set(orderId, {
          order_id: orderId,
          customer_email: row['Email'] || '',
          customer_name: row['Billing Name'] || row['Shipping Name'] || '',
          customer_phone: transformShopifyPhone(row['Billing Phone'] || row['Shipping Phone'] || ''),
          order_date: transformShopifyDate(row['Created at'] || ''),
          order_status: transformShopifyOrderStatus(row['Financial Status'] || ''),
          shipping_status: transformShopifyShippingStatus(row['Fulfillment Status'] || ''),
          tracking_code: row['Tracking Number'] || '',
          total: transformShopifyMoney(row['Total'] || '0'),
          shipping_cost: transformShopifyMoney(row['Shipping'] || '0'),
          shipping_method: row['Shipping Method'],
          payment_method: row['Payment Method'],
          shipping_address: {
            street: row['Shipping Address1'] || '',
            number: row['Shipping Address2'] || '',
            complement: row['Shipping Company'] || '',
            neighborhood: '', // Shopify não tem campo separado
            city: row['Shipping City'] || '',
            state: row['Shipping Province'] || '',
            zip_code: row['Shipping Zip']?.replace(/\D/g, '').padStart(8, '0') || '',
            country: row['Shipping Country'] || 'Brasil',
          },
          items: [],
          notes: row['Notes'],
          source_platform: 'shopify',
        });
      }
      
      // Adicionar item ao pedido
      const order = ordersMap.get(orderId)!;
      order.items.push({
        name: row['Lineitem name'] || '',
        price: transformShopifyMoney(row['Lineitem price'] || '0'),
        quantity: parseInt(row['Lineitem quantity'] || '1') || 1,
        sku: row['Lineitem sku'],
      });
    }
    
    return Array.from(ordersMap.values());
  },
};
