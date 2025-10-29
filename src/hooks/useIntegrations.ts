import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useWebhooks } from '@/hooks/useWebhooks';
import { useBidirectionalSync } from '@/hooks/useBidirectionalSync';
import type { PlatformCredentials } from '@/services/webhooks';

export interface MarketplaceIntegration {
  id: string;
  platform: 'shopify' | 'woocommerce' | 'mercadolivre' | 'nuvemshop';
  is_connected: boolean;
  credentials?: PlatformCredentials;
  settings?: Record<string, unknown>;
  last_sync?: string;
}

export interface CarrierIntegration {
  id: string;
  carrier: 'correios' | 'jadlog' | 'total_express' | 'azul_cargo' | 'loggi' | 'melhor_envio';
  is_connected: boolean;
  credentials?: Record<string, string>;
  settings?: Record<string, unknown>;
}

export const useMarketplaceIntegrations = () => {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<MarketplaceIntegration[]>([]);
  const [loading, setLoading] = useState(false);
  const { registerShopifyWebhook, registerWooCommerceWebhook, registerMercadoLivreWebhook } = useWebhooks();
  const { toggleAutoSync } = useBidirectionalSync();

  const loadIntegrations = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('marketplace_integrations')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      // Mapear os dados do banco para o formato esperado
      const mappedData: MarketplaceIntegration[] = (data || []).map((item) => ({
        id: item.id,
        platform: item.marketplace as 'shopify' | 'woocommerce' | 'mercadolivre' | 'nuvemshop',
        is_connected: item.is_active,
        credentials: item.api_key ? {
          shop_url: item.store_url,
          access_token: item.access_token,
          api_key: item.api_key,
          api_secret: item.api_secret,
        } as PlatformCredentials : undefined,
        settings: {},
        last_sync: item.last_sync,
      }));

      setIntegrations(mappedData);
    } catch (error) {
      console.error('Error loading marketplace integrations:', error);
    }
  }, [user]);

  const connectShopify = useCallback(async (shopDomain: string, accessToken: string) => {
    if (!user) return;

    setLoading(true);
    try {
      // Test connection
      const response = await fetch(
        `https://${shopDomain}/admin/api/2023-10/shop.json`,
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Credenciais inválidas do Shopify');
      }

      const { error } = await supabase
        .from('marketplace_integrations')
        .upsert({
          user_id: user.id,
          marketplace: 'shopify',
          name: 'Shopify',
          is_active: true,
          store_url: shopDomain,
          access_token: accessToken,
          last_sync: new Date().toISOString(),
        } as never);

      if (error) throw error;

      await loadIntegrations();
      
      // Registrar webhook automático
      try {
        await registerShopifyWebhook(shopDomain, accessToken);
        await toggleAutoSync('shopify', true);
        toast.success('Shopify conectado com sincronização automática!');
      } catch (webhookError) {
        console.error('Webhook registration failed:', webhookError);
        toast.success('Shopify conectado! Configure webhooks em Configurações.');
      }
    } catch (error) {
      console.error('Error connecting Shopify:', error);
      toast.error('Erro ao conectar Shopify');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, loadIntegrations, registerShopifyWebhook, toggleAutoSync]);

  const connectWooCommerce = useCallback(async (storeUrl: string, consumerKey: string, consumerSecret: string) => {
    if (!user) return;

    setLoading(true);
    try {
      // Test connection
      const auth = btoa(`${consumerKey}:${consumerSecret}`);
      const response = await fetch(`${storeUrl}/wp-json/wc/v3/system_status`, {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      });

      if (!response.ok) {
        throw new Error('Credenciais inválidas do WooCommerce');
      }

      const { error } = await supabase
        .from('marketplace_integrations')
        .upsert({
          user_id: user.id,
          marketplace: 'woocommerce',
          name: 'WooCommerce',
          is_active: true,
          store_url: storeUrl,
          api_key: consumerKey,
          api_secret: consumerSecret,
          last_sync: new Date().toISOString(),
        } as never);

      if (error) throw error;

      await loadIntegrations();
      
      // Registrar webhook automático
      try {
        await registerWooCommerceWebhook(storeUrl, consumerKey, consumerSecret);
        await toggleAutoSync('woocommerce', true);
        toast.success('WooCommerce conectado com sincronização automática!');
      } catch (webhookError) {
        console.error('Webhook registration failed:', webhookError);
        toast.success('WooCommerce conectado! Configure webhooks em Configurações.');
      }
    } catch (error) {
      console.error('Error connecting WooCommerce:', error);
      toast.error('Erro ao conectar WooCommerce');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, loadIntegrations, registerWooCommerceWebhook, toggleAutoSync]);

  const connectMercadoLivre = useCallback(async (accessToken: string, sellerId: string) => {
    if (!user) return;

    setLoading(true);
    try {
      // Test connection
      const response = await fetch(`https://api.mercadolibre.com/users/${sellerId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Credenciais inválidas do Mercado Livre');
      }

      const { error } = await supabase
        .from('marketplace_integrations')
        .upsert({
          user_id: user.id,
          marketplace: 'mercadolivre',
          name: 'Mercado Livre',
          is_active: true,
          access_token: accessToken,
          api_key: sellerId,
          last_sync: new Date().toISOString(),
        } as never);

      if (error) throw error;

      await loadIntegrations();
      
      // Registrar webhook automático
      try {
        await registerMercadoLivreWebhook(accessToken, sellerId);
        await toggleAutoSync('mercadolivre', true);
        toast.success('Mercado Livre conectado com sincronização automática!');
      } catch (webhookError) {
        console.error('Webhook registration failed:', webhookError);
        toast.success('Mercado Livre conectado! Configure webhooks em Configurações.');
      }
    } catch (error) {
      console.error('Error connecting Mercado Livre:', error);
      toast.error('Erro ao conectar Mercado Livre');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, loadIntegrations, registerMercadoLivreWebhook, toggleAutoSync]);

  const disconnect = useCallback(async (platform: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('marketplace_integrations')
        .update({
          is_active: false,
          access_token: '',
          last_sync: null,
        } as never)
        .eq('user_id', user.id)
        .eq('marketplace', platform);

      if (error) throw error;

      await loadIntegrations();
      toast.success(`${platform} desconectado`);
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Erro ao desconectar');
      throw error;
    }
  }, [user, loadIntegrations]);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  return {
    integrations,
    loading,
    connectShopify,
    connectWooCommerce,
    connectMercadoLivre,
    disconnect,
    reload: loadIntegrations,
  };
};

export const useCarrierIntegrations = () => {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<CarrierIntegration[]>([]);
  const [loading, setLoading] = useState(false);

  const loadIntegrations = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('carrier_integrations' as never)
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      setIntegrations((data || []) as CarrierIntegration[]);
    } catch (error) {
      console.error('Error loading carrier integrations:', error);
    }
  }, [user]);

  const connectCarrier = useCallback(async (carrier: string, credentials: Record<string, string>) => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('carrier_integrations' as never)
        .upsert({
          user_id: user.id,
          carrier,
          is_connected: true,
          credentials,
        } as never);

      if (error) throw error;

      await loadIntegrations();
      toast.success(`${carrier} conectado com sucesso!`);
    } catch (error) {
      console.error('Error connecting carrier:', error);
      toast.error(`Erro ao conectar ${carrier}`);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, loadIntegrations]);

  const disconnectCarrier = useCallback(async (carrier: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('carrier_integrations' as never)
        .update({
          is_connected: false,
          credentials: null,
        } as never)
        .eq('user_id', user.id)
        .eq('carrier', carrier);

      if (error) throw error;

      await loadIntegrations();
      toast.success(`${carrier} desconectado`);
    } catch (error) {
      console.error('Error disconnecting carrier:', error);
      toast.error('Erro ao desconectar');
      throw error;
    }
  }, [user, loadIntegrations]);

  const connectNuvemshop = useCallback(async (appId: string, appSecret: string, storeUrl: string) => {
    if (!user) return;

    setLoading(true);
    try {
      // Save configuration for OAuth flow
      const { error } = await supabase
        .from('integrations')
        .upsert({
          user_id: user.id,
          platform: 'nuvemshop' as any,
          config: {
            app_id: appId,
            app_secret: appSecret,
            store_url: storeUrl,
            store_id: '',
            access_token: '',
            user_id: '',
          } as any,
          is_active: false, // Will be activated after OAuth
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any);

      if (error) throw error;

      await loadIntegrations();
      
      // Generate OAuth URL and redirect
      const redirectUri = `${window.location.origin}/integrations/nuvemshop/callback`;
      const authUrl = `https://www.nuvemshop.com.br/apps/authorize/token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
      
      toast.success('Redirecionando para autorização...');
      setTimeout(() => {
        window.location.href = authUrl;
      }, 1000);

    } catch (error) {
      console.error('Error connecting Nuvemshop:', error);
      toast.error('Erro ao conectar Nuvemshop');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, loadIntegrations]);

  const connectSmartenvios = useCallback(async (apiKey: string, environment: 'sandbox' | 'production' = 'production') => {
    if (!user) return;

    setLoading(true);
    try {
      // Test authentication
      const testResponse = await fetch('https://api.smartenvios.com/v1/auth/validate', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!testResponse.ok) {
        throw new Error('API Key inválida do Smartenvios');
      }

      const webhookUrl = `${window.location.origin}/api/webhooks/smartenvios`;
      
      const { error } = await supabase
        .from('integrations')
        .upsert({
          user_id: user.id,
          platform: 'smartenvios' as any,
          config: {
            api_key: apiKey,
            environment: environment,
            webhook_url: webhookUrl,
          } as any,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any);

      if (error) throw error;

      await loadIntegrations();
      toast.success('Smartenvios conectado com sucesso!');

    } catch (error) {
      console.error('Error connecting Smartenvios:', error);
      toast.error('Erro ao conectar Smartenvios');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, loadIntegrations]);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  return {
    integrations,
    loading,
    connectCarrier,
    disconnectCarrier,
    connectNuvemshop,
    connectSmartenvios,
    reload: loadIntegrations,
  };
};