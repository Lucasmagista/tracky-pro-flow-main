import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface TrackingWebhook {
  id: string
  carrier: string
  tracking_code: string
  webhook_url: string
  secret_key?: string
  is_active: boolean
  created_at: string
  last_triggered?: string
}

export interface WebhookStats {
  total: number
  active: number
  triggeredToday: number
  byCarrier: Record<string, number>
}

export const useTrackingWebhooks = () => {
  const [webhooks, setWebhooks] = useState<TrackingWebhook[]>([])
  const [stats, setStats] = useState<WebhookStats>({
    total: 0,
    active: 0,
    triggeredToday: 0,
    byCarrier: {}
  })
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Fetch webhooks
  const fetchWebhooks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tracking_webhooks')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setWebhooks(data as TrackingWebhook[])
      calculateStats(data as TrackingWebhook[])
    } catch (error) {
      console.error('Error fetching webhooks:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os webhooks.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Calculate statistics
  const calculateStats = (webhookData: TrackingWebhook[]) => {
    const today = new Date().toDateString()
    const stats: WebhookStats = {
      total: webhookData.length,
      active: webhookData.filter(w => w.is_active).length,
      triggeredToday: webhookData.filter(w =>
        w.last_triggered && new Date(w.last_triggered).toDateString() === today
      ).length,
      byCarrier: {}
    }

    webhookData.forEach(webhook => {
      stats.byCarrier[webhook.carrier] = (stats.byCarrier[webhook.carrier] || 0) + 1
    })

    setStats(stats)
  }

  // Create webhook
  const createWebhook = async (
    carrier: string,
    trackingCode: string,
    webhookUrl: string,
    secretKey?: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('tracking_webhooks')
        .insert({
          carrier,
          tracking_code: trackingCode,
          webhook_url: webhookUrl,
          secret_key: secretKey,
          is_active: true
        })

      if (error) throw error

      await fetchWebhooks()
      toast({
        title: 'Webhook criado',
        description: `Webhook para ${carrier} - ${trackingCode} foi criado com sucesso.`,
      })
      return true
    } catch (error) {
      console.error('Error creating webhook:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o webhook.',
        variant: 'destructive'
      })
      return false
    }
  }

  // Update webhook
  const updateWebhook = async (
    id: string,
    updates: Partial<Pick<TrackingWebhook, 'webhook_url' | 'secret_key' | 'is_active'>>
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('tracking_webhooks')
        .update(updates)
        .eq('id', id)

      if (error) throw error

      await fetchWebhooks()
      toast({
        title: 'Webhook atualizado',
        description: 'Webhook foi atualizado com sucesso.',
      })
      return true
    } catch (error) {
      console.error('Error updating webhook:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o webhook.',
        variant: 'destructive'
      })
      return false
    }
  }

  // Delete webhook
  const deleteWebhook = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('tracking_webhooks')
        .delete()
        .eq('id', id)

      if (error) throw error

      await fetchWebhooks()
      toast({
        title: 'Webhook removido',
        description: 'Webhook foi removido com sucesso.',
      })
      return true
    } catch (error) {
      console.error('Error deleting webhook:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o webhook.',
        variant: 'destructive'
      })
      return false
    }
  }

  // Test webhook
  const testWebhook = async (webhook: TrackingWebhook): Promise<boolean> => {
    try {
      const testPayload = {
        carrier: webhook.carrier,
        trackingCode: webhook.tracking_code,
        status: 'in_transit',
        events: [{
          timestamp: new Date().toISOString(),
          location: 'Test Location',
          description: 'Test webhook event',
          status: 'in_transit'
        }],
        signature: 'test_signature'
      }

      const response = await fetch(webhook.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Test': 'true'
        },
        body: JSON.stringify(testPayload)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      toast({
        title: 'Teste realizado',
        description: 'Webhook testado com sucesso.',
      })
      return true
    } catch (error) {
      console.error('Error testing webhook:', error)
      toast({
        title: 'Erro no teste',
        description: 'Não foi possível testar o webhook.',
        variant: 'destructive'
      })
      return false
    }
  }

  // Get webhooks by carrier
  const getWebhooksByCarrier = (carrier: string) => {
    return webhooks.filter(webhook => webhook.carrier === carrier)
  }

  // Get active webhooks
  const getActiveWebhooks = () => {
    return webhooks.filter(webhook => webhook.is_active)
  }

  // Real-time subscription
  useEffect(() => {
    fetchWebhooks()

    const channel = supabase
      .channel('tracking_webhooks')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tracking_webhooks'
        },
        () => {
          fetchWebhooks()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchWebhooks])

  return {
    webhooks,
    stats,
    loading,
    fetchWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    testWebhook,
    getWebhooksByCarrier,
    getActiveWebhooks
  }
}