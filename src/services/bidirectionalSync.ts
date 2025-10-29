/**
 * Serviço de Sincronização Bidirecional
 * 
 * Sincroniza dados do Tracky de volta para os marketplaces
 * Atualiza status, códigos de rastreio e notificações
 */

import { supabase } from '@/integrations/supabase/client';

interface SyncPayload {
  orderId: string;
  trackingCode?: string;
  status?: string;
  carrier?: string;
  estimatedDelivery?: string;
  notes?: string;
}

interface MarketplaceCredentials {
  shopDomain?: string;
  accessToken?: string;
  storeUrl?: string;
  consumerKey?: string;
  consumerSecret?: string;
  sellerId?: string;
}

export class BidirectionalSyncService {
  /**
   * Sincroniza atualização de pedido para o marketplace
   */
  static async syncOrderUpdate(
    orderId: string,
    platform: string,
    updates: Partial<SyncPayload>
  ): Promise<void> {
    // Buscar credenciais da integração
    const credentials = await this.getMarketplaceCredentials(platform);
    
    // Buscar dados do pedido
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (!order || !credentials) {
      throw new Error('Order or credentials not found');
    }

    switch (platform) {
      case 'shopify':
        await this.syncToShopify(order, credentials, updates);
        break;
      
      case 'woocommerce':
        await this.syncToWooCommerce(order, credentials, updates);
        break;
      
      case 'mercadolivre':
        await this.syncToMercadoLivre(order, credentials, updates);
        break;
      
      default:
        throw new Error(`Platform ${platform} not supported for sync`);
    }

    // Registrar log de sincronização
    await this.logSync(orderId, platform, updates, 'success');
  }

  /**
   * Sincroniza código de rastreio para o marketplace
   */
  static async syncTrackingCode(
    orderId: string,
    trackingCode: string,
    carrier: string
  ): Promise<void> {
    const { data: order } = await supabase
      .from('orders')
      .select('marketplace, external_id')
      .eq('id', orderId)
      .single();

    if (!order) throw new Error('Order not found');

    await this.syncOrderUpdate(orderId, (order as unknown as { marketplace: string }).marketplace, {
      trackingCode,
      carrier,
    });
  }

  /**
   * Sincroniza status do pedido para o marketplace
   */
  static async syncOrderStatus(
    orderId: string,
    newStatus: string
  ): Promise<void> {
    const { data: order } = await supabase
      .from('orders')
      .select('marketplace, external_id')
      .eq('id', orderId)
      .single();

    if (!order) throw new Error('Order not found');

    await this.syncOrderUpdate(orderId, (order as unknown as { marketplace: string }).marketplace, {
      status: newStatus,
    });
  }

  /**
   * Sincroniza para Shopify
   */
  private static async syncToShopify(
    order: Record<string, unknown>,
    credentials: MarketplaceCredentials,
    updates: Partial<SyncPayload>
  ): Promise<void> {
    const { shopDomain, accessToken } = credentials;

    // Se houver tracking code, criar fulfillment
    if (updates.trackingCode) {
      const fulfillmentPayload = {
        fulfillment: {
          tracking_number: updates.trackingCode,
          tracking_company: updates.carrier || '',
          notify_customer: true,
          line_items: [
            // Normalmente você pegaria os line items do pedido original
            { id: order.external_id }
          ],
        },
      };

      const response = await fetch(
        `https://${shopDomain}/admin/api/2023-10/orders/${order.external_id}/fulfillments.json`,
        {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': accessToken!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fulfillmentPayload),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to sync tracking to Shopify');
      }
    }

    // Se houver mudança de status
    if (updates.status) {
      const statusPayload = {
        order: {
          note: updates.notes || `Status atualizado para: ${updates.status}`,
        },
      };

      const response = await fetch(
        `https://${shopDomain}/admin/api/2023-10/orders/${order.external_id}.json`,
        {
          method: 'PUT',
          headers: {
            'X-Shopify-Access-Token': accessToken!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(statusPayload),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to sync status to Shopify');
      }
    }
  }

  /**
   * Sincroniza para WooCommerce
   */
  private static async syncToWooCommerce(
    order: Record<string, unknown>,
    credentials: MarketplaceCredentials,
    updates: Partial<SyncPayload>
  ): Promise<void> {
    const { storeUrl, consumerKey, consumerSecret } = credentials;
    const auth = btoa(`${consumerKey}:${consumerSecret}`);

    const updatePayload: Record<string, unknown> = {};

    // Adicionar tracking code como meta data
    if (updates.trackingCode) {
      updatePayload.meta_data = [
        {
          key: '_tracking_number',
          value: updates.trackingCode,
        },
        {
          key: '_tracking_provider',
          value: updates.carrier || '',
        },
      ];
    }

    // Mapear status interno para status WooCommerce
    if (updates.status) {
      updatePayload.status = this.mapToWooCommerceStatus(updates.status);
    }

    // Adicionar nota
    if (updates.notes) {
      updatePayload.customer_note = updates.notes;
    }

    const response = await fetch(
      `${storeUrl}/wp-json/wc/v3/orders/${order.external_id}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to sync to WooCommerce');
    }
  }

  /**
   * Sincroniza para Mercado Livre
   */
  private static async syncToMercadoLivre(
    order: Record<string, unknown>,
    credentials: MarketplaceCredentials,
    updates: Partial<SyncPayload>
  ): Promise<void> {
    const { accessToken } = credentials;

    // Mercado Livre tem API específica para atualizar shipment
    if (updates.trackingCode) {
      const shipmentPayload = {
        tracking_number: updates.trackingCode,
        tracking_method: updates.carrier || 'custom',
      };

      const response = await fetch(
        `https://api.mercadolibre.com/shipments/${order.external_id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(shipmentPayload),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to sync tracking to Mercado Livre');
      }
    }

    // Adicionar nota no pedido
    if (updates.notes) {
      await fetch(
        `https://api.mercadolibre.com/messages/packs/${order.external_id}/sellers/${credentials.sellerId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: {
              user_id: credentials.sellerId,
            },
            to: {
              user_id: order.customer_id,
            },
            text: updates.notes,
          }),
        }
      );
    }
  }

  /**
   * Busca credenciais do marketplace
   */
  private static async getMarketplaceCredentials(
    platform: string
  ): Promise<MarketplaceCredentials | null> {
    const { data } = await supabase
      .from('marketplace_integrations')
      .select('api_key, api_secret, access_token, store_url')
      .eq('marketplace', platform)
      .eq('is_active', true)
      .single();

    if (!data) return null;

    return {
      shopDomain: data.store_url || undefined,
      accessToken: data.access_token || undefined,
      storeUrl: data.store_url || undefined,
      consumerKey: data.api_key || undefined,
      consumerSecret: data.api_secret || undefined,
    } as MarketplaceCredentials;
  }

  /**
   * Registra log de sincronização
   */
  private static async logSync(
    orderId: string,
    platform: string,
    updates: Partial<SyncPayload>,
    status: 'success' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    await supabase.from('sync_logs' as never).insert({
      order_id: orderId,
      platform,
      sync_type: 'bidirectional',
      payload: updates,
      status,
      error_message: errorMessage,
      synced_at: new Date().toISOString(),
    } as never);
  }

  /**
   * Mapeia status interno para WooCommerce
   */
  private static mapToWooCommerceStatus(internalStatus: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'pending',
      'in_transit': 'processing',
      'out_for_delivery': 'processing',
      'delivered': 'completed',
      'delayed': 'on-hold',
      'failed': 'failed',
      'returned': 'refunded',
    };
    return statusMap[internalStatus] || 'processing';
  }

  /**
   * Sincroniza em lote
   */
  static async syncBatch(
    orderIds: string[],
    updates: Partial<SyncPayload>
  ): Promise<{ success: string[]; failed: string[] }> {
    const results = {
      success: [] as string[],
      failed: [] as string[],
    };

    for (const orderId of orderIds) {
      try {
        const { data: order } = await supabase
          .from('orders')
          .select('marketplace')
          .eq('id', orderId)
          .single();

        if (order) {
          await this.syncOrderUpdate(orderId, (order as unknown as { marketplace: string }).marketplace, updates);
          results.success.push(orderId);
        }
      } catch (error) {
        console.error(`Failed to sync order ${orderId}:`, error);
        results.failed.push(orderId);
      }
    }

    return results;
  }

  /**
   * Verifica se sincronização está habilitada para um pedido
   */
  static async isSyncEnabled(orderId: string): Promise<boolean> {
    const { data: order } = await supabase
      .from('orders')
      .select('marketplace, external_id')
      .eq('id', orderId)
      .single();

    const orderData = order as unknown as { marketplace: string; external_id: string } | null;
    if (!orderData || !orderData.external_id) return false;

    const { data: integration } = await supabase
      .from('marketplace_integrations')
      .select('is_active')
      .eq('marketplace', orderData.marketplace)
      .single();

    return (integration as unknown as { is_active: boolean } | null)?.is_active || false;
  }

  /**
   * Configura sincronização automática
   */
  static async enableAutoSync(platform: string, enabled: boolean): Promise<void> {
    const { error } = await supabase
      .from('marketplace_integrations')
      .update({
        is_active: enabled,
      } as never)
      .eq('marketplace', platform);

    if (error) throw error;
  }

  /**
   * Obtém histórico de sincronizações
   */
  static async getSyncHistory(
    orderId: string,
    limit = 10
  ): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await supabase
      .from('sync_logs' as never)
      .select('*')
      .eq('order_id', orderId)
      .order('synced_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as Array<Record<string, unknown>>;
  }

  /**
   * Retenta sincronização falha
   */
  static async retrySyncFailure(syncLogId: string): Promise<void> {
    const { data: log } = await supabase
      .from('sync_logs' as never)
      .select('*')
      .eq('id', syncLogId)
      .single();

    const syncLog = log as unknown as {
      order_id: string;
      platform: string;
      payload: Partial<SyncPayload>;
      status: string;
    } | null;

    if (!syncLog || syncLog.status !== 'failed') {
      throw new Error('Sync log not found or not failed');
    }

    await this.syncOrderUpdate(syncLog.order_id, syncLog.platform, syncLog.payload);
  }

  /**
   * Sincroniza notificação enviada
   */
  static async syncNotificationSent(
    orderId: string,
    notificationType: string,
    sentAt: string
  ): Promise<void> {
    const { data: order } = await supabase
      .from('orders')
      .select('marketplace, external_id')
      .eq('id', orderId)
      .single();

    if (!order) return;

    await this.syncOrderUpdate(orderId, (order as unknown as { marketplace: string }).marketplace, {
      notes: `Notificação enviada: ${notificationType} em ${new Date(sentAt).toLocaleString('pt-BR')}`,
    });
  }
}
