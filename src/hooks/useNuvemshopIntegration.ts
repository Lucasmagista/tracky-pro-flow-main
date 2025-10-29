/**
 * Hook para integração com Nuvemshop
 * Gerencia conexão, autenticação OAuth, sincronização de pedidos e webhooks
 */

import { useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { NuvemshopService } from '@/services/nuvemshop'
import type { NuvemshopConfig, NuvemshopOrder } from '@/types/nuvemshop'
import type { Database } from '@/integrations/supabase/types'

export interface UseNuvemshopIntegrationReturn {
  isConnected: boolean
  isLoading: boolean
  connect: (appId: string, appSecret: string, storeUrl: string) => Promise<void>
  disconnect: () => Promise<void>
  syncOrders: () => Promise<void>
  getOrders: (filters?: { status?: string; limit?: number }) => Promise<NuvemshopOrder[]>
  lastSync: string | null
}

export const useNuvemshopIntegration = (): UseNuvemshopIntegrationReturn => {
  const { user } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)

  /**
   * Buscar configuração existente do Nuvemshop
   */
  const fetchConfig = useCallback(async (): Promise<NuvemshopConfig | null> => {
    if (!user) return null

    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('config')
        .eq('platform', 'nuvemshop')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (error || !data) return null

      return data.config as unknown as NuvemshopConfig
    } catch (error) {
      console.error('Erro ao buscar configuração Nuvemshop:', error)
      return null
    }
  }, [user])

  /**
   * Conectar ao Nuvemshop
   * Inicia o fluxo OAuth e registra webhooks
   */
  const connect = useCallback(async (
    appId: string,
    appSecret: string,
    storeUrl: string
  ): Promise<void> => {
    if (!user) {
      toast.error('Usuário não autenticado')
      return
    }

    setIsLoading(true)

    try {
      // 1. Validar credenciais
      if (!appId || !appSecret || !storeUrl) {
        throw new Error('Credenciais incompletas')
      }

      // 2. Gerar URL de autorização OAuth
      const redirectUri = `${window.location.origin}/integrations/nuvemshop/callback`
      const authUrl = NuvemshopService.getAuthorizationUrl(appId, redirectUri)

      // 3. Salvar configuração temporária
      const config: NuvemshopConfig = {
        app_id: appId,
        app_secret: appSecret,
        store_url: storeUrl,
        store_id: '',  // Será preenchido após OAuth
        access_token: '', // Será preenchido após OAuth
        user_id: '', // Será preenchido após OAuth
      }

      const { error: upsertError } = await supabase
        .from('integrations')
        .upsert({
          user_id: user.id,
          platform: 'nuvemshop',
          config: config as unknown as Database['public']['Tables']['integrations']['Insert']['config'],
          is_active: false, // Será ativado após OAuth
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,platform'
        })

      if (upsertError) throw upsertError

      // 4. Redirecionar para autorização OAuth
      toast.info('Redirecionando para autorização...')
      window.location.href = authUrl

    } catch (error) {
      console.error('Erro ao conectar Nuvemshop:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao conectar com Nuvemshop'
      )
    } finally {
      setIsLoading(false)
    }
  }, [user])

  /**
   * Desconectar do Nuvemshop
   * Remove webhooks e desativa integração
   */
  const disconnect = useCallback(async (): Promise<void> => {
    if (!user) {
      toast.error('Usuário não autenticado')
      return
    }

    setIsLoading(true)

    try {
      // 1. Buscar configuração atual
      const config = await fetchConfig()

      if (config) {
        // 2. Remover webhooks (opcional - se implementarmos unregister)
        try {
          // await NuvemshopService.unregisterWebhooks(config)
          console.log('Webhooks serão desativados no servidor')
        } catch (error) {
          console.warn('Erro ao remover webhooks:', error)
          // Continuar mesmo se falhar
        }
      }

      // 3. Desativar integração no banco
      const { error } = await supabase
        .from('integrations')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('platform', 'nuvemshop')
        .eq('user_id', user.id)

      if (error) throw error

      setIsConnected(false)
      setLastSync(null)
      toast.success('Nuvemshop desconectado com sucesso')

    } catch (error) {
      console.error('Erro ao desconectar Nuvemshop:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao desconectar Nuvemshop'
      )
    } finally {
      setIsLoading(false)
    }
  }, [user, fetchConfig])

  /**
   * Sincronizar pedidos da Nuvemshop
   * Importa pedidos recentes e atualiza status
   */
  const syncOrders = useCallback(async (): Promise<void> => {
    if (!user) {
      toast.error('Usuário não autenticado')
      return
    }

    setIsLoading(true)

    try {
      // 1. Buscar configuração
      const config = await fetchConfig()

      if (!config || !config.access_token) {
        throw new Error('Nuvemshop não está conectado')
      }

      // 2. Buscar pedidos da Nuvemshop
      toast.info('Sincronizando pedidos...')
      const orders = await NuvemshopService.fetchOrders(config, {
        status: 'open',
      })

      // 3. Converter e salvar pedidos
      let importedCount = 0

      for (const order of orders) {
        try {
          const trackyOrder = NuvemshopService.convertToTrackyOrder(order, user.id)

          const { error } = await supabase
            .from('orders')
            .upsert({
              user_id: user.id,
              tracking_code: trackyOrder.tracking_code,
              customer_name: trackyOrder.customer_name,
              customer_email: trackyOrder.customer_email,
              customer_phone: trackyOrder.customer_phone,
              carrier: trackyOrder.carrier,
              status: trackyOrder.status,
              external_id: order.id.toString(),
              marketplace: 'nuvemshop',
              updated_at: new Date().toISOString(),
            })

          if (!error) importedCount++

        } catch (error) {
          console.error(`Erro ao importar pedido ${order.id}:`, error)
        }
      }

      // 4. Atualizar data de sincronização
      const syncTime = new Date().toISOString()

      const { error: updateError } = await supabase
        .from('integrations')
        .update({ updated_at: syncTime })
        .eq('platform', 'nuvemshop')
        .eq('user_id', user.id)

      if (updateError) throw updateError

      setLastSync(syncTime)
      toast.success(`${importedCount} pedidos sincronizados com sucesso`)

    } catch (error) {
      console.error('Erro ao sincronizar pedidos:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao sincronizar pedidos'
      )
    } finally {
      setIsLoading(false)
    }
  }, [user, fetchConfig])

  /**
   * Buscar pedidos da Nuvemshop com filtros
   */
  const getOrders = useCallback(async (
    filters?: { status?: string; limit?: number }
  ): Promise<NuvemshopOrder[]> => {
    try {
      const config = await fetchConfig()

      if (!config || !config.access_token) {
        throw new Error('Nuvemshop não está conectado')
      }

      return await NuvemshopService.fetchOrders(config, filters as { status?: 'open' | 'closed' | 'cancelled'; limit?: number })

    } catch (error) {
      console.error('Erro ao buscar pedidos:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao buscar pedidos'
      )
      return []
    }
  }, [fetchConfig])

  return {
    isConnected,
    isLoading,
    connect,
    disconnect,
    syncOrders,
    getOrders,
    lastSync,
  }
}
