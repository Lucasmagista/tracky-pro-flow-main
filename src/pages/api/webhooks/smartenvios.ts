/**
 * Webhook endpoint para Smartenvios
 * 
 * Recebe atualizações de rastreamento e sincroniza com o banco de dados
 * e opcionalmente com Nuvemshop (se integrado)
 */

import { createClient } from '@supabase/supabase-js'
import type { SmartenviosWebhookPayload, SmartenviosTracking } from '@/types/smartenvios'
import { NuvemshopService } from '@/services/nuvemshop'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
)

/**
 * Valida assinatura do webhook Smartenvios
 */
function validateWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false

  try {
    const crypto = require('crypto')
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payload)
    const computedSignature = hmac.digest('hex')

    return signature === computedSignature
  } catch (error) {
    console.error('[Smartenvios Webhook] Signature validation error:', error)
    return false
  }
}

/**
 * Processa atualização de rastreamento
 */
async function handleTrackingUpdate(payload: SmartenviosWebhookPayload): Promise<void> {
  console.log('[Smartenvios Webhook] Processing tracking update', {
    tracking_code: payload.tracking_code,
    status: payload.status
  })

  try {
    // 1. Atualizar rastreamento no banco
    const trackingData = payload.data as SmartenviosTracking
    
    const { error: updateError } = await supabase
      .from('shipments')
      .update({
        status: payload.status,
        last_event: trackingData.events?.[0]?.description || '',
        last_update: new Date(payload.timestamp).toISOString(),
        events: trackingData.events
      })
      .eq('tracking_code', payload.tracking_code)

    if (updateError) {
      console.error('[Smartenvios Webhook] Error updating shipment:', updateError)
      throw updateError
    }

    // 2. Buscar pedido associado
    const { data: shipment } = await supabase
      .from('shipments')
      .select('order_id')
      .eq('tracking_code', payload.tracking_code)
      .single()

    if (!shipment?.order_id) {
      console.log('[Smartenvios Webhook] No order associated with tracking')
      return
    }

    // 3. Atualizar status do pedido
    const orderStatus = mapSmartenviosStatusToOrderStatus(payload.status)
    
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        status: orderStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', shipment.order_id)

    if (orderError) {
      console.error('[Smartenvios Webhook] Error updating order:', orderError)
    }

    // 4. Sincronizar com Nuvemshop (se integrado)
    await syncWithNuvemshop(shipment.order_id, payload)

    console.log('[Smartenvios Webhook] Tracking update processed successfully')
  } catch (error) {
    console.error('[Smartenvios Webhook] Error processing tracking update:', error)
    
    // Log error para análise
    await logWebhookError('smartenvios', 'tracking_update', payload, error)
    throw error
  }
}

/**
 * Mapeia status do Smartenvios para status do pedido
 */
function mapSmartenviosStatusToOrderStatus(smartenviosStatus: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'pending',
    'in_transit': 'shipped',
    'out_for_delivery': 'shipped',
    'delivered': 'delivered',
    'failed': 'pending',
    'returned': 'cancelled'
  }

  return statusMap[smartenviosStatus] || 'pending'
}

/**
 * Sincroniza atualização com Nuvemshop
 */
async function syncWithNuvemshop(
  orderId: string,
  payload: SmartenviosWebhookPayload
): Promise<void> {
  try {
    // 1. Buscar pedido e dados do Nuvemshop
    const { data: order } = await supabase
      .from('orders')
      .select(`
        *,
        nuvemshop_orders_cache!inner(nuvemshop_order_id)
      `)
      .eq('id', orderId)
      .single()

    if (!order?.nuvemshop_orders_cache?.nuvemshop_order_id) {
      console.log('[Smartenvios Webhook] Order not from Nuvemshop, skipping sync')
      return
    }

    // 2. Buscar integração Nuvemshop do usuário
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', order.user_id)
      .eq('provider', 'nuvemshop')
      .eq('is_active', true)
      .single()

    if (!integration) {
      console.log('[Smartenvios Webhook] No active Nuvemshop integration')
      return
    }

    // 3. Atualizar status de envio no Nuvemshop
    const config = {
      ...integration.config,
      user_id: integration.user_id
    }

    const nuvemshopStatus = mapSmartenviosStatusToNuvemshop(payload.status)
    const trackingData = payload.data as SmartenviosTracking

    await NuvemshopService.updateShippingStatus(
      config,
      parseInt(order.nuvemshop_orders_cache.nuvemshop_order_id),
      payload.tracking_code,
      undefined, // tracking URL não está disponível no Smartenvios
      nuvemshopStatus
    )

    console.log('[Smartenvios Webhook] Synced with Nuvemshop successfully')
  } catch (error) {
    console.error('[Smartenvios Webhook] Error syncing with Nuvemshop:', error)
    // Não propaga erro - sync com Nuvemshop é opcional
  }
}

/**
 * Mapeia status do Smartenvios para Nuvemshop
 */
function mapSmartenviosStatusToNuvemshop(smartenviosStatus: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'unfulfilled',
    'in_transit': 'fulfilled',
    'out_for_delivery': 'fulfilled',
    'delivered': 'fulfilled',
    'failed': 'unfulfilled',
    'returned': 'unfulfilled'
  }

  return statusMap[smartenviosStatus] || 'unfulfilled'
}

/**
 * Processa entrega concluída
 */
async function handleDeliveryCompleted(payload: SmartenviosWebhookPayload): Promise<void> {
  console.log('[Smartenvios Webhook] Processing delivery completed', payload.tracking_code)

  try {
    // Atualizar com status final de entrega
    await handleTrackingUpdate({
      ...payload,
      status: 'delivered'
    })

    // Buscar pedido
    const { data: shipment } = await supabase
      .from('shipments')
      .select('order_id')
      .eq('tracking_code', payload.tracking_code)
      .single()

    if (shipment?.order_id) {
      // Marcar pedido como completo
      await supabase
        .from('orders')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', shipment.order_id)
    }

    console.log('[Smartenvios Webhook] Delivery completed processed successfully')
  } catch (error) {
    console.error('[Smartenvios Webhook] Error processing delivery:', error)
    await logWebhookError('smartenvios', 'delivery_completed', payload, error)
    throw error
  }
}

/**
 * Loga erro do webhook para análise posterior
 */
async function logWebhookError(
  provider: string,
  event: string,
  payload: any,
  error: any
): Promise<void> {
  try {
    await supabase.from('webhook_errors').insert({
      provider,
      event,
      payload,
      error: error.message || String(error),
      error_details: error.stack || null,
      created_at: new Date().toISOString()
    })
  } catch (logError) {
    console.error('[Smartenvios Webhook] Error logging webhook error:', logError)
  }
}

/**
 * Handler principal do webhook
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const signature = request.headers.get('X-Smartenvios-Signature')
    const rawBody = await request.text()
    const payload: SmartenviosWebhookPayload = JSON.parse(rawBody)

    console.log('[Smartenvios Webhook] Received event:', payload.event)

    // 1. Buscar configuração do Smartenvios para validar assinatura
    const { data: integration } = await supabase
      .from('integrations')
      .select('config')
      .eq('provider', 'smartenvios')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!integration?.config?.webhook_secret) {
      console.error('[Smartenvios Webhook] No webhook secret configured')
      return new Response(
        JSON.stringify({ error: 'Webhook not configured' }),
        { status: 401 }
      )
    }

    // 2. Validar assinatura
    const isValid = validateWebhookSignature(
      rawBody,
      signature,
      integration.config.webhook_secret
    )

    if (!isValid) {
      console.error('[Smartenvios Webhook] Invalid signature')
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401 }
      )
    }

    // 3. Processar evento baseado no tipo
    switch (payload.event) {
      case 'tracking.update':
        await handleTrackingUpdate(payload)
        break

      case 'tracking.delivered':
        await handleDeliveryCompleted(payload)
        break

      case 'tracking.exception':
        console.warn('[Smartenvios Webhook] Exception event:', payload)
        await handleTrackingUpdate(payload)
        break

      case 'tracking.returned':
        await handleTrackingUpdate({
          ...payload,
          status: 'returned'
        })
        break

      case 'shipment.created':
        console.log('[Smartenvios Webhook] Shipment created:', payload.tracking_code)
        break

      case 'shipment.cancelled':
        console.log('[Smartenvios Webhook] Shipment cancelled:', payload.tracking_code)
        break

      default:
        console.warn('[Smartenvios Webhook] Unknown event type:', payload.event)
        break
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    )
  } catch (error) {
    console.error('[Smartenvios Webhook] Fatal error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      }),
      { status: 500 }
    )
  }
}

/**
 * Health check endpoint
 */
export async function GET(): Promise<Response> {
  return new Response(
    JSON.stringify({
      status: 'ok',
      webhook: 'smartenvios',
      timestamp: new Date().toISOString()
    }),
    { status: 200 }
  )
}
