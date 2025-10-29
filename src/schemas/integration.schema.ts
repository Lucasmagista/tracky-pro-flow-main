/**
 * Schemas de Validação - Integrations
 * 
 * Validações Zod para credenciais de integração e configurações
 */

import { z } from 'zod';

/**
 * Schema para URL
 */
export const urlSchema = z
  .string()
  .url('URL inválida')
  .max(500, 'URL muito longa')
  .trim();

/**
 * Schema para API Key genérica
 */
export const apiKeySchema = z
  .string()
  .min(10, 'API Key deve ter no mínimo 10 caracteres')
  .max(500, 'API Key muito longa')
  .trim();

/**
 * Schema para credenciais Nuvemshop
 */
export const nuvemshopCredentialsSchema = z.object({
  app_id: z.string().min(1, 'App ID é obrigatório'),
  app_secret: z.string().min(1, 'App Secret é obrigatório'),
  access_token: z.string().optional(),
  store_id: z.string().optional(),
  store_url: urlSchema.optional(),
});

/**
 * Schema para credenciais Smartenvios
 */
export const smartenviosCredentialsSchema = z.object({
  api_key: apiKeySchema,
  environment: z.enum(['sandbox', 'production']).default('production'),
  webhook_url: urlSchema.optional(),
});

/**
 * Schema para credenciais Shopify
 */
export const shopifyCredentialsSchema = z.object({
  shop_domain: z
    .string()
    .regex(/^[\w-]+\.myshopify\.com$/, 'Domínio Shopify inválido (ex: loja.myshopify.com)'),
  access_token: apiKeySchema,
  api_version: z.string().default('2024-01'),
});

/**
 * Schema para credenciais WooCommerce
 */
export const wooCommerceCredentialsSchema = z.object({
  store_url: urlSchema,
  consumer_key: z.string().min(1, 'Consumer Key é obrigatório'),
  consumer_secret: z.string().min(1, 'Consumer Secret é obrigatório'),
  api_version: z.string().default('wc/v3'),
});

/**
 * Schema para credenciais Mercado Livre
 */
export const mercadoLivreCredentialsSchema = z.object({
  client_id: z.string().min(1, 'Client ID é obrigatório'),
  client_secret: z.string().min(1, 'Client Secret é obrigatório'),
  access_token: apiKeySchema.optional(),
  refresh_token: z.string().optional(),
  expires_at: z.string().datetime().optional(),
  country: z.enum(['BR', 'AR', 'MX', 'CO', 'CL', 'PE', 'UY']).default('BR'),
});

/**
 * Schema para credenciais de transportadora genérica
 */
export const carrierCredentialsSchema = z.object({
  api_key: apiKeySchema,
  api_secret: z.string().optional(),
  environment: z.enum(['sandbox', 'production']).default('production'),
  webhook_url: urlSchema.optional(),
  extra: z.record(z.string()).optional(),
});

/**
 * Schema para configuração de integração
 */
export const integrationConfigSchema = z.object({
  provider: z.enum([
    'nuvemshop',
    'smartenvios',
    'shopify',
    'woocommerce',
    'mercadolivre',
    'correios',
    'jadlog',
    'dhl',
    'fedex',
  ]),
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  is_active: z.boolean().default(true),
  credentials: z.union([
    nuvemshopCredentialsSchema,
    smartenviosCredentialsSchema,
    shopifyCredentialsSchema,
    wooCommerceCredentialsSchema,
    mercadoLivreCredentialsSchema,
    carrierCredentialsSchema,
  ]),
  settings: z
    .object({
      auto_sync: z.boolean().default(false),
      sync_interval: z.number().int().positive().default(300), // segundos
      webhook_enabled: z.boolean().default(false),
      notification_enabled: z.boolean().default(true),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Schema para webhook configuration
 */
export const webhookConfigSchema = z.object({
  url: urlSchema,
  events: z
    .array(z.string())
    .min(1, 'Deve selecionar pelo menos um evento')
    .max(20, 'Máximo de 20 eventos'),
  secret: z.string().min(16, 'Secret deve ter no mínimo 16 caracteres').optional(),
  headers: z.record(z.string()).optional(),
  active: z.boolean().default(true),
  retry_on_fail: z.boolean().default(true),
  max_retries: z.number().int().min(0).max(5).default(3),
});

/**
 * Schema para validação de webhook payload
 */
export const webhookPayloadSchema = z.object({
  event: z.string().min(1, 'Evento é obrigatório'),
  data: z.record(z.unknown()),
  signature: z.string().optional(),
  timestamp: z.string().datetime(),
});

/**
 * Schema para teste de conexão
 */
export const connectionTestSchema = z.object({
  provider: z.string().min(1, 'Provider é obrigatório'),
  credentials: z.record(z.unknown()),
  timeout: z.number().int().positive().default(10000), // ms
});

/**
 * Type exports
 */
export type Url = z.infer<typeof urlSchema>;
export type ApiKey = z.infer<typeof apiKeySchema>;
export type NuvemshopCredentials = z.infer<typeof nuvemshopCredentialsSchema>;
export type SmartenviosCredentials = z.infer<typeof smartenviosCredentialsSchema>;
export type ShopifyCredentials = z.infer<typeof shopifyCredentialsSchema>;
export type WooCommerceCredentials = z.infer<typeof wooCommerceCredentialsSchema>;
export type MercadoLivreCredentials = z.infer<typeof mercadoLivreCredentialsSchema>;
export type CarrierCredentials = z.infer<typeof carrierCredentialsSchema>;
export type IntegrationConfig = z.infer<typeof integrationConfigSchema>;
export type WebhookConfig = z.infer<typeof webhookConfigSchema>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
export type ConnectionTest = z.infer<typeof connectionTestSchema>;
