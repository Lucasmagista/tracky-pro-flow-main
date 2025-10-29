/**
 * Schemas de Validação - Orders
 * 
 * Validações Zod para pedidos, clientes e importação
 */

import { z } from 'zod';
import { trackingCodeSchema, carrierSchema, trackingStatusSchema } from './tracking.schema';

/**
 * Schema para telefone (formato internacional)
 */
export const phoneSchema = z
  .string()
  .regex(
    /^\+?[1-9]\d{1,14}$/,
    'Telefone inválido. Use formato internacional: +5511999999999'
  )
  .or(z.string().length(0)); // Permite vazio

/**
 * Schema para email
 */
export const emailSchema = z
  .string()
  .email('Email inválido')
  .max(255, 'Email muito longo')
  .toLowerCase()
  .trim();

/**
 * Schema para endereço
 */
export const addressSchema = z.object({
  street: z.string().min(1, 'Rua é obrigatória').max(200),
  number: z.string().max(20),
  complement: z.string().max(100).optional(),
  neighborhood: z.string().max(100).optional(),
  city: z.string().min(1, 'Cidade é obrigatória').max(100),
  state: z.string().length(2, 'Estado deve ter 2 letras').toUpperCase(),
  zipCode: z
    .string()
    .regex(/^\d{5}-?\d{3}$/, 'CEP inválido. Use formato: 12345-678 ou 12345678'),
  country: z.string().length(2, 'País deve ser código ISO de 2 letras').default('BR'),
});

/**
 * Schema para informações do cliente
 */
export const customerSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200).trim(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  document: z.string().max(20).optional(), // CPF/CNPJ
  address: addressSchema.optional(),
});

/**
 * Schema para criação de pedido
 */
export const createOrderSchema = z.object({
  trackingCode: trackingCodeSchema,
  customerName: z.string().min(1, 'Nome do cliente é obrigatório').max(200).trim(),
  customerEmail: emailSchema.optional(),
  customerPhone: phoneSchema.optional(),
  carrier: carrierSchema.optional(),
  status: trackingStatusSchema.default('pending'),
  externalId: z.string().max(100).optional(),
  marketplace: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Schema para atualização de pedido
 */
export const updateOrderSchema = createOrderSchema.partial().extend({
  id: z.string().uuid('ID inválido'),
});

/**
 * Schema para filtro de pedidos
 */
export const orderFilterSchema = z.object({
  status: trackingStatusSchema.optional(),
  carrier: carrierSchema.optional(),
  marketplace: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().max(200).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

/**
 * Schema para importação CSV
 */
export const csvImportSchema = z.object({
  source: z.literal('csv'),
  mappings: z.object({
    trackingCode: z.string().min(1, 'Coluna de tracking code é obrigatória'),
    customerName: z.string().min(1, 'Coluna de nome do cliente é obrigatória'),
    customerEmail: z.string().optional(),
    customerPhone: z.string().optional(),
    carrier: z.string().optional(),
  }),
  validateBeforeImport: z.boolean().default(true),
  skipDuplicates: z.boolean().default(true),
});

/**
 * Schema para importação de marketplace
 */
export const marketplaceImportSchema = z.object({
  source: z.enum(['shopify', 'woocommerce', 'mercadolivre', 'nuvemshop']),
  integrationId: z.string().uuid('ID de integração inválido'),
  filters: z
    .object({
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional(),
      status: z.string().optional(),
    })
    .optional(),
  autoSync: z.boolean().default(false),
});

/**
 * Schema para batch de importação
 */
export const importBatchSchema = z.object({
  source: z.enum(['csv', 'shopify', 'woocommerce', 'mercadolivre', 'nuvemshop', 'manual']),
  totalRecords: z.number().int().positive(),
  successCount: z.number().int().min(0),
  errorCount: z.number().int().min(0),
  status: z.enum(['processing', 'completed', 'failed', 'rolled_back']),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Type exports
 */
export type Phone = z.infer<typeof phoneSchema>;
export type Email = z.infer<typeof emailSchema>;
export type Address = z.infer<typeof addressSchema>;
export type Customer = z.infer<typeof customerSchema>;
export type CreateOrder = z.infer<typeof createOrderSchema>;
export type UpdateOrder = z.infer<typeof updateOrderSchema>;
export type OrderFilter = z.infer<typeof orderFilterSchema>;
export type CsvImport = z.infer<typeof csvImportSchema>;
export type MarketplaceImport = z.infer<typeof marketplaceImportSchema>;
export type ImportBatch = z.infer<typeof importBatchSchema>;
