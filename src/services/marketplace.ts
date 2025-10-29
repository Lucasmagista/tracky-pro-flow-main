import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'

export interface MarketplaceIntegration {
  id: string
  user_id: string
  marketplace: 'shopify' | 'woocommerce' | 'mercadolivre'
  name: string
  api_key?: string
  api_secret?: string
  access_token?: string
  store_url?: string
  webhook_secret?: string
  is_active: boolean
  last_sync?: string
  sync_status?: 'idle' | 'syncing' | 'error' | 'success'
  error_message?: string
  created_at: string
  updated_at: string
}

export interface MarketplaceCredentials {
  apiKey?: string
  apiSecret?: string
  accessToken?: string
  storeUrl?: string
  additionalSettings?: Record<string, unknown>
}

export class MarketplaceService {
  // Create or update marketplace integration
  static async upsertIntegration(
    userId: string,
    marketplace: MarketplaceIntegration['marketplace'],
    name: string,
    credentials: MarketplaceCredentials,
    isActive: boolean = true
  ): Promise<MarketplaceIntegration> {
    const integrationData = {
      user_id: userId,
      marketplace,
      name,
      api_key: credentials.apiKey,
      api_secret: credentials.apiSecret,
      access_token: credentials.accessToken,
      store_url: credentials.storeUrl,
      is_active: isActive
    }

    const { data, error } = await supabase
      .from('marketplace_integrations')
      .upsert(integrationData, {
        onConflict: 'user_id,marketplace'
      })
      .select()
      .single()

    if (error) throw error
    return data as MarketplaceIntegration
  }

  // Get user's marketplace integrations
  static async getUserIntegrations(userId: string): Promise<MarketplaceIntegration[]> {
    const { data, error } = await supabase
      .from('marketplace_integrations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as MarketplaceIntegration[]
  }

  // Get specific integration
  static async getIntegration(userId: string, marketplace: MarketplaceIntegration['marketplace']): Promise<MarketplaceIntegration | null> {
    const { data, error } = await supabase
      .from('marketplace_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('marketplace', marketplace)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error
    }

    return data as MarketplaceIntegration || null
  }

  // Update integration status
  static async updateIntegrationStatus(
    integrationId: string,
    isActive: boolean,
    syncStatus?: MarketplaceIntegration['sync_status'],
    errorMessage?: string
  ): Promise<void> {
    const updateData: Partial<MarketplaceIntegration> = {
      is_active: isActive,
      updated_at: new Date().toISOString()
    }

    if (syncStatus) {
      updateData.sync_status = syncStatus
      updateData.last_sync = new Date().toISOString()
    }

    if (errorMessage) {
      updateData.error_message = errorMessage
    }

    const { error } = await supabase
      .from('marketplace_integrations')
      .update(updateData)
      .eq('id', integrationId)

    if (error) throw error
  }

  // Delete integration
  static async deleteIntegration(integrationId: string): Promise<void> {
    const { error } = await supabase
      .from('marketplace_integrations')
      .delete()
      .eq('id', integrationId)

    if (error) throw error
  }

  // Test integration connectivity
  static async testIntegration(integration: MarketplaceIntegration): Promise<{ success: boolean, message: string }> {
    try {
      switch (integration.marketplace) {
        case 'shopify':
          return await this.testShopifyIntegration(integration)
        case 'woocommerce':
          return await this.testWooCommerceIntegration(integration)
        case 'mercadolivre':
          return await this.testMercadoLivreIntegration(integration)
        default:
          return { success: false, message: 'Plataforma não suportada' }
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  }

  // Test Shopify integration
  private static async testShopifyIntegration(integration: MarketplaceIntegration): Promise<{ success: boolean, message: string }> {
    if (!integration.store_url || !integration.access_token) {
      return { success: false, message: 'URL da loja e token de acesso são obrigatórios' }
    }

    try {
      const response = await fetch(`https://${integration.store_url}/admin/api/2023-10/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': integration.access_token,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        return { success: true, message: 'Conexão estabelecida com sucesso' }
      } else {
        return { success: false, message: `Erro HTTP ${response.status}: ${response.statusText}` }
      }
    } catch (error) {
      return { success: false, message: `Erro de conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}` }
    }
  }

  // Test WooCommerce integration
  private static async testWooCommerceIntegration(integration: MarketplaceIntegration): Promise<{ success: boolean, message: string }> {
    if (!integration.store_url || !integration.api_key || !integration.api_secret) {
      return { success: false, message: 'URL da loja, chave da API e segredo são obrigatórios' }
    }

    try {
      const response = await fetch(`${integration.store_url}/wp-json/wc/v3/system_status`, {
        headers: {
          'Authorization': 'Basic ' + btoa(`${integration.api_key}:${integration.api_secret}`)
        }
      })

      if (response.ok) {
        return { success: true, message: 'Conexão estabelecida com sucesso' }
      } else {
        return { success: false, message: `Erro HTTP ${response.status}: ${response.statusText}` }
      }
    } catch (error) {
      return { success: false, message: `Erro de conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}` }
    }
  }

  // Test MercadoLivre integration
  private static async testMercadoLivreIntegration(integration: MarketplaceIntegration): Promise<{ success: boolean, message: string }> {
    if (!integration.access_token) {
      return { success: false, message: 'Token de acesso é obrigatório' }
    }

    try {
      const response = await fetch('https://api.mercadolibre.com/users/me', {
        headers: {
          'Authorization': `Bearer ${integration.access_token}`
        }
      })

      if (response.ok) {
        return { success: true, message: 'Conexão estabelecida com sucesso' }
      } else {
        return { success: false, message: `Erro HTTP ${response.status}: ${response.statusText}` }
      }
    } catch (error) {
      return { success: false, message: `Erro de conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}` }
    }
  }

  // Sync orders from marketplace
  static async syncOrders(integrationId: string): Promise<{ success: boolean, syncedCount: number, message: string }> {
    const { data: integration, error } = await supabase
      .from('marketplace_integrations')
      .select('*')
      .eq('id', integrationId)
      .single()

    if (error || !integration) {
      return { success: false, syncedCount: 0, message: 'Integração não encontrada' }
    }

    if (!integration.is_active) {
      return { success: false, syncedCount: 0, message: 'Integração está desativada' }
    }

    try {
      await this.updateIntegrationStatus(integrationId, true, 'syncing')

      let syncedCount = 0

      switch (integration.marketplace) {
        case 'shopify':
          syncedCount = await this.syncShopifyOrders(integration)
          break
        case 'woocommerce':
          syncedCount = await this.syncWooCommerceOrders(integration)
          break
        case 'mercadolivre':
          syncedCount = await this.syncMercadoLivreOrders(integration)
          break
        default:
          throw new Error('Plataforma não suportada')
      }

      await this.updateIntegrationStatus(integrationId, true, 'idle')
      return { success: true, syncedCount, message: `${syncedCount} pedidos sincronizados com sucesso` }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      await this.updateIntegrationStatus(integrationId, true, 'error', errorMessage)
      return { success: false, syncedCount: 0, message: errorMessage }
    }
  }

  // Sync Shopify orders (placeholder implementation)
  private static async syncShopifyOrders(integration: MarketplaceIntegration): Promise<number> {
    // TODO: Implement actual Shopify API integration
    console.log('Syncing Shopify orders for', integration.name)
    return 0
  }

  // Sync WooCommerce orders (placeholder implementation)
  private static async syncWooCommerceOrders(integration: MarketplaceIntegration): Promise<number> {
    // TODO: Implement actual WooCommerce API integration
    console.log('Syncing WooCommerce orders for', integration.name)
    return 0
  }

  // Sync MercadoLivre orders (placeholder implementation)
  private static async syncMercadoLivreOrders(integration: MarketplaceIntegration): Promise<number> {
    // TODO: Implement actual MercadoLivre API integration
    console.log('Syncing MercadoLivre orders for', integration.name)
    return 0
  }
}