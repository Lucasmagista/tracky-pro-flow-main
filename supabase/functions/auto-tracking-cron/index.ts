// Edge Function para atualização automática de rastreamento via Cron
// Executar a cada hora: 0 * * * *

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Order {
  id: string;
  tracking_code: string;
  carrier: string;
  status: string;
  created_at: string;
  last_tracking_update?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting automatic tracking update...');

    // Buscar pedidos que precisam de atualização
    const { data: orders, error: ordersError } = await supabaseClient
      .from('orders')
      .select('id, tracking_code, carrier, status, created_at, last_tracking_update')
      .not('tracking_code', 'is', null)
      .not('status', 'in', '(delivered,cancelled)');

    if (ordersError) {
      throw ordersError;
    }

    if (!orders || orders.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No orders to update',
          updated: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`Found ${orders.length} orders to check`);

    // Filtrar pedidos baseado em intervalo inteligente
    const ordersToUpdate = orders.filter((order: Order) => {
      const lastUpdate = order.last_tracking_update
        ? new Date(order.last_tracking_update)
        : new Date(order.created_at);

      const hoursSinceUpdate =
        (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);

      // Intervalo baseado no status
      const updateIntervals: Record<string, number> = {
        out_for_delivery: 0.5, // 30 minutos
        in_transit: 2, // 2 horas
        delayed: 1, // 1 hora
        exception: 1, // 1 hora
        posted: 4, // 4 horas
        pending: 6, // 6 horas
      };

      const interval = updateIntervals[order.status] || 4;

      return hoursSinceUpdate >= interval;
    });

    console.log(`${ordersToUpdate.length} orders need update`);

    let successCount = 0;
    let errorCount = 0;

    // Atualizar em lotes pequenos para evitar rate limiting
    const batchSize = 3;
    for (let i = 0; i < ordersToUpdate.length; i += batchSize) {
      const batch = ordersToUpdate.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (order: Order) => {
          try {
            // Chamar função de rastreamento multi-transportadora
            const { data: trackingData, error: trackingError } =
              await supabaseClient.functions.invoke('track-multi-carrier', {
                body: {
                  tracking_code: order.tracking_code,
                  carrier: order.carrier,
                },
              });

            if (trackingError) {
              console.error(
                `Error tracking ${order.tracking_code}:`,
                trackingError
              );
              errorCount++;
              return;
            }

            if (trackingData && trackingData.success) {
              // Atualizar pedido
              await supabaseClient
                .from('orders')
                .update({
                  status: trackingData.current_status,
                  estimated_delivery: trackingData.estimated_delivery,
                  last_tracking_update: new Date().toISOString(),
                })
                .eq('id', order.id);

              // Verificar se precisa criar alerta de atraso
              if (
                trackingData.current_status === 'delayed' ||
                trackingData.current_status === 'exception'
              ) {
                // Importar serviço de detecção de atraso (simulado)
                const daysInTransit = Math.floor(
                  (Date.now() - new Date(order.created_at).getTime()) /
                    (1000 * 60 * 60 * 24)
                );

                if (daysInTransit > 7) {
                  // Criar alerta proativo
                  await supabaseClient.from('proactive_alerts').insert({
                    order_id: order.id,
                    alert_type: 'delay_warning',
                    priority:
                      trackingData.current_status === 'exception'
                        ? 'urgent'
                        : 'high',
                    title: `Possível atraso - ${order.tracking_code}`,
                    message: `O pedido está há ${daysInTransit} dias em trânsito com status "${trackingData.current_status}".`,
                    metadata: {
                      tracking_code: order.tracking_code,
                      carrier: order.carrier,
                      days_in_transit: daysInTransit,
                      current_status: trackingData.current_status,
                    },
                    is_read: false,
                    is_resolved: false,
                  });
                }
              }

              successCount++;
              console.log(`Updated ${order.tracking_code}: ${trackingData.current_status}`);
            }
          } catch (error) {
            console.error(`Error processing ${order.tracking_code}:`, error);
            errorCount++;
          }
        })
      );

      // Delay entre lotes
      if (i + batchSize < ordersToUpdate.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.log(`Update complete. Success: ${successCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Automatic tracking update completed',
        total_checked: orders.length,
        needs_update: ordersToUpdate.length,
        updated: successCount,
        errors: errorCount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in auto-tracking-cron:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
