/**
 * Service de Integração com Smartenvios
 * Sistema de rastreamento e envio de encomendas
 */

import { supabase } from '@/integrations/supabase/client';
import {
  SmartenviosApiErrorClass,
  SmartenviosAuthError,
  SmartenviosTrackingError,
} from '@/types/smartenvios';
import type {
  SmartenviosConfig,
  SmartenviosTracking,
  SmartenviosEvent,
  SmartenviosShipment,
  SmartenviosShipmentRequest,
  SmartenviosQuote,
  SmartenviosQuoteRequest,
  SmartenviosWebhook,
  SmartenviosWebhookEvent,
  SmartenviosWebhookPayload,
  SmartenviosTrackingFilters,
  SmartenviosBatchTrackingRequest,
  SmartenviosBatchTrackingResponse,
  SmartenviosValidationResult,
  SMARTENVIOS_TRACKING_PATTERNS,
  SMARTENVIOS_STATUS_MAP
} from '@/types/smartenvios';

const SMARTENVIOS_API_BASE = 'https://api.smartenvios.com/v1';

export class SmartenviosService {
  /**
   * ========================================
   * AUTENTICAÇÃO
   * ========================================
   */

  static async authenticate(apiKey: string): Promise<boolean> {
    try {
      const response = await this.makeRequest(
        { api_key: apiKey, environment: 'production' },
        '/auth/validate'
      );
      return !!response;
    } catch (error) {
      console.error('Erro ao autenticar Smartenvios:', error);
      return false;
    }
  }

  /**
   * ========================================
   * RASTREAMENTO
   * ========================================
   */

  static async trackOrder(
    config: SmartenviosConfig,
    trackingCode: string
  ): Promise<SmartenviosTracking> {
    try {
      return await this.makeRequest<SmartenviosTracking>(
        config,
        `/tracking/${trackingCode}`
      );
    } catch (error) {
      throw new SmartenviosTrackingError(
        `Erro ao rastrear pedido ${trackingCode}`,
        trackingCode
      );
    }
  }

  static async trackMultipleOrders(
    config: SmartenviosConfig,
    trackingCodes: string[]
  ): Promise<SmartenviosBatchTrackingResponse> {
    const results: SmartenviosTracking[] = [];
    const errors: Array<{ tracking_code: string; error: string }> = [];

    for (const code of trackingCodes) {
      try {
        const tracking = await this.trackOrder(config, code);
        results.push(tracking);
      } catch (error) {
        errors.push({
          tracking_code: code,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }

    return { results, errors };
  }

  /**
   * ========================================
   * ENVIOS
   * ========================================
   */

  static async createShipment(
    config: SmartenviosConfig,
    shipmentData: SmartenviosShipmentRequest
  ): Promise<SmartenviosShipment> {
    return await this.makeRequest<SmartenviosShipment>(
      config,
      '/shipments',
      {
        method: 'POST',
        body: JSON.stringify(shipmentData)
      }
    );
  }

  static async getShipment(
    config: SmartenviosConfig,
    shipmentId: string
  ): Promise<SmartenviosShipment> {
    return await this.makeRequest<SmartenviosShipment>(
      config,
      `/shipments/${shipmentId}`
    );
  }

  static async cancelShipment(
    config: SmartenviosConfig,
    shipmentId: string
  ): Promise<void> {
    await this.makeRequest(
      config,
      `/shipments/${shipmentId}/cancel`,
      { method: 'POST' }
    );
  }

  /**
   * ========================================
   * COTAÇÕES
   * ========================================
   */

  static async getQuotes(
    config: SmartenviosConfig,
    quoteRequest: SmartenviosQuoteRequest
  ): Promise<SmartenviosQuote[]> {
    return await this.makeRequest<SmartenviosQuote[]>(
      config,
      '/quotes',
      {
        method: 'POST',
        body: JSON.stringify(quoteRequest)
      }
    );
  }

  /**
   * ========================================
   * WEBHOOKS
   * ========================================
   */

  static async registerWebhook(
    config: SmartenviosConfig,
    events: SmartenviosWebhookEvent[]
  ): Promise<SmartenviosWebhook> {
    return await this.makeRequest<SmartenviosWebhook>(
      config,
      '/webhooks',
      {
        method: 'POST',
        body: JSON.stringify({
          url: config.webhook_url,
          events,
          is_active: true
        })
      }
    );
  }

  static async listWebhooks(config: SmartenviosConfig): Promise<SmartenviosWebhook[]> {
    return await this.makeRequest<SmartenviosWebhook[]>(config, '/webhooks');
  }

  static async deleteWebhook(config: SmartenviosConfig, webhookId: string): Promise<void> {
    await this.makeRequest(config, `/webhooks/${webhookId}`, { method: 'DELETE' });
  }

  static async processWebhook(
    payload: SmartenviosWebhookPayload,
    userId: string
  ): Promise<void> {
    try {
      console.log('Processando webhook Smartenvios:', payload);

      // Atualiza o pedido no banco de dados
      const { error } = await supabase
        .from('orders')
        .update({
          status: this.mapStatus(payload.status),
          last_update: payload.timestamp,
        })
        .eq('user_id', userId)
        .eq('tracking_code', payload.tracking_code);

      if (error) {
        console.error('Erro ao atualizar pedido:', error);
      }
    } catch (error) {
      console.error('Erro ao processar webhook:', error);
      throw error;
    }
  }

  /**
   * ========================================
   * VALIDAÇÃO E DETECÇÃO
   * ========================================
   */

  static detectTrackingCode(code: string): boolean {
    const patterns = [
      /^SE[A-Z0-9]{10,15}$/i,
      /^SM[0-9]{12,16}$/i,
      /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/i,
    ];

    return patterns.some(pattern => pattern.test(code));
  }

  static validateTrackingCode(code: string): SmartenviosValidationResult {
    const patterns = [
      { pattern: /^SE[A-Z0-9]{10,15}$/i, name: 'Smartenvios Standard' },
      { pattern: /^SM[0-9]{12,16}$/i, name: 'Smartenvios Express' },
    ];

    for (const { pattern, name } of patterns) {
      if (pattern.test(code)) {
        return {
          is_valid: true,
          carrier: 'smartenvios',
          pattern_matched: name
        };
      }
    }

    return {
      is_valid: false,
      errors: ['Código de rastreamento inválido']
    };
  }

  /**
   * ========================================
   * MAPEAMENTO
   * ========================================
   */

  static mapStatus(smartenviosStatus: string): string {
    const statusMap: Record<string, string> = {
      pending: 'pending',
      in_transit: 'in_transit',
      out_for_delivery: 'out_for_delivery',
      delivered: 'delivered',
      failed: 'failed',
      returned: 'returned',
      cancelled: 'failed',
      exception: 'delayed',
    };

    return statusMap[smartenviosStatus] || 'pending';
  }

  /**
   * ========================================
   * UTILITÁRIOS HTTP
   * ========================================
   */

  private static async makeRequest<T>(
    config: SmartenviosConfig,
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${SMARTENVIOS_API_BASE}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${config.api_key}`,
          'Content-Type': 'application/json',
          ...options?.headers
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new SmartenviosApiErrorClass(
          errorData.message || `HTTP ${response.status}`,
          errorData.code,
          response.status,
          errorData
        );
      }

      if (options?.method === 'DELETE') {
        return {} as T;
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      if (error instanceof SmartenviosApiErrorClass) throw error;
      
      throw new SmartenviosApiErrorClass(
        `Erro na requisição: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      );
    }
  }

  static validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    // Implementar validação HMAC em produção
    return true;
  }
}
