import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ShopifyOrder {
  id: string;
  order_number: string;
  created_at: string;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
  };
  shipping_address: {
    address1: string;
    city: string;
    province: string;
    zip: string;
    country: string;
  };
  line_items: Array<{
    title: string;
    quantity: number;
    price: string;
  }>;
  fulfillments?: Array<{
    tracking_number: string;
    tracking_company: string;
  }>;
}

export const useShopifyIntegration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);

  const fetchOrders = useCallback(async (shopDomain: string, accessToken: string, since?: string) => {
    setIsLoading(true);
    try {
      // Primeiro testar a conexão
      const testResponse = await fetch(
        `https://${shopDomain}/admin/api/2023-10/shop.json`,
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!testResponse.ok) {
        throw new Error(`Credenciais inválidas ou loja não encontrada: ${testResponse.status}`);
      }

      // Buscar pedidos via função Edge
      const { data, error } = await supabase.functions.invoke('shopify-orders', {
        body: {
          shopDomain,
          accessToken,
          since
        }
      });

      if (error) throw error;

      setOrders(data.orders || []);
      toast.success(`Encontrados ${data.orders?.length || 0} pedidos no Shopify`);
      return data.orders || [];
    } catch (error) {
      console.error('Erro ao buscar pedidos do Shopify:', error);
      toast.error(`Erro ao conectar com Shopify: ${error.message}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const importOrders = useCallback(async (shopifyOrders: ShopifyOrder[]) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-shopify-orders', {
        body: { orders: shopifyOrders }
      });

      if (error) throw error;

      toast.success(`${data.imported} pedidos importados com sucesso`);
      return data;
    } catch (error) {
      console.error('Erro ao importar pedidos:', error);
      toast.error('Erro ao importar pedidos');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    orders,
    fetchOrders,
    importOrders
  };
};