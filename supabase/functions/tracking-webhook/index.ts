import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WebhookPayload {
  carrier: string
  trackingCode: string
  status: string
  events: Array<{
    timestamp: string
    location: string
    description: string
    status: string
  }>
  estimatedDelivery?: string
  signature?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    let payload: WebhookPayload

    // Parse payload based on content type
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      payload = await req.json()
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData()
      payload = JSON.parse(formData.get('payload') as string || '{}')
    } else {
      // Try to parse as JSON anyway
      try {
        payload = await req.json()
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid content type or payload format' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    const { carrier, trackingCode, status, events, estimatedDelivery, signature } = payload

    if (!carrier || !trackingCode) {
      return new Response(
        JSON.stringify({ error: 'Carrier and tracking code are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify webhook signature if provided
    if (signature) {
      const isValid = await verifyWebhookSignature(carrier, payload, signature)
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: 'Invalid webhook signature' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    // Find the order associated with this tracking code
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('tracking_code', trackingCode)
      .single()

    if (orderError || !order) {
      console.log(`Order not found for tracking code: ${trackingCode}`)
      return new Response(
        JSON.stringify({ message: 'Order not found, but webhook logged' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if status has changed
    const statusChanged = order.status !== status

    if (statusChanged) {
      // Update order status
      const { error: updateError } = await supabaseClient
        .from('orders')
        .update({
          status: status,
          estimated_delivery: estimatedDelivery,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)

      if (updateError) {
        console.error('Error updating order:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update order' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Log status change in history
      const { error: historyError } = await supabaseClient
        .from('order_history')
        .insert({
          order_id: order.id,
          user_id: order.user_id,
          old_status: order.status,
          new_status: status,
          notes: `Webhook update from ${carrier}: ${events?.[0]?.description || 'Status updated'}`
        })

      if (historyError) {
        console.error('Error logging history:', historyError)
      }

      // Generate proactive alerts based on status change
      await generateProactiveAlerts(supabaseClient, order, status, events)

      // Update tracking cache
      await updateTrackingCache(supabaseClient, trackingCode, carrier, status, events, estimatedDelivery)

      // Send notifications if configured
      await sendStatusChangeNotifications(supabaseClient, order, status, events)
    }

    // Update webhook last triggered timestamp
    await supabaseClient
      .from('tracking_webhooks')
      .update({ last_triggered: new Date().toISOString() })
      .eq('carrier', carrier)
      .eq('tracking_code', trackingCode)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook processed successfully',
        statusChanged
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Webhook processing error:', error)

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

async function verifyWebhookSignature(carrier: string, payload: WebhookPayload, signature: string): Promise<boolean> {
  try {
    // Get webhook secret from database
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { data: webhook } = await supabaseClient
      .from('tracking_webhooks')
      .select('secret_key')
      .eq('carrier', carrier)
      .eq('tracking_code', payload.trackingCode)
      .single()

    if (!webhook?.secret_key) {
      return true // No secret configured, accept webhook
    }

    // Verify signature based on carrier
    const expectedSignature = await generateWebhookSignature(carrier, payload, webhook.secret_key)

    return signature === expectedSignature
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

async function generateWebhookSignature(carrier: string, payload: WebhookPayload, secret: string): Promise<string> {
  const crypto = await import("https://deno.land/std@0.168.0/crypto/mod.ts")

  switch (carrier.toLowerCase()) {
    case 'fedex': {
      // FedEx uses HMAC-SHA256
      const encoder = new TextEncoder()
      const key = await crypto.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      const signature = await crypto.sign('HMAC', key, encoder.encode(JSON.stringify(payload)))
      return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    }

    case 'ups': {
      // UPS uses MD5 hash
      const hash = await crypto.hash('md5', new TextEncoder().encode(secret + JSON.stringify(payload)))
      return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    }

    default: {
      // Default HMAC-SHA256
      const encoder = new TextEncoder()
      const defaultKey = await crypto.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      const defaultSignature = await crypto.sign('HMAC', defaultKey, encoder.encode(JSON.stringify(payload)))
      return btoa(String.fromCharCode(...new Uint8Array(defaultSignature)))
    }
  }
}

async function generateProactiveAlerts(
  supabaseClient: ReturnType<typeof createClient>,
  order: {
    id: string
    user_id: string
    tracking_code: string
    customer_email?: string
    customer_phone?: string
  },
  newStatus: string,
  events: Array<{
    timestamp: string
    location: string
    description: string
    status: string
  }>
): Promise<void> {
  const alerts = []

  // Delay warning alert
  if (newStatus === 'delayed' || newStatus === 'exception') {
    alerts.push({
      user_id: order.user_id,
      order_id: order.id,
      alert_type: 'delay_warning',
      title: 'Atraso na entrega detectado',
      message: `O pedido ${order.tracking_code} apresenta atraso. Último evento: ${events?.[0]?.description || 'Status alterado'}`,
      priority: 'high'
    })
  }

  // Delivery reminder (when out for delivery)
  if (newStatus === 'out_for_delivery') {
    alerts.push({
      user_id: order.user_id,
      order_id: order.id,
      alert_type: 'delivery_reminder',
      title: 'Pedido saiu para entrega',
      message: `O pedido ${order.tracking_code} saiu para entrega hoje. Fique atento!`,
      priority: 'normal'
    })
  }

  // Status change alert
  alerts.push({
    user_id: order.user_id,
    order_id: order.id,
    alert_type: 'status_change',
    title: 'Status do pedido atualizado',
    message: `O status do pedido ${order.tracking_code} foi alterado para: ${newStatus}`,
    priority: 'normal'
  })

  // Exception alert
  if (newStatus === 'returned' || newStatus === 'failed') {
    alerts.push({
      user_id: order.user_id,
      order_id: order.id,
      alert_type: 'exception_alert',
      title: 'Problema com o pedido',
      message: `Foi detectado um problema com o pedido ${order.tracking_code}. Verifique o status.`,
      priority: 'urgent'
    })
  }

  // Insert alerts
  if (alerts.length > 0) {
    const { error } = await supabaseClient
      .from('proactive_alerts')
      .insert(alerts)

    if (error) {
      console.error('Error creating proactive alerts:', error)
    }
  }
}

async function updateTrackingCache(
  supabaseClient: ReturnType<typeof createClient>,
  trackingCode: string,
  carrier: string,
  status: string,
  events: Array<{
    timestamp: string
    location: string
    description: string
    status: string
  }>,
  estimatedDelivery?: string
): Promise<void> {
  const { error } = await supabaseClient
    .from('tracking_cache')
    .upsert({
      tracking_code: trackingCode,
      carrier: carrier,
      status: status,
      events: events || [],
      estimated_delivery: estimatedDelivery,
      last_update: new Date().toISOString()
    })

  if (error) {
    console.error('Error updating tracking cache:', error)
  }
}

async function sendStatusChangeNotifications(
  supabaseClient: ReturnType<typeof createClient>,
  order: {
    id: string
    user_id: string
    tracking_code: string
    customer_email?: string
    customer_phone?: string
  },
  status: string,
  events: Array<{
    timestamp: string
    location: string
    description: string
    status: string
  }>
): Promise<void> {
  try {
    // Get user's notification settings
    const { data: settings } = await supabaseClient
      .from('notification_settings')
      .select('*')
      .eq('user_id', order.user_id)
      .single()

    if (!settings?.enabled) return

    // Send email notification if enabled
    if (settings.email_enabled && order.customer_email) {
      const emailPayload = {
        to: order.customer_email,
        subject: `Atualização do pedido ${order.tracking_code}`,
        html: `
          <h2>Status do seu pedido atualizado</h2>
          <p><strong>Código de rastreio:</strong> ${order.tracking_code}</p>
          <p><strong>Novo status:</strong> ${status}</p>
          <p><strong>Último evento:</strong> ${events?.[0]?.description || 'Status alterado'}</p>
          <p><strong>Data/Hora:</strong> ${events?.[0]?.timestamp || new Date().toISOString()}</p>
          <br>
          <p>Para mais detalhes, acesse: <a href="${Deno.env.get('APP_URL') || 'https://trackyproflow.com'}/orders/${order.id}">Ver pedido</a></p>
        `
      }

      await supabaseClient.functions.invoke('email-service', {
        body: emailPayload
      })
    }

    // Send WhatsApp notification if enabled
    if (settings.whatsapp_enabled && order.customer_phone) {
      const whatsappPayload = {
        phone: order.customer_phone,
        message: `📦 *Atualização do Pedido*\n\nCódigo: ${order.tracking_code}\nStatus: ${status}\nEvento: ${events?.[0]?.description || 'Status alterado'}\n\nAcompanhe em: ${Deno.env.get('APP_URL') || 'https://trackyproflow.com'}/orders/${order.id}`
      }

      await supabaseClient.functions.invoke('whatsapp-service', {
        body: whatsappPayload
      })
    }
  } catch (error) {
    console.error('Error sending notifications:', error)
  }
}