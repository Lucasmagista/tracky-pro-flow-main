/**
 * Template Shopee
 * Configuração para importação de pedidos da Shopee
 */

import type {
  EcommerceTemplate,
  OrderStatus,
  ShippingStatus,
  NormalizedOrder,
} from '../types';

// ===== TRANSFORMADORES SHOPEE =====

export function transformShopeeDate(value: string): string {
  if (!value) return new Date().toISOString();
  
  // Shopee usa formato "DD-MM-YYYY HH:mm" ou "DD/MM/YYYY HH:mm"
  try {
    const dateRegex = /^(\d{2})[-/](\d{2})[-/](\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/;
    const match = value.match(dateRegex);
    
    if (match) {
      const [, day, month, year, hour, minute, second = '00'] = match;
      return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
    }
    
    // Tentar ISO direto
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch {
    // Fallback
  }
  
  return new Date().toISOString();
}

export function transformShopeeOrderStatus(value: string): OrderStatus {
  const status = value.toLowerCase().trim();
  
  const statusMap: Record<string, OrderStatus> = {
    'unpaid': 'open',
    'to_ship': 'paid',
    'shipping': 'paid',
    'completed': 'completed',
    'cancelled': 'cancelled',
    'to_return': 'cancelled',
    'returned': 'cancelled',
  };
  
  return statusMap[status] || 'open';
}

export function transformShopeeShippingStatus(value: string): ShippingStatus {
  const status = value.toLowerCase().trim();
  
  const statusMap: Record<string, ShippingStatus> = {
    'to_ship': 'pending',
    'shipping': 'shipped',
    'shipped': 'in_transit',
    'to_receive': 'in_transit',
    'completed': 'delivered',
    'cancelled': 'returned',
    'to_return': 'returned',
    'returned': 'returned',
  };
  
  return statusMap[status] || 'pending';
}

export function transformShopeePhone(value: string): string {
  if (!value) return '';
  
  // Remove formatação
  let cleaned = value.replace(/\D/g, '');
  
  // Remover código do país se houver
  if (cleaned.startsWith('55') && cleaned.length > 11) {
    cleaned = cleaned.substring(2);
  }
  
  return cleaned;
}

export function transformShopeeMoney(value: string): number {
  if (!value) return 0;
  
  // Shopee pode usar vírgula ou ponto como decimal
  const cleaned = value.toString()
    .replace(/[R$\s]/g, '')
    .replace(',', '.');
  
  const number = parseFloat(cleaned);
  return isNaN(number) ? 0 : number;
}

export function transformShopeeZipCode(value: string): string {
  if (!value) return '';
  
  const cleaned = value.replace(/\D/g, '');
  
  // CEP brasileiro tem 8 dígitos
  if (cleaned.length <= 8) {
    return cleaned.padStart(8, '0');
  }
  
  return cleaned;
}

// ===== TEMPLATE SHOPEE =====

export const shopeeTemplate: EcommerceTemplate = {
  platform: 'shopee',
  name: 'Shopee',
  
  detection: {
    uniqueHeaders: [
      'Order ID',
      'Order Status',
      'Buyer Username',
      'Shipping Provider',
      'Tracking Number',
    ],
    requiredHeaders: [
      'Recipient Name',
      'Phone Number',
      'Order Total',
      'Product Name',
      'Variation',
    ],
    minConfidence: 75,
    dataPatterns: {
      orderId: /^\d{15,}$/,
    },
  },
  
  mapping: {
    // Identificação
    order_id: 'Order ID',
    customer_email: 'Buyer Email',
    customer_name: 'Recipient Name',
    customer_phone: 'Phone Number',
    
    // Datas
    order_date: 'Order Creation Date',
    
    // Status
    order_status: 'Order Status',
    shipping_status: 'Order Status', // Shopee usa o mesmo campo
    
    // Rastreamento
    tracking_code: 'Tracking Number',
    shipping_method: 'Shipping Provider',
    
    // Valores
    total: 'Order Total',
    shipping_cost: 'Shipping Fee',
    
    // Endereço de Entrega
    street: 'Recipient Address',
    number: '', // Shopee não separa
    complement: '',
    neighborhood: '',
    city: 'City',
    state: 'State',
    zip_code: 'Zip Code',
    country: 'Country',
    
    // Produto
    product_name: 'Product Name',
    product_quantity: 'Quantity',
    product_price: 'Product Price',
    product_sku: 'Product SKU',
    
    // Opcionais
    payment_method: 'Payment Method',
    notes: 'Buyer Note',
  },
  
  transformers: {
    phone: transformShopeePhone,
    date: transformShopeeDate,
    orderStatus: transformShopeeOrderStatus,
    shippingStatus: transformShopeeShippingStatus,
    money: transformShopeeMoney,
    zipCode: transformShopeeZipCode,
  },
  
  // Processador customizado para agrupar produtos
  customProcessor: (rows: Record<string, string>[]): NormalizedOrder[] => {
    const ordersMap = new Map<string, NormalizedOrder>();
    
    for (const row of rows) {
      const orderId = row['Order ID'] || '';
      
      if (!ordersMap.has(orderId)) {
        // Criar novo pedido
        const fullAddress = row['Recipient Address'] || '';
        
        // Tentar extrair número do endereço (padrão: "Rua, 123")
        const addressMatch = fullAddress.match(/^(.+?),\s*(\d+)(.*)$/);
        const street = addressMatch ? addressMatch[1] : fullAddress;
        const number = addressMatch ? addressMatch[2] : '';
        const complement = addressMatch ? addressMatch[3].trim() : '';
        
        ordersMap.set(orderId, {
          order_id: orderId,
          customer_email: row['Buyer Email'] || '',
          customer_name: row['Recipient Name'] || '',
          customer_phone: transformShopeePhone(row['Phone Number'] || ''),
          order_date: transformShopeeDate(row['Order Creation Date'] || ''),
          order_status: transformShopeeOrderStatus(row['Order Status'] || ''),
          shipping_status: transformShopeeShippingStatus(row['Order Status'] || ''),
          tracking_code: row['Tracking Number'] || '',
          total: transformShopeeMoney(row['Order Total'] || '0'),
          shipping_cost: transformShopeeMoney(row['Shipping Fee'] || '0'),
          shipping_method: row['Shipping Provider'],
          payment_method: row['Payment Method'],
          shipping_address: {
            street,
            number,
            complement,
            neighborhood: '',
            city: row['City'] || '',
            state: row['State'] || '',
            zip_code: transformShopeeZipCode(row['Zip Code'] || ''),
            country: row['Country'] || 'Brasil',
          },
          items: [],
          notes: row['Buyer Note'],
          source_platform: 'shopee',
        });
      }
      
      // Adicionar item ao pedido
      const order = ordersMap.get(orderId)!;
      const productName = row['Product Name'] || '';
      const variation = row['Variation'] || '';
      const fullProductName = variation ? `${productName} - ${variation}` : productName;
      
      order.items.push({
        name: fullProductName,
        price: transformShopeeMoney(row['Product Price'] || '0'),
        quantity: parseInt(row['Quantity'] || '1') || 1,
        sku: row['Product SKU'],
      });
    }
    
    return Array.from(ordersMap.values());
  },
};
