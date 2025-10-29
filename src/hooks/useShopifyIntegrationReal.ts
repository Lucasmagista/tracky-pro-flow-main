/**
 * Hook real de integração com Shopify
 * 
 * Features:
 * - Autenticação OAuth 2.0
 * - Importação de pedidos
 * - Webhooks para sincronização
 * - Atualização bidirecional
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface ShopifyConfig {
  shop_url: string;
  access_token: string;
  api_version?: string;
}

export interface ShopifyOrder {
  id: string;
  order_number: string;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
  shipping_address: {
    city: string;
    province: string;
    country: string;
    address1: string;
  };
  fulfillments: Array<{
    tracking_company?: string;
    tracking_number?: string;
    status: string;
  }>;
  financial_status: string;
  fulfillment_status: string;
  created_at: string;
  updated_at: string;
}

export function useShopifyIntegrationReal() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [config, setConfig] = useState<ShopifyConfig | null>(null);
  const { toast } = useToast();

  /**
   * Inicia o fluxo de autenticação OAuth
   */
  const connect = useCallback(async (shopUrl: string) => {
    setIsConnecting(true);
    try {
      // Normaliza a URL da loja
      const normalizedShop = shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      
      if (!normalizedShop.includes('.myshopify.com')) {
        throw new Error('URL inválida. Use o formato: sua-loja.myshopify.com');
      }

      // Gera o state para segurança OAuth
      const state = crypto.randomUUID();
      
      // Salva o state no localStorage para verificação posterior
      localStorage.setItem('shopify_oauth_state', state);
      
      // Redireciona para a página de autorização do Shopify
      const scopes = [
        'read_orders',
        'write_orders',
        'read_customers',
        'read_fulfillments',
        'write_fulfillments',
      ].join(',');
      
      const redirectUri = `${window.location.origin}/dashboard/integrations/shopify/callback`;
      const clientId = import.meta.env.VITE_SHOPIFY_CLIENT_ID;
      
      if (!clientId) {
        throw new Error('Shopify Client ID não configurado. Configure VITE_SHOPIFY_CLIENT_ID no .env');
      }

      const authUrl = `https://${normalizedShop}/admin/oauth/authorize?` +
        `client_id=${clientId}&` +
        `scope=${scopes}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${state}`;

      window.location.href = authUrl;
    } catch (error) {
      console.error('Erro ao conectar Shopify:', error);
      toast({
        title: 'Erro na Conexão',
        description: error instanceof Error ? error.message : 'Falha ao conectar com Shopify',
        variant: 'destructive',
      });
      setIsConnecting(false);
    }
  }, [toast]);

  /**
   * Completa o fluxo OAuth com o código recebido
   */
  const handleCallback = useCallback(async (code: string, state: string, shop: string) => {
    try {
      // Verifica o state para prevenir CSRF
      const savedState = localStorage.getItem('shopify_oauth_state');
      if (state !== savedState) {
        throw new Error('State inválido - possível ataque CSRF');
      }

      // Troca o código pelo access token via Supabase Function
      const { data, error } = await supabase.functions.invoke('shopify-oauth', {
        body: { code, shop },
      });

      if (error) throw error;

      const shopifyConfig: ShopifyConfig = {
        shop_url: shop,
        access_token: data.access_token,
        api_version: '2024-01',
      };

      // Salva a configuração no banco
      const { error: saveError } = await supabase
        .from('integrations')
        .upsert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          platform: 'shopify',
          config: shopifyConfig,
          is_active: true,
        });

      if (saveError) throw saveError;

      setConfig(shopifyConfig);
      localStorage.removeItem('shopify_oauth_state');

      // Registra webhook
      await registerWebhooks(shopifyConfig);

      toast({
        title: '✅ Shopify Conectado',
        description: 'Integração configurada com sucesso!',
      });

      return true;
    } catch (error) {
      console.error('Erro no callback OAuth:', error);
      toast({
        title: 'Erro na Autenticação',
        description: error instanceof Error ? error.message : 'Falha ao autenticar',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  /**
   * Registra webhooks do Shopify
   */
  const registerWebhooks = async (config: ShopifyConfig) => {
    const webhooks = [
      {
        topic: 'orders/create',
        address: `${window.location.origin}/api/webhooks/shopify/orders-create`,
      },
      {
        topic: 'orders/updated',
        address: `${window.location.origin}/api/webhooks/shopify/orders-update`,
      },
      {
        topic: 'fulfillments/create',
        address: `${window.location.origin}/api/webhooks/shopify/fulfillments-create`,
      },
      {
        topic: 'fulfillments/update',
        address: `${window.location.origin}/api/webhooks/shopify/fulfillments-update`,
      },
    ];

    for (const webhook of webhooks) {
      await fetch(`https://${config.shop_url}/admin/api/${config.api_version}/webhooks.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': config.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ webhook }),
      });
    }
  };

  /**
   * Importa pedidos do Shopify
   */
  const importOrders = useCallback(async (
    startDate?: Date,
    endDate?: Date,
    limit = 50
  ) => {
    if (!config) {
      throw new Error('Shopify não conectado');
    }

    setIsImporting(true);
    try {
      // Monta parâmetros da query
      const params = new URLSearchParams({
        limit: limit.toString(),
        status: 'any',
      });

      if (startDate) {
        params.append('created_at_min', startDate.toISOString());
      }
      if (endDate) {
        params.append('created_at_max', endDate.toISOString());
      }

      // Busca pedidos do Shopify
      const response = await fetch(
        `https://${config.shop_url}/admin/api/${config.api_version}/orders.json?${params}`,
        {
          headers: {
            'X-Shopify-Access-Token': config.access_token,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Erro ao buscar pedidos: ${response.statusText}`);
      }

      const { orders } = await response.json() as { orders: ShopifyOrder[] };

      // Converte para formato interno
      const convertedOrders = orders
        .filter((order) => order.fulfillments.length > 0)
        .map((order) => {
          const fulfillment = order.fulfillments[0];
          return {
            tracking_code: fulfillment.tracking_number || '',
            customer_name: `${order.customer.first_name} ${order.customer.last_name}`,
            customer_email: order.customer.email,
            customer_phone: order.customer.phone,
            carrier: fulfillment.tracking_company || 'Shopify',
            status: mapShopifyStatus(fulfillment.status),
            destination: `${order.shipping_address.city}, ${order.shipping_address.province}`,
            origin: 'shopify',
            external_id: order.id,
            order_number: order.order_number,
            created_at: order.created_at,
            updated_at: order.updated_at,
          };
        });

      // Salva no banco via Supabase Function
      const { data, error } = await supabase.functions.invoke('import-shopify-orders', {
        body: { orders: convertedOrders },
      });

      if (error) throw error;

      toast({
        title: '✅ Importação Concluída',
        description: `${convertedOrders.length} pedidos importados do Shopify`,
      });

      return data;
    } catch (error) {
      console.error('Erro ao importar pedidos:', error);
      toast({
        title: 'Erro na Importação',
        description: error instanceof Error ? error.message : 'Falha ao importar pedidos',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsImporting(false);
    }
  }, [config, toast]);

  /**
   * Atualiza status de rastreio no Shopify
   */
  const updateTracking = useCallback(async (
    orderId: string,
    trackingNumber: string,
    trackingCompany: string,
    trackingUrl?: string
  ) => {
    if (!config) {
      throw new Error('Shopify não conectado');
    }

    try {
      const response = await fetch(
        `https://${config.shop_url}/admin/api/${config.api_version}/orders/${orderId}/fulfillments.json`,
        {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': config.access_token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fulfillment: {
              tracking_number: trackingNumber,
              tracking_company: trackingCompany,
              tracking_url: trackingUrl,
              notify_customer: true,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Erro ao atualizar rastreio: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao atualizar rastreio:', error);
      throw error;
    }
  }, [config]);

  /**
   * Desconecta o Shopify
   */
  const disconnect = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('integrations')
        .update({ is_active: false })
        .eq('platform', 'shopify')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;

      setConfig(null);

      toast({
        title: 'Shopify Desconectado',
        description: 'Integração removida com sucesso',
      });
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao desconectar Shopify',
        variant: 'destructive',
      });
    }
  }, [toast]);

  return {
    config,
    isConnecting,
    isImporting,
    connect,
    handleCallback,
    importOrders,
    updateTracking,
    disconnect,
  };
}

/**
 * Mapeia status do Shopify para status interno
 */
function mapShopifyStatus(shopifyStatus: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'pending',
    'success': 'delivered',
    'in_transit': 'in_transit',
    'out_for_delivery': 'out_for_delivery',
    'failure': 'failed',
    'cancelled': 'returned',
  };

  return statusMap[shopifyStatus] || 'pending';
}
