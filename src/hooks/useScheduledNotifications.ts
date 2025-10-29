import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { EmailService } from '@/services/email'
import { whatsAppService } from '@/services/whatsapp'
import type { Json } from '@/integrations/supabase/types'

export interface ScheduledNotification {
  id: string
  template_id: string | null
  type: string
  recipient: string
  variables: Json
  scheduled_at: string
  status: string | null
  sent_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface ScheduledNotificationInput {
  template_id?: string
  type: 'email' | 'whatsapp'
  recipient: string
  variables?: Record<string, unknown>
  scheduled_at: string
}

export function useScheduledNotifications() {
  const [scheduledNotifications, setScheduledNotifications] = useState<ScheduledNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchScheduledNotifications()
  }, [])

  const fetchScheduledNotifications = async () => {
    try {
      setLoading(true)
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setScheduledNotifications([])
        setError('User not authenticated')
        return
      }

      const { data, error } = await supabase
        .from('scheduled_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('scheduled_at', { ascending: true })

      if (error) throw error

      setScheduledNotifications(data || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching scheduled notifications:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch scheduled notifications')
    } finally {
      setLoading(false)
    }
  }

  const scheduleNotification = async (notification: ScheduledNotificationInput) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return {
          success: false,
          error: 'User not authenticated'
        }
      }

      const { data, error } = await supabase
        .from('scheduled_notifications')
        .insert([{
          ...notification,
          user_id: user.id,
          variables: (notification.variables || {}) as Json,
          status: 'pending',
          scheduled_at: notification.scheduled_at
        }])
        .select()
        .single()

      if (error) throw error

      setScheduledNotifications(prev => [...prev, data as ScheduledNotification])
      return { success: true, data }
    } catch (err) {
      console.error('Error scheduling notification:', err)
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to schedule notification'
      }
    }
  }

  const cancelScheduledNotification = async (id: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_notifications')
        .update({ status: 'cancelled' })
        .eq('id', id)

      if (error) throw error

      setScheduledNotifications(prev =>
        prev.map(notification =>
          notification.id === id
            ? { ...notification, status: 'cancelled' }
            : notification
        )
      )

      return { success: true }
    } catch (err) {
      console.error('Error cancelling scheduled notification:', err)
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to cancel scheduled notification'
      }
    }
  }

  const processScheduledNotifications = async () => {
    const now = new Date()
    const dueNotifications = scheduledNotifications.filter(
      notification =>
        notification.status === 'pending' &&
        new Date(notification.scheduled_at) <= now
    )

    for (const notification of dueNotifications) {
      try {
        let result

        if (notification.type === 'email') {
          if (notification.template_id) {
            result = await EmailService.sendTemplateEmail(
              notification.recipient,
              notification.template_id,
              (notification.variables as Record<string, string>) || {}
            )
          } else {
            // Send direct email (would need additional implementation)
            continue
          }
        } else if (notification.type === 'whatsapp') {
          if (notification.template_id) {
            // Get template from database
            const { data: template } = await supabase
              .from('notification_templates')
              .select('*')
              .eq('id', notification.template_id)
              .single()

            if (template) {
              // Replace variables in template
              let message = template.content
              const variables = (notification.variables as Record<string, string>) || {}
              Object.entries(variables).forEach(([key, value]) => {
                const regex = new RegExp(`{{${key}}}`, 'g')
                message = message.replace(regex, value)
              })

              result = { success: await whatsAppService.sendMessage(notification.recipient, message) }
            }
          } else {
            // Send direct WhatsApp message (would need additional implementation)
            continue
          }
        }

        if (result?.success) {
          await supabase
            .from('scheduled_notifications')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', notification.id)
        } else {
          await supabase
            .from('scheduled_notifications')
            .update({
              status: 'failed',
              error_message: result?.error || 'Unknown error'
            })
            .eq('id', notification.id)
        }
      } catch (err) {
        console.error('Error processing scheduled notification:', err)
        await supabase
          .from('scheduled_notifications')
          .update({
            status: 'failed',
            error_message: err instanceof Error ? err.message : 'Unknown error'
          })
          .eq('id', notification.id)
      }
    }

    // Refresh the list after processing
    await fetchScheduledNotifications()
  }

  return {
    scheduledNotifications,
    loading,
    error,
    scheduleNotification,
    cancelScheduledNotification,
    processScheduledNotifications,
    refresh: fetchScheduledNotifications
  }
}