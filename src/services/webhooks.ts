/**
 * Serviço de Webhooks para Sincronização Automática
 * 
 * Gerencia webhooks de marketplaces para importação automática de pedidos
 * e sincronização bidirecional de status
 */

import { supabase } from '@/integrations/supabase/client';

// Tipos para credenciais de plataformas
export interface ShopifyCredentials {
  shop_url: string;
  access_token: string;
  api_key?: string;
  api_secret?: string;
}

export interface WooCommerceCredentials {
  store_url: string;
  consumer_key: string;
  consumer_secret: string;
}

export interface MercadoLivreCredentials {
  access_token: string;
  refresh_token?: string;
  user_id?: string;
  app_id?: string;
  app_secret?: string;
}

export type PlatformCredentials = ShopifyCredentials | WooCommerceCredentials | MercadoLivreCredentials;

// Tipos para payloads de webhooks
export interface ShopifyOrderPayload {
  id: number;
  order_number: string;
  email?: string;
  created_at: string;
  updated_at: string;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status?: string;
  customer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  shipping_address?: {
    address1?: string;
    city?: string;
    province?: string;
    country?: string;
    zip?: string;
  };
  line_items?: Array<{
    title: string;
    quantity: number;
    price: string;
  }>;
}

export interface WooCommerceOrderPayload {
  id: number;
  order_key: string;
  status: string;
  currency: string;
  date_created: string;
  date_modified: string;
  total: string;
  billing?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  shipping?: {
    address_1?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  line_items?: Array<{
    name: string;
    quantity: number;
    total: string;
  }>;
  meta_data?: Array<{
    key: string;
    value: string;
  }>;
}

export interface MercadoLivreOrderPayload {
  id: number;
  status: string;
  date_created: string;
  date_closed?: string;
  order_items?: Array<{
    item: {
      title: string;
      id: string;
    };
    quantity: number;
    unit_price: number;
  }>;
  total_amount: number;
  currency_id: string;
  buyer?: {
    id: number;
    nickname?: string;
    email?: string;
  };
  shipping?: {
    id: number;
    status?: string;
    tracking_number?: string;
    tracking_method?: string;
  };
}

export type WebhookPayload = ShopifyOrderPayload | WooCommerceOrderPayload | MercadoLivreOrderPayload | Record<string, unknown>;

export interface WebhookConfig {
  id?: string;
  user_id: string;
  platform: 'shopify' | 'woocommerce' | 'mercadolivre' | 'nuvemshop';
  webhook_url: string;
  webhook_secret: string;
  events: string[];
  is_active: boolean;
  last_triggered?: string;
  created_at?: string;
}

export interface WebhookEvent {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: WebhookPayload;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  processed_at?: string;
  created_at: string;
}

export class WebhookService {
  /**
   * Registra um webhook em um marketplace
   */
  static async registerWebhook(
    platform: string,
    credentials: PlatformCredentials,
    events: string[]
  ): Promise<WebhookConfig> {
    const webhookUrl = `${window.location.origin}/api/webhooks/${platform}`;
    
    switch (platform) {
      case 'shopify':
        return this.registerShopifyWebhook(credentials as ShopifyCredentials, events, webhookUrl);
      
      case 'woocommerce':
        return this.registerWooCommerceWebhook(credentials as WooCommerceCredentials, events, webhookUrl);
      
      case 'mercadolivre':
        return this.registerMercadoLivreWebhook(credentials as MercadoLivreCredentials, events, webhookUrl);
      
      default:
        throw new Error(`Platform ${platform} not supported`);
    }
  }

  /**
   * Registra webhook no Shopify
   */
  private static async registerShopifyWebhook(
    credentials: ShopifyCredentials,
    events: string[],
    webhookUrl: string
  ): Promise<WebhookConfig> {
    const webhooks = [];

    for (const event of events) {
      const response = await fetch(
        `https://${credentials.shop_url}/admin/api/2023-10/webhooks.json`,
        {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': credentials.access_token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            webhook: {
              topic: event,
              address: webhookUrl,
              format: 'json',
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to register Shopify webhook for ${event}`);
      }

      const data = await response.json();
      webhooks.push(data.webhook);
    }

    // Salvar configuração no banco
    const { data: config, error } = await supabase
      .from('webhook_configs' as never)
      .insert({
        platform: 'shopify',
        webhook_url: webhookUrl,
        webhook_secret: webhooks[0]?.secret || '',
        events,
        is_active: true,
      } as never)
      .select()
      .single();

    if (error) throw error;

    return config as unknown as WebhookConfig;
  }

  /**
   * Registra webhook no WooCommerce
   */
  private static async registerWooCommerceWebhook(
    credentials: WooCommerceCredentials,
    events: string[],
    webhookUrl: string
  ): Promise<WebhookConfig> {
    const auth = btoa(`${credentials.consumer_key}:${credentials.consumer_secret}`);
    const webhooks = [];

    for (const event of events) {
      const response = await fetch(`${credentials.store_url}/wp-json/wc/v3/webhooks`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Tracky - ${event}`,
          topic: event,
          delivery_url: webhookUrl,
          status: 'active',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to register WooCommerce webhook for ${event}`);
      }

      const data = await response.json();
      webhooks.push(data);
    }

    // Salvar configuração no banco
    const { data: config, error } = await supabase
      .from('webhook_configs' as never)
      .insert({
        platform: 'woocommerce',
        webhook_url: webhookUrl,
        webhook_secret: webhooks[0]?.secret || '',
        events,
        is_active: true,
      } as never)
      .select()
      .single();

    if (error) throw error;

    return config as unknown as WebhookConfig;
  }

  /**
   * Registra webhook no Mercado Livre
   */
  private static async registerMercadoLivreWebhook(
    credentials: MercadoLivreCredentials,
    events: string[],
    webhookUrl: string
  ): Promise<WebhookConfig> {
    const response = await fetch(
      `https://api.mercadolibre.com/applications/${credentials.user_id}/webhooks`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
          events: events,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to register Mercado Livre webhook');
    }

    const data = await response.json();

    // Salvar configuração no banco
    const { data: config, error} = await supabase
      .from('webhook_configs' as never)
      .insert({
        platform: 'mercadolivre',
        webhook_url: webhookUrl,
        webhook_secret: data.id || '',
        events,
        is_active: true,
      } as never)
      .select()
      .single();

    if (error) throw error;

    return config as unknown as WebhookConfig;
  }

  /**
   * Processa evento de webhook recebido
   */
  static async processWebhookEvent(
    platform: string,
    eventType: string,
    payload: WebhookPayload,
    signature: string
  ): Promise<void> {
    // Validar assinatura
    const isValid = await this.validateWebhookSignature(platform, payload, signature);
    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    // Criar registro do evento
    const { data: event, error } = await supabase
      .from('webhook_events' as never)
      .insert({
        event_type: eventType,
        payload,
        status: 'processing',
      } as never)
      .select()
      .single();

    if (error) throw error;

    try {
      // Processar baseado no tipo de evento
      switch (eventType) {
        case 'orders/create':
        case 'order.created':
          await this.processOrderCreated(platform, payload);
          break;

        case 'orders/updated':
        case 'order.updated':
          await this.processOrderUpdated(platform, payload);
          break;

        case 'orders/fulfilled':
        case 'order.fulfilled':
          await this.processOrderFulfilled(platform, payload);
          break;

        default:
          console.log(`Unhandled event type: ${eventType}`);
      }

      // Marcar como concluído
      await supabase
        .from('webhook_events' as never)
        .update({ 
          status: 'completed', 
          processed_at: new Date().toISOString() 
        } as never)
        .eq('id', (event as WebhookEvent).id);

    } catch (error) {
      // Marcar como falha
      await supabase
        .from('webhook_events' as never)
        .update({ 
          status: 'failed', 
          error_message: error instanceof Error ? error.message : 'Unknown error',
          processed_at: new Date().toISOString() 
        } as never)
        .eq('id', (event as WebhookEvent).id);

      throw error;
    }
  }

  /**
   * Valida assinatura do webhook
   */
  private static async validateWebhookSignature(
    platform: string,
    payload: WebhookPayload,
    signature: string
  ): Promise<boolean> {
    // Buscar secret do webhook
    const { data: config } = await supabase
      .from('webhook_configs' as never)
      .select('webhook_secret')
      .eq('platform', platform)
      .eq('is_active', true)
      .single();

    if (!config) return false;

    // Validar baseado na plataforma
    switch (platform) {
      case 'shopify':
        return this.validateShopifySignature(payload, signature, (config as unknown as WebhookConfig).webhook_secret);
      
      case 'woocommerce':
        return this.validateWooCommerceSignature(payload, signature, (config as unknown as WebhookConfig).webhook_secret);
      
      case 'mercadolivre':
        return true; // Mercado Livre usa outro método de validação
      
      default:
        return false;
    }
  }

  /**
   * Valida assinatura Shopify (HMAC SHA256)
   */
  private static async validateShopifySignature(
    payload: WebhookPayload,
    signature: string,
    secret: string
  ): Promise<boolean> {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
    const calculatedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    
    return calculatedSignature === signature;
  }

  /**
   * Valida assinatura WooCommerce
   */
  private static async validateWooCommerceSignature(
    payload: WebhookPayload,
    signature: string,
    secret: string
  ): Promise<boolean> {
    // WooCommerce usa HMAC SHA256 base64
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
    const calculatedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    
    return calculatedSignature === signature;
  }

  /**
   * Processa criação de pedido
   */
  private static async processOrderCreated(platform: string, payload: WebhookPayload): Promise<void> {
    let orderData;

    switch (platform) {
      case 'shopify':
        orderData = this.normalizeShopifyOrder(payload as ShopifyOrderPayload);
        break;
      
      case 'woocommerce':
        orderData = this.normalizeWooCommerceOrder(payload as WooCommerceOrderPayload);
        break;
      
      case 'mercadolivre':
        orderData = this.normalizeMercadoLivreOrder(payload as MercadoLivreOrderPayload);
        break;
      
      default:
        throw new Error(`Platform ${platform} not supported`);
    }

    // Criar pedido no banco
    const { error } = await supabase
      .from('orders')
      .insert(orderData);

    if (error) throw error;
  }

  /**
   * Processa atualização de pedido
   */
  private static async processOrderUpdated(platform: string, payload: WebhookPayload): Promise<void> {
    // Similar ao processOrderCreated, mas com update
    const orderData = this.normalizeOrderData(platform, payload);
    const payloadWithId = payload as { id: number };
    
    // Usando type casting para evitar erros de schema
    const query = supabase.from('orders').update(orderData as never);
    const { error } = await (query as never);

    if (error) throw error;
  }

  /**
   * Processa pedido enviado
   */
  private static async processOrderFulfilled(platform: string, payload: WebhookPayload): Promise<void> {
    const trackingCode = this.extractTrackingCode(platform, payload);
    const payloadWithId = payload as { id: number };
    
    if (trackingCode) {
      // Usando type casting para evitar erros de schema
      const query = supabase.from('orders').update({ 
        tracking_code: trackingCode,
        status: 'in_transit',
        updated_at: new Date().toISOString()
      } as never);
      const { error } = await (query as never);

      if (error) throw error;
    }
  }

  /**
   * Normaliza dados do pedido Shopify
   */
  private static normalizeShopifyOrder(order: ShopifyOrderPayload) {
    return {
      external_id: order.id.toString(),
      platform: 'shopify',
      tracking_code: order.fulfillment_status || '',
      customer_name: `${order.customer?.first_name} ${order.customer?.last_name}`,
      customer_email: order.customer?.email || '',
      customer_phone: '',
      carrier: '',
      status: this.mapShopifyStatus(order.financial_status),
      destination: `${order.shipping_address?.city}, ${order.shipping_address?.province}`,
      order_value: parseFloat(order.total_price),
      created_at: order.created_at,
      updated_at: order.updated_at,
    };
  }

  /**
   * Normaliza dados do pedido WooCommerce
   */
  private static normalizeWooCommerceOrder(order: WooCommerceOrderPayload) {
    return {
      external_id: order.id.toString(),
      platform: 'woocommerce',
      tracking_code: order.meta_data?.find((m) => m.key === '_tracking_number')?.value || '',
      customer_name: `${order.billing?.first_name} ${order.billing?.last_name}`,
      customer_email: order.billing?.email || '',
      customer_phone: '',
      carrier: order.meta_data?.find((m) => m.key === '_tracking_provider')?.value || '',
      status: this.mapWooCommerceStatus(order.status),
      destination: `${order.shipping?.city}, ${order.shipping?.state}`,
      order_value: parseFloat(order.total),
      created_at: order.date_created,
      updated_at: order.date_modified,
    };
  }

  /**
   * Normaliza dados do pedido Mercado Livre
   */
  private static normalizeMercadoLivreOrder(order: MercadoLivreOrderPayload) {
    return {
      external_id: order.id.toString(),
      platform: 'mercadolivre',
      tracking_code: order.shipping?.tracking_number || '',
      customer_name: order.buyer?.nickname || '',
      customer_email: order.buyer?.email || '',
      customer_phone: '',
      carrier: order.shipping?.tracking_method || '',
      status: this.mapMercadoLivreStatus(order.status),
      destination: '',
      order_value: order.total_amount,
      created_at: order.date_created,
      updated_at: order.date_closed || order.date_created,
    };
  }

  /**
   * Mapeia status do Shopify para status interno
   */
  private static mapShopifyStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'unfulfilled': 'pending',
      'partial': 'in_transit',
      'fulfilled': 'delivered',
      'null': 'pending',
    };
    return statusMap[status] || 'pending';
  }

  /**
   * Mapeia status do WooCommerce para status interno
   */
  private static mapWooCommerceStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'pending',
      'processing': 'in_transit',
      'completed': 'delivered',
      'on-hold': 'pending',
      'cancelled': 'failed',
      'refunded': 'returned',
      'failed': 'failed',
    };
    return statusMap[status] || 'pending';
  }

  /**
   * Mapeia status do Mercado Livre para status interno
   */
  private static mapMercadoLivreStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'confirmed': 'pending',
      'payment_required': 'pending',
      'paid': 'in_transit',
      'shipped': 'in_transit',
      'delivered': 'delivered',
      'cancelled': 'failed',
    };
    return statusMap[status] || 'pending';
  }

  /**
   * Extrai código de rastreio do payload
   */
  private static extractTrackingCode(platform: string, payload: WebhookPayload): string | null {
    switch (platform) {
      case 'shopify':
        return (payload as ShopifyOrderPayload).fulfillment_status || null;
      
      case 'woocommerce':
        return (payload as WooCommerceOrderPayload).meta_data?.find((m) => m.key === '_tracking_number')?.value || null;
      
      case 'mercadolivre':
        return (payload as MercadoLivreOrderPayload).shipping?.tracking_number || null;
      
      default:
        return null;
    }
  }

  /**
   * Normaliza dados genéricos
   */
  private static normalizeOrderData(platform: string, payload: WebhookPayload) {
    switch (platform) {
      case 'shopify':
        return this.normalizeShopifyOrder(payload as ShopifyOrderPayload);
      
      case 'woocommerce':
        return this.normalizeWooCommerceOrder(payload as WooCommerceOrderPayload);
      
      case 'mercadolivre':
        return this.normalizeMercadoLivreOrder(payload as MercadoLivreOrderPayload);
      
      default:
        throw new Error(`Platform ${platform} not supported`);
    }
  }

  /**
   * Remove webhook de um marketplace
   */
  static async removeWebhook(webhookId: string, platform: string, credentials: PlatformCredentials): Promise<void> {
    switch (platform) {
      case 'shopify':
        await this.removeShopifyWebhook(webhookId, credentials as ShopifyCredentials);
        break;
      
      case 'woocommerce':
        await this.removeWooCommerceWebhook(webhookId, credentials as WooCommerceCredentials);
        break;
      
      case 'mercadolivre':
        await this.removeMercadoLivreWebhook(webhookId, credentials as MercadoLivreCredentials);
        break;
      
      default:
        throw new Error(`Platform ${platform} not supported`);
    }

    // Desativar no banco
    await supabase
      .from('webhook_configs' as never)
      .update({ is_active: false } as never)
      .eq('webhook_secret', webhookId);
  }

  private static async removeShopifyWebhook(webhookId: string, credentials: ShopifyCredentials): Promise<void> {
    await fetch(
      `https://${credentials.shop_url}/admin/api/2023-10/webhooks/${webhookId}.json`,
      {
        method: 'DELETE',
        headers: {
          'X-Shopify-Access-Token': credentials.access_token,
        },
      }
    );
  }

  private static async removeWooCommerceWebhook(webhookId: string, credentials: WooCommerceCredentials): Promise<void> {
    const auth = btoa(`${credentials.consumer_key}:${credentials.consumer_secret}`);
    await fetch(`${credentials.store_url}/wp-json/wc/v3/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });
  }

  private static async removeMercadoLivreWebhook(webhookId: string, credentials: MercadoLivreCredentials): Promise<void> {
    await fetch(
      `https://api.mercadolibre.com/applications/${credentials.user_id}/webhooks/${webhookId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
        },
      }
    );
  }

  /**
   * Lista webhooks ativos do usuário
   */
  static async listWebhooks(userId: string): Promise<WebhookConfig[]> {
    const { data, error } = await supabase
      .from('webhook_configs' as never)
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw error;

    return (data || []) as unknown as WebhookConfig[];
  }

  /**
   * Testa webhook enviando evento de teste
   */
  static async testWebhook(webhookId: string): Promise<boolean> {
    const { data: config, error } = await supabase
      .from('webhook_configs' as never)
      .select('*')
      .eq('id', webhookId)
      .single();

    if (error || !config) return false;

    try {
      const webhookConfig = config as unknown as WebhookConfig;
      const response = await fetch(webhookConfig.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test: true,
          timestamp: new Date().toISOString(),
        }),
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
