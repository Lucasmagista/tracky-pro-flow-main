import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'

export interface SystemSetting {
  id: string
  user_id: string
  category: string
  key: string
  value: unknown
  description?: string
  is_public: boolean
  created_at: string
  updated_at: string
}

export class SettingsService {
  // Get a specific setting
    async getSetting<T = unknown>(key: string, category: string = 'general', userId?: string): Promise<T | null> {
    const query = supabase
      .from('settings')
      .select('value')
      .eq('category', category)
      .eq('key', key)

    if (userId) {
      query.eq('user_id', userId)
    }

    const { data, error } = await query.single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error
    }

    return data?.value || null
  }

  // Set a setting
  static async setSetting<T = unknown>(
    category: string,
    key: string,
    value: T,
    description?: string,
    isPublic: boolean = false,
    userId?: string
  ): Promise<void> {
    const settingData = {
      category,
      key,
      value: value as Json,
      description,
      is_public: isPublic,
      ...(userId && { user_id: userId })
    }

    const { error } = await supabase
      .from('settings')
      .upsert(settingData, {
        onConflict: userId ? 'user_id,category,key' : 'category,key'
      })

    if (error) throw error
  }

  // Get all settings for a category
  static async getCategorySettings(category: string, userId?: string): Promise<Record<string, unknown>> {
    const query = supabase
      .from('settings')
      .select('key, value')
      .eq('category', category)

    if (userId) {
      query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error) throw error

    return data.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, unknown>)
  }

  // Get all user settings
  static async getUserSettings(userId: string): Promise<Record<string, Record<string, unknown>>> {
    const { data, error } = await supabase
      .from('settings')
      .select('category, key, value')
      .eq('user_id', userId)

    if (error) throw error

    return data.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = {}
      }
      acc[setting.category][setting.key] = setting.value
      return acc
    }, {} as Record<string, Record<string, unknown>>)
  }

  // Delete a setting
  static async deleteSetting(category: string, key: string, userId?: string): Promise<void> {
    const query = supabase
      .from('settings')
      .delete()
      .eq('category', category)
      .eq('key', key)

    if (userId) {
      query.eq('user_id', userId)
    }

    const { error } = await query

    if (error) throw error
  }

  // Get public settings
  static async getPublicSettings(): Promise<Record<string, Record<string, unknown>>> {
    const { data, error } = await supabase
      .from('settings')
      .select('category, key, value')
      .eq('is_public', true)

    if (error) throw error

    return data.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = {}
      }
      acc[setting.category][setting.key] = setting.value
      return acc
    }, {} as Record<string, Record<string, unknown>>)
  }

  // Initialize default settings for a user
  static async initializeUserSettings(userId: string): Promise<void> {
    const defaultSettings = [
      // Notification settings
      { category: 'notifications', key: 'email_enabled', value: true, description: 'Habilitar notificações por email' },
      { category: 'notifications', key: 'whatsapp_enabled', value: true, description: 'Habilitar notificações por WhatsApp' },
      { category: 'notifications', key: 'delay_alerts', value: true, description: 'Alertas de atraso' },
      { category: 'notifications', key: 'delivery_reminders', value: true, description: 'Lembretes de entrega' },

      // Tracking settings
      { category: 'tracking', key: 'auto_update', value: true, description: 'Atualização automática de status' },
      { category: 'tracking', key: 'cache_enabled', value: true, description: 'Habilitar cache inteligente' },
      { category: 'tracking', key: 'webhook_retries', value: 3, description: 'Número de tentativas de webhook' },

      // UI settings
      { category: 'ui', key: 'theme', value: 'light', description: 'Tema da interface' },
      { category: 'ui', key: 'language', value: 'pt-BR', description: 'Idioma da interface' },
      { category: 'ui', key: 'items_per_page', value: 20, description: 'Itens por página' },

      // Privacy settings
      { category: 'privacy', key: 'data_retention_days', value: 365, description: 'Dias para retenção de dados' },
      { category: 'privacy', key: 'analytics_enabled', value: false, description: 'Habilitar analytics' }
    ]

    for (const setting of defaultSettings) {
      await this.setSetting(
        setting.category,
        setting.key,
        setting.value,
        setting.description,
        false,
        userId
      )
    }
  }

  // Initialize system-wide default settings
  static async initializeSystemSettings(): Promise<void> {
    const systemSettings = [
      // System configuration
      { category: 'system', key: 'maintenance_mode', value: false, description: 'Modo de manutenção do sistema', isPublic: false },
      { category: 'system', key: 'max_concurrent_requests', value: 100, description: 'Máximo de requisições simultâneas', isPublic: false },
      { category: 'system', key: 'rate_limit_per_minute', value: 60, description: 'Limite de requisições por minuto', isPublic: false },

      // API settings
      { category: 'api', key: 'correios_timeout', value: 30000, description: 'Timeout para API dos Correios (ms)', isPublic: false },
      { category: 'api', key: 'webhook_timeout', value: 10000, description: 'Timeout para webhooks (ms)', isPublic: false },
      { category: 'api', key: 'max_retry_attempts', value: 3, description: 'Máximo de tentativas de retry', isPublic: false },

      // Marketplace integrations
      { category: 'marketplace', key: 'shopify_enabled', value: false, description: 'Integração com Shopify habilitada', isPublic: false },
      { category: 'marketplace', key: 'woocommerce_enabled', value: false, description: 'Integração com WooCommerce habilitada', isPublic: false },
      { category: 'marketplace', key: 'mercadolivre_enabled', value: false, description: 'Integração com MercadoLivre habilitada', isPublic: false },

      // Subscription settings
      { category: 'subscription', key: 'trial_days', value: 14, description: 'Dias de período de teste', isPublic: true },
      { category: 'subscription', key: 'grace_period_days', value: 7, description: 'Dias de período de carência', isPublic: true },
      { category: 'subscription', key: 'auto_renewal_enabled', value: true, description: 'Renovação automática habilitada', isPublic: true },

      // Export settings
      { category: 'export', key: 'max_export_rows', value: 10000, description: 'Máximo de linhas por exportação', isPublic: false },
      { category: 'export', key: 'export_timeout', value: 300000, description: 'Timeout para exportações (ms)', isPublic: false },
      { category: 'export', key: 'compression_enabled', value: true, description: 'Compressão de arquivos habilitada', isPublic: false }
    ]

    for (const setting of systemSettings) {
      await this.setSetting(
        setting.category,
        setting.key,
        setting.value,
        setting.description,
        setting.isPublic
      )
    }
  }

  // Get system setting with fallback to default
  static async getSystemSetting<T = unknown>(key: string, category: string = 'system', defaultValue?: T): Promise<T | null> {
    try {
      const value = await this.getSetting<T>(key, category)
      return value !== null ? value : defaultValue || null
    } catch (error) {
      console.warn(`Failed to get system setting ${category}.${key}:`, error)
      return defaultValue || null
    }
  }

  // Update multiple settings at once
  static async bulkUpdateSettings(updates: Array<{
    category: string
    key: string
    value: unknown
    description?: string
    isPublic?: boolean
    userId?: string
  }>): Promise<void> {
    const promises = updates.map(update =>
      this.setSetting(
        update.category,
        update.key,
        update.value,
        update.description,
        update.isPublic,
        update.userId
      )
    )

    await Promise.all(promises)
  }

  // Get settings by category with caching
  private static settingsCache = new Map<string, { data: Record<string, unknown>, timestamp: number }>()
  private static readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  static async getCategorySettingsCached(category: string, userId?: string): Promise<Record<string, unknown>> {
    const cacheKey = `${category}:${userId || 'system'}`
    const cached = this.settingsCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data
    }

    const data = await this.getCategorySettings(category, userId)
    this.settingsCache.set(cacheKey, { data, timestamp: Date.now() })

    return data
  }

  // Clear settings cache
  static clearCache(): void {
    this.settingsCache.clear()
  }
}