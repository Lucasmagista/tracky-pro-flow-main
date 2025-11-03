/**
 * Normalizador de Dados
 * Processa e transforma dados do CSV para formato padronizado
 */

import type { EcommerceTemplate, NormalizedOrder } from './types';

/**
 * Extrai valor de uma linha CSV usando o mapeamento do template
 */
function extractValue(
  row: Record<string, string>,
  columnName: string | undefined
): string {
  if (!columnName) return '';
  return row[columnName] || '';
}

/**
 * Normaliza uma linha CSV usando o template
 */
export function normalizeRow(
  row: Record<string, string>,
  template: EcommerceTemplate
): Partial<NormalizedOrder> {
  const { mapping, transformers } = template;
  
  // Extrai valores básicos
  const orderId = extractValue(row, mapping.order_id);
  const email = extractValue(row, mapping.customer_email);
  const name = extractValue(row, mapping.customer_name);
  const phone = extractValue(row, mapping.customer_phone);
  const phoneAlt = extractValue(row, mapping.customer_phone_alt);
  const date = extractValue(row, mapping.order_date);
  const orderStatus = extractValue(row, mapping.order_status);
  const shippingStatus = extractValue(row, mapping.shipping_status);
  const trackingCode = extractValue(row, mapping.tracking_code);
  const total = extractValue(row, mapping.total);
  const shippingCost = extractValue(row, mapping.shipping_cost);
  const shippingMethod = extractValue(row, mapping.shipping_method);
  const paymentMethod = extractValue(row, mapping.payment_method);
  
  // Endereço
  const street = extractValue(row, mapping.street);
  const number = extractValue(row, mapping.number);
  const complement = extractValue(row, mapping.complement);
  const neighborhood = extractValue(row, mapping.neighborhood);
  const city = extractValue(row, mapping.city);
  const state = extractValue(row, mapping.state);
  const zipCode = extractValue(row, mapping.zip_code);
  const country = extractValue(row, mapping.country);
  
  // Produto
  const productName = extractValue(row, mapping.product_name);
  const productPrice = extractValue(row, mapping.product_price);
  const productQuantity = extractValue(row, mapping.product_quantity);
  const productSku = extractValue(row, mapping.product_sku);
  
  const notes = extractValue(row, mapping.notes);
  
  // Aplica transformações
  return {
    order_id: orderId,
    customer_email: email.toLowerCase().trim(),
    customer_name: name.trim(),
    customer_phone: transformers.phone ? transformers.phone(phone) : phone,
    customer_phone_alt: phoneAlt && transformers.phone 
      ? transformers.phone(phoneAlt)
      : phoneAlt || undefined,
    order_date: transformers.date ? transformers.date(date) : date,
    order_status: transformers.orderStatus 
      ? transformers.orderStatus(orderStatus)
      : 'open',
    shipping_status: transformers.shippingStatus
      ? transformers.shippingStatus(shippingStatus)
      : 'pending',
    tracking_code: trackingCode.trim(),
    total: transformers.money ? transformers.money(total) : parseFloat(total) || 0,
    shipping_cost: shippingCost && transformers.money
      ? transformers.money(shippingCost)
      : undefined,
    shipping_method: shippingMethod || undefined,
    payment_method: paymentMethod || undefined,
    shipping_address: {
      street: street.trim(),
      number: number.trim(),
      complement: complement?.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: state.trim(),
      zip_code: transformers.zipCode ? transformers.zipCode(zipCode) : zipCode,
      country: country.trim() || 'Brasil',
    },
    items: productName ? [{
      name: productName.trim(),
      price: transformers.money 
        ? transformers.money(productPrice)
        : parseFloat(productPrice) || 0,
      quantity: parseInt(productQuantity || '1', 10),
      sku: productSku?.trim(),
    }] : [],
    notes: notes?.trim(),
    source_platform: template.platform,
  };
}

/**
 * Agrupa linhas com mesmo order_id em um único pedido
 * (para casos onde um pedido tem múltiplos produtos em linhas separadas)
 */
export function groupOrders(
  normalizedRows: Partial<NormalizedOrder>[]
): NormalizedOrder[] {
  const ordersMap = new Map<string, NormalizedOrder>();
  
  for (const row of normalizedRows) {
    if (!row.order_id) continue;
    
    // Se pedido já existe, adiciona item
    if (ordersMap.has(row.order_id)) {
      const existingOrder = ordersMap.get(row.order_id)!;
      
      // Adiciona items se existirem
      if (row.items && row.items.length > 0) {
        existingOrder.items.push(...row.items);
      }
    } else {
      // Cria novo pedido completo
      ordersMap.set(row.order_id, row as NormalizedOrder);
    }
  }
  
  return Array.from(ordersMap.values());
}

/**
 * Processa CSV completo usando o template
 */
export function processCSV(
  rows: Record<string, string>[],
  template: EcommerceTemplate
): NormalizedOrder[] {
  // Se template tem processor customizado, usa ele
  if (template.customProcessor) {
    return template.customProcessor(rows);
  }
  
  // Senão, usa o processamento padrão
  const normalizedRows = rows.map(row => normalizeRow(row, template));
  return groupOrders(normalizedRows);
}

/**
 * Limpa e normaliza texto (remove espaços extras, quebras de linha, etc.)
 */
export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Remove espaços múltiplos
    .replace(/[\r\n]+/g, ' ') // Remove quebras de linha
    .trim();
}

/**
 * Normaliza nome (capitaliza corretamente)
 */
export function normalizeName(name: string): string {
  return cleanText(name)
    .toLowerCase()
    .split(' ')
    .map(word => {
      // Não capitaliza conectores
      if (['de', 'da', 'do', 'dos', 'das', 'e'].includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Extrai estatísticas dos pedidos processados
 */
export function extractStats(orders: NormalizedOrder[]) {
  const stats = {
    totalOrders: orders.length,
    multiProductOrders: 0,
    totalItems: 0,
    totalValue: 0,
    platforms: new Map<string, number>(),
    statuses: {
      open: 0,
      paid: 0,
      cancelled: 0,
      completed: 0,
    },
    shippingStatuses: {
      pending: 0,
      shipped: 0,
      in_transit: 0,
      delivered: 0,
      returned: 0,
    },
  };
  
  for (const order of orders) {
    // Conta pedidos com múltiplos produtos
    if (order.items.length > 1) {
      stats.multiProductOrders++;
    }
    
    // Soma total de items
    stats.totalItems += order.items.reduce((sum, item) => sum + item.quantity, 0);
    
    // Soma valor total
    stats.totalValue += order.total;
    
    // Conta por plataforma
    const platformCount = stats.platforms.get(order.source_platform) || 0;
    stats.platforms.set(order.source_platform, platformCount + 1);
    
    // Conta por status
    stats.statuses[order.order_status]++;
    stats.shippingStatuses[order.shipping_status]++;
  }
  
  return stats;
}
