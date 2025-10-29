/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from '../notification';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client');

describe('NotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendEmail', () => {
    it('deve enviar email com sucesso', async () => {
      const mockEmailData = {
        to: 'cliente@example.com',
        subject: 'Seu pedido foi enviado',
        body: '<p>Olá! Seu pedido #123 foi enviado.</p>',
        order_id: 'order-123',
      };

      const mockResponse = {
        success: true,
        message_id: 'msg-123',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await NotificationService.sendEmail(mockEmailData);

      expect(result.success).toBe(true);
      expect(result.message_id).toBe('msg-123');
    });

    it('deve lançar erro quando envio falha', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'SMTP error' }),
      });

      await expect(
        NotificationService.sendEmail({} as any)
      ).rejects.toThrow();
    });
  });

  describe('sendSMS', () => {
    it('deve enviar SMS com sucesso', async () => {
      const mockSMS = {
        to: '+5511999999999',
        message: 'Seu pedido #123 foi enviado!',
        order_id: 'order-123',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, sid: 'SM123' }),
      });

      const result = await NotificationService.sendSMS(mockSMS);

      expect(result.success).toBe(true);
      expect(result.sid).toBe('SM123');
    });
  });

  describe('sendWhatsApp', () => {
    it('deve enviar mensagem WhatsApp', async () => {
      const mockMessage = {
        to: '5511999999999',
        message: 'Seu pedido foi enviado',
        order_id: 'order-123',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message_id: 'wa-123' }),
      });

      const result = await NotificationService.sendWhatsApp(mockMessage);

      expect(result.success).toBe(true);
    });
  });

  describe('createNotificationTemplate', () => {
    it('deve criar template de notificação', async () => {
      const mockTemplate = {
        name: 'order_shipped',
        type: 'email',
        subject: 'Pedido Enviado',
        body: 'Olá {{customer_name}}, seu pedido {{order_number}} foi enviado.',
        variables: ['customer_name', 'order_number'],
      };

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'template-123', ...mockTemplate },
            error: null,
          }),
        }),
      });

      (supabase.from as any).mockReturnValue({
        insert: mockInsert,
      });

      const result = await NotificationService.createNotificationTemplate(
        mockTemplate
      );

      expect(result.id).toBe('template-123');
      expect(result.name).toBe('order_shipped');
    });
  });

  describe('renderTemplate', () => {
    it('deve renderizar template com variáveis', () => {
      const template = 'Olá {{name}}, seu pedido {{order}} está {{status}}.';
      const variables = {
        name: 'João',
        order: '#123',
        status: 'a caminho',
      };

      const result = NotificationService.renderTemplate(template, variables);

      expect(result).toBe('Olá João, seu pedido #123 está a caminho.');
    });

    it('deve manter placeholders se variável não fornecida', () => {
      const template = 'Olá {{name}}, código: {{code}}';
      const variables = { name: 'Maria' };

      const result = NotificationService.renderTemplate(template, variables);

      expect(result).toContain('Maria');
      expect(result).toContain('{{code}}');
    });
  });

  describe('scheduleNotification', () => {
    it('deve agendar notificação', async () => {
      const mockSchedule = {
        type: 'email',
        recipient: 'cliente@example.com',
        message: 'Lembrete de pedido',
        scheduled_for: '2025-10-27T10:00:00Z',
        order_id: 'order-123',
      };

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'schedule-123', ...mockSchedule },
            error: null,
          }),
        }),
      });

      (supabase.from as any).mockReturnValue({
        insert: mockInsert,
      });

      const result = await NotificationService.scheduleNotification(
        mockSchedule
      );

      expect(result.id).toBe('schedule-123');
    });
  });

  describe('getNotificationHistory', () => {
    it('deve buscar histórico de notificações', async () => {
      const orderId = 'order-123';
      const mockHistory = [
        {
          id: 'notif-1',
          type: 'email',
          status: 'sent',
          sent_at: '2025-10-26T10:00:00Z',
        },
        {
          id: 'notif-2',
          type: 'sms',
          status: 'sent',
          sent_at: '2025-10-26T11:00:00Z',
        },
      ];

      const mockEq = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockHistory,
          error: null,
        }),
      });

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: mockEq,
        }),
      });

      const result = await NotificationService.getNotificationHistory(orderId);

      expect(result).toHaveLength(2);
      expect(mockEq).toHaveBeenCalledWith('order_id', orderId);
    });
  });

  describe('validateEmail', () => {
    it('deve validar email correto', () => {
      expect(NotificationService.validateEmail('test@example.com')).toBe(true);
      expect(NotificationService.validateEmail('user+tag@domain.co.uk')).toBe(true);
    });

    it('deve invalidar email incorreto', () => {
      expect(NotificationService.validateEmail('invalid')).toBe(false);
      expect(NotificationService.validateEmail('test@')).toBe(false);
      expect(NotificationService.validateEmail('@example.com')).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('deve validar telefone correto', () => {
      expect(NotificationService.validatePhone('+5511999999999')).toBe(true);
      expect(NotificationService.validatePhone('11999999999')).toBe(true);
    });

    it('deve invalidar telefone incorreto', () => {
      expect(NotificationService.validatePhone('123')).toBe(false);
      expect(NotificationService.validatePhone('invalid')).toBe(false);
    });
  });

  describe('formatPhoneNumber', () => {
    it('deve formatar número brasileiro', () => {
      expect(NotificationService.formatPhoneNumber('11999999999')).toBe(
        '+5511999999999'
      );
    });

    it('deve manter formato internacional', () => {
      expect(NotificationService.formatPhoneNumber('+5511999999999')).toBe(
        '+5511999999999'
      );
    });
  });

  describe('retryFailedNotification', () => {
    it('deve reenviar notificação que falhou', async () => {
      const notificationId = 'notif-123';

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: { id: notificationId, status: 'pending' },
          error: null,
        }),
      });

      (supabase.from as any).mockReturnValue({
        update: mockUpdate,
      });

      const result = await NotificationService.retryFailedNotification(
        notificationId
      );

      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'pending',
        retry_count: expect.any(Number),
      });
    });
  });

  describe('bulkSendNotifications', () => {
    it('deve enviar múltiplas notificações', async () => {
      const notifications = [
        { to: 'test1@example.com', message: 'Test 1' },
        { to: 'test2@example.com', message: 'Test 2' },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const results = await NotificationService.bulkSendNotifications(
        notifications
      );

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });
  });
});
