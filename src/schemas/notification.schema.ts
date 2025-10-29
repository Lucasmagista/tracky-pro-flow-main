/**
 * Schemas de Validação - Notifications
 * 
 * Validações Zod para notificações, templates e configurações
 */

import { z } from 'zod';
import { emailSchema, phoneSchema } from './order.schema';

/**
 * Schema para canal de notificação
 */
export const notificationChannelSchema = z.enum(['email', 'sms', 'whatsapp', 'push']);

/**
 * Schema para prioridade de notificação
 */
export const notificationPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);

/**
 * Schema para status de notificação
 */
export const notificationStatusSchema = z.enum([
  'pending',
  'sent',
  'delivered',
  'failed',
  'bounced',
  'cancelled',
]);

/**
 * Schema para template de notificação
 */
export const notificationTemplateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100).trim(),
  channel: notificationChannelSchema,
  subject: z.string().max(200).optional(), // Para email
  body: z.string().min(1, 'Corpo da mensagem é obrigatório').max(5000),
  variables: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Schema para variáveis de template
 */
export const templateVariablesSchema = z.object({
  customer_name: z.string().optional(),
  tracking_code: z.string().optional(),
  order_number: z.string().optional(),
  status: z.string().optional(),
  carrier: z.string().optional(),
  estimated_delivery: z.string().optional(),
  delivery_address: z.string().optional(),
  tracking_url: z.string().url().optional(),
  custom: z.record(z.string()).optional(),
});

/**
 * Schema para envio de notificação
 */
export const sendNotificationSchema = z.object({
  channel: notificationChannelSchema,
  recipient: z.union([emailSchema, phoneSchema]),
  template_id: z.string().uuid().optional(),
  subject: z.string().max(200).optional(),
  body: z.string().min(1, 'Corpo da mensagem é obrigatório').max(5000),
  variables: templateVariablesSchema.optional(),
  priority: notificationPrioritySchema.default('normal'),
  scheduled_at: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Schema para notificação agendada
 */
export const scheduledNotificationSchema = z.object({
  channel: notificationChannelSchema,
  recipient: z.union([emailSchema, phoneSchema]),
  template_id: z.string().uuid(),
  variables: templateVariablesSchema,
  scheduled_at: z.string().datetime(),
  timezone: z.string().default('America/Sao_Paulo'),
  repeat: z
    .enum(['once', 'daily', 'weekly', 'monthly'])
    .default('once')
    .optional(),
  expires_at: z.string().datetime().optional(),
});

/**
 * Schema para configuração SMTP
 */
export const smtpConfigSchema = z.object({
  host: z.string().min(1, 'Host é obrigatório'),
  port: z.number().int().positive().default(587),
  username: z.string().min(1, 'Username é obrigatório'),
  password: z.string().min(1, 'Password é obrigatório'),
  from_email: emailSchema,
  from_name: z.string().max(100).optional(),
  use_tls: z.boolean().default(true),
  use_ssl: z.boolean().default(false),
});

/**
 * Schema para configuração Twilio (SMS)
 */
export const twilioConfigSchema = z.object({
  account_sid: z
    .string()
    .min(1, 'Account SID é obrigatório')
    .regex(/^AC[a-f0-9]{32}$/, 'Account SID inválido'),
  auth_token: z.string().min(1, 'Auth Token é obrigatório'),
  phone_number: phoneSchema,
  messaging_service_sid: z.string().optional(),
});

/**
 * Schema para configuração WhatsApp
 */
export const whatsappConfigSchema = z.object({
  api_url: z.string().url('URL da API inválida'),
  api_key: z.string().min(1, 'API Key é obrigatória').optional(),
  session_name: z
    .string()
    .min(1, 'Nome da sessão é obrigatório')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Nome da sessão deve conter apenas letras, números, - e _'),
  webhook_url: z.string().url().optional(),
  auto_reconnect: z.boolean().default(true),
});

/**
 * Schema para configuração de provedor de notificação
 */
export const notificationProviderSchema = z.object({
  channel: notificationChannelSchema,
  is_enabled: z.boolean().default(false),
  config: z.union([smtpConfigSchema, twilioConfigSchema, whatsappConfigSchema]),
  daily_limit: z.number().int().positive().optional(),
  rate_limit: z.number().int().positive().optional(), // por minuto
});

/**
 * Schema para filtro de notificações
 */
export const notificationFilterSchema = z.object({
  channel: notificationChannelSchema.optional(),
  status: notificationStatusSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  recipient: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

/**
 * Schema para estatísticas de notificação
 */
export const notificationStatsSchema = z.object({
  total_sent: z.number().int().min(0),
  total_delivered: z.number().int().min(0),
  total_failed: z.number().int().min(0),
  delivery_rate: z.number().min(0).max(100),
  by_channel: z.record(
    z.object({
      sent: z.number().int().min(0),
      delivered: z.number().int().min(0),
      failed: z.number().int().min(0),
    })
  ),
  period: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
});

/**
 * Type exports
 */
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;
export type NotificationPriority = z.infer<typeof notificationPrioritySchema>;
export type NotificationStatus = z.infer<typeof notificationStatusSchema>;
export type NotificationTemplate = z.infer<typeof notificationTemplateSchema>;
export type TemplateVariables = z.infer<typeof templateVariablesSchema>;
export type SendNotification = z.infer<typeof sendNotificationSchema>;
export type ScheduledNotification = z.infer<typeof scheduledNotificationSchema>;
export type SmtpConfig = z.infer<typeof smtpConfigSchema>;
export type TwilioConfig = z.infer<typeof twilioConfigSchema>;
export type WhatsAppConfig = z.infer<typeof whatsappConfigSchema>;
export type NotificationProvider = z.infer<typeof notificationProviderSchema>;
export type NotificationFilter = z.infer<typeof notificationFilterSchema>;
export type NotificationStats = z.infer<typeof notificationStatsSchema>;
