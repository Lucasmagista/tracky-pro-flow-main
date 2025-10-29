import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
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

    const { orders } = await req.json()
    const { data: { user } } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('User not authenticated')
    }

    const ordersToInsert = []
    const historyEntries = []

    for (const order of orders) {
      // Extract tracking info from fulfillments
      let trackingCode = null
      let carrier = 'Correios' // Default

      if (order.fulfillments && order.fulfillments.length > 0) {
        const fulfillment = order.fulfillments[0]
        trackingCode = fulfillment.tracking_number
        if (fulfillment.tracking_company) {
          carrier = fulfillment.tracking_company
        }
      }

      // Skip orders without tracking
      if (!trackingCode) continue

      const orderData = {
        user_id: user.id,
        tracking_code: trackingCode,
        customer_name: `${order.customer.first_name} ${order.customer.last_name}`,
        customer_email: order.customer.email,
        customer_phone: order.shipping_address?.phone || null,
        carrier: carrier,
        status: 'pending',
        external_order_id: order.id.toString(),
        external_source: 'shopify'
      }

      ordersToInsert.push(orderData)
    }

    if (ordersToInsert.length === 0) {
      return new Response(
        JSON.stringify({ imported: 0, message: 'No orders with tracking codes found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // Insert orders
    const { data, error } = await supabaseClient
      .from('orders')
      .insert(ordersToInsert)
      .select()

    if (error) throw error

    // Create history entries
    for (const order of data || []) {
      historyEntries.push({
        order_id: order.id,
        user_id: user.id,
        new_status: 'pending',
        notes: 'Pedido importado do Shopify'
      })
    }

    if (historyEntries.length > 0) {
      await supabaseClient.from('order_history').insert(historyEntries)
    }

    return new Response(
      JSON.stringify({ imported: ordersToInsert.length }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})