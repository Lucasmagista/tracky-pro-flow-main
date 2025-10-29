import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TrackingEvent {
  data: string
  hora: string
  local: string
  status: string
  subStatus?: string[]
}

interface TrackingResponse {
  codigo: string
  eventos: TrackingEvent[]
  success: boolean
  error?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { trackingCode } = await req.json()

    if (!trackingCode) {
      return new Response(
        JSON.stringify({ error: 'Código de rastreio é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Consultar API dos Correios
    const response = await fetch(`https://proxyapp.correios.com.br/v1/sro-rastro/${trackingCode}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Erro na API dos Correios: ${response.status}`)
    }

    const data = await response.json()

    // Transformar resposta dos Correios para nosso formato
    const trackingResponse: TrackingResponse = {
      codigo: trackingCode,
      success: true,
      eventos: data.objetos?.[0]?.eventos?.map((evento: any) => ({
        data: evento.dtHrCriado,
        hora: evento.dtHrCriado.split('T')[1]?.substring(0, 5) || '',
        local: evento.unidade?.nome || evento.unidade?.tipo || 'Não informado',
        status: evento.descricao || evento.tipo,
        subStatus: evento.detalhes || []
      })) || []
    }

    // Atualizar status no banco se houver eventos
    if (trackingResponse.eventos.length > 0) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: { Authorization: req.headers.get('Authorization')! },
          },
        }
      )

      const latestEvent = trackingResponse.eventos[0]
      const status = mapCorreiosStatus(latestEvent.status)

      // Atualizar pedido no banco
      const { error: updateError } = await supabaseClient
        .from('orders')
        .update({
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('tracking_code', trackingCode)

      if (updateError) {
        console.error('Erro ao atualizar pedido:', updateError)
      }

      // Registrar histórico
      const { error: historyError } = await supabaseClient
        .from('order_history')
        .insert({
          order_id: (await supabaseClient
            .from('orders')
            .select('id')
            .eq('tracking_code', trackingCode)
            .single()).data?.id,
          user_id: (await supabaseClient.auth.getUser()).data.user?.id,
          new_status: status,
          notes: `Atualização automática via API dos Correios: ${latestEvent.status}`
        })

      if (historyError) {
        console.error('Erro ao registrar histórico:', historyError)
      }
    }

    return new Response(
      JSON.stringify(trackingResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro na Edge Function:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro interno do servidor'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function mapCorreiosStatus(correiosStatus: string): string {
  const statusMap: Record<string, string> = {
    'Postado': 'pending',
    'Encaminhado': 'in_transit',
    'Saiu para entrega': 'out_for_delivery',
    'Entregue': 'delivered',
    'Aguardando retirada': 'out_for_delivery',
    'Devolvido': 'returned',
    'Extraviado': 'failed',
    'Destinatário ausente': 'delayed'
  }

  // Procurar por correspondências parciais
  for (const [key, value] of Object.entries(statusMap)) {
    if (correiosStatus.toLowerCase().includes(key.toLowerCase())) {
      return value
    }
  }

  return 'in_transit' // Status padrão
}