/**
 * Validador de Dados com Correções Automáticas
 * Valida pedidos normalizados e aplica correções quando possível
 */

import type { NormalizedOrder, ValidationResult, ValidationError } from './types';

// DDDs válidos do Brasil
const VALID_BRAZILIAN_DDDS = [
  11, 12, 13, 14, 15, 16, 17, 18, 19, // São Paulo
  21, 22, 24, // Rio de Janeiro
  27, 28, // Espírito Santo
  31, 32, 33, 34, 35, 37, 38, // Minas Gerais
  41, 42, 43, 44, 45, 46, // Paraná
  47, 48, 49, // Santa Catarina
  51, 53, 54, 55, // Rio Grande do Sul
  61, // Distrito Federal
  62, 64, // Goiás
  63, // Tocantins
  65, 66, // Mato Grosso
  67, // Mato Grosso do Sul
  68, // Acre
  69, // Rondônia
  71, 73, 74, 75, 77, // Bahia
  79, // Sergipe
  81, 87, // Pernambuco
  82, // Alagoas
  83, // Paraíba
  84, // Rio Grande do Norte
  85, 88, // Ceará
  86, 89, // Piauí
  91, 93, 94, // Pará
  92, 97, // Amazonas
  95, // Roraima
  96, // Amapá
  98, 99, // Maranhão
];

/**
 * Valida email
 */
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida telefone brasileiro
 */
function validatePhone(phone: string): { valid: boolean; fixed?: string; error?: string } {
  if (!phone || phone.trim() === '') {
    return { valid: true }; // Telefone vazio é válido (campo opcional)
  }
  
  const cleaned = phone.replace(/\D/g, '');
  
  // Se não tem dígitos após limpar, considerar vazio
  if (cleaned.length === 0) {
    return { valid: true };
  }
  
  // Remove código do país se presente
  const phoneToValidate = cleaned.startsWith('55') ? cleaned.substring(2) : cleaned;
  
  // Valida tamanho
  if (phoneToValidate.length !== 10 && phoneToValidate.length !== 11) {
    return { 
      valid: false, 
      error: `Telefone com ${phoneToValidate.length} dígitos (esperado: 10 ou 11)` 
    };
  }
  
  // Valida DDD
  const ddd = parseInt(phoneToValidate.substring(0, 2), 10);
  if (!VALID_BRAZILIAN_DDDS.includes(ddd)) {
    return { valid: false, error: `DDD ${ddd} inválido` };
  }
  
  // Valida primeiro dígito do número
  const firstDigit = phoneToValidate[2];
  if (phoneToValidate.length === 11 && firstDigit !== '9') {
    return { 
      valid: false, 
      error: 'Celular (11 dígitos) deve começar com 9' 
    };
  }
  
  if (phoneToValidate.length === 10 && !['2', '3', '4', '5'].includes(firstDigit)) {
    return { 
      valid: false, 
      error: 'Fixo (10 dígitos) deve começar com 2-5' 
    };
  }
  
  // Retorna apenas o número limpo sem código do país
  return { valid: true, fixed: phoneToValidate };
}

/**
 * Valida CEP
 */
function validateZipCode(zipCode: string): { valid: boolean; fixed?: string; error?: string } {
  if (!zipCode) {
    return { valid: false, error: 'CEP vazio' };
  }
  
  const cleaned = zipCode.replace(/\D/g, '');
  
  if (cleaned.length !== 8) {
    return { 
      valid: false, 
      error: `CEP com ${cleaned.length} dígitos (esperado: 8)` 
    };
  }
  
  // Adiciona zeros à esquerda se necessário
  const fixed = cleaned.padStart(8, '0');
  return { valid: true, fixed };
}

/**
 * Valida código de rastreio
 */
function validateTrackingCode(code: string): { valid: boolean; error?: string } {
  if (!code || code.trim().length === 0) {
    return { valid: false, error: 'Código de rastreio vazio' };
  }
  
  // Aceita qualquer código com pelo menos 10 caracteres
  if (code.length < 10) {
    return { 
      valid: false, 
      error: 'Código de rastreio muito curto (mínimo: 10 caracteres)' 
    };
  }
  
  return { valid: true };
}

/**
 * Valida data (deve estar no passado ou presente)
 */
function validateDate(dateStr: string): { valid: boolean; error?: string } {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    
    if (isNaN(date.getTime())) {
      return { valid: false, error: 'Data inválida' };
    }
    
    // Aviso se data está no futuro
    if (date > now) {
      return { 
        valid: true, 
        error: 'Data no futuro (possível erro de importação)' 
      };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'Formato de data inválido' };
  }
}

/**
 * Valida endereço
 */
function validateAddress(address: NormalizedOrder['shipping_address']): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!address.street) {
    errors.push({
      row: 0,
      field: 'street',
      value: address.street,
      message: 'Rua não informada',
      severity: 'error',
    });
  }
  
  if (!address.number) {
    errors.push({
      row: 0,
      field: 'number',
      value: address.number,
      message: 'Número não informado',
      severity: 'warning',
    });
  }
  
  if (!address.neighborhood) {
    errors.push({
      row: 0,
      field: 'neighborhood',
      value: address.neighborhood,
      message: 'Bairro não informado',
      severity: 'warning',
    });
  }
  
  if (!address.city) {
    errors.push({
      row: 0,
      field: 'city',
      value: address.city,
      message: 'Cidade não informada',
      severity: 'error',
    });
  }
  
  if (!address.state) {
    errors.push({
      row: 0,
      field: 'state',
      value: address.state,
      message: 'Estado não informado',
      severity: 'error',
    });
  }
  
  return errors;
}

/**
 * Valida um pedido completo
 */
export function validateOrder(
  order: NormalizedOrder,
  rowIndex: number,
  autoFix: boolean = true
): { 
  order: NormalizedOrder;
  errors: ValidationError[];
  warnings: ValidationError[];
  fixed: boolean;
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  let fixed = false;
  const fixedOrder = { ...order };
  
  // Valida email
  if (!validateEmail(order.customer_email)) {
    errors.push({
      row: rowIndex,
      field: 'customer_email',
      value: order.customer_email,
      message: 'Email inválido',
      severity: 'error',
    });
  }
  
  // Valida telefone principal (apenas se fornecido)
  if (order.customer_phone && order.customer_phone.trim() !== '') {
    const phoneValidation = validatePhone(order.customer_phone);
    if (!phoneValidation.valid) {
      errors.push({
        row: rowIndex,
        field: 'customer_phone',
        value: order.customer_phone,
        message: phoneValidation.error || 'Telefone inválido',
        severity: 'error',
      });
    } else if (autoFix && phoneValidation.fixed && phoneValidation.fixed !== order.customer_phone) {
      fixedOrder.customer_phone = phoneValidation.fixed;
      fixed = true;
    }
  }
  
  // Valida telefone alternativo (apenas se fornecido)
  if (order.customer_phone_alt) {
    const phoneAltValidation = validatePhone(order.customer_phone_alt);
    if (!phoneAltValidation.valid) {
      warnings.push({
        row: rowIndex,
        field: 'customer_phone_alt',
        value: order.customer_phone_alt,
        message: phoneAltValidation.error || 'Telefone alternativo inválido',
        severity: 'warning',
      });
    } else if (autoFix && phoneAltValidation.fixed && phoneAltValidation.fixed !== order.customer_phone_alt) {
      fixedOrder.customer_phone_alt = phoneAltValidation.fixed;
      fixed = true;
    }
  }
  
  // Valida CEP
  const zipValidation = validateZipCode(order.shipping_address.zip_code);
  if (!zipValidation.valid) {
    errors.push({
      row: rowIndex,
      field: 'zip_code',
      value: order.shipping_address.zip_code,
      message: zipValidation.error || 'CEP inválido',
      severity: 'error',
    });
  } else if (autoFix && zipValidation.fixed && zipValidation.fixed !== order.shipping_address.zip_code) {
    fixedOrder.shipping_address.zip_code = zipValidation.fixed;
    fixed = true;
  }
  
  // Valida código de rastreio
  const trackingValidation = validateTrackingCode(order.tracking_code);
  if (!trackingValidation.valid) {
    errors.push({
      row: rowIndex,
      field: 'tracking_code',
      value: order.tracking_code,
      message: trackingValidation.error || 'Código de rastreio inválido',
      severity: 'error',
    });
  }
  
  // Valida data
  const dateValidation = validateDate(order.order_date);
  if (!dateValidation.valid) {
    errors.push({
      row: rowIndex,
      field: 'order_date',
      value: order.order_date,
      message: dateValidation.error || 'Data inválida',
      severity: 'error',
    });
  } else if (dateValidation.error) {
    // Data válida mas com aviso
    warnings.push({
      row: rowIndex,
      field: 'order_date',
      value: order.order_date,
      message: dateValidation.error,
      severity: 'warning',
    });
  }
  
  // Valida endereço
  const addressErrors = validateAddress(order.shipping_address);
  errors.push(...addressErrors.filter(e => e.severity === 'error').map(e => ({ ...e, row: rowIndex })));
  warnings.push(...addressErrors.filter(e => e.severity === 'warning').map(e => ({ ...e, row: rowIndex })));
  
  // Valida items
  if (order.items.length === 0) {
    warnings.push({
      row: rowIndex,
      field: 'items',
      value: null,
      message: 'Pedido sem produtos',
      severity: 'warning',
    });
  }
  
  // Valida total
  if (order.total <= 0) {
    errors.push({
      row: rowIndex,
      field: 'total',
      value: order.total,
      message: 'Valor total inválido',
      severity: 'error',
    });
  }
  
  return { order: fixedOrder, errors, warnings, fixed };
}

/**
 * Valida lista completa de pedidos
 */
export function validateOrders(
  orders: NormalizedOrder[],
  autoFix: boolean = true
): ValidationResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];
  const fixedOrders: NormalizedOrder[] = [];
  let fixedCount = 0;
  let validCount = 0;
  let invalidCount = 0;
  let multiProductCount = 0;
  
  orders.forEach((order, index) => {
    const result = validateOrder(order, index + 1, autoFix);
    
    if (result.fixed) {
      fixedCount++;
      fixedOrders.push(result.order);
    } else {
      fixedOrders.push(order);
    }
    
    if (result.errors.length === 0) {
      validCount++;
    } else {
      invalidCount++;
    }
    
    if (order.items.length > 1) {
      multiProductCount++;
    }
    
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  });
  
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    fixedRows: fixedCount,
    totalRows: orders.length,
    stats: {
      validOrders: validCount,
      invalidOrders: invalidCount,
      multiProductOrders: multiProductCount,
    },
  };
}
