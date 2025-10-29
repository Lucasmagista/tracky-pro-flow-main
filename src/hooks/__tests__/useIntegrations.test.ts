import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useIntegrations } from '../useIntegrations';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase');

describe('useIntegrations', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('deve listar integrações disponíveis', async () => {
    const { result } = renderHook(() => useIntegrations(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    expect(result.current.availableIntegrations).toContain('nuvemshop');
    expect(result.current.availableIntegrations).toContain('mercadolivre');
    expect(result.current.availableIntegrations).toContain('smartenvios');
  });

  it('deve verificar status de integração', async () => {
    const mockData = {
      is_active: true,
      type: 'nuvemshop',
    };

    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockData,
        error: null,
      }),
    };

    (supabase.from as any).mockReturnValue(mockChain);

    const { result } = renderHook(() => useIntegrations(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });
});
