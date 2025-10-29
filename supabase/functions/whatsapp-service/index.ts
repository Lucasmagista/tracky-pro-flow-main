import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Simulação de estado do WhatsApp (em produção seria persistido)
let whatsappSessions = new Map<string, {
  isConnected: boolean;
  qrCode?: string;
  sessionId: string;
}>();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função para gerar QR Code simulado
function generateQRCode(): string {
  // Simula um QR code do WhatsApp Web
  const randomId = Math.random().toString(36).substring(2, 15);
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=whatsapp-web-${randomId}`;
}

// Função para validar número de telefone brasileiro
function validateBrazilianPhone(phone: string): string {
  // Remove todos os caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, '');

  // Adiciona o código do país se não estiver presente
  if (cleanPhone.length === 10 || cleanPhone.length === 11) {
    return `55${cleanPhone}`;
  }

  // Se já tem código do país, retorna como está
  if (cleanPhone.startsWith('55') && cleanPhone.length === 12 || cleanPhone.length === 13) {
    return cleanPhone;
  }

  throw new Error('Número de telefone inválido');
}

// Função para simular envio de WhatsApp
async function simulateWhatsAppSend(phone: string, message: string): Promise<boolean> {
  // Simula delay de envio
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

  // Simula taxa de sucesso de 95%
  const success = Math.random() > 0.05;

  if (success) {
    console.log(`✅ WhatsApp enviado para ${phone}: ${message.substring(0, 100)}...`);
  } else {
    console.log(`❌ Falha ao enviar WhatsApp para ${phone}`);
  }

  return success;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    switch (action) {
      case "initialize":
        // Inicializar sessão do WhatsApp
        const sessionId = `session_${user.id}_${Date.now()}`;
        const qrCode = generateQRCode();

        whatsappSessions.set(user.id, {
          isConnected: false,
          qrCode,
          sessionId
        });

        return new Response(JSON.stringify({
          success: true,
          qrCode,
          sessionId,
          message: "Escaneie o QR code com o WhatsApp Web"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      case "get_status":
        const session = whatsappSessions.get(user.id);
        return new Response(JSON.stringify({
          isConnected: session?.isConnected || false,
          qrCode: session?.qrCode,
          sessionId: session?.sessionId
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      case "connect":
        // Simular conexão após escanear QR code
        const connectSession = whatsappSessions.get(user.id);
        if (connectSession) {
          connectSession.isConnected = true;
          connectSession.qrCode = undefined; // Remove QR code após conexão
        }

        return new Response(JSON.stringify({
          success: true,
          message: "WhatsApp conectado com sucesso!"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      case "disconnect":
        whatsappSessions.delete(user.id);
        return new Response(JSON.stringify({
          success: true,
          message: "WhatsApp desconectado"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      case "send_message":
        const { phone, message } = await req.json();

        try {
          // Validar número de telefone
          const validatedPhone = validateBrazilianPhone(phone);

          // Verificar se WhatsApp está conectado
          const userSession = whatsappSessions.get(user.id);
          if (!userSession?.isConnected) {
            return new Response(JSON.stringify({
              success: false,
              error: "WhatsApp não está conectado. Inicialize a sessão primeiro."
            }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Simular envio
          const success = await simulateWhatsAppSend(validatedPhone, message);

          // Registrar notificação no banco
          const { error: notificationError } = await supabaseClient
            .from("notifications")
            .insert({
              user_id: user.id,
              type: "whatsapp",
              recipient: validatedPhone,
              message: message,
              status: success ? "sent" : "failed",
              sent_at: new Date().toISOString(),
              error_message: success ? null : "Falha simulada no envio",
            });

          if (notificationError) {
            console.error("Error storing notification:", notificationError);
          }

          return new Response(JSON.stringify({
            success,
            message: success ? "Mensagem enviada com sucesso" : "Falha ao enviar mensagem"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });

        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

      case "get_qr":
        const qrSession = whatsappSessions.get(user.id);
        if (!qrSession?.qrCode) {
          return new Response(JSON.stringify({
            error: "QR code não disponível. Inicialize a sessão primeiro."
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          qrCode: qrSession.qrCode
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Error in whatsapp-service:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});