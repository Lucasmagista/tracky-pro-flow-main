// Este arquivo é executado no Deno runtime (Supabase Edge Functions)
// Os erros do TypeScript no VS Code são esperados e podem ser ignorados
// @ts-nocheck
// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @deno-types="https://esm.sh/@supabase/supabase-js@2"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Tipos
interface WhatsAppSession {
  user_id: string;
  session_id: string;
  is_connected: boolean;
  qr_code?: string;
  created_at: string;
  updated_at: string;
}

// DDDs válidos do Brasil (regiões)
const VALID_BRAZILIAN_DDDS = [
  11, 12, 13, 14, 15, 16, 17, 18, 19, // São Paulo
  21, 22, 24, // Rio de Janeiro
  27, 28, // Espírito Santo
  31, 32, 33, 34, 35, 37, 38, // Minas Gerais
  41, 42, 43, 44, 45, 46, // Paraná
  47, 48, 49, // Santa Catarina
  51, 53, 54, 55, // Rio Grande do Sul
  61, // Distrito Federal
  62, 64, // Goiás
  63, // Tocantins
  65, 66, // Mato Grosso
  67, // Mato Grosso do Sul
  68, // Acre
  69, // Rondônia
  71, 73, 74, 75, 77, // Bahia
  79, // Sergipe
  81, 87, // Pernambuco
  82, // Alagoas
  83, // Paraíba
  84, // Rio Grande do Norte
  85, 88, // Ceará
  86, 89, // Piauí
  91, 93, 94, // Pará
  92, 97, // Amazonas
  95, // Roraima
  96, // Amapá
  98, 99, // Maranhão
];

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

  let phoneToValidate = cleanPhone;

  // Remove código do país se presente para validar DDD e número
  if (cleanPhone.startsWith('55')) {
    phoneToValidate = cleanPhone.substring(2);
  }

  // Valida tamanho (10 ou 11 dígitos: DDD + número)
  if (phoneToValidate.length !== 10 && phoneToValidate.length !== 11) {
    throw new Error('Número de telefone deve ter 10 ou 11 dígitos (com DDD)');
  }

  // Extrai e valida DDD
  const ddd = parseInt(phoneToValidate.substring(0, 2), 10);
  if (!VALID_BRAZILIAN_DDDS.includes(ddd)) {
    throw new Error(`DDD ${ddd} inválido. Use um DDD brasileiro válido.`);
  }

  // Valida número (deve começar com 9 para celular ou 2-5 para fixo)
  const number = phoneToValidate.substring(2);
  const firstDigit = number[0];

  if (phoneToValidate.length === 11 && firstDigit !== '9') {
    throw new Error('Números com 11 dígitos devem começar com 9 (celular)');
  }

  if (phoneToValidate.length === 10 && !['2', '3', '4', '5'].includes(firstDigit)) {
    throw new Error('Números com 10 dígitos devem começar com 2, 3, 4 ou 5 (fixo)');
  }

  // Retorna com código do país
  return cleanPhone.startsWith('55') ? cleanPhone : `55${phoneToValidate}`;
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

// Função auxiliar para gerenciar sessões no banco
async function getSession(supabaseClient: any, userId: string): Promise<WhatsAppSession | null> {
  const { data, error } = await supabaseClient
    .from('whatsapp_sessions')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching session:', error);
    return null;
  }

  return data;
}

async function upsertSession(supabaseClient: any, session: Partial<WhatsAppSession>): Promise<WhatsAppSession | null> {
  const { data, error } = await supabaseClient
    .from('whatsapp_sessions')
    .upsert(session, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    console.error('Error upserting session:', error);
    return null;
  }

  return data;
}

async function deleteSession(supabaseClient: any, userId: string): Promise<boolean> {
  const { error } = await supabaseClient
    .from('whatsapp_sessions')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting session:', error);
    return false;
  }

  return true;
}

// Rate limiting: verifica quantas mensagens foram enviadas na última hora
async function checkRateLimit(supabaseClient: any, userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error } = await supabaseClient
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'whatsapp')
    .gte('created_at', oneHourAgo);

  if (error) {
    console.error('Error checking rate limit:', error);
    return { allowed: true, remaining: 100 }; // Fallback
  }

  const limit = 100; // 100 mensagens por hora
  const used = count || 0;
  const remaining = Math.max(0, limit - used);

  return {
    allowed: used < limit,
    remaining
  };
}

serve(async (req: Request) => {
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
      case "initialize": {
        // Inicializar sessão do WhatsApp
        const sessionId = `session_${user.id}_${Date.now()}`;
        const qrCode = generateQRCode();

        const session = await upsertSession(supabaseClient, {
          user_id: user.id,
          session_id: sessionId,
          is_connected: false,
          qr_code: qrCode,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (!session) {
          return new Response(JSON.stringify({
            success: false,
            error: "Erro ao criar sessão do WhatsApp"
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          qrCode,
          sessionId,
          message: "Escaneie o QR code com o WhatsApp Web"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_status": {
        const session = await getSession(supabaseClient, user.id);
        return new Response(JSON.stringify({
          isConnected: session?.is_connected || false,
          qrCode: session?.qr_code,
          sessionId: session?.session_id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "connect": {
        // Simular conexão após escanear QR code
        const existingSession = await getSession(supabaseClient, user.id);
        
        if (!existingSession) {
          return new Response(JSON.stringify({
            success: false,
            error: "Sessão não encontrada. Inicialize primeiro."
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const updatedSession = await upsertSession(supabaseClient, {
          ...existingSession,
          is_connected: true,
          qr_code: undefined, // Remove QR code após conexão
          updated_at: new Date().toISOString(),
        });

        return new Response(JSON.stringify({
          success: true,
          message: "WhatsApp conectado com sucesso!"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "disconnect": {
        const deleted = await deleteSession(supabaseClient, user.id);
        return new Response(JSON.stringify({
          success: deleted,
          message: deleted ? "WhatsApp desconectado" : "Erro ao desconectar"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send_message": {
        const { phone, message } = await req.json();

        try {
          // Verificar rate limit
          const rateLimit = await checkRateLimit(supabaseClient, user.id);
          if (!rateLimit.allowed) {
            return new Response(JSON.stringify({
              success: false,
              error: "Limite de mensagens excedido. Aguarde antes de enviar mais mensagens.",
              remaining: rateLimit.remaining
            }), {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Validar número de telefone
          const validatedPhone = validateBrazilianPhone(phone);

          // Verificar se WhatsApp está conectado
          const userSession = await getSession(supabaseClient, user.id);
          if (!userSession?.is_connected) {
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
            message: success ? "Mensagem enviada com sucesso" : "Falha ao enviar mensagem",
            remaining: rateLimit.remaining - 1
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
          return new Response(JSON.stringify({
            success: false,
            error: errorMessage
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      case "get_qr": {
        const qrSession = await getSession(supabaseClient, user.id);
        if (!qrSession?.qr_code) {
          return new Response(JSON.stringify({
            error: "QR code não disponível. Inicialize a sessão primeiro."
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          qrCode: qrSession.qr_code
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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