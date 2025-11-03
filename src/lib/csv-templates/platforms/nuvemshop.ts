/**
 * Template NuvemShop
 * Configuração específica para importação de pedidos da NuvemShop
 */

import type {
  EcommerceTemplate,
  OrderStatus,
  ShippingStatus,
  NormalizedOrder,
} from '../types';

// ===== TRANSFORMADORES NUVEMSHOP =====

/**
 * Transforma telefone do formato Excel (notação científica) para string
 * Exemplo: 5,582E+12 → "5582..."
 */
export function transformPhone(value: string): string {
  if (!value) return '';
  
  // Remove espaços e caracteres especiais
  let cleaned = value.toString().replace(/[^\d.E+-]/g, '');
  
  // Se está em notação científica
  if (cleaned.includes('E') || cleaned.includes('e')) {
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      cleaned = num.toFixed(0);
    }
  }
  
  // Remove zeros à esquerda exceto se for número de telefone válido
  cleaned = cleaned.replace(/^0+/, '');
  
  return cleaned;
}

/**
 * Transforma data do formato PT-BR para ISO 8601
 * Exemplo: "30/09/2025 21:15" → "2025-09-30T21:15:00Z"
 */
export function transformDate(value: string): string {
  if (!value) return new Date().toISOString();
  
  try {
    // Formato: DD/MM/YYYY HH:MM
    const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
    if (match) {
      const [, day, month, year, hour, minute] = match;
      return `${year}-${month}-${day}T${hour}:${minute}:00Z`;
    }
    
    // Fallback: tentar parse direto
    const date = new Date(value);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Mapeia status do pedido NuvemShop para status padronizado
 */
export function transformOrderStatus(value: string): OrderStatus {
  const normalized = value.toLowerCase().trim();
  
  const mapping: Record<string, OrderStatus> = {
    'aberto': 'open',
    'open': 'open',
    'pago': 'paid',
    'paid': 'paid',
    'cancelado': 'cancelled',
    'cancelled': 'cancelled',
    'concluído': 'completed',
    'concluido': 'completed',
    'completed': 'completed',
  };
  
  return mapping[normalized] || 'open';
}

/**
 * Mapeia status de envio NuvemShop para status padronizado
 */
export function transformShippingStatus(value: string): ShippingStatus {
  const normalized = value.toLowerCase().trim();
  
  const mapping: Record<string, ShippingStatus> = {
    'pendente': 'pending',
    'pending': 'pending',
    'enviado': 'shipped',
    'shipped': 'shipped',
    'em trânsito': 'in_transit',
    'em transito': 'in_transit',
    'in_transit': 'in_transit',
    'entregue': 'delivered',
    'delivered': 'delivered',
    'devolvido': 'returned',
    'returned': 'returned',
  };
  
  return mapping[normalized] || 'pending';
}

/**
 * Transforma valor monetário string para number
 * Exemplo: "195.5" → 195.50
 */
export function transformMoney(value: string): number {
  if (!value) return 0;
  
  const cleaned = value.toString().replace(/[^\d.,-]/g, '');
  const normalized = cleaned.replace(',', '.');
  const num = parseFloat(normalized);
  
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Transforma CEP para formato padronizado (8 dígitos)
 */
export function transformZipCode(value: string): string {
  if (!value) return '';
  
  const cleaned = value.toString().replace(/\D/g, '');
  
  // Adiciona zeros à esquerda se necessário
  return cleaned.padStart(8, '0');
}

// ===== TEMPLATE NUVEMSHOP =====

export const nuvemshopTemplate: EcommerceTemplate = {
  platform: 'nuvemshop',
  name: 'NuvemShop',
  
  detection: {
    // Headers únicos da NuvemShop
    uniqueHeaders: [
      'Número do Pedido',
      'Status do Pedido',
      'Status do Envio',
      'Forma de Entrega',
      'Código de rastreio do envio',
    ],
    
    // Headers obrigatórios
    requiredHeaders: [
      'Número do Pedido',
      'E-mail',
      'Nome do comprador',
      'Telefone',
      'Código de rastreio do envio',
    ],
    
    minConfidence: 80,
    
    dataPatterns: {
      // NuvemShop usa códigos de rastreio com formato específico
      tracking: /^[A-Z]{2}\d{9,13}[A-Z]{2,3}$/i, // Ex: SM9681306764ZUJ
      orderId: /^\d+$/,
    },
  },
  
  mapping: {
    // Campos obrigatórios
    order_id: 'Número do Pedido',
    customer_email: 'E-mail',
    customer_name: 'Nome do comprador',
    customer_phone: 'Telefone',
    order_date: 'Data',
    order_status: 'Status do Pedido',
    shipping_status: 'Status do Envio',
    tracking_code: 'Código de rastreio do envio',
    total: 'Total',
    
    // Endereço
    street: 'Endereço',
    number: 'Número',
    complement: 'Complemento',
    neighborhood: 'Bairro',
    city: 'Cidade',
    state: 'Estado',
    zip_code: 'Código postal',
    country: 'País',
    
    // Produto
    product_name: 'Nome do Produto',
    product_price: 'Valor do Produto',
    product_quantity: 'Quantidade Comprada',
    
    // Opcionais
    customer_phone_alt: 'Telefone para a entrega',
    shipping_cost: 'Valor do Frete',
    shipping_method: 'Forma de Entrega',
    payment_method: 'Forma de Pagamento',
    product_sku: 'SKU',
    notes: 'Anotações do Comprador',
  },
  
  transformers: {
    phone: transformPhone,
    date: transformDate,
    orderStatus: transformOrderStatus,
    shippingStatus: transformShippingStatus,
    money: transformMoney,
    zipCode: transformZipCode,
  },
  
  // Processador customizado para NuvemShop
  customProcessor: (rows: Record<string, string>[]): NormalizedOrder[] => {
    const ordersMap = new Map<string, NormalizedOrder>();
    
    rows.forEach((row) => {
      const orderId = row['Número do Pedido'];
      if (!orderId) return;
      
      // Se pedido já existe, adiciona produto
      if (ordersMap.has(orderId)) {
        const order = ordersMap.get(orderId)!;
        
        // Adiciona produto se tiver nome
        const productName = row['Nome do Produto'];
        if (productName) {
          order.items.push({
            name: productName,
            price: transformMoney(row['Valor do Produto'] || '0'),
            quantity: parseInt(row['Quantidade Comprada'] || '1', 10),
            sku: row['SKU'],
          });
        }
      } else {
        // Cria novo pedido
        const order: NormalizedOrder = {
          order_id: orderId,
          customer_email: row['E-mail'] || '',
          customer_name: row['Nome do comprador'] || '',
          customer_phone: transformPhone(row['Telefone'] || ''),
          customer_phone_alt: row['Telefone para a entrega'] 
            ? transformPhone(row['Telefone para a entrega'])
            : undefined,
          order_date: transformDate(row['Data'] || ''),
          order_status: transformOrderStatus(row['Status do Pedido'] || 'open'),
          shipping_status: transformShippingStatus(row['Status do Envio'] || 'pending'),
          tracking_code: row['Código de rastreio do envio'] || '',
          total: transformMoney(row['Total'] || '0'),
          shipping_cost: row['Valor do Frete'] 
            ? transformMoney(row['Valor do Frete'])
            : undefined,
          shipping_method: row['Forma de Entrega'],
          payment_method: row['Forma de Pagamento'],
          shipping_address: {
            street: row['Endereço'] || '',
            number: row['Número'] || '',
            complement: row['Complemento'],
            neighborhood: row['Bairro'] || '',
            city: row['Cidade'] || '',
            state: row['Estado'] || '',
            zip_code: transformZipCode(row['Código postal'] || ''),
            country: row['País'] || 'Brasil',
          },
          items: [],
          notes: row['Anotações do Comprador'],
          source_platform: 'nuvemshop',
        };
        
        // Adiciona primeiro produto
        const productName = row['Nome do Produto'];
        if (productName) {
          order.items.push({
            name: productName,
            price: transformMoney(row['Valor do Produto'] || '0'),
            quantity: parseInt(row['Quantidade Comprada'] || '1', 10),
            sku: row['SKU'],
          });
        }
        
        ordersMap.set(orderId, order);
      }
    });
    
    return Array.from(ordersMap.values());
  },
};
