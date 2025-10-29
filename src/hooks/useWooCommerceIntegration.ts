import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WooCommerceOrder {
  id: number;
  order_key: string;
  created_via: string;
  version: string;
  status: string;
  currency: string;
  date_created: string;
  date_modified: string;
  discount_total: string;
  discount_tax: string;
  shipping_total: string;
  shipping_tax: string;
  cart_tax: string;
  total: string;
  total_tax: string;
  prices_include_tax: boolean;
  customer_id: number;
  customer_ip_address: string;
  customer_user_agent: string;
  customer_note: string;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  date_paid: string;
  date_completed: string;
  cart_hash: string;
  meta_data: Array<{
    id: number;
    key: string;
    value: string;
  }>;
  line_items: Array<{
    id: number;
    name: string;
    product_id: number;
    variation_id: number;
    quantity: number;
    tax_class: string;
    subtotal: string;
    subtotal_tax: string;
    total: string;
    total_tax: string;
    taxes: Array<unknown>;
    meta_data: Array<{
      id: number;
      key: string;
      value: string;
    }>;
    sku: string;
    price: number;
  }>;
  tax_lines: Array<unknown>;
  shipping_lines: Array<unknown>;
  fee_lines: Array<unknown>;
  coupon_lines: Array<unknown>;
  refunds: Array<unknown>;
}

export const useWooCommerceIntegration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [orders, setOrders] = useState<WooCommerceOrder[]>([]);

  const fetchOrders = useCallback(async (storeUrl: string, consumerKey: string, consumerSecret: string, since?: string) => {
    setIsLoading(true);
    try {
      // Primeiro testar a conexão
      const auth = btoa(`${consumerKey}:${consumerSecret}`);
      const testResponse = await fetch(`${storeUrl}/wp-json/wc/v3/system_status`, {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      });

      if (!testResponse.ok) {
        throw new Error(`Credenciais inválidas ou loja não encontrada: ${testResponse.status}`);
      }

      // Buscar pedidos via função Edge
      const { data, error } = await supabase.functions.invoke('woocommerce-orders', {
        body: {
          storeUrl,
          consumerKey,
          consumerSecret,
          since
        }
      });

      if (error) throw error;

      setOrders(data.orders || []);
      toast.success(`Encontrados ${data.orders?.length || 0} pedidos no WooCommerce`);
      return data.orders || [];
    } catch (error) {
      console.error('Erro ao buscar pedidos do WooCommerce:', error);
      toast.error(`Erro ao conectar com WooCommerce: ${error.message}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const importOrders = useCallback(async (wooOrders: WooCommerceOrder[]) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-woocommerce-orders', {
        body: { orders: wooOrders }
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