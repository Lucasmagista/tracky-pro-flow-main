/**
 * Hook real de integração com WooCommerce
 * 
 * Features:
 * - Autenticação via Consumer Key/Secret
 * - Importação de pedidos via REST API
 * - Webhooks para sincronização
 * - Atualização bidirecional
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface WooCommerceConfig {
  store_url: string;
  consumer_key: string;
  consumer_secret: string;
  api_version?: string;
}

export interface WooCommerceOrder {
  id: number;
  number: string;
  status: string;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  shipping: {
    city: string;
    state: string;
    country: string;
    address_1: string;
  };
  meta_data: Array<{
    key: string;
    value: string;
  }>;
  date_created: string;
  date_modified: string;
}

export function useWooCommerceIntegrationReal() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [config, setConfig] = useState<WooCommerceConfig | null>(null);
  const { toast } = useToast();

  /**
   * Conecta com WooCommerce
   */
  const connect = useCallback(async (
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string
  ) => {
    setIsConnecting(true);
    try {
      // Normaliza a URL da loja
      const normalizedUrl = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const fullUrl = `https://${normalizedUrl}`;

      // Valida credenciais fazendo uma requisição teste
      const testUrl = `${fullUrl}/wp-json/wc/v3/system_status`;
      const auth = btoa(`${consumerKey}:${consumerSecret}`);

      const response = await fetch(testUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      });

      if (!response.ok) {
        throw new Error('Credenciais inválidas ou loja não acessível');
      }

      const wooConfig: WooCommerceConfig = {
        store_url: fullUrl,
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
        api_version: 'v3',
      };

      // Salva a configuração no banco
      const { error: saveError } = await supabase
        .from('integrations')
        .upsert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          platform: 'woocommerce',
          config: wooConfig,
          is_active: true,
        });

      if (saveError) throw saveError;

      setConfig(wooConfig);

      // Registra webhooks
      await registerWebhooks(wooConfig);

      toast({
        title: '✅ WooCommerce Conectado',
        description: 'Integração configurada com sucesso!',
      });

      return true;
    } catch (error) {
      console.error('Erro ao conectar WooCommerce:', error);
      toast({
        title: 'Erro na Conexão',
        description: error instanceof Error ? error.message : 'Falha ao conectar com WooCommerce',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [toast]);

  /**
   * Registra webhooks do WooCommerce
   */
  const registerWebhooks = async (config: WooCommerceConfig) => {
    const webhooks = [
      {
        name: 'Order created',
        topic: 'order.created',
        delivery_url: `${window.location.origin}/api/webhooks/woocommerce/order-created`,
      },
      {
        name: 'Order updated',
        topic: 'order.updated',
        delivery_url: `${window.location.origin}/api/webhooks/woocommerce/order-updated`,
      },
      {
        name: 'Order status changed',
        topic: 'order.status_changed',
        delivery_url: `${window.location.origin}/api/webhooks/woocommerce/order-status-changed`,
      },
    ];

    const auth = btoa(`${config.consumer_key}:${config.consumer_secret}`);

    for (const webhook of webhooks) {
      await fetch(`${config.store_url}/wp-json/wc/${config.api_version}/webhooks`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhook),
      });
    }
  };

  /**
   * Importa pedidos do WooCommerce
   */
  const importOrders = useCallback(async (
    startDate?: Date,
    endDate?: Date,
    perPage = 50
  ) => {
    if (!config) {
      throw new Error('WooCommerce não conectado');
    }

    setIsImporting(true);
    try {
      // Monta parâmetros da query
      const params = new URLSearchParams({
        per_page: perPage.toString(),
        status: 'processing,completed,shipped',
      });

      if (startDate) {
        params.append('after', startDate.toISOString());
      }
      if (endDate) {
        params.append('before', endDate.toISOString());
      }

      const auth = btoa(`${config.consumer_key}:${config.consumer_secret}`);

      // Busca pedidos do WooCommerce
      const response = await fetch(
        `${config.store_url}/wp-json/wc/${config.api_version}/orders?${params}`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Erro ao buscar pedidos: ${response.statusText}`);
      }

      const orders = await response.json() as WooCommerceOrder[];

      // Converte para formato interno
      const convertedOrders = orders
        .filter((order) => {
          // Verifica se tem código de rastreio nos metadados
          return order.meta_data.some((meta) =>
            meta.key.toLowerCase().includes('tracking') ||
            meta.key.toLowerCase().includes('rastreio')
          );
        })
        .map((order) => {
          // Busca código de rastreio nos metadados
          const trackingMeta = order.meta_data.find((meta) =>
            meta.key.toLowerCase().includes('tracking') ||
            meta.key.toLowerCase().includes('rastreio')
          );

          const carrierMeta = order.meta_data.find((meta) =>
            meta.key.toLowerCase().includes('carrier') ||
            meta.key.toLowerCase().includes('transportadora')
          );

          return {
            tracking_code: trackingMeta?.value || '',
            customer_name: `${order.billing.first_name} ${order.billing.last_name}`,
            customer_email: order.billing.email,
            customer_phone: order.billing.phone,
            carrier: carrierMeta?.value || 'WooCommerce',
            status: mapWooStatus(order.status),
            destination: `${order.shipping.city}, ${order.shipping.state}`,
            origin: 'woocommerce',
            external_id: order.id.toString(),
            order_number: order.number,
            created_at: order.date_created,
            updated_at: order.date_modified,
          };
        });

      // Salva no banco via Supabase Function
      const { data, error } = await supabase.functions.invoke('import-woocommerce-orders', {
        body: { orders: convertedOrders },
      });

      if (error) throw error;

      toast({
        title: '✅ Importação Concluída',
        description: `${convertedOrders.length} pedidos importados do WooCommerce`,
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
   * Atualiza código de rastreio no WooCommerce
   */
  const updateTracking = useCallback(async (
    orderId: string,
    trackingNumber: string,
    carrier: string
  ) => {
    if (!config) {
      throw new Error('WooCommerce não conectado');
    }

    try {
      const auth = btoa(`${config.consumer_key}:${config.consumer_secret}`);

      const response = await fetch(
        `${config.store_url}/wp-json/wc/${config.api_version}/orders/${orderId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            meta_data: [
              {
                key: '_tracking_number',
                value: trackingNumber,
              },
              {
                key: '_tracking_carrier',
                value: carrier,
              },
            ],
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
   * Desconecta o WooCommerce
   */
  const disconnect = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('integrations')
        .update({ is_active: false })
        .eq('platform', 'woocommerce')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;

      setConfig(null);

      toast({
        title: 'WooCommerce Desconectado',
        description: 'Integração removida com sucesso',
      });
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao desconectar WooCommerce',
        variant: 'destructive',
      });
    }
  }, [toast]);

  return {
    config,
    isConnecting,
    isImporting,
    connect,
    importOrders,
    updateTracking,
    disconnect,
  };
}

/**
 * Mapeia status do WooCommerce para status interno
 */
function mapWooStatus(wooStatus: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'pending',
    'processing': 'in_transit',
    'on-hold': 'pending',
    'completed': 'delivered',
    'cancelled': 'returned',
    'refunded': 'returned',
    'failed': 'failed',
    'shipped': 'in_transit',
  };

  return statusMap[wooStatus] || 'pending';
}
