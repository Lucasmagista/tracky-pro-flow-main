/**
 * Service de Integração com Nuvemshop
 * 
 * Implementa todas as funcionalidades de integração com a API da Nuvemshop:
 * - Autenticação OAuth 2.0
 * - Busca de pedidos
 * - Atualização de status
 * - Gerenciamento de webhooks
 * - Conversão de dados
 * 
 * @see https://tiendanube.github.io/api-documentation/
 */

import { supabase } from '@/integrations/supabase/client';
import {
  NuvemshopApiError,
  NuvemshopAuthError,
} from '@/types/nuvemshop';
import type {
  NuvemshopConfig,
  NuvemshopOrder,
  NuvemshopOrderFilters,
  NuvemshopWebhook,
  NuvemshopWebhookEvent,
  NuvemshopWebhookPayload,
  NuvemshopAuthResponse,
  NuvemshopStore,
} from '@/types/nuvemshop';

const NUVEMSHOP_API_BASE = 'https://api.nuvemshop.com.br/v1';
const NUVEMSHOP_AUTH_URL = 'https://www.nuvemshop.com.br/apps/authorize/token';

export class NuvemshopService {
  /**
   * ========================================
   * AUTENTICAÇÃO OAuth 2.0
   * ========================================
   */

  /**
   * Inicia o fluxo OAuth
   */
  static getAuthorizationUrl(appId: string, redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      ...(state && { state })
    });

    return `https://www.nuvemshop.com.br/apps/authorize?${params.toString()}`;
  }

  /**
   * Troca o código de autorização por access token
   */
  static async authenticate(
    appId: string,
    appSecret: string,
    code: string,
    redirectUri: string
  ): Promise<NuvemshopAuthResponse> {
    try {
      const response = await fetch(NUVEMSHOP_AUTH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: appId,
          client_secret: appSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new NuvemshopAuthError(
          error.error_description || 'Falha na autenticação OAuth'
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof NuvemshopAuthError) throw error;
      throw new NuvemshopAuthError(
        `Erro ao autenticar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      );
    }
  }

  /**
   * ========================================
   * CONEXÃO E TESTE
   * ========================================
   */

  /**
   * Testa a conexão com a API
   */
  static async testConnection(config: NuvemshopConfig): Promise<boolean> {
    try {
      const store = await this.getStoreInfo(config);
      return !!store.id;
    } catch (error) {
      console.error('Erro ao testar conexão Nuvemshop:', error);
      return false;
    }
  }

  /**
   * Obtém informações da loja
   */
  static async getStoreInfo(config: NuvemshopConfig): Promise<NuvemshopStore> {
    const response = await this.makeRequest<NuvemshopStore>(
      config,
      `/stores/${config.store_id}`
    );
    return response;
  }

  /**
   * ========================================
   * PEDIDOS (ORDERS)
   * ========================================
   */

  /**
   * Busca pedidos com filtros opcionais
   */
  static async fetchOrders(
    config: NuvemshopConfig,
    filters?: NuvemshopOrderFilters
  ): Promise<NuvemshopOrder[]> {
    const queryParams = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }

    const endpoint = `/stores/${config.store_id}/orders${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;

    return await this.makeRequest<NuvemshopOrder[]>(config, endpoint);
  }

  /**
   * Busca um pedido específico por ID
   */
  static async fetchOrder(
    config: NuvemshopConfig,
    orderId: number
  ): Promise<NuvemshopOrder> {
    return await this.makeRequest<NuvemshopOrder>(
      config,
      `/stores/${config.store_id}/orders/${orderId}`
    );
  }

  /**
   * Atualiza o status de envio de um pedido
   */
  static async updateShippingStatus(
    config: NuvemshopConfig,
    orderId: number,
    trackingCode?: string,
    trackingUrl?: string,
    shippingStatus?: string
  ): Promise<void> {
    const updateData: any = {};

    if (trackingCode) {
      updateData.shipping_tracking_number = trackingCode;
    }

    if (trackingUrl) {
      updateData.shipping_tracking_url = trackingUrl;
    }

    if (shippingStatus) {
      updateData.shipping_status = shippingStatus;
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('Nenhum dado para atualizar');
    }

    await this.makeRequest(
      config,
      `/stores/${config.store_id}/orders/${orderId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updateData)
      }
    );
  }

  /**
   * ========================================
   * WEBHOOKS
   * ========================================
   */

  /**
   * Registra múltiplos webhooks
   */
  static async registerWebhooks(
    config: NuvemshopConfig,
    webhookUrl: string,
    events: NuvemshopWebhookEvent[]
  ): Promise<NuvemshopWebhook[]> {
    const webhooks: NuvemshopWebhook[] = [];

    for (const event of events) {
      try {
        const webhook = await this.createWebhook(config, webhookUrl, event);
        webhooks.push(webhook);
      } catch (error) {
        console.error(`Erro ao criar webhook para ${event}:`, error);
      }
    }

    return webhooks;
  }

  /**
   * Cria um webhook específico
   */
  static async createWebhook(
    config: NuvemshopConfig,
    webhookUrl: string,
    event: NuvemshopWebhookEvent
  ): Promise<NuvemshopWebhook> {
    return await this.makeRequest<NuvemshopWebhook>(
      config,
      `/stores/${config.store_id}/webhooks`,
      {
        method: 'POST',
        body: JSON.stringify({
          url: webhookUrl,
          event
        })
      }
    );
  }

  /**
   * Lista todos os webhooks configurados
   */
  static async listWebhooks(config: NuvemshopConfig): Promise<NuvemshopWebhook[]> {
    return await this.makeRequest<NuvemshopWebhook[]>(
      config,
      `/stores/${config.store_id}/webhooks`
    );
  }

  /**
   * Remove um webhook
   */
  static async deleteWebhook(config: NuvemshopConfig, webhookId: number): Promise<void> {
    await this.makeRequest(
      config,
      `/stores/${config.store_id}/webhooks/${webhookId}`,
      { method: 'DELETE' }
    );
  }

  /**
   * Remove todos os webhooks
   */
  static async deleteAllWebhooks(config: NuvemshopConfig): Promise<void> {
    const webhooks = await this.listWebhooks(config);
    
    for (const webhook of webhooks) {
      try {
        await this.deleteWebhook(config, webhook.id);
      } catch (error) {
        console.error(`Erro ao deletar webhook ${webhook.id}:`, error);
      }
    }
  }

  /**
   * Processa um payload de webhook recebido
   */
  static async processWebhook(
    payload: NuvemshopWebhookPayload,
    userId: string
  ): Promise<void> {
    try {
      console.log('Processando webhook Nuvemshop:', payload);

      // Busca a configuração do usuário
      const { data: integration, error } = await supabase
        .from('marketplace_integrations')
        .select('*')
        .eq('user_id', userId)
        .eq('marketplace', 'nuvemshop')
        .eq('store_url', payload.store_id)
        .single();

      if (error || !integration) {
        console.error('Integração Nuvemshop não encontrada para usuário:', userId);
        return;
      }

      const config: NuvemshopConfig = {
        app_id: integration.api_key || '',
        app_secret: integration.api_secret || '',
        access_token: integration.access_token || '',
        store_id: payload.store_id,
        store_url: integration.store_url || '',
        user_id: userId
      };

      // Processa de acordo com o evento
      switch (payload.event) {
        case 'order/created':
        case 'order/updated':
        case 'order/paid':
          if (payload.id) {
            await this.importOrder(config, payload.id, userId);
          }
          break;

        case 'order/fulfilled':
          console.log('Pedido enviado:', payload.id);
          break;

        case 'order/cancelled':
          console.log('Pedido cancelado:', payload.id);
          break;

        default:
          console.log('Evento não tratado:', payload.event);
      }
    } catch (error) {
      console.error('Erro ao processar webhook Nuvemshop:', error);
      throw error;
    }
  }

  /**
   * ========================================
   * IMPORTAÇÃO E CONVERSÃO
   * ========================================
   */

  /**
   * Importa um pedido específico
   */
  static async importOrder(
    config: NuvemshopConfig,
    orderId: number,
    userId: string
  ): Promise<void> {
    try {
      const nuvemshopOrder = await this.fetchOrder(config, orderId);
      const trackyOrder = this.convertToTrackyOrder(nuvemshopOrder, userId);

      // Verifica se já existe
      const { data: existing } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', userId)
        .eq('tracking_code', trackyOrder.tracking_code)
        .single();

      if (existing) {
        // Atualiza pedido existente
        await supabase
          .from('orders')
          .update({
            status: trackyOrder.status,
            last_update: trackyOrder.last_update,
            estimated_delivery: trackyOrder.estimated_delivery
          })
          .eq('id', existing.id);
      } else {
        // Insere novo pedido
        await supabase.from('orders').insert([trackyOrder]);
      }
    } catch (error) {
      console.error('Erro ao importar pedido:', error);
      throw error;
    }
  }

  /**
   * Converte um pedido Nuvemshop para o formato Tracky
   */
  static convertToTrackyOrder(order: NuvemshopOrder, userId: string): any {
    // Mapeia o status de envio
    const statusMap: Record<string, string> = {
      unpacked: 'pending',
      packed: 'pending',
      ready_for_pickup: 'pending',
      shipped: 'in_transit',
      delivered: 'delivered',
      cancelled: 'failed'
    };

    const status = statusMap[order.shipping_status] || 'pending';

    // Monta endereço de destino
    const destination = order.shipping_address
      ? `${order.shipping_address.city}, ${order.shipping_address.province}`
      : `${order.billing_city}, ${order.billing_province}`;

    return {
      user_id: userId,
      tracking_code: order.shipping_tracking_number || `NV${order.number}`,
      customer_name: order.contact_name || order.billing_name,
      customer_email: order.contact_email,
      customer_phone: order.contact_phone || order.billing_phone,
      status,
      carrier: order.shipping || 'nuvemshop',
      last_update: order.updated_at,
      estimated_delivery: order.shipping_max_days
        ? new Date(Date.now() + order.shipping_max_days * 24 * 60 * 60 * 1000).toISOString()
        : undefined,
      origin: 'nuvemshop',
      destination,
      created_at: order.created_at
    };
  }

  /**
   * Importa múltiplos pedidos em lote
   */
  static async bulkImportOrders(
    config: NuvemshopConfig,
    userId: string,
    filters?: NuvemshopOrderFilters
  ): Promise<{ success: number; errors: number }> {
    let success = 0;
    let errors = 0;

    try {
      const orders = await this.fetchOrders(config, filters);

      for (const order of orders) {
        try {
          await this.importOrder(config, order.id, userId);
          success++;
        } catch (error) {
          console.error(`Erro ao importar pedido ${order.id}:`, error);
          errors++;
        }
      }
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
      throw error;
    }

    return { success, errors };
  }

  /**
   * ========================================
   * UTILITÁRIOS E HTTP
   * ========================================
   */

  /**
   * Faz uma requisição HTTP para a API da Nuvemshop
   */
  private static async makeRequest<T>(
    config: NuvemshopConfig,
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${NUVEMSHOP_API_BASE}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authentication': `bearer ${config.access_token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Tracky Pro Flow (lucas@tracky.com)',
          ...options?.headers
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new NuvemshopApiError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          errorData.code,
          response.status,
          errorData
        );
      }

      // DELETE não retorna conteúdo
      if (options?.method === 'DELETE') {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof NuvemshopApiError) throw error;
      
      throw new NuvemshopApiError(
        `Erro na requisição: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      );
    }
  }

  /**
   * Valida se uma assinatura de webhook é válida
   */
  static validateWebhookSignature(
    payload: string,
    signature: string,
    appSecret: string
  ): boolean {
    // Implementar validação de assinatura HMAC
    // A Nuvemshop usa HMAC-SHA256
    try {
      // Nota: Implementar crypto.subtle ou usar biblioteca
      // Por enquanto, aceita todos (deve ser implementado em produção)
      return true;
    } catch (error) {
      console.error('Erro ao validar assinatura:', error);
      return false;
    }
  }

  /**
   * Formata data para filtros da API
   */
  static formatDate(date: Date): string {
    return date.toISOString();
  }

  /**
   * Calcula datas para sincronização incremental
   */
  static getIncrementalSyncDates(lastSync?: string): {
    created_at_min: string;
    created_at_max: string;
  } {
    const now = new Date();
    const minDate = lastSync ? new Date(lastSync) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      created_at_min: this.formatDate(minDate),
      created_at_max: this.formatDate(now)
    };
  }
}
