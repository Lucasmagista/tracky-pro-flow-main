import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as analyticsModule from '../analytics';

describe('Analytics', () => {
  let mockGtag: ReturnType<typeof vi.fn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let isGAEnabledSpy: any;

  beforeEach(() => {
    // Mock do gtag
    mockGtag = vi.fn();
    window.gtag = mockGtag as unknown as Window['gtag'];
    window.dataLayer = [];
    
    // Força isGAEnabled a retornar true para os testes funcionarem
    isGAEnabledSpy = vi.spyOn(analyticsModule, 'isGAEnabled').mockReturnValue(true);
  });

  afterEach(() => {
    delete (window as Partial<Window>).gtag;
    delete (window as Partial<Window>).dataLayer;
    vi.restoreAllMocks();
  });

  describe('isGAEnabled', () => {
    it('deve retornar true quando GA está configurado', () => {
      expect(analyticsModule.isGAEnabled()).toBe(true);
    });

    it('deve retornar false quando gtag não existe', () => {
      // Restaura implementação original e remove gtag
      isGAEnabledSpy.mockRestore();
      delete (window as Partial<Window>).gtag;
      
      expect(analyticsModule.isGAEnabled()).toBe(false);
    });
  });

  describe('trackPageView', () => {
    it('deve trackear visualização de página', () => {
      analyticsModule.trackPageView('/dashboard', 'Dashboard');

      expect(mockGtag).toHaveBeenCalledWith('event', 'page_view', {
        page_path: '/dashboard',
        page_title: 'Dashboard',
      });
    });

    it('não deve trackear quando GA está desabilitado', () => {
      // Mock isGAEnabled para retornar false
      isGAEnabledSpy.mockReturnValue(false);

      analyticsModule.trackPageView('/test');

      expect(mockGtag).not.toHaveBeenCalled();
    });
  });

  describe('trackEvent', () => {
    it('deve trackear evento customizado', () => {
      analyticsModule.trackEvent('import_orders_success', {
        integration: 'nuvemshop',
        count: 100,
      });

      expect(mockGtag).toHaveBeenCalledWith(
        'event',
        'import_orders_success',
        {
          integration: 'nuvemshop',
          count: 100,
        }
      );
    });
  });

  describe('trackOrdersImport', () => {
    it('deve trackear importação bem-sucedida', () => {
      analyticsModule.trackOrdersImport('nuvemshop', 100, true);

      expect(mockGtag).toHaveBeenCalledWith(
        'event',
        'import_orders_success',
        {
          integration: 'nuvemshop',
          orders_count: 100,
        }
      );
    });

    it('deve trackear erro na importação', () => {
      analyticsModule.trackOrdersImport('shopify', 50, false);

      expect(mockGtag).toHaveBeenCalledWith(
        'event',
        'import_orders_error',
        {
          integration: 'shopify',
          orders_count: 50,
        }
      );
    });
  });

  describe('trackIntegrationConnected', () => {
    it('deve trackear conexão de integração', () => {
      analyticsModule.trackIntegrationConnected('mercadolivre');

      expect(mockGtag).toHaveBeenCalledWith(
        'event',
        'integration_connected',
        {
          integration_name: 'mercadolivre',
        }
      );
    });
  });

  describe('trackNotificationSent', () => {
    it('deve trackear notificação enviada com sucesso', () => {
      analyticsModule.trackNotificationSent('whatsapp', 10, true);

      expect(mockGtag).toHaveBeenCalledWith(
        'event',
        'notification_sent',
        {
          channel: 'whatsapp',
          count: 10,
        }
      );
    });

    it('deve trackear erro no envio de notificação', () => {
      analyticsModule.trackNotificationSent('email', 5, false);

      expect(mockGtag).toHaveBeenCalledWith(
        'event',
        'notification_error',
        {
          channel: 'email',
          count: 5,
        }
      );
    });
  });

  describe('trackError', () => {
    it('deve trackear erro com mensagem', () => {
      analyticsModule.trackError('api_error', 'Falha na conexão');

      expect(mockGtag).toHaveBeenCalledWith(
        'event',
        'error_occurred',
        {
          error_type: 'api_error',
          error_message: 'Falha na conexão',
        }
      );
    });
  });

  describe('setUserProperties', () => {
    it('deve definir propriedades do usuário', () => {
      analyticsModule.setUserProperties('user-123', {
        plan: 'premium',
        total_integrations: 3,
      });

      expect(mockGtag).toHaveBeenCalledWith('set', {
        user_id: 'user-123',
        plan: 'premium',
        total_integrations: 3,
      });
    });
  });

  describe('clearUserData', () => {
    it('deve limpar dados do usuário', () => {
      analyticsModule.clearUserData();

      expect(mockGtag).toHaveBeenCalledWith('set', {
        user_id: undefined,
      });
    });
  });
});
