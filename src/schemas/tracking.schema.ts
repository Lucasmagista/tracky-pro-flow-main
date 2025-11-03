/**
 * Schemas de Validação - Tracking
 * 
 * Validações Zod para códigos de rastreamento, eventos e status
 */

import { z } from 'zod';

/**
 * Schema para código de rastreamento
 * Valida formato, tamanho e caracteres permitidos
 */
export const trackingCodeSchema = z
  .string()
  .min(8, 'Código deve ter no mínimo 8 caracteres')
  .max(50, 'Código deve ter no máximo 50 caracteres')
  .regex(
    /^[A-Z0-9-]+$/,
    'Código deve conter apenas letras maiúsculas, números e hífen'
  )
  .trim();

/**
 * Schema para status de rastreamento
 */
export const trackingStatusSchema = z.enum([
  'pending',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'failed',
  'returned',
  'cancelled',
  'exception',
]);

/**
 * Schema para transportadora
 */
export const carrierSchema = z.enum([
  'correios',
  'jadlog',
  'dhl',
  'fedex',
  'ups',
  'smartenvios',
  'melhorenvio',
  'total_express',
  'sequoia',
  'azul_cargo',
]);

/**
 * Schema para evento de rastreamento
 */
export const trackingEventSchema = z.object({
  date: z.string().datetime('Data deve estar no formato ISO 8601'),
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora inválida (use HH:MM ou HH:MM:SS)'),
  location: z.string().min(1, 'Local é obrigatório').max(200, 'Local muito longo'),
  description: z.string().min(1, 'Descrição é obrigatória').max(500, 'Descrição muito longa'),
  status: trackingStatusSchema,
});

/**
 * Schema para informações de rastreamento completas
 */
export const trackingInfoSchema = z.object({
  trackingCode: trackingCodeSchema,
  carrier: carrierSchema,
  status: trackingStatusSchema,
  estimatedDelivery: z.string().datetime().optional(),
  lastUpdate: z.string().datetime(),
  events: z.array(trackingEventSchema).min(1, 'Deve ter pelo menos um evento'),
  origin: z.string().max(200).optional(),
  destination: z.string().max(200).optional(),
  weight: z.number().positive().optional(),
  dimensions: z
    .object({
      length: z.number().positive(),
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .optional(),
});

/**
 * Schema para request de rastreamento
 */
export const trackingRequestSchema = z.object({
  trackingCode: trackingCodeSchema,
  carrier: carrierSchema.optional(),
  forceRefresh: z.boolean().default(false),
});

/**
 * Schema para múltiplos códigos de rastreamento
 */
export const bulkTrackingSchema = z.object({
  trackingCodes: z
    .array(trackingCodeSchema)
    .min(1, 'Deve fornecer pelo menos um código')
    .max(100, 'Máximo de 100 códigos por vez'),
  carrier: carrierSchema.optional(),
});

/**
 * Type exports para uso no TypeScript
 */
export type TrackingCode = z.infer<typeof trackingCodeSchema>;
export type TrackingStatus = z.infer<typeof trackingStatusSchema>;
export type Carrier = z.infer<typeof carrierSchema>;
export type TrackingEvent = z.infer<typeof trackingEventSchema>;
export type TrackingInfo = z.infer<typeof trackingInfoSchema>;
export type TrackingRequest = z.infer<typeof trackingRequestSchema>;
export type BulkTrackingRequest = z.infer<typeof bulkTrackingSchema>;
