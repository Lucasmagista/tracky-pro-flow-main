/**
 * Hook para integração com Smartenvios
 * Gerencia conexão, rastreamento de pedidos e webhooks
 */

import { useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { SmartenviosService } from '@/services/smartenvios'
import type {
  SmartenviosConfig,
  SmartenviosTracking,
  SmartenviosShipment,
  SmartenviosShipmentRequest,
  SmartenviosValidationResult,
} from '@/types/smartenvios'

export interface UseSmartenviosIntegrationReturn {
  isConnected: boolean
  isLoading: boolean
  connect: (apiKey: string, environment?: 'sandbox' | 'production') => Promise<void>
  disconnect: () => Promise<void>
  trackOrder: (trackingCode: string) => Promise<SmartenviosTracking | null>
  bulkTrack: (trackingCodes: string[]) => Promise<SmartenviosTracking[]>
  createShipment: (shipmentData: SmartenviosShipmentRequest) => Promise<SmartenviosShipment | null>
  validateTrackingCode: (code: string) => SmartenviosValidationResult
}

export const useSmartenviosIntegration = (): UseSmartenviosIntegrationReturn => {
  const { user } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  /**
   * Buscar configuração existente do Smartenvios
   */
  const fetchConfig = useCallback(async (): Promise<SmartenviosConfig | null> => {
    if (!user) return null

    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('config')
        .eq('platform', 'smartenvios' as any)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (error || !data) return null

      return data.config as unknown as SmartenviosConfig
    } catch (error) {
      console.error('Erro ao buscar configuração Smartenvios:', error)
      return null
    }
  }, [user])

  /**
   * Conectar ao Smartenvios
   * Valida API Key e registra webhooks
   */
  const connect = useCallback(async (
    apiKey: string,
    environment: 'sandbox' | 'production' = 'production'
  ): Promise<void> => {
    if (!user) {
      toast.error('Usuário não autenticado')
      return
    }

    setIsLoading(true)

    try {
      // 1. Validar API Key
      if (!apiKey || apiKey.length < 10) {
        throw new Error('API Key inválida')
      }

      // 2. Testar autenticação
      const isAuthenticated = await SmartenviosService.authenticate(apiKey)

      if (!isAuthenticated) {
        throw new Error('Falha na autenticação. Verifique sua API Key')
      }

      // 3. Criar configuração
      const webhookUrl = `${window.location.origin}/api/webhooks/smartenvios`
      const config: SmartenviosConfig = {
        api_key: apiKey,
        environment: environment,
        webhook_url: webhookUrl,
      }

      // 4. Salvar no banco de dados
      const { error: upsertError } = await supabase
        .from('integrations')
        .upsert({
          user_id: user.id,
          platform: 'smartenvios' as any,
          config: config as any,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)

      if (upsertError) throw upsertError

      // 5. Registrar webhooks (se necessário)
      try {
        await SmartenviosService.registerWebhook(config, [
          'tracking.update',
          'tracking.delivered',
          'tracking.exception',
        ])
      } catch (webhookError) {
        console.warn('Erro ao registrar webhook:', webhookError)
        // Não falhar a conexão por causa do webhook
      }

      setIsConnected(true)
      toast.success('Smartenvios conectado com sucesso')

    } catch (error) {
      console.error('Erro ao conectar Smartenvios:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao conectar com Smartenvios'
      )
    } finally {
      setIsLoading(false)
    }
  }, [user])

  /**
   * Desconectar do Smartenvios
   * Remove webhooks e desativa integração
   */
  const disconnect = useCallback(async (): Promise<void> => {
    if (!user) {
      toast.error('Usuário não autenticado')
      return
    }

    setIsLoading(true)

    try {
      // 1. Desativar integração no banco
      const { error } = await supabase
        .from('integrations')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('platform', 'smartenvios' as any)
        .eq('user_id', user.id)

      if (error) throw error

      setIsConnected(false)
      toast.success('Smartenvios desconectado com sucesso')

    } catch (error) {
      console.error('Erro ao desconectar Smartenvios:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao desconectar Smartenvios'
      )
    } finally {
      setIsLoading(false)
    }
  }, [user])

  /**
   * Rastrear um pedido específico
   */
  const trackOrder = useCallback(async (
    trackingCode: string
  ): Promise<SmartenviosTracking | null> => {
    try {
      const config = await fetchConfig()

      if (!config || !config.api_key) {
        throw new Error('Smartenvios não está conectado')
      }

      // Validar formato do código de rastreamento
      if (!SmartenviosService.detectTrackingCode(trackingCode)) {
        throw new Error('Código de rastreamento inválido para Smartenvios')
      }

      const tracking = await SmartenviosService.trackOrder(config, trackingCode)

      // Salvar no cache
      if (user) {
        await supabase
          .from('tracking_cache')
          .upsert({
            tracking_code: trackingCode,
            carrier: 'smartenvios',
            status: tracking.status,
            events: tracking.events as any,
            estimated_delivery: tracking.estimated_delivery,
            last_update: new Date().toISOString(),
          } as any)
      }

      return tracking

    } catch (error) {
      console.error('Erro ao rastrear pedido:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao rastrear pedido'
      )
      return null
    }
  }, [fetchConfig, user])

  /**
   * Rastrear múltiplos pedidos
   */
  const bulkTrack = useCallback(async (
    trackingCodes: string[]
  ): Promise<SmartenviosTracking[]> => {
    try {
      const config = await fetchConfig()

      if (!config || !config.api_key) {
        throw new Error('Smartenvios não está conectado')
      }

      const response = await SmartenviosService.trackMultipleOrders(config, trackingCodes)

      // Salvar resultados no cache
      if (user) {
        for (const tracking of response.results) {
          await supabase
            .from('tracking_cache')
            .upsert({
              tracking_code: tracking.tracking_code,
              carrier: 'smartenvios',
              status: tracking.status,
              events: tracking.events as any,
              estimated_delivery: tracking.estimated_delivery,
              last_update: new Date().toISOString(),
            } as any)
        }
      }

      // Mostrar erros se houver
      if (response.errors.length > 0) {
        toast.warning(`${response.errors.length} rastreamentos falharam`)
      }

      return response.results

    } catch (error) {
      console.error('Erro ao rastrear pedidos:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao rastrear pedidos'
      )
      return []
    }
  }, [fetchConfig, user])

  /**
   * Criar um novo envio
   */
  const createShipment = useCallback(async (
    shipmentData: SmartenviosShipmentRequest
  ): Promise<SmartenviosShipment | null> => {
    try {
      const config = await fetchConfig()

      if (!config || !config.api_key) {
        throw new Error('Smartenvios não está conectado')
      }

      const shipment = await SmartenviosService.createShipment(config, shipmentData)

      toast.success(`Envio criado: ${shipment.tracking_code}`)

      return shipment

    } catch (error) {
      console.error('Erro ao criar envio:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao criar envio'
      )
      return null
    }
  }, [fetchConfig])

  /**
   * Validar formato de código de rastreamento
   */
  const validateTrackingCode = useCallback((code: string): SmartenviosValidationResult => {
    return SmartenviosService.validateTrackingCode(code)
  }, [])

  return {
    isConnected,
    isLoading,
    connect,
    disconnect,
    trackOrder,
    bulkTrack,
    createShipment,
    validateTrackingCode,
  }
}
