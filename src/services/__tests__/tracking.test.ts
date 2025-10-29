/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrackingService } from '../tracking';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('TrackingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTracking', () => {
    it('deve criar rastreamento com sucesso', async () => {
      const mockTracking = {
        order_id: 'order-123',
        tracking_code: 'BR123456789BR',
        carrier: 'correios',
        status: 'pending',
      };

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'tracking-123', ...mockTracking },
            error: null,
          }),
        }),
      });

      (supabase.from as any).mockReturnValue({
        insert: mockInsert,
      });

      const result = await TrackingService.createTracking(mockTracking);

      expect(supabase.from).toHaveBeenCalledWith('tracking');
      expect(mockInsert).toHaveBeenCalledWith(mockTracking);
      expect(result.id).toBe('tracking-123');
    });

    it('deve lançar erro quando inserção falha', async () => {
      const mockError = new Error('Database error');
      
      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: mockError,
            }),
          }),
        }),
      });

      await expect(
        TrackingService.createTracking({} as any)
      ).rejects.toThrow('Database error');
    });
  });

  describe('updateTrackingStatus', () => {
    it('deve atualizar status do rastreamento', async () => {
      const trackingId = 'tracking-123';
      const newStatus = 'in_transit';

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: trackingId, status: newStatus },
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as any).mockReturnValue({
        update: mockUpdate,
      });

      const result = await TrackingService.updateTrackingStatus(
        trackingId,
        newStatus
      );

      expect(mockUpdate).toHaveBeenCalledWith({ status: newStatus });
      expect(result.status).toBe(newStatus);
    });
  });

  describe('addTrackingEvent', () => {
    it('deve adicionar evento de rastreamento', async () => {
      const mockEvent = {
        tracking_id: 'tracking-123',
        status: 'in_transit',
        description: 'Objeto em trânsito',
        location: 'São Paulo - SP',
        date: new Date().toISOString(),
      };

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'event-123', ...mockEvent },
            error: null,
          }),
        }),
      });

      (supabase.from as any).mockReturnValue({
        insert: mockInsert,
      });

      const result = await TrackingService.addTrackingEvent(mockEvent);

      expect(supabase.from).toHaveBeenCalledWith('tracking_events');
      expect(result.description).toBe(mockEvent.description);
    });
  });

  describe('getTrackingByCode', () => {
    it('deve buscar rastreamento por código', async () => {
      const trackingCode = 'BR123456789BR';
      const mockTracking = {
        id: 'tracking-123',
        tracking_code: trackingCode,
        carrier: 'correios',
        status: 'in_transit',
      };

      const mockEq = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockTracking,
          error: null,
        }),
      });

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: mockEq,
        }),
      });

      const result = await TrackingService.getTrackingByCode(trackingCode);

      expect(mockEq).toHaveBeenCalledWith('tracking_code', trackingCode);
      expect(result.tracking_code).toBe(trackingCode);
    });

    it('deve retornar null quando código não existe', async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          }),
        }),
      });

      const result = await TrackingService.getTrackingByCode('INVALID');

      expect(result).toBeNull();
    });
  });

  describe('getTrackingEvents', () => {
    it('deve buscar eventos de rastreamento', async () => {
      const trackingId = 'tracking-123';
      const mockEvents = [
        {
          id: 'event-1',
          status: 'posted',
          description: 'Objeto postado',
          date: '2025-10-26T10:00:00Z',
        },
        {
          id: 'event-2',
          status: 'in_transit',
          description: 'Em trânsito',
          date: '2025-10-27T14:00:00Z',
        },
      ];

      const mockEq = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockEvents,
          error: null,
        }),
      });

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: mockEq,
        }),
      });

      const result = await TrackingService.getTrackingEvents(trackingId);

      expect(mockEq).toHaveBeenCalledWith('tracking_id', trackingId);
      expect(result).toHaveLength(2);
    });
  });

  describe('getTrackingsByOrder', () => {
    it('deve buscar todos os rastreamentos de um pedido', async () => {
      const orderId = 'order-123';
      const mockTrackings = [
        { id: 'track-1', tracking_code: 'BR111111111BR' },
        { id: 'track-2', tracking_code: 'BR222222222BR' },
      ];

      const mockEq = vi.fn().mockResolvedValue({
        data: mockTrackings,
        error: null,
      });

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: mockEq,
        }),
      });

      const result = await TrackingService.getTrackingsByOrder(orderId);

      expect(mockEq).toHaveBeenCalledWith('order_id', orderId);
      expect(result).toHaveLength(2);
    });
  });

  describe('detectCarrier', () => {
    it('deve detectar Correios', () => {
      expect(TrackingService.detectCarrier('BR123456789BR')).toBe('correios');
      expect(TrackingService.detectCarrier('JT123456789BR')).toBe('correios');
    });

    it('deve detectar FedEx', () => {
      expect(TrackingService.detectCarrier('123456789012')).toBe('fedex');
    });

    it('deve detectar DHL', () => {
      expect(TrackingService.detectCarrier('1234567890')).toBe('dhl');
    });

    it('deve retornar unknown para código inválido', () => {
      expect(TrackingService.detectCarrier('INVALID')).toBe('unknown');
    });
  });

  describe('isDelivered', () => {
    it('deve retornar true para status entregue', () => {
      expect(TrackingService.isDelivered('delivered')).toBe(true);
    });

    it('deve retornar false para outros status', () => {
      expect(TrackingService.isDelivered('in_transit')).toBe(false);
      expect(TrackingService.isDelivered('pending')).toBe(false);
    });
  });

  describe('isDelayed', () => {
    it('deve retornar true para atraso', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      expect(
        TrackingService.isDelayed(pastDate.toISOString(), 'in_transit')
      ).toBe(true);
    });

    it('deve retornar false se já entregue', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      expect(
        TrackingService.isDelayed(pastDate.toISOString(), 'delivered')
      ).toBe(false);
    });

    it('deve retornar false se dentro do prazo', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      
      expect(
        TrackingService.isDelayed(futureDate.toISOString(), 'in_transit')
      ).toBe(false);
    });
  });

  describe('formatTrackingStatus', () => {
    it('deve formatar status corretamente', () => {
      expect(TrackingService.formatTrackingStatus('pending')).toBe('Aguardando');
      expect(TrackingService.formatTrackingStatus('in_transit')).toBe('Em Trânsito');
      expect(TrackingService.formatTrackingStatus('delivered')).toBe('Entregue');
      expect(TrackingService.formatTrackingStatus('delayed')).toBe('Atrasado');
    });
  });

  describe('bulkUpdateTracking', () => {
    it('deve atualizar múltiplos rastreamentos', async () => {
      const updates = [
        { tracking_id: 'track-1', status: 'in_transit' },
        { tracking_id: 'track-2', status: 'delivered' },
      ];

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: updates,
          error: null,
        }),
      });

      (supabase.from as any).mockReturnValue({
        update: mockUpdate,
      });

      const results = await TrackingService.bulkUpdateTracking(updates);

      expect(results).toHaveLength(2);
    });
  });
});
