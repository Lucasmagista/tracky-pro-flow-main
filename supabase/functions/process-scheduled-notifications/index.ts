import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get all pending scheduled notifications that are due
    const now = new Date()
    const { data: dueNotifications, error: fetchError } = await supabaseClient
      .from('scheduled_notifications')
      .select(`
        *,
        notification_templates (
          name,
          type,
          subject,
          content
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', now.toISOString())

    if (fetchError) {
      console.error('Error fetching due notifications:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch notifications' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const results = []

    for (const notification of dueNotifications || []) {
      try {
        let success = false
        let errorMessage = null

        if (notification.type === 'email' && notification.notification_templates) {
          // Send email
          const emailResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/email-service`, {
            method: 'POST',
            headers: {
              'Authorization': req.headers.get('Authorization')!,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: notification.recipient,
              subject: notification.notification_templates.subject || '',
              html: replaceVariables(notification.notification_templates.content, notification.variables),
              from: undefined
            }),
          })

          if (emailResponse.ok) {
            success = true
          } else {
            errorMessage = `Email failed: ${emailResponse.statusText}`
          }
        } else if (notification.type === 'whatsapp' && notification.notification_templates) {
          // Send WhatsApp message
          const whatsappResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-service`, {
            method: 'POST',
            headers: {
              'Authorization': req.headers.get('Authorization')!,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'sendMessage',
              phoneNumber: notification.recipient,
              message: replaceVariables(notification.notification_templates.content, notification.variables)
            }),
          })

          if (whatsappResponse.ok) {
            success = true
          } else {
            errorMessage = `WhatsApp failed: ${whatsappResponse.statusText}`
          }
        }

        // Update notification status
        const { error: updateError } = await supabaseClient
          .from('scheduled_notifications')
          .update({
            status: success ? 'sent' : 'failed',
            sent_at: success ? new Date().toISOString() : null,
            error_message: errorMessage
          })
          .eq('id', notification.id)

        if (updateError) {
          console.error('Error updating notification:', updateError)
        }

        results.push({
          id: notification.id,
          success,
          error: errorMessage
        })

      } catch (error) {
        console.error('Error processing notification:', error)

        // Mark as failed
        await supabaseClient
          .from('scheduled_notifications')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', notification.id)

        results.push({
          id: notification.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Scheduled notifications error:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function replaceVariables(content: string, variables: any): string {
  if (!variables || typeof variables !== 'object') return content

  let result = content
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    result = result.replace(regex, String(value))
  })

  return result
}