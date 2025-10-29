/**
 * Sanitization Utilities
 * 
 * Funções para sanitizar e validar dados de entrada do usuário
 * Prevenção contra XSS, SQL Injection e outros ataques
 */

import DOMPurify from 'dompurify';

/**
 * Sanitiza HTML removendo scripts e tags perigosas
 * Usa DOMPurify para limpeza segura
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitiza texto puro removendo caracteres especiais perigosos
 * Mantém apenas caracteres seguros
 */
export function sanitizePlainText(text: string): string {
  return text
    .replace(/[<>]/g, '') // Remove < e >
    .replace(/javascript:/gi, '') // Remove javascript:
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Sanitiza email removendo espaços e convertendo para minúsculas
 */
export function sanitizeEmail(email: string): string {
  return email
    .toLowerCase()
    .trim()
    .replace(/\s/g, '');
}

/**
 * Sanitiza telefone removendo caracteres não numéricos
 * Mantém apenas números e +
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

/**
 * Sanitiza URL garantindo que seja http ou https
 * Remove javascript: e data: URIs
 */
export function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  
  // Bloquear protocolos perigosos
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:')
  ) {
    return '';
  }

  // Garantir protocolo seguro
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

/**
 * Sanitiza nome de arquivo removendo caracteres perigosos
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Apenas alfanuméricos, ponto, hífen, underscore
    .replace(/\.{2,}/g, '.') // Prevenir directory traversal (..)
    .replace(/^\.+/, '') // Remove pontos no início
    .substring(0, 255); // Limitar tamanho
}

/**
 * Sanitiza JSON string removendo chaves perigosas
 */
export function sanitizeJsonString(jsonString: string): string {
  try {
    const parsed = JSON.parse(jsonString);
    const sanitized = sanitizeObject(parsed);
    return JSON.stringify(sanitized);
  } catch {
    return '{}';
  }
}

/**
 * Sanitiza objeto recursivamente
 */
export function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    if (typeof obj === 'string') {
      return sanitizePlainText(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Ignorar chaves que começam com __proto__, constructor, prototype
    if (['__proto__', 'constructor', 'prototype'].includes(key)) {
      continue;
    }
    
    sanitized[sanitizePlainText(key)] = sanitizeObject(value);
  }

  return sanitized;
}

/**
 * Sanitiza código de rastreamento
 * Permite apenas caracteres alfanuméricos, hífens e underscores
 */
export function sanitizeTrackingCode(code: string): string {
  return code
    .toUpperCase()
    .replace(/[^A-Z0-9\-_]/g, '')
    .substring(0, 50); // Limitar tamanho
}

/**
 * Sanitiza mensagem de notificação
 * Remove HTML mas permite formatação básica
 */
export function sanitizeNotificationMessage(message: string): string {
  // Primeiro sanitiza HTML
  const cleanHtml = sanitizeHtml(message);
  
  // Limitar tamanho
  return cleanHtml.substring(0, 5000);
}

/**
 * Sanitiza dados de cliente/pedido
 */
export interface CustomerData {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  document?: string;
}

export function sanitizeCustomerData(data: CustomerData): CustomerData {
  return {
    name: data.name ? sanitizePlainText(data.name) : undefined,
    email: data.email ? sanitizeEmail(data.email) : undefined,
    phone: data.phone ? sanitizePhone(data.phone) : undefined,
    address: data.address ? sanitizePlainText(data.address) : undefined,
    document: data.document ? data.document.replace(/[^\d]/g, '') : undefined,
  };
}

/**
 * Escape SQL para prevenção de SQL Injection
 * NOTA: Sempre prefira usar prepared statements/parameterized queries
 */
export function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Sanitiza parâmetros de URL/query string
 */
export function sanitizeQueryParam(param: string): string {
  return encodeURIComponent(sanitizePlainText(param));
}

/**
 * Valida e sanitiza webhook payload
 */
export function sanitizeWebhookPayload(payload: any): any {
  // Limitar tamanho do payload
  const jsonString = JSON.stringify(payload);
  if (jsonString.length > 1_000_000) { // 1MB
    throw new Error('Webhook payload too large');
  }

  return sanitizeObject(payload);
}

/**
 * Sanitiza headers HTTP
 */
export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    // Permitir apenas headers conhecidos e seguros
    const safeKey = key.toLowerCase();
    if (
      safeKey === 'content-type' ||
      safeKey === 'authorization' ||
      safeKey === 'user-agent' ||
      safeKey === 'accept' ||
      safeKey.startsWith('x-')
    ) {
      sanitized[key] = sanitizePlainText(value);
    }
  }

  return sanitized;
}

/**
 * Remove caracteres de controle Unicode
 */
export function removeControlCharacters(text: string): string {
  return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
}

/**
 * Sanitiza caminho de arquivo (prevenir directory traversal)
 */
export function sanitizePath(path: string): string {
  return path
    .replace(/\.\./g, '') // Remover ../
    .replace(/\\/g, '/') // Normalizar separadores
    .replace(/\/+/g, '/') // Remover // duplicados
    .replace(/^\//, ''); // Remover / inicial
}

/**
 * Valida e sanitiza configuração de integração
 */
export interface IntegrationConfig {
  api_key?: string;
  api_secret?: string;
  access_token?: string;
  webhook_url?: string;
  [key: string]: any;
}

export function sanitizeIntegrationConfig(config: IntegrationConfig): IntegrationConfig {
  const sanitized: IntegrationConfig = {};

  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string') {
      // URLs precisam de sanitização especial
      if (key.includes('url') || key.includes('webhook')) {
        sanitized[key] = sanitizeUrl(value);
      } else {
        sanitized[key] = sanitizePlainText(value);
      }
    } else {
      sanitized[key] = sanitizeObject(value);
    }
  }

  return sanitized;
}
