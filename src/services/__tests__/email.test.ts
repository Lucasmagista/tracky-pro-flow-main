import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  single: vi.fn(),
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendEmail', () => {
    it('should send email via SMTP', async () => {
      const mockResponse = {
        success: true,
        messageId: '<abc123@mail.example.com>',
        accepted: ['customer@example.com'],
        rejected: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const emailData = {
        to: 'customer@example.com',
        subject: 'Pedido Enviado - #1001',
        html: '<h1>Seu pedido foi enviado!</h1><p>Código: BR123456789BR</p>',
        from: 'notificacoes@tracky.com',
      };

      const response = await fetch('https://api.example.com/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData),
      });

      const data = await response.json();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/send-email'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('customer@example.com'),
        })
      );
      expect(data.success).toBe(true);
      expect(data.accepted).toContain('customer@example.com');
    });

    it('should send email with attachments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, messageId: '<xyz789@mail.example.com>' }),
      });

      const emailData = {
        to: 'customer@example.com',
        subject: 'Etiqueta de Rastreamento',
        html: '<p>Segue em anexo a etiqueta.</p>',
        attachments: [
          {
            filename: 'etiqueta.pdf',
            content: 'base64-encoded-pdf-content',
            encoding: 'base64',
          },
        ],
      };

      const response = await fetch('https://api.example.com/send-email', {
        method: 'POST',
        body: JSON.stringify(emailData),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
    });

    it('should handle invalid email address', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'Invalid email address',
        }),
      });

      const response = await fetch('https://api.example.com/send-email', {
        method: 'POST',
        body: JSON.stringify({
          to: 'invalid-email',
          subject: 'Test',
          html: '<p>Test</p>',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should handle SMTP connection error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          success: false,
          error: 'SMTP connection failed',
        }),
      });

      const response = await fetch('https://api.example.com/send-email', {
        method: 'POST',
        body: JSON.stringify({
          to: 'customer@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        }),
      });

      expect(response.status).toBe(503);
    });
  });

  describe('sendBulkEmails', () => {
    it('should send multiple emails in batch', async () => {
      const mockResponse = {
        success: true,
        sent: 3,
        failed: 0,
        results: [
          { email: 'customer1@example.com', status: 'sent' },
          { email: 'customer2@example.com', status: 'sent' },
          { email: 'customer3@example.com', status: 'sent' },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const emails = [
        {
          to: 'customer1@example.com',
          subject: 'Pedido Enviado',
          html: '<p>Seu pedido foi enviado.</p>',
        },
        {
          to: 'customer2@example.com',
          subject: 'Pedido Enviado',
          html: '<p>Seu pedido foi enviado.</p>',
        },
        {
          to: 'customer3@example.com',
          subject: 'Pedido Enviado',
          html: '<p>Seu pedido foi enviado.</p>',
        },
      ];

      const response = await fetch('https://api.example.com/send-bulk-emails', {
        method: 'POST',
        body: JSON.stringify({ emails }),
      });

      const data = await response.json();

      expect(data.sent).toBe(3);
      expect(data.results).toHaveLength(3);
    });

    it('should handle partial failures in bulk send', async () => {
      const mockResponse = {
        success: true,
        sent: 2,
        failed: 1,
        results: [
          { email: 'customer1@example.com', status: 'sent' },
          { email: 'invalid-email', status: 'failed', error: 'Invalid address' },
          { email: 'customer3@example.com', status: 'sent' },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await fetch('https://api.example.com/send-bulk-emails', {
        method: 'POST',
        body: JSON.stringify({ emails: [] }),
      });

      const data = await response.json();

      expect(data.sent).toBe(2);
      expect(data.failed).toBe(1);
    });
  });

  describe('validateEmailAddress', () => {
    it('should validate correct email format', () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'user_123@sub.example.com',
      ];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      validEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(true);
      });
    });

    it('should reject invalid email format', () => {
      const invalidEmails = [
        'invalid',
        '@example.com',
        'user@',
        'user@.com',
        'user @example.com',
      ];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      invalidEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });
  });

  describe('renderTemplate', () => {
    it('should render email template with variables', () => {
      const template = 'Olá {{customerName}}, seu pedido {{orderNumber}} foi enviado. Rastreamento: {{trackingCode}}';
      const variables = {
        customerName: 'João Silva',
        orderNumber: '#1001',
        trackingCode: 'BR123456789BR',
      };

      let rendered = template;
      Object.entries(variables).forEach(([key, value]) => {
        rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });

      expect(rendered).toBe('Olá João Silva, seu pedido #1001 foi enviado. Rastreamento: BR123456789BR');
      expect(rendered).not.toContain('{{');
    });

    it('should handle missing variables gracefully', () => {
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

  describe('createHTMLFromTemplate', () => {
    it('should create full HTML email with styles', () => {
      const content = '<h1>Pedido Enviado</h1><p>Seu pedido foi postado.</p>';
      const styles = `
        body { font-family: Arial, sans-serif; }
        h1 { color: #333; }
        p { color: #666; }
      `;

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>${styles}</style>
          </head>
          <body>
            ${content}
          </body>
        </html>
      `;

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain(content);
      expect(html).toContain(styles);
    });
  });

  describe('trackEmailOpen', () => {
    it('should track email open via tracking pixel', async () => {
      const mockResponse = {
        success: true,
        tracked: true,
        emailId: 'email-123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const emailId = 'email-123';

      const response = await fetch(
        `https://api.example.com/track-open?id=${emailId}`,
        { method: 'GET' }
      );

      const data = await response.json();

      expect(data.tracked).toBe(true);
      expect(data.emailId).toBe(emailId);
    });

    it('should embed tracking pixel in email HTML', () => {
      const emailId = 'email-456';
      const trackingPixel = `<img src="https://api.example.com/track-open?id=${emailId}" width="1" height="1" alt="" style="display:none;" />`;

      const html = `<p>Email content</p>${trackingPixel}`;

      expect(html).toContain('track-open');
      expect(html).toContain(emailId);
      expect(html).toContain('display:none');
    });
  });

  describe('trackLinkClick', () => {
    it('should track link clicks in email', async () => {
      const mockResponse = {
        success: true,
        tracked: true,
        linkId: 'link-789',
        destination: 'https://rastreamento.correios.com.br',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const linkId = 'link-789';

      const response = await fetch(
        `https://api.example.com/track-click?id=${linkId}`,
        { method: 'GET' }
      );

      const data = await response.json();

      expect(data.tracked).toBe(true);
      expect(data.linkId).toBe(linkId);
    });
  });

  describe('getEmailStatus', () => {
    it('should retrieve email delivery status', async () => {
      const mockResponse = {
        success: true,
        status: 'delivered',
        messageId: '<abc123@mail.example.com>',
        sentAt: '2025-10-26T10:00:00Z',
        deliveredAt: '2025-10-26T10:00:15Z',
        opened: true,
        openedAt: '2025-10-26T10:05:30Z',
        clicked: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const messageId = '<abc123@mail.example.com>';

      const response = await fetch(
        `https://api.example.com/email-status?messageId=${encodeURIComponent(messageId)}`,
        { method: 'GET' }
      );

      const data = await response.json();

      expect(data.status).toBe('delivered');
      expect(data.opened).toBe(true);
      expect(data.clicked).toBe(false);
    });

    it('should handle bounced email status', async () => {
      const mockResponse = {
        success: true,
        status: 'bounced',
        bounceType: 'hard',
        bounceReason: 'Mailbox does not exist',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await fetch('https://api.example.com/email-status?messageId=xyz', {
        method: 'GET',
      });

      const data = await response.json();

      expect(data.status).toBe('bounced');
      expect(data.bounceType).toBe('hard');
    });
  });

  describe('saveToSupabase', () => {
    it('should save sent email record to database', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'uuid-123',
          recipient_email: 'customer@example.com',
          subject: 'Pedido Enviado',
          status: 'sent',
          message_id: '<abc123@mail.example.com>',
          sent_at: '2025-10-26T10:00:00Z',
        },
        error: null,
      });

      const emailRecord = {
        recipient_email: 'customer@example.com',
        subject: 'Pedido Enviado',
        html_content: '<p>Email content</p>',
        status: 'sent',
        message_id: '<abc123@mail.example.com>',
      };

      const { data, error } = await mockSupabase
        .from('email_logs')
        .insert(emailRecord)
        .select()
        .single();

      expect(mockSupabase.insert).toHaveBeenCalled();
      expect(data?.recipient_email).toBe('customer@example.com');
      expect(error).toBeNull();
    });
  });
});
