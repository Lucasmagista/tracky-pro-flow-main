/**
 * Template Mercado Livre
 * Configuração para importação de pedidos do Mercado Livre
 */

import type {
  EcommerceTemplate,
  OrderStatus,
  ShippingStatus,
  NormalizedOrder,
} from '../types';

// ===== TRANSFORMADORES MERCADO LIVRE =====

export function transformMLDate(value: string): string {
  if (!value) return new Date().toISOString();
  
  // ML usa formato "DD/MM/YYYY HH:mm:ss" ou ISO
  try {
    // Tentar formato DD/MM/YYYY
    const ddmmRegex = /^(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2})?:?(\d{2})?:?(\d{2})?$/;
    const match = value.match(ddmmRegex);
    
    if (match) {
      const [, day, month, year, hour = '00', minute = '00', second = '00'] = match;
      const isoDate = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
      return isoDate;
    }
    
    // Tentar ISO direto
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch {
    // Fallback para data atual
  }
  
  return new Date().toISOString();
}

export function transformMLOrderStatus(value: string): OrderStatus {
  const status = value.toLowerCase().trim();
  
  const statusMap: Record<string, OrderStatus> = {
    'pending': 'open',
    'payment_required': 'open',
    'payment_in_process': 'open',
    'paid': 'paid',
    'cancelled': 'cancelled',
    'invalid': 'cancelled',
    'delivered': 'completed',
  };
  
  return statusMap[status] || 'open';
}

export function transformMLShippingStatus(value: string): ShippingStatus {
  const status = value.toLowerCase().trim();
  
  const statusMap: Record<string, ShippingStatus> = {
    'pending': 'pending',
    'handling': 'pending',
    'ready_to_ship': 'pending',
    'shipped': 'shipped',
    'delivered': 'delivered',
    'not_delivered': 'in_transit',
    'cancelled': 'returned',
    'returned': 'returned',
  };
  
  return statusMap[status] || 'pending';
}

export function transformMLPhone(value: string): string {
  if (!value) return '';
  
  // ML fornece telefone com código do país
  let cleaned = value.replace(/\D/g, '');
  
  // Remover +55 se existir
  if (cleaned.startsWith('55') && cleaned.length > 11) {
    cleaned = cleaned.substring(2);
  }
  
  return cleaned;
}

export function transformMLMoney(value: string): number {
  if (!value) return 0;
  
  // ML usa ponto como decimal
  const cleaned = value.toString()
    .replace(/[R$\s]/g, '')
    .replace(',', '');
  
  const number = parseFloat(cleaned);
  return isNaN(number) ? 0 : number;
}

export function transformMLZipCode(value: string): string {
  if (!value) return '';
  
  // Remove hífen e outros caracteres
  const cleaned = value.replace(/\D/g, '');
  
  // CEP brasileiro tem 8 dígitos
  if (cleaned.length <= 8) {
    return cleaned.padStart(8, '0');
  }
  
  return cleaned;
}

// ===== TEMPLATE MERCADO LIVRE =====

export const mercadolivreTemplate: EcommerceTemplate = {
  platform: 'mercadolivre',
  name: 'Mercado Livre',
  
  detection: {
    uniqueHeaders: [
      'ID da venda',
      'Apelido do comprador',
      'Status da venda',
      'Método de envio',
      'Código de rastreamento',
    ],
    requiredHeaders: [
      'E-mail do comprador',
      'Nome do comprador',
      'Total da venda',
      'Cidade',
      'Estado',
    ],
    minConfidence: 75,
    dataPatterns: {
      orderId: /^\d{10,}$/,
    },
  },
  
  mapping: {
    // Identificação
    order_id: 'ID da venda',
    customer_email: 'E-mail do comprador',
    customer_name: 'Nome do comprador',
    customer_phone: 'Telefone do comprador',
    customer_phone_alt: 'Telefone alternativo',
    
    // Datas
    order_date: 'Data da compra',
    
    // Status
    order_status: 'Status da venda',
    shipping_status: 'Status do envio',
    
    // Rastreamento
    tracking_code: 'Código de rastreamento',
    shipping_method: 'Método de envio',
    
    // Valores
    total: 'Total da venda',
    shipping_cost: 'Custo de envio',
    
    // Endereço de Entrega
    street: 'Rua',
    number: 'Número',
    complement: 'Complemento',
    neighborhood: 'Bairro',
    city: 'Cidade',
    state: 'Estado',
    zip_code: 'CEP',
    country: 'País',
    
    // Produto
    product_name: 'Título do anúncio',
    product_quantity: 'Quantidade',
    product_price: 'Preço unitário',
    product_sku: 'SKU',
    
    // Opcionais
    payment_method: 'Forma de pagamento',
    notes: 'Observações',
  },
  
  transformers: {
    phone: transformMLPhone,
    date: transformMLDate,
    orderStatus: transformMLOrderStatus,
    shippingStatus: transformMLShippingStatus,
    money: transformMLMoney,
    zipCode: transformMLZipCode,
  },
  
  // Processador customizado para agrupar produtos do mesmo pedido
  customProcessor: (rows: Record<string, string>[]): NormalizedOrder[] => {
    const ordersMap = new Map<string, NormalizedOrder>();
    
    for (const row of rows) {
      const orderId = row['ID da venda'] || '';
      
      if (!ordersMap.has(orderId)) {
        // Criar novo pedido
        ordersMap.set(orderId, {
          order_id: orderId,
          customer_email: row['E-mail do comprador'] || '',
          customer_name: row['Nome do comprador'] || '',
          customer_phone: transformMLPhone(row['Telefone do comprador'] || ''),
          order_date: transformMLDate(row['Data da compra'] || ''),
          order_status: transformMLOrderStatus(row['Status da venda'] || ''),
          shipping_status: transformMLShippingStatus(row['Status do envio'] || ''),
          tracking_code: row['Código de rastreamento'] || '',
          total: transformMLMoney(row['Total da venda'] || '0'),
          shipping_cost: transformMLMoney(row['Custo de envio'] || '0'),
          shipping_method: row['Método de envio'],
          payment_method: row['Forma de pagamento'],
          shipping_address: {
            street: row['Rua'] || '',
            number: row['Número'] || '',
            complement: row['Complemento'] || '',
            neighborhood: row['Bairro'] || '',
            city: row['Cidade'] || '',
            state: row['Estado'] || '',
            zip_code: transformMLZipCode(row['CEP'] || ''),
            country: row['País'] || 'Brasil',
          },
          items: [],
          notes: row['Observações'],
          source_platform: 'mercadolivre',
        });
      }
      
      // Adicionar item ao pedido
      const order = ordersMap.get(orderId)!;
      order.items.push({
        name: row['Título do anúncio'] || '',
        price: transformMLMoney(row['Preço unitário'] || '0'),
        quantity: parseInt(row['Quantidade'] || '1') || 1,
        sku: row['SKU'],
      });
    }
    
    return Array.from(ordersMap.values());
  },
};
