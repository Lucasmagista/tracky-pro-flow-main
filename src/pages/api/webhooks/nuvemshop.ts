/**
 * Webhook Endpoint - Nuvemshop
 * Processa eventos de pedidos da Nuvemshop
 * 
 * Eventos suportados:
 * - order/created: Novo pedido criado
 * - order/updated: Pedido atualizado
 * - order/paid: Pagamento confirmado
 * - order/fulfilled: Pedido enviado
 * - order/cancelled: Pedido cancelado
 */

import { createClient } from '@supabase/supabase-js'
import { NuvemshopService } from '@/services/nuvemshop'
import { TrackingService } from '@/services/tracking'
import type { NuvemshopWebhookPayload } from '@/types/nuvemshop'

// Configuração do Supabase (server-side)
const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key no servidor
const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Valida a assinatura do webhook da Nuvemshop
 */
function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // Nuvemshop usa HMAC SHA256
  const crypto = require('crypto')
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  const expectedSignature = hmac.digest('hex')
  
  return signature === expectedSignature
}

/**
 * Processa evento de pedido criado
 */
async function handleOrderCreated(payload: NuvemshopWebhookPayload): Promise<void> {
  const orderId = payload.object_id || payload.id
  console.log('[Nuvemshop Webhook] Processing order/created', orderId)

  try {
    // 1. Buscar configuração da integração
    const { data: integration } = await supabase
      .from('marketplace_integrations')
      .select('*')
      .eq('marketplace', 'nuvemshop')
      .eq('store_id', payload.store_id)
      .single()

    if (!integration) {
      console.error('[Nuvemshop Webhook] Integration not found for store', payload.store_id)
      return
    }

    // 2. Buscar pedido completo da API
    const config = {
      app_id: integration.config.app_id,
      app_secret: integration.config.app_secret,
      access_token: integration.config.access_token,
      store_id: payload.store_id,
      store_url: integration.config.store_url,
      user_id: integration.user_id
    }

    const order = await NuvemshopService.fetchOrder(config, orderId)

    // 3. Converter para formato Tracky
    const trackyOrder = NuvemshopService.convertToTrackyOrder(order, integration.user_id)

    // 4. Salvar pedido no banco
    const { data: savedOrder, error: orderError } = await supabase
      .from('orders')
      .insert(trackyOrder)
      .select()
      .single()

    if (orderError) {
      console.error('[Nuvemshop Webhook] Error saving order:', orderError)
      throw orderError
    }

    // 5. Cache do pedido Nuvemshop
    await supabase
      .from('nuvemshop_orders_cache')
      .upsert({
        user_id: integration.user_id,
        order_id: savedOrder.id,
        nuvemshop_order_id: order.id.toString(),
        nuvemshop_store_id: payload.store_id,
        order_number: order.number.toString(),
        status: order.status,
        shipping_status: order.shipping_status,
        payment_status: order.payment_status,
        total_amount: parseFloat(order.total),
        customer_data: order.customer,
        shipping_data: order.shipping_address,
        products: order.products,
        raw_data: order,
        last_sync: new Date().toISOString()
      })

    // 6. Se tiver código de rastreamento, iniciar tracking
    if (trackyOrder.tracking_code && trackyOrder.tracking_code !== `NUVEMSHOP-${order.id}`) {
      try {
        const trackingInfo = await TrackingService.trackPackage(
          trackyOrder.tracking_code,
          trackyOrder.carrier
        )

        // Atualizar ordem com informações de rastreamento
        await supabase
          .from('orders')
          .update({
            status: trackingInfo.status,
            last_update: trackingInfo.lastUpdate
          })
          .eq('id', savedOrder.id)

      } catch (trackingError) {
        console.error('[Nuvemshop Webhook] Error tracking package:', trackingError)
        // Não falhar o webhook por erro de tracking
      }
    }

    console.log('[Nuvemshop Webhook] Order processed successfully:', savedOrder.id)

  } catch (error) {
    console.error('[Nuvemshop Webhook] Error processing order/created:', error)
    throw error
  }
}

/**
 * Processa evento de pedido atualizado
 */
async function handleOrderUpdated(payload: NuvemshopWebhookPayload): Promise<void> {
  const orderId = payload.object_id || payload.id
  console.log('[Nuvemshop Webhook] Processing order/updated', orderId)

  try {
    // 1. Buscar pedido no cache
    const { data: cachedOrder } = await supabase
      .from('nuvemshop_orders_cache')
      .select('*')
      .eq('nuvemshop_order_id', orderId.toString())
      .eq('nuvemshop_store_id', payload.store_id)
      .single()

    if (!cachedOrder) {
      console.log('[Nuvemshop Webhook] Order not found in cache, creating new')
      await handleOrderCreated(payload)
      return
    }

    // 2. Buscar configuração
    const { data: integration } = await supabase
      .from('marketplace_integrations')
      .select('*')
      .eq('marketplace', 'nuvemshop')
      .eq('store_id', payload.store_id)
      .single()

    if (!integration) {
      console.error('[Nuvemshop Webhook] Integration not found')
      return
    }

    // 3. Buscar pedido atualizado da API
    const config = {
      app_id: integration.config.app_id,
      app_secret: integration.config.app_secret,
      access_token: integration.config.access_token,
      store_id: payload.store_id,
      store_url: integration.config.store_url,
      user_id: integration.user_id
    }

    const order = await NuvemshopService.fetchOrder(config, orderId)

    // 4. Atualizar pedido no Tracky
    const trackyOrder = NuvemshopService.convertToTrackyOrder(order, integration.user_id)

    await supabase
      .from('orders')
      .update({
        status: trackyOrder.status,
        tracking_code: trackyOrder.tracking_code,
        carrier: trackyOrder.carrier,
        updated_at: new Date().toISOString()
      })
      .eq('id', cachedOrder.order_id)

    // 5. Atualizar cache
    await supabase
      .from('nuvemshop_orders_cache')
      .update({
        status: order.status,
        shipping_status: order.shipping_status,
        payment_status: order.payment_status,
        raw_data: order,
        last_sync: new Date().toISOString()
      })
      .eq('id', cachedOrder.id)

    console.log('[Nuvemshop Webhook] Order updated successfully:', cachedOrder.order_id)

  } catch (error) {
    console.error('[Nuvemshop Webhook] Error processing order/updated:', error)
    throw error
  }
}

/**
 * Handler principal do webhook
 */
export async function POST(request: Request) {
  try {
    // 1. Validar assinatura
    const signature = request.headers.get('x-nuvemshop-signature')
    const rawBody = await request.text()
    
    // Obter webhook secret da configuração
    // Em produção, isso viria do banco de dados
    const webhookSecret = process.env.NUVEMSHOP_WEBHOOK_SECRET || ''
    
    if (!validateWebhookSignature(rawBody, signature || '', webhookSecret)) {
      console.error('[Nuvemshop Webhook] Invalid signature')
      return new Response('Invalid signature', { status: 401 })
    }

    // 2. Parse payload
    const payload: NuvemshopWebhookPayload = JSON.parse(rawBody)

    // 3. Log do evento
    await supabase
      .from('webhook_logs')
      .insert({
        source: 'nuvemshop',
        event: payload.event,
        payload: payload,
        received_at: new Date().toISOString()
      })

    // 4. Processar evento
    switch (payload.event) {
      case 'order/created':
        await handleOrderCreated(payload)
        break

      case 'order/updated':
        await handleOrderUpdated(payload)
        break

      case 'order/paid':
        // Atualizar status de pagamento
        console.log('[Nuvemshop Webhook] Order paid:', payload.object_id || payload.id)
        break

      case 'order/fulfilled':
        // Pedido enviado
        console.log('[Nuvemshop Webhook] Order fulfilled:', payload.object_id || payload.id)
        break

      case 'order/cancelled':
        // Pedido cancelado
        console.log('[Nuvemshop Webhook] Order cancelled:', payload.object_id || payload.id)
        break

      default:
        console.log('[Nuvemshop Webhook] Unknown event:', payload.event)
    }

    return new Response('OK', { status: 200 })

  } catch (error) {
    console.error('[Nuvemshop Webhook] Error:', error)
    
    // Log error no banco
    await supabase
      .from('webhook_errors')
      .insert({
        source: 'nuvemshop',
        error: error instanceof Error ? error.message : 'Unknown error',
        occurred_at: new Date().toISOString()
      })

    return new Response('Internal Server Error', { status: 500 })
  }
}

/**
 * Health check
 */
export async function GET() {
  return new Response(JSON.stringify({ status: 'ok', service: 'nuvemshop-webhook' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
