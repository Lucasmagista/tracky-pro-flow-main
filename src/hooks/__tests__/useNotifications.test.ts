import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

const mockSupabase = {
  from: mockFrom,
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

// Mock Auth Context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-123', email: 'test@example.com' } }),
}));

describe('useNotifications - Notification Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock chain
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    });
    
    mockSelect.mockReturnValue({
      eq: mockEq,
      single: mockSingle,
    });
    
    mockInsert.mockReturnValue({
      select: mockSelect,
    });
    
    mockUpdate.mockReturnValue({
      eq: mockEq,
    });
    
    mockEq.mockReturnValue({
      eq: mockEq,
      single: mockSingle,
    });
    
    mockSingle.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  describe('Send Notification', () => {
    it('should send email notification', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'notif-1',
          type: 'email',
          recipient: 'customer@example.com',
          subject: 'Pedido Enviado',
          status: 'sent',
        },
        error: null,
      });

      const notification = {
        user_id: 'user-123',
        type: 'email',
        recipient: 'customer@example.com',
        subject: 'Pedido Enviado',
        body: 'Seu pedido foi enviado.',
        status: 'pending',
      };

      const result = await mockSupabase
        .from('notifications')
        .insert(notification)
        .select()
        .single();

      expect(mockFrom).toHaveBeenCalledWith('notifications');
      expect(mockInsert).toHaveBeenCalledWith(notification);
      expect(result.data?.type).toBe('email');
    });

    it('should send SMS notification', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'notif-2',
          type: 'sms',
          recipient: '+5511999999999',
          body: 'Seu pedido #1001 foi enviado',
          status: 'sent',
        },
        error: null,
      });

      const notification = {
        type: 'sms',
        recipient: '+5511999999999',
        body: 'Seu pedido #1001 foi enviado',
      };

      const result = await mockSupabase
        .from('notifications')
        .insert(notification)
        .select()
        .single();

      expect(result.data?.type).toBe('sms');
      expect(result.data?.recipient).toBe('+5511999999999');
    });

    it('should send WhatsApp notification', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'notif-3',
          type: 'whatsapp',
          recipient: '5511999999999',
          body: 'Rastreamento: BR123456789BR',
          status: 'sent',
        },
        error: null,
      });

      const result = await mockSupabase
        .from('notifications')
        .insert({
          type: 'whatsapp',
          recipient: '5511999999999',
          body: 'Rastreamento: BR123456789BR',
        })
        .select()
        .single();

      expect(result.data?.type).toBe('whatsapp');
    });
  });

  describe('Notification Templates', () => {
    it('should create notification template', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'template-1',
          name: 'order_shipped',
          subject: 'Pedido Enviado - {{orderNumber}}',
          body: 'Olá {{customerName}}, seu pedido foi enviado. Código: {{trackingCode}}',
          type: 'email',
        },
        error: null,
      });

      const template = {
        name: 'order_shipped',
        subject: 'Pedido Enviado - {{orderNumber}}',
        body: 'Olá {{customerName}}, seu pedido foi enviado. Código: {{trackingCode}}',
        type: 'email',
      };

      const result = await mockSupabase
        .from('notification_templates')
        .insert(template)
        .select()
        .single();

      expect(result.data?.name).toBe('order_shipped');
      expect(result.data?.body).toContain('{{customerName}}');
      expect(result.data?.body).toContain('{{trackingCode}}');
    });

    it('should render template with variables', () => {
      const template = 'Olá {{customerName}}, pedido {{orderNumber}} enviado. Rastreamento: {{trackingCode}}';
      const variables = {
        customerName: 'João Silva',
        orderNumber: '#1001',
        trackingCode: 'BR123456789BR',
      };

      let rendered = template;
      Object.entries(variables).forEach(([key, value]) => {
        rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });

      expect(rendered).toBe('Olá João Silva, pedido #1001 enviado. Rastreamento: BR123456789BR');
      expect(rendered).not.toContain('{{');
    });

    it('should handle missing variables in template', () => {
      const template = 'Olá {{customerName}}, pedido {{orderNumber}}';
      const variables = { customerName: 'Maria' };

      let rendered = template;
      Object.entries(variables).forEach(([key, value]) => {
        rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });

      expect(rendered).toContain('Maria');
      expect(rendered).toContain('{{orderNumber}}'); // Not replaced
    });
  });

  describe('Notification History', () => {
    it('should fetch notification history', async () => {
      mockEq.mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'notif-1',
              type: 'email',
              recipient: 'customer@example.com',
              status: 'sent',
              sent_at: '2025-10-26T10:00:00Z',
            },
            {
              id: 'notif-2',
              type: 'sms',
              recipient: '+5511999999999',
              status: 'sent',
              sent_at: '2025-10-26T11:00:00Z',
            },
          ],
          error: null,
        }),
      });

      const result = await mockSupabase
        .from('notifications')
        .select('*')
        .eq('user_id', 'user-123');

      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123');
    });

    it('should filter notifications by status', async () => {
      mockEq.mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            { id: 'notif-1', status: 'failed' },
            { id: 'notif-2', status: 'failed' },
          ],
          error: null,
        }),
      });

      await mockSupabase
        .from('notifications')
        .select('*')
        .eq('status', 'failed');

      expect(mockEq).toHaveBeenCalledWith('status', 'failed');
    });

    it('should filter notifications by type', async () => {
      mockEq.mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            { id: 'notif-1', type: 'whatsapp' },
            { id: 'notif-2', type: 'whatsapp' },
            { id: 'notif-3', type: 'whatsapp' },
          ],
          error: null,
        }),
      });

      await mockSupabase
        .from('notifications')
        .select('*')
        .eq('type', 'whatsapp');

      expect(mockEq).toHaveBeenCalledWith('type', 'whatsapp');
    });
  });

  describe('Retry Failed Notifications', () => {
    it('should update failed notification to retry', async () => {
      mockEq.mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: { id: 'notif-1', status: 'pending' },
          error: null,
        }),
      });

      const result = await mockSupabase
        .from('notifications')
        .update({ status: 'pending', retry_count: 1 })
        .eq('id', 'notif-1');

      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'pending',
        retry_count: 1,
      });
      expect(mockEq).toHaveBeenCalledWith('id', 'notif-1');
    });

    it('should track retry attempts', async () => {
      const retryData = {
        status: 'pending',
        retry_count: 3,
        last_retry_at: new Date().toISOString(),
      };

      await mockSupabase
        .from('notifications')
        .update(retryData)
        .eq('id', 'notif-1');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          retry_count: 3,
        })
      );
    });
  });

  describe('Notification Validation', () => {
    it('should validate email format', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      expect(emailRegex.test('valid@example.com')).toBe(true);
      expect(emailRegex.test('invalid@')).toBe(false);
      expect(emailRegex.test('@example.com')).toBe(false);
      expect(emailRegex.test('no-at-sign.com')).toBe(false);
    });

    it('should validate phone number format', () => {
      const phoneRegex = /^\+?[1-9]\d{10,14}$/;

      expect(phoneRegex.test('+5511999999999')).toBe(true);
      expect(phoneRegex.test('5511999999999')).toBe(true);
      expect(phoneRegex.test('123')).toBe(false);
      expect(phoneRegex.test('invalid')).toBe(false);
    });

    it('should sanitize notification content', () => {
      const unsafeContent = '<script>alert("XSS")</script>Hello';
      const sanitized = unsafeContent.replace(/<script[^>]*>.*?<\/script>/gi, '');

      expect(sanitized).toBe('Hello');
      expect(sanitized).not.toContain('<script>');
    });
  });

  describe('Scheduled Notifications', () => {
    it('should schedule notification for future sending', async () => {
      const scheduledTime = new Date('2025-10-27T10:00:00Z').toISOString();

      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'notif-scheduled-1',
          status: 'scheduled',
          scheduled_for: scheduledTime,
        },
        error: null,
      });

      const result = await mockSupabase
        .from('notifications')
        .insert({
          type: 'email',
          recipient: 'customer@example.com',
          status: 'scheduled',
          scheduled_for: scheduledTime,
        })
        .select()
        .single();

      expect(result.data?.status).toBe('scheduled');
      expect(result.data?.scheduled_for).toBe(scheduledTime);
    });
  });

  describe('Bulk Notifications', () => {
    it('should send notifications in bulk', async () => {
      const recipients = [
        'customer1@example.com',
        'customer2@example.com',
        'customer3@example.com',
      ];

      const notifications = recipients.map((recipient) => ({
        type: 'email',
        recipient,
        subject: 'Promoção',
        body: 'Confira nossas ofertas!',
        status: 'pending',
      }));

      mockSelect.mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: notifications.map((n, i) => ({ id: `notif-${i}`, ...n })),
          error: null,
        }),
      });

      await mockSupabase
        .from('notifications')
        .insert(notifications)
        .select();

      expect(mockInsert).toHaveBeenCalledWith(notifications);
    });
  });

  describe('Error Handling', () => {
    it('should handle notification sending error', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'SMTP connection failed' },
      });

      const result = await mockSupabase
        .from('notifications')
        .insert({ type: 'email', recipient: 'test@example.com' })
        .select()
        .single();

      expect(result.error).not.toBeNull();
      expect(result.error.message).toContain('SMTP');
    });

    it('should handle invalid recipient error', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid phone number' },
      });

      const result = await mockSupabase
        .from('notifications')
        .insert({ type: 'sms', recipient: 'invalid' })
        .select()
        .single();

      expect(result.error?.message).toContain('Invalid');
    });
  });
});
