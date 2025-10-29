import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface ProactiveAlert {
  id: string
  user_id: string
  order_id: string
  alert_type: 'delay_warning' | 'delivery_reminder' | 'status_change' | 'exception_alert'
  title: string
  message: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  is_read: boolean
  triggered_at: string
  action_taken?: boolean
  action_details?: Record<string, unknown>
}

export interface AlertStats {
  total: number
  unread: number
  urgent: number
  byType: Record<string, number>
}

export const useProactiveAlerts = () => {
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([])
  const [stats, setStats] = useState<AlertStats>({
    total: 0,
    unread: 0,
    urgent: 0,
    byType: {}
  })
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('proactive_alerts')
        .select('*')
        .order('triggered_at', { ascending: false })
        .limit(50)

      if (error) throw error

      setAlerts(data as ProactiveAlert[])
      calculateStats(data as ProactiveAlert[])
    } catch (error) {
      console.error('Error fetching alerts:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os alertas.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Calculate statistics
  const calculateStats = (alertData: ProactiveAlert[]) => {
    const stats: AlertStats = {
      total: alertData.length,
      unread: alertData.filter(a => !a.is_read).length,
      urgent: alertData.filter(a => a.priority === 'urgent').length,
      byType: {}
    }

    alertData.forEach(alert => {
      stats.byType[alert.alert_type] = (stats.byType[alert.alert_type] || 0) + 1
    })

    setStats(stats)
  }

  // Mark alert as read
  const markAsRead = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('proactive_alerts')
        .update({ is_read: true })
        .eq('id', alertId)

      if (error) throw error

      setAlerts(prev => prev.map(alert =>
        alert.id === alertId ? { ...alert, is_read: true } : alert
      ))

      // Update stats
      setStats(prev => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1)
      }))
    } catch (error) {
      console.error('Error marking alert as read:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível marcar o alerta como lido.',
        variant: 'destructive'
      })
    }
  }

  // Mark all alerts as read
  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('proactive_alerts')
        .update({ is_read: true })
        .eq('is_read', false)

      if (error) throw error

      setAlerts(prev => prev.map(alert => ({ ...alert, is_read: true })))
      setStats(prev => ({ ...prev, unread: 0 }))
    } catch (error) {
      console.error('Error marking all alerts as read:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível marcar todos os alertas como lidos.',
        variant: 'destructive'
      })
    }
  }

  // Take action on alert
  const takeAction = async (alertId: string, action: string, details?: Record<string, unknown>) => {
    try {
      const { error } = await supabase
        .from('proactive_alerts')
        .update({
          action_taken: true,
          action_details: details
        })
        .eq('id', alertId)

      if (error) throw error

      setAlerts(prev => prev.map(alert =>
        alert.id === alertId
          ? { ...alert, action_taken: true, action_details: details }
          : alert
      ))

      toast({
        title: 'Ação registrada',
        description: `Ação "${action}" foi registrada com sucesso.`,
      })
    } catch (error) {
      console.error('Error taking action on alert:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível registrar a ação.',
        variant: 'destructive'
      })
    }
  }

  // Delete alert
  const deleteAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('proactive_alerts')
        .delete()
        .eq('id', alertId)

      if (error) throw error

      setAlerts(prev => prev.filter(alert => alert.id !== alertId))
      setStats(prev => ({ ...prev, total: prev.total - 1 }))
    } catch (error) {
      console.error('Error deleting alert:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o alerta.',
        variant: 'destructive'
      })
    }
  }

  // Get alerts by type
  const getAlertsByType = (type: string) => {
    return alerts.filter(alert => alert.alert_type === type)
  }

  // Get unread alerts
  const getUnreadAlerts = () => {
    return alerts.filter(alert => !alert.is_read)
  }

  // Get urgent alerts
  const getUrgentAlerts = () => {
    return alerts.filter(alert => alert.priority === 'urgent')
  }

  // Real-time subscription
  useEffect(() => {
    fetchAlerts()

    const channel = supabase
      .channel('proactive_alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'proactive_alerts'
        },
        (payload) => {
          const newAlert = payload.new as ProactiveAlert
          setAlerts(prev => [newAlert, ...prev])
          setStats(prev => ({
            ...prev,
            total: prev.total + 1,
            unread: prev.unread + 1,
            urgent: newAlert.priority === 'urgent' ? prev.urgent + 1 : prev.urgent,
            byType: {
              ...prev.byType,
              [newAlert.alert_type]: (prev.byType[newAlert.alert_type] || 0) + 1
            }
          }))

          // Show toast notification for urgent alerts
          if (newAlert.priority === 'urgent') {
            toast({
              title: newAlert.title,
              description: newAlert.message,
              variant: 'destructive'
            })
          } else {
            toast({
              title: newAlert.title,
              description: newAlert.message,
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAlerts, toast])

  return {
    alerts,
    stats,
    loading,
    fetchAlerts,
    markAsRead,
    markAllAsRead,
    takeAction,
    deleteAlert,
    getAlertsByType,
    getUnreadAlerts,
    getUrgentAlerts
  }
}