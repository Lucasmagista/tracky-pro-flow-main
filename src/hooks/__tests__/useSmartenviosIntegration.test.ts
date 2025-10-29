import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSmartenviosIntegration } from '../useSmartenviosIntegration';
import { supabase } from '@/lib/supabase';
import type { ReactNode } from 'react';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

global.fetch = vi.fn();

describe('useSmartenviosIntegration', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
  });

  describe('API Configuration', () => {
    it('deve salvar configuração da API', async () => {
      const mockConfig = {
        api_key: 'smart_key_123',
        environment: 'production' as const,
      };

      const mockSupabaseChain = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'config-123', ...mockConfig },
          error: null,
        }),
      };

      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      const { result } = renderHook(() => useSmartenviosIntegration(), { wrapper });

      const config = await result.current.saveConfig(mockConfig);

      expect(config).toEqual({ id: 'config-123', ...mockConfig });
      expect(mockSupabaseChain.upsert).toHaveBeenCalled();
    });

    it('deve buscar configuração existente', async () => {
      const mockConfig = {
        id: 'config-123',
        api_key: 'smart_key_123',
        environment: 'production',
      };

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockConfig,
          error: null,
        }),
      };

      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      const { result } = renderHook(() => useSmartenviosIntegration(), { wrapper });

      await waitFor(() => {
        expect(result.current.config).toEqual(mockConfig);
        expect(result.current.isConfigured).toBe(true);
      });
    });
  });

  describe('Shipping Quotes', () => {
    it('deve buscar cotações com sucesso', async () => {
      const mockQuotes = [
        {
          carrier: 'correios',
          service: 'PAC',
          price: 25.50,
          delivery_time: 7,
        },
        {
          carrier: 'jadlog',
          service: '.Package',
          price: 30.00,
          delivery_time: 5,
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ quotes: mockQuotes }),
      });

      const { result } = renderHook(() => useSmartenviosIntegration(), { wrapper });

      const quotes = await result.current.getShippingQuotes({
        origin_zipcode: '01000-000',
        destination_zipcode: '20000-000',
        weight: 1.5,
        length: 20,
        width: 15,
        height: 10,
      });

      expect(quotes).toHaveLength(2);
      expect(quotes[0].carrier).toBe('correios');
    });

    it('deve lidar com erro na busca de cotações', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid zipcode' }),
      });

      const { result } = renderHook(() => useSmartenviosIntegration(), { wrapper });

      await expect(
        result.current.getShippingQuotes({
          origin_zipcode: 'invalid',
          destination_zipcode: '20000-000',
          weight: 1.5,
          length: 20,
          width: 15,
          height: 10,
        })
      ).rejects.toThrow();
    });
  });

  describe('Label Generation', () => {
    it('deve gerar etiqueta com sucesso', async () => {
      const mockLabel = {
        id: 'label-123',
        tracking_code: 'SM123456789BR',
        label_url: 'https://smartenvios.com/labels/123.pdf',
        carrier: 'correios',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockLabel,
      });

      const { result } = renderHook(() => useSmartenviosIntegration(), { wrapper });

      const label = await result.current.generateLabel({
        order_id: 'order-123',
        carrier: 'correios',
        service: 'PAC',
        origin: {
          name: 'Loja A',
          zipcode: '01000-000',
          address: 'Rua A',
          number: '123',
          city: 'São Paulo',
          state: 'SP',
        },
        destination: {
          name: 'Cliente B',
          zipcode: '20000-000',
          address: 'Rua B',
          number: '456',
          city: 'Rio de Janeiro',
          state: 'RJ',
        },
        package: {
          weight: 1.5,
          length: 20,
          width: 15,
          height: 10,
        },
      });

      expect(label.tracking_code).toBe('SM123456789BR');
      expect(label.label_url).toContain('.pdf');
    });
  });

  describe('Tracking', () => {
    it('deve rastrear pacote com sucesso', async () => {
      const mockTracking = {
        tracking_code: 'SM123456789BR',
        carrier: 'correios',
        status: 'in_transit',
        events: [
          {
            status: 'posted',
            date: '2025-01-15T10:00:00Z',
            location: 'São Paulo - SP',
          },
          {
            status: 'in_transit',
            date: '2025-01-16T11:00:00Z',
            location: 'Rio de Janeiro - RJ',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTracking,
      });

      const { result } = renderHook(() => useSmartenviosIntegration(), { wrapper });

      const tracking = await result.current.trackPackage('SM123456789BR');

      expect(tracking.status).toBe('in_transit');
      expect(tracking.events).toHaveLength(2);
    });
  });

  describe('Bulk Operations', () => {
    it('deve gerar etiquetas em lote', async () => {
      const mockLabels = [
        {
          id: 'label-1',
          tracking_code: 'SM123456789BR',
          order_id: 'order-1',
        },
        {
          id: 'label-2',
          tracking_code: 'SM987654321BR',
          order_id: 'order-2',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ labels: mockLabels }),
      });

      const { result } = renderHook(() => useSmartenviosIntegration(), { wrapper });

      const labels = await result.current.generateBulkLabels([
        {
          order_id: 'order-1',
          carrier: 'correios',
          service: 'PAC',
        },
        {
          order_id: 'order-2',
          carrier: 'jadlog',
          service: '.Package',
        },
      ]);

      expect(labels).toHaveLength(2);
    });
  });
});
