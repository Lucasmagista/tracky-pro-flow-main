import { supabase } from '@/integrations/supabase/client';

export interface NotificationOptions {
  channel: 'email' | 'sms' | 'whatsapp';
  recipient: string;
  subject?: string;
  body: string;
  templateId?: string;
  variables?: Record<string, string>;
  metadata?: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high';
  retryAttempts?: number;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  deliveryStatus?: 'pending' | 'sent' | 'delivered' | 'failed';
}

interface ProviderConfig {
  is_enabled: boolean;
  config: Record<string, string>;
}

class NotificationService {
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 5000;

  /**
   * Envia uma notificação através do canal especificado
   */
  async send(options: NotificationOptions): Promise<NotificationResult> {
    try {
      // Log inicial
      const logId = await this.createLog(options);

      // Processar template se fornecido
      let body = options.body;
      let subject = options.subject;

      if (options.templateId) {
        const templateResult = await this.processTemplate(
          options.templateId,
          options.variables || {}
        );
        body = templateResult.body;
        subject = templateResult.subject;
      }

      // Tentar enviar com retry
      const retryAttempts = options.retryAttempts || this.MAX_RETRY_ATTEMPTS;
      let lastError: string | undefined;

      for (let attempt = 1; attempt <= retryAttempts; attempt++) {
        try {
          const result = await this.sendViaChannel({
            ...options,
            body,
            subject,
          });

          if (result.success) {
            // Atualizar log com sucesso
            await this.updateLog(logId, {
              status: 'sent',
              sent_at: new Date().toISOString(),
              delivery_status: result.deliveryStatus || 'sent',
            });

            return result;
          }

          lastError = result.error;
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Attempt ${attempt}/${retryAttempts} failed:`, lastError);
        }

        // Aguardar antes de tentar novamente (exceto na última tentativa)
        if (attempt < retryAttempts) {
          await this.delay(this.RETRY_DELAY_MS * attempt);
        }
      }

      // Todas as tentativas falharam
      await this.updateLog(logId, {
        status: 'failed',
        error_message: lastError || 'Failed after all retry attempts',
      });

      return {
        success: false,
        error: lastError || 'Failed after all retry attempts',
        deliveryStatus: 'failed',
      };
    } catch (error) {
      console.error('Error in NotificationService.send:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveryStatus: 'failed',
      };
    }
  }

  /**
   * Envia notificação em lote
   */
  async sendBatch(notifications: NotificationOptions[]): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    // Processar em paralelo (máximo 10 por vez)
    const batchSize = 10;
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((notification) => this.send(notification))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Envia através do canal específico
   */
  private async sendViaChannel(
    options: NotificationOptions
  ): Promise<NotificationResult> {
    // Buscar configuração do provedor
    const providerConfig = await this.getProviderConfig(options.channel);

    if (!providerConfig || !providerConfig.is_enabled) {
      return {
        success: false,
        error: `Provider ${options.channel} is not configured or disabled`,
        deliveryStatus: 'failed',
      };
    }

    switch (options.channel) {
      case 'email':
        return this.sendEmail(options, providerConfig.config);

      case 'sms':
        return this.sendSMS(options, providerConfig.config);

      case 'whatsapp':
        return this.sendWhatsApp(options, providerConfig.config);

      default:
        return {
          success: false,
          error: `Unsupported channel: ${options.channel}`,
          deliveryStatus: 'failed',
        };
    }
  }

  /**
   * Envia email via SMTP
   */
  private async sendEmail(
    options: NotificationOptions,
    config: Record<string, string>
  ): Promise<NotificationResult> {
    try {
      // Simulação de envio de email
      // Em produção, integrar com serviço real (Nodemailer, SendGrid, etc.)
      console.log('Sending email:', {
        to: options.recipient,
        subject: options.subject,
        body: options.body,
        config: {
          host: config.host,
          port: config.port,
          from: config.from_email || config.username,
        },
      });

      // Simular delay de rede
      await this.delay(500);

      // Simular sucesso (95% de taxa de sucesso)
      const success = Math.random() > 0.05;

      if (success) {
        return {
          success: true,
          messageId: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          deliveryStatus: 'sent',
        };
      } else {
        throw new Error('SMTP connection timeout');
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Email send failed',
        deliveryStatus: 'failed',
      };
    }
  }

  /**
   * Envia SMS via Twilio
   */
  private async sendSMS(
    options: NotificationOptions,
    config: Record<string, string>
  ): Promise<NotificationResult> {
    try {
      // Simulação de envio de SMS via Twilio
      console.log('Sending SMS:', {
        to: options.recipient,
        body: options.body,
        from: config.phone_number,
      });

      await this.delay(300);

      const success = Math.random() > 0.05;

      if (success) {
        return {
          success: true,
          messageId: `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          deliveryStatus: 'sent',
        };
      } else {
        throw new Error('Twilio API error');
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMS send failed',
        deliveryStatus: 'failed',
      };
    }
  }

  /**
   * Envia mensagem via WhatsApp
   */
  private async sendWhatsApp(
    options: NotificationOptions,
    config: Record<string, string>
  ): Promise<NotificationResult> {
    try {
      // Simulação de envio via WhatsApp API
      console.log('Sending WhatsApp:', {
        to: options.recipient,
        body: options.body,
        session: config.session_name,
      });

      await this.delay(400);

      const success = Math.random() > 0.05;

      if (success) {
        return {
          success: true,
          messageId: `whatsapp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          deliveryStatus: 'sent',
        };
      } else {
        throw new Error('WhatsApp session not connected');
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'WhatsApp send failed',
        deliveryStatus: 'failed',
      };
    }
  }

  /**
   * Processa template de notificação
   */
  private async processTemplate(
    templateId: string,
    variables: Record<string, string>
  ): Promise<{ body: string; subject?: string }> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: template, error } = await (supabase as any)
        .from('notification_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error) throw error;

      if (!template) {
        throw new Error('Template not found');
      }

      // Substituir variáveis no corpo
      let body = template.body;
      let subject = template.subject;

      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        body = body.replace(regex, value);
        if (subject) {
          subject = subject.replace(regex, value);
        }
      });

      return { body, subject };
    } catch (error) {
      console.error('Error processing template:', error);
      throw error;
    }
  }

  /**
   * Busca configuração do provedor
   */
  private async getProviderConfig(
    channel: string
  ): Promise<ProviderConfig | null> {
    try {
      const providerMap: Record<string, string> = {
        email: 'smtp',
        sms: 'twilio',
        whatsapp: 'whatsapp',
      };

      const provider = providerMap[channel];
      if (!provider) return null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('notification_providers')
        .select('*')
        .eq('provider', provider)
        .single();

      if (error) {
        console.error('Error fetching provider config:', error);
        return null;
      }

      return data as ProviderConfig;
    } catch (error) {
      console.error('Error in getProviderConfig:', error);
      return null;
    }
  }

  /**
   * Cria log de notificação
   */
  private async createLog(options: NotificationOptions): Promise<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('notification_logs')
        .insert({
          channel: options.channel,
          recipient: options.recipient,
          subject: options.subject,
          body: options.body,
          status: 'pending',
          metadata: options.metadata || {},
        })
        .select()
        .single();

      if (error) throw error;

      return data.id;
    } catch (error) {
      console.error('Error creating notification log:', error);
      // Retornar ID fictício se falhar
      return 'temp_' + Date.now();
    }
  }

  /**
   * Atualiza log de notificação
   */
  private async updateLog(
    logId: string,
    updates: Record<string, unknown>
  ): Promise<void> {
    try {
      if (logId.startsWith('temp_')) return; // Ignorar logs temporários

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('notification_logs')
        .update(updates)
        .eq('id', logId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating notification log:', error);
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Verifica status de entrega (para webhooks futuros)
   */
  async checkDeliveryStatus(messageId: string): Promise<string> {
    // Placeholder para integração com webhooks de provedores
    // Twilio, WhatsApp, etc. enviariam callbacks de status
    return 'delivered';
  }

  /**
   * Cancela notificação agendada
   */
  async cancelScheduled(notificationId: string): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('scheduled_notifications')
        .update({ status: 'cancelled' })
        .eq('id', notificationId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error cancelling scheduled notification:', error);
      return false;
    }
  }

  /**
   * Obtém estatísticas de notificações
   */
  async getStats(userId: string, days: number = 30): Promise<{
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    byChannel: Record<string, number>;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('notification_logs')
        .select('channel, status')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      const logs = data || [];
      const stats = {
        total: logs.length,
        sent: logs.filter((l: { status: string }) => l.status === 'sent' || l.status === 'delivered').length,
        delivered: logs.filter((l: { status: string }) => l.status === 'delivered').length,
        failed: logs.filter((l: { status: string }) => l.status === 'failed').length,
        byChannel: {} as Record<string, number>,
      };

      logs.forEach((log: { channel: string }) => {
        stats.byChannel[log.channel] = (stats.byChannel[log.channel] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error getting notification stats:', error);
      return {
        total: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        byChannel: {},
      };
    }
  }
}

// Exportar instância singleton
export const notificationService = new NotificationService();

// Exportar classe para casos de uso avançados
export default NotificationService;
