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

describe('WPPConnect Service', () => {
  const baseUrl = 'http://localhost:21465';
  const secretKey = 'test-secret-key';
  const sessionName = 'tracky-session';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startSession', () => {
    it('should start a new WhatsApp session', async () => {
      const mockResponse = {
        status: 'success',
        session: sessionName,
        qrcode: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
        message: 'Session started successfully',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await fetch(
        `${baseUrl}/api/${sessionName}/${secretKey}/start-session`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const data = await response.json();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/start-session'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(data.status).toBe('success');
      expect(data.qrcode).toContain('data:image/png');
    });

    it('should handle session already exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          status: 'error',
          message: 'Session already exists',
        }),
      });

      const response = await fetch(
        `${baseUrl}/api/${sessionName}/${secretKey}/start-session`,
        { method: 'POST' }
      );

      expect(response.status).toBe(409);
    });
  });

  describe('checkConnectionStatus', () => {
    it('should check if WhatsApp is connected', async () => {
      const mockResponse = {
        status: 'success',
        connected: true,
        session: sessionName,
        phone: {
          wa_name: 'TrackyProFlow',
          wa_version: '2.2345.52',
          phone_number: '5511999999999',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await fetch(
        `${baseUrl}/api/${sessionName}/${secretKey}/check-connection-session`,
        { method: 'GET' }
      );

      const data = await response.json();

      expect(data.connected).toBe(true);
      expect(data.phone.phone_number).toBe('5511999999999');
    });

    it('should return disconnected status', async () => {
      const mockResponse = {
        status: 'success',
        connected: false,
        session: sessionName,
        message: 'Phone not connected',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await fetch(
        `${baseUrl}/api/${sessionName}/${secretKey}/check-connection-session`,
        { method: 'GET' }
      );

      const data = await response.json();

      expect(data.connected).toBe(false);
    });
  });

  describe('getQRCode', () => {
    it('should retrieve QR code for session', async () => {
      const mockResponse = {
        status: 'success',
        qrcode: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
        urlcode: '2@AbCdEfGhIjKlMnOpQrStUv...',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await fetch(
        `${baseUrl}/api/${sessionName}/${secretKey}/show-qrcode-session`,
        { method: 'GET' }
      );

      const data = await response.json();

      expect(data.status).toBe('success');
      expect(data.qrcode).toContain('data:image/png');
      expect(data.urlcode).toBeDefined();
    });

    it('should return error if already connected', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          status: 'error',
          message: 'Session is already connected',
        }),
      });

      const response = await fetch(
        `${baseUrl}/api/${sessionName}/${secretKey}/show-qrcode-session`,
        { method: 'GET' }
      );

      expect(response.status).toBe(400);
    });
  });

  describe('sendMessage', () => {
    it('should send text message successfully', async () => {
      const mockResponse = {
        status: 'success',
        message: 'Message sent',
        id: 'msg-id-12345',
        timestamp: 1698326400,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const phone = '5511999999999';
      const message = 'Olá! Seu pedido #1001 foi enviado.';

      const response = await fetch(
        `${baseUrl}/api/${sessionName}/${secretKey}/send-message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: phone,
            message: message,
          }),
        }
      );

      const data = await response.json();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/send-message'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(phone),
        })
      );
      expect(data.status).toBe('success');
      expect(data.id).toBe('msg-id-12345');
    });

    it('should send message with tracking link', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'success', id: 'msg-id-67890' }),
      });

      const phone = '5511988888888';
      const trackingCode = 'BR123456789BR';
      const message = `Seu pedido foi enviado!\n\nCódigo de rastreamento: ${trackingCode}\n\nAcompanhe: https://rastreamento.correios.com.br/${trackingCode}`;

      const response = await fetch(
        `${baseUrl}/api/${sessionName}/${secretKey}/send-message`,
        {
          method: 'POST',
          body: JSON.stringify({ phone, message }),
        }
      );

      const data = await response.json();

      expect(data.status).toBe('success');
    });

    it('should handle invalid phone number', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          status: 'error',
          message: 'Invalid phone number format',
        }),
      });

      const response = await fetch(
        `${baseUrl}/api/${sessionName}/${secretKey}/send-message`,
        {
          method: 'POST',
          body: JSON.stringify({
            phone: '123',
            message: 'Test',
          }),
        }
      );

      expect(response.status).toBe(400);
    });

    it('should handle session not connected error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          status: 'error',
          message: 'Session is not connected',
        }),
      });

      const response = await fetch(
        `${baseUrl}/api/${sessionName}/${secretKey}/send-message`,
        {
          method: 'POST',
          body: JSON.stringify({
            phone: '5511999999999',
            message: 'Test message',
          }),
        }
      );

      expect(response.status).toBe(503);
    });
  });

  describe('sendFile', () => {
    it('should send file with caption', async () => {
      const mockResponse = {
        status: 'success',
        message: 'File sent',
        id: 'file-msg-id-12345',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const phone = '5511999999999';
      const fileUrl = 'https://cdn.example.com/tracking-label.pdf';
      const caption = 'Etiqueta de rastreamento';

      const response = await fetch(
        `${baseUrl}/api/${sessionName}/${secretKey}/send-file-base64`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: phone,
            path: fileUrl,
            filename: 'etiqueta.pdf',
            caption: caption,
          }),
        }
      );

      const data = await response.json();

      expect(data.status).toBe('success');
      expect(data.id).toBe('file-msg-id-12345');
    });
  });

  describe('sendImage', () => {
    it('should send image successfully', async () => {
      const mockResponse = {
        status: 'success',
        message: 'Image sent',
        id: 'img-msg-id-12345',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const phone = '5511999999999';
      const imageBase64 = 'data:image/png;base64,iVBORw0KG...';

      const response = await fetch(
        `${baseUrl}/api/${sessionName}/${secretKey}/send-image`,
        {
          method: 'POST',
          body: JSON.stringify({
            phone: phone,
            base64: imageBase64,
            caption: 'QR Code do rastreamento',
          }),
        }
      );

      const data = await response.json();

      expect(data.status).toBe('success');
    });
  });

  describe('closeSession', () => {
    it('should close WhatsApp session', async () => {
      const mockResponse = {
        status: 'success',
        message: 'Session closed successfully',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await fetch(
        `${baseUrl}/api/${sessionName}/${secretKey}/close-session`,
        { method: 'POST' }
      );

      const data = await response.json();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/close-session'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(data.status).toBe('success');
    });
  });

  describe('logoutSession', () => {
    it('should logout from WhatsApp session', async () => {
      const mockResponse = {
        status: 'success',
        message: 'Logged out successfully',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await fetch(
        `${baseUrl}/api/${sessionName}/${secretKey}/logout-session`,
        { method: 'POST' }
      );

      const data = await response.json();

      expect(data.status).toBe('success');
    });
  });

  describe('getAllContacts', () => {
    it('should retrieve all contacts', async () => {
      const mockResponse = {
        status: 'success',
        contacts: [
          {
            id: '5511999999999@c.us',
            name: 'João Silva',
            pushname: 'João',
            isMyContact: true,
          },
          {
            id: '5511988888888@c.us',
            name: 'Maria Santos',
            pushname: 'Maria',
            isMyContact: true,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await fetch(
        `${baseUrl}/api/${sessionName}/${secretKey}/all-contacts`,
        { method: 'GET' }
      );

      const data = await response.json();

      expect(data.contacts).toHaveLength(2);
      expect(data.contacts[0].name).toBe('João Silva');
    });
  });

  describe('checkNumberExists', () => {
    it('should check if phone number exists on WhatsApp', async () => {
      const mockResponse = {
        status: 'success',
        numberExists: true,
        id: '5511999999999@c.us',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const phone = '5511999999999';

      const response = await fetch(
        `${baseUrl}/api/${sessionName}/${secretKey}/check-number-status/${phone}`,
        { method: 'GET' }
      );

      const data = await response.json();

      expect(data.numberExists).toBe(true);
    });

    it('should return false for non-existent number', async () => {
      const mockResponse = {
        status: 'success',
        numberExists: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await fetch(
        `${baseUrl}/api/${sessionName}/${secretKey}/check-number-status/1234567890`,
        { method: 'GET' }
      );

      const data = await response.json();

      expect(data.numberExists).toBe(false);
    });
  });

  describe('getMessages', () => {
    it('should retrieve chat messages', async () => {
      const mockResponse = {
        status: 'success',
        messages: [
          {
            id: 'msg-1',
            body: 'Olá!',
            timestamp: 1698326400,
            from: '5511999999999@c.us',
            to: '5511988888888@c.us',
            type: 'chat',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const chatId = '5511999999999@c.us';

      const response = await fetch(
        `${baseUrl}/api/${sessionName}/${secretKey}/get-messages/${chatId}`,
        { method: 'GET' }
      );

      const data = await response.json();

      expect(data.messages).toHaveLength(1);
      expect(data.messages[0].body).toBe('Olá!');
    });
  });

  describe('getBatteryStatus', () => {
    it('should get phone battery status', async () => {
      const mockResponse = {
        status: 'success',
        battery: 85,
        plugged: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await fetch(
        `${baseUrl}/api/${sessionName}/${secretKey}/battery-status`,
        { method: 'GET' }
      );

      const data = await response.json();

      expect(data.battery).toBe(85);
      expect(data.plugged).toBe(false);
    });
  });
});
