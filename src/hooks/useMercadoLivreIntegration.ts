import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MercadoLivreOrder {
  id: number;
  date_created: string;
  date_closed: string;
  last_updated: string;
  manufacturing_ending_date: string;
  comment: string;
  pack_id: number;
  pickup_id: number;
  order_request: {
    change: string;
    return: string;
  };
  fulfilled: boolean;
  mediations: Array<unknown>;
  total_amount: number;
  paid_amount: number;
  coupon: {
    id: string;
    amount: number;
  };
  expiration_date: string;
  order_items: Array<{
    item: {
      id: string;
      title: string;
      category_id: string;
      variation_id: number;
      seller_custom_field: string;
      variation_attributes: Array<unknown>;
      warranty: string;
      condition: string;
      seller_sku: string;
      global_price: number;
      net_weight: string;
    };
    quantity: number;
    requested_quantity: {
      value: number;
      measure: string;
    };
    picked_quantity: number;
    unit_price: number;
    full_unit_price: number;
    currency_id: string;
    manufacturing_days: number;
    sale_fee: number;
    listing_type_id: string;
  }>;
  payments: Array<{
    id: number;
    transaction_amount: number;
    currency_id: string;
    status: string;
    date_created: string;
    date_last_modified: string;
    payment_type: string;
    order_id: number;
    card_id: number;
    activation_uri: string;
    payment_method_id: string;
    installments: number;
    issuer_id: string;
    atm_transfer_reference: {
      transaction_id: string;
      company_id: string;
    };
    site_id: string;
    payer_id: number;
    marketplace_fee: number;
  }>;
  shipping: {
    id: number;
  };
  status: string;
  status_detail: string;
  tags: Array<string>;
  feedback: {
    buyer: unknown;
    seller: unknown;
  };
  context: {
    channel: string;
    site: string;
    flows: Array<string>;
  };
  buyer: {
    id: number;
    nickname: string;
    first_name: string;
    last_name: string;
    billing_info: {
      doc_type: string;
      doc_number: string;
    };
  };
  seller: {
    id: number;
    nickname: string;
    first_name: string;
    last_name: string;
    billing_info: {
      doc_type: string;
      doc_number: string;
    };
  };
}

export const useMercadoLivreIntegration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [orders, setOrders] = useState<MercadoLivreOrder[]>([]);

  const fetchOrders = useCallback(async (accessToken: string, sellerId: string, since?: string) => {
    setIsLoading(true);
    try {
      // Primeiro testar a conexão
      const testResponse = await fetch(`https://api.mercadolibre.com/users/${sellerId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!testResponse.ok) {
        throw new Error(`Credenciais inválidas ou vendedor não encontrado: ${testResponse.status}`);
      }

      // Buscar pedidos via função Edge
      const { data, error } = await supabase.functions.invoke('mercadolivre-orders', {
        body: {
          accessToken,
          sellerId,
          since
        }
      });

      if (error) throw error;

      setOrders(data.orders || []);
      toast.success(`Encontrados ${data.orders?.length || 0} pedidos no Mercado Livre`);
      return data.orders || [];
    } catch (error) {
      console.error('Erro ao buscar pedidos do Mercado Livre:', error);
      toast.error(`Erro ao conectar com Mercado Livre: ${error.message}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const importOrders = useCallback(async (mlOrders: MercadoLivreOrder[]) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-mercadolivre-orders', {
        body: { orders: mlOrders }
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