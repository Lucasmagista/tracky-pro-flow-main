import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TrackingEvent {
  date: string
  time: string
  location: string
  status: string
  description: string
  normalized_status?: string
}

interface TrackingResponse {
  success: boolean
  carrier: string
  tracking_code: string
  events: TrackingEvent[]
  current_status: string
  estimated_delivery?: string
  error?: string
}

// Normalização de status entre transportadoras
const normalizeStatus = (rawStatus: string, carrier: string): string => {
  const statusMap: Record<string, Record<string, string>> = {
    correios: {
      'Objeto postado': 'posted',
      'Objeto em trânsito': 'in_transit',
      'Objeto saiu para entrega': 'out_for_delivery',
      'Objeto entregue': 'delivered',
      'Destinatário ausente': 'delivery_failed',
      'Objeto aguardando retirada': 'awaiting_pickup',
      'Atraso na entrega': 'delayed',
    },
    jadlog: {
      'Entrada': 'posted',
      'Transferência': 'in_transit',
      'Saída para entrega': 'out_for_delivery',
      'Entrega realizada': 'delivered',
      'Destinatário ausente': 'delivery_failed',
    },
    melhorenvio: {
      'posted': 'posted',
      'in_transit': 'in_transit',
      'out_for_delivery': 'out_for_delivery',
      'delivered': 'delivered',
      'pending': 'pending',
    },
  }

  const map = statusMap[carrier.toLowerCase()] || {}
  
  for (const [key, value] of Object.entries(map)) {
    if (rawStatus.toLowerCase().includes(key.toLowerCase())) {
      return value
    }
  }

  return 'unknown'
}

// Rastreamento Correios
async function trackCorreios(trackingCode: string): Promise<TrackingResponse> {
  try {
    const response = await fetch(
      `https://api.linketrack.com/track/json?user=teste&token=1abcd00b2731640e886fb41a8a9671ad1434c599dbaa0a0de9a5aa619f29a83f&codigo=${trackingCode}`
    )

    if (!response.ok) {
      throw new Error('Correios API error')
    }

    const data = await response.json()

    if (!data.eventos || data.eventos.length === 0) {
      return {
        success: false,
        carrier: 'correios',
        tracking_code: trackingCode,
        events: [],
        current_status: 'not_found',
        error: 'Tracking code not found',
      }
    }

    const events: TrackingEvent[] = data.eventos.map((evento: {
      data: string;
      hora: string;
      local?: string;
      status: string;
      subStatus?: string[];
    }) => ({
      date: evento.data,
      time: evento.hora,
      location: evento.local || 'N/A',
      status: evento.status,
      description: evento.subStatus?.[0] || evento.status,
      normalized_status: normalizeStatus(evento.status, 'correios'),
    }))

    return {
      success: true,
      carrier: 'correios',
      tracking_code: trackingCode,
      events: events,
      current_status: events[0]?.normalized_status || 'unknown',
    }
  } catch (error) {
    console.error('Correios tracking error:', error)
    return {
      success: false,
      carrier: 'correios',
      tracking_code: trackingCode,
      events: [],
      current_status: 'error',
      error: error.message,
    }
  }
}

// Rastreamento Jadlog
async function trackJadlog(trackingCode: string): Promise<TrackingResponse> {
  try {
    // API pública da Jadlog (exemplo - ajustar conforme API real)
    const response = await fetch(
      `https://www.jadlog.com.br/rastreamento/rastreamento-api?cte=${trackingCode}`
    )

    if (!response.ok) {
      throw new Error('Jadlog API error')
    }

    const data = await response.json()

    if (!data.tracking || data.tracking.length === 0) {
      return {
        success: false,
        carrier: 'jadlog',
        tracking_code: trackingCode,
        events: [],
        current_status: 'not_found',
        error: 'Tracking code not found',
      }
    }

    const events: TrackingEvent[] = data.tracking.map((event: {
      data: string;
      hora?: string;
      unidade?: string;
      status: string;
      observacao?: string;
    }) => ({
      date: event.data,
      time: event.hora || '00:00',
      location: event.unidade || 'N/A',
      status: event.status,
      description: event.observacao || event.status,
      normalized_status: normalizeStatus(event.status, 'jadlog'),
    }))

    return {
      success: true,
      carrier: 'jadlog',
      tracking_code: trackingCode,
      events: events,
      current_status: events[0]?.normalized_status || 'unknown',
    }
  } catch (error) {
    console.error('Jadlog tracking error:', error)
    return {
      success: false,
      carrier: 'jadlog',
      tracking_code: trackingCode,
      events: [],
      current_status: 'error',
      error: error.message,
    }
  }
}

// Rastreamento Melhor Envio
async function trackMelhorEnvio(
  trackingCode: string,
  apiToken?: string
): Promise<TrackingResponse> {
  try {
    if (!apiToken) {
      throw new Error('Melhor Envio API token required')
    }

    const response = await fetch(
      `https://melhorenvio.com.br/api/v2/me/shipment/tracking/${trackingCode}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Melhor Envio API error')
    }

    const data = await response.json()

    if (!data.tracking || !data.tracking.history) {
      return {
        success: false,
        carrier: 'melhorenvio',
        tracking_code: trackingCode,
        events: [],
        current_status: 'not_found',
        error: 'Tracking code not found',
      }
    }

    const events: TrackingEvent[] = data.tracking.history.map((event: {
      created_at: string;
      location?: string;
      status: string;
      description?: string;
    }) => ({
      date: event.created_at.split(' ')[0],
      time: event.created_at.split(' ')[1] || '00:00',
      location: event.location || 'N/A',
      status: event.status,
      description: event.description || event.status,
      normalized_status: normalizeStatus(event.status, 'melhorenvio'),
    }))

    return {
      success: true,
      carrier: 'melhorenvio',
      tracking_code: trackingCode,
      events: events,
      current_status: data.tracking.status || events[0]?.normalized_status || 'unknown',
      estimated_delivery: data.tracking.estimated_delivery_date,
    }
  } catch (error) {
    console.error('Melhor Envio tracking error:', error)
    return {
      success: false,
      carrier: 'melhorenvio',
      tracking_code: trackingCode,
      events: [],
      current_status: 'error',
      error: error.message,
    }
  }
}

// Detecção automática de transportadora
function detectCarrier(trackingCode: string): string {
  // Correios: 13 caracteres, formato AA000000000BR
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(trackingCode)) {
    return 'correios'
  }

  // Jadlog: números com hífen ou ponto
  if (/^\d{10,}[-.]?\d*$/.test(trackingCode)) {
    return 'jadlog'
  }

  // Melhor Envio: UUID ou código específico
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(trackingCode)) {
    return 'melhorenvio'
  }

  // Padrão: tentar Correios primeiro
  return 'correios'
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { tracking_code, carrier, melhor_envio_token } = await req.json()

    if (!tracking_code) {
      throw new Error('Tracking code is required')
    }

    // Detectar transportadora se não especificada
    const detectedCarrier = carrier || detectCarrier(tracking_code)

    console.log(`Tracking ${tracking_code} via ${detectedCarrier}`)

    let result: TrackingResponse

    switch (detectedCarrier.toLowerCase()) {
      case 'correios':
        result = await trackCorreios(tracking_code)
        break

      case 'jadlog':
        result = await trackJadlog(tracking_code)
        break

      case 'melhorenvio':
        result = await trackMelhorEnvio(tracking_code, melhor_envio_token)
        break

      default:
        // Tentar múltiplas transportadoras
        result = await trackCorreios(tracking_code)
        if (!result.success) {
          result = await trackJadlog(tracking_code)
        }
        break
    }

    // Salvar no banco de dados
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Atualizar cache de rastreamento
    await supabase.from('tracking_cache').upsert({
      tracking_code: tracking_code,
      carrier: result.carrier,
      events: result.events,
      current_status: result.current_status,
      last_updated: new Date().toISOString(),
      estimated_delivery: result.estimated_delivery,
    })

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Edge function error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
