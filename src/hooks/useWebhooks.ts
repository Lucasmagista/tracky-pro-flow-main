/**
 * Hook para gerenciar webhooks de marketplaces
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WebhookService, WebhookConfig } from '@/services/webhooks';
import { useToast } from '@/hooks/use-toast';

export function useWebhooks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Carregar webhooks
  const loadWebhooks = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const data = await WebhookService.listWebhooks(user.id);
      setWebhooks(data);
    } catch (error) {
      console.error('Error loading webhooks:', error);
      toast({
        title: 'Erro ao carregar webhooks',
        description: 'Não foi possível carregar a lista de webhooks.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadWebhooks();
  }, [loadWebhooks]);

  // Registrar novo webhook
  const registerWebhook = useCallback(
    async (
      platform: string,
      credentials: Record<string, string>,
      events: string[]
    ) => {
      setIsRegistering(true);
      try {
        const config = await WebhookService.registerWebhook(
          platform,
          credentials,
          events
        );

        setWebhooks((prev) => [...prev, config]);

        toast({
          title: '✅ Webhook registrado!',
          description: `Sincronização automática ativada para ${platform}.`,
        });

        return config;
      } catch (error) {
        console.error('Error registering webhook:', error);
        toast({
          title: '❌ Erro ao registrar webhook',
          description:
            error instanceof Error
              ? error.message
              : 'Não foi possível registrar o webhook.',
          variant: 'destructive',
        });
        throw error;
      } finally {
        setIsRegistering(false);
      }
    },
    [toast]
  );

  // Remover webhook
  const removeWebhook = useCallback(
    async (webhookId: string, platform: string, credentials: Record<string, string>) => {
      try {
        await WebhookService.removeWebhook(webhookId, platform, credentials);

        setWebhooks((prev) =>
          prev.filter((w) => w.webhook_secret !== webhookId)
        );

        toast({
          title: 'Webhook removido',
          description: 'Sincronização automática desativada.',
        });
      } catch (error) {
        console.error('Error removing webhook:', error);
        toast({
          title: 'Erro ao remover webhook',
          description: 'Não foi possível remover o webhook.',
          variant: 'destructive',
        });
        throw error;
      }
    },
    [toast]
  );

  // Testar webhook
  const testWebhook = useCallback(
    async (webhookId: string) => {
      try {
        const success = await WebhookService.testWebhook(webhookId);

        if (success) {
          toast({
            title: '✅ Webhook funcionando',
            description: 'O webhook está configurado corretamente.',
          });
        } else {
          toast({
            title: '⚠️ Webhook não responde',
            description: 'O webhook não está respondendo corretamente.',
            variant: 'destructive',
          });
        }

        return success;
      } catch (error) {
        console.error('Error testing webhook:', error);
        toast({
          title: 'Erro ao testar webhook',
          description: 'Não foi possível testar o webhook.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast]
  );

  // Registrar webhook para Shopify
  const registerShopifyWebhook = useCallback(
    async (shopDomain: string, accessToken: string) => {
      const events = ['orders/create', 'orders/updated', 'orders/fulfilled'];
      return registerWebhook('shopify', { shopDomain, accessToken }, events);
    },
    [registerWebhook]
  );

  // Registrar webhook para WooCommerce
  const registerWooCommerceWebhook = useCallback(
    async (storeUrl: string, consumerKey: string, consumerSecret: string) => {
      const events = ['order.created', 'order.updated'];
      return registerWebhook(
        'woocommerce',
        { storeUrl, consumerKey, consumerSecret },
        events
      );
    },
    [registerWebhook]
  );

  // Registrar webhook para Mercado Livre
  const registerMercadoLivreWebhook = useCallback(
    async (accessToken: string, sellerId: string) => {
      const events = ['orders', 'shipments'];
      return registerWebhook(
        'mercadolivre',
        { accessToken, sellerId },
        events
      );
    },
    [registerWebhook]
  );

  return {
    webhooks,
    isLoading,
    isRegistering,
    loadWebhooks,
    registerWebhook,
    registerShopifyWebhook,
    registerWooCommerceWebhook,
    registerMercadoLivreWebhook,
    removeWebhook,
    testWebhook,
  };
}
