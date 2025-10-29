/**
 * Hook real de integração com Mercado Livre
 * 
 * Features:
 * - Autenticação OAuth 2.0
 * - Importação de vendas
 * - Webhooks para notificações
 * - Atualização de envios
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface MercadoLivreConfig {
  access_token: string;
  refresh_token: string;
  user_id: string;
  expires_at: string;
}

export interface MercadoLivreOrder {
  id: string;
  status: string;
  buyer: {
    id: string;
    nickname: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: {
      area_code: string;
      number: string;
    };
  };
  shipping: {
    id: string;
    tracking_number?: string;
    tracking_method?: string;
    status: string;
    receiver_address: {
      city: {
        name: string;
      };
      state: {
        name: string;
      };
    };
  };
  date_created: string;
  last_updated: string;
}

export function useMercadoLivreIntegrationReal() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [config, setConfig] = useState<MercadoLivreConfig | null>(null);
  const { toast } = useToast();

  /**
   * Inicia o fluxo de autenticação OAuth
   */
  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const clientId = import.meta.env.VITE_MERCADOLIVRE_CLIENT_ID;
      
      if (!clientId) {
        throw new Error('Mercado Livre Client ID não configurado. Configure VITE_MERCADOLIVRE_CLIENT_ID no .env');
      }

      // Gera o state para segurança OAuth
      const state = crypto.randomUUID();
      localStorage.setItem('ml_oauth_state', state);

      const redirectUri = `${window.location.origin}/dashboard/integrations/mercadolivre/callback`;

      // URL de autorização do Mercado Livre
      const authUrl = `https://auth.mercadolivre.com.br/authorization?` +
        `response_type=code&` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${state}`;

      window.location.href = authUrl;
    } catch (error) {
      console.error('Erro ao conectar Mercado Livre:', error);
      toast({
        title: 'Erro na Conexão',
        description: error instanceof Error ? error.message : 'Falha ao conectar com Mercado Livre',
        variant: 'destructive',
      });
      setIsConnecting(false);
    }
  }, [toast]);

  /**
   * Completa o fluxo OAuth com o código recebido
   */
  const handleCallback = useCallback(async (code: string, state: string) => {
    try {
      // Verifica o state
      const savedState = localStorage.getItem('ml_oauth_state');
      if (state !== savedState) {
        throw new Error('State inválido - possível ataque CSRF');
      }

      // Troca o código pelo access token via Supabase Function
      const { data, error } = await supabase.functions.invoke('mercadolivre-oauth', {
        body: { code },
      });

      if (error) throw error;

      const mlConfig: MercadoLivreConfig = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user_id: data.user_id,
        expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      };

      // Salva a configuração no banco
      const { error: saveError } = await supabase
        .from('integrations')
        .upsert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          platform: 'mercadolivre',
          config: mlConfig,
          is_active: true,
        });

      if (saveError) throw saveError;

      setConfig(mlConfig);
      localStorage.removeItem('ml_oauth_state');

      // Registra webhook
      await registerWebhooks(mlConfig);

      toast({
        title: '✅ Mercado Livre Conectado',
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
   * Registra webhooks do Mercado Livre
   */
  const registerWebhooks = async (config: MercadoLivreConfig) => {
    const topics = [
      'orders_v2',
      'shipments',
      'messages',
    ];

    const webhookUrl = `${window.location.origin}/api/webhooks/mercadolivre`;

    for (const topic of topics) {
      await fetch('https://api.mercadolibre.com/applications/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic,
          url: webhookUrl,
        }),
      });
    }
  };

  /**
   * Refresh do access token quando expira
   */
  const refreshToken = useCallback(async () => {
    if (!config) return null;

    try {
      const { data, error } = await supabase.functions.invoke('mercadolivre-refresh-token', {
        body: { refresh_token: config.refresh_token },
      });

      if (error) throw error;

      const newConfig: MercadoLivreConfig = {
        ...config,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      };

      // Atualiza no banco
      await supabase
        .from('integrations')
        .update({ config: newConfig })
        .eq('platform', 'mercadolivre')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      setConfig(newConfig);
      return newConfig;
    } catch (error) {
      console.error('Erro ao renovar token:', error);
      return null;
    }
  }, [config]);

  /**
   * Garante que o token está válido
   */
  const ensureValidToken = useCallback(async (): Promise<string | null> => {
    if (!config) return null;

    // Verifica se o token ainda é válido (com margem de 5 minutos)
    const expiresAt = new Date(config.expires_at);
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiresAt.getTime() - now.getTime() < fiveMinutes) {
      const newConfig = await refreshToken();
      return newConfig?.access_token || null;
    }

    return config.access_token;
  }, [config, refreshToken]);

  /**
   * Importa pedidos do Mercado Livre
   */
  const importOrders = useCallback(async (
    startDate?: Date,
    limit = 50
  ) => {
    const token = await ensureValidToken();
    if (!token) {
      throw new Error('Mercado Livre não conectado ou token inválido');
    }

    setIsImporting(true);
    try {
      // Busca vendas do Mercado Livre
      const params = new URLSearchParams({
        seller: config!.user_id,
        limit: limit.toString(),
        sort: 'date_desc',
      });

      if (startDate) {
        params.append('date_created_from', startDate.toISOString());
      }

      const response = await fetch(
        `https://api.mercadolibre.com/orders/search?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Erro ao buscar pedidos: ${response.statusText}`);
      }

      const { results } = await response.json() as { results: MercadoLivreOrder[] };

      // Busca detalhes de envio para cada pedido
      const ordersWithShipping = await Promise.all(
        results.map(async (order) => {
          if (order.shipping?.id) {
            const shippingResponse = await fetch(
              `https://api.mercadolibre.com/shipments/${order.shipping.id}`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              }
            );

            if (shippingResponse.ok) {
              const shippingData = await shippingResponse.json();
              return { ...order, shipping: shippingData };
            }
          }
          return order;
        })
      );

      // Converte para formato interno
      const convertedOrders = ordersWithShipping
        .filter((order) => order.shipping?.tracking_number)
        .map((order) => ({
          tracking_code: order.shipping.tracking_number || '',
          customer_name: `${order.buyer.first_name} ${order.buyer.last_name}`.trim() || order.buyer.nickname,
          customer_email: order.buyer.email,
          customer_phone: order.buyer.phone ? `${order.buyer.phone.area_code}${order.buyer.phone.number}` : undefined,
          carrier: order.shipping.tracking_method || 'Mercado Envios',
          status: mapMercadoLivreStatus(order.shipping.status),
          destination: `${order.shipping.receiver_address.city.name}, ${order.shipping.receiver_address.state.name}`,
          origin: 'mercadolivre',
          external_id: order.id,
          order_number: order.id,
          created_at: order.date_created,
          updated_at: order.last_updated,
        }));

      // Salva no banco via Supabase Function
      const { data, error } = await supabase.functions.invoke('import-mercadolivre-orders', {
        body: { orders: convertedOrders },
      });

      if (error) throw error;

      toast({
        title: '✅ Importação Concluída',
        description: `${convertedOrders.length} pedidos importados do Mercado Livre`,
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
  }, [config, ensureValidToken, toast]);

  /**
   * Desconecta o Mercado Livre
   */
  const disconnect = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('integrations')
        .update({ is_active: false })
        .eq('platform', 'mercadolivre')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;

      setConfig(null);

      toast({
        title: 'Mercado Livre Desconectado',
        description: 'Integração removida com sucesso',
      });
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao desconectar Mercado Livre',
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
    disconnect,
  };
}

/**
 * Mapeia status do Mercado Livre para status interno
 */
function mapMercadoLivreStatus(mlStatus: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'pending',
    'handling': 'in_transit',
    'ready_to_ship': 'pending',
    'shipped': 'in_transit',
    'delivered': 'delivered',
    'not_delivered': 'failed',
    'cancelled': 'returned',
  };

  return statusMap[mlStatus] || 'pending';
}
