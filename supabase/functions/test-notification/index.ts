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

    const { type, recipient, template, subject } = await req.json()
    const { data: { user } } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('User not authenticated')
    }

    // Replace template variables with test data
    const testData = {
      cliente: 'João Silva',
      codigo: 'BR123456789BR',
      status: 'Em trânsito',
      link: 'https://tracky.com/rastreio/BR123456789BR'
    }

    let processedTemplate = template
    Object.entries(testData).forEach(([key, value]) => {
      processedTemplate = processedTemplate.replace(new RegExp(`{${key}}`, 'g'), value)
    })

    // Send test notification based on type
    if (type === 'email') {
      // For now, just log the email (in production, integrate with email service)
      console.log('Test Email:', {
        to: recipient,
        subject: subject || 'Teste de Notificação',
        content: processedTemplate
      })

      // TODO: Integrate with email service (SendGrid, AWS SES, etc.)

    } else if (type === 'whatsapp') {
      // For now, just log the WhatsApp message (in production, integrate with WhatsApp API)
      console.log('Test WhatsApp:', {
        to: recipient,
        content: processedTemplate
      })

      // TODO: Integrate with WhatsApp Business API or wppconnect

    } else if (type === 'sms') {
      // For now, just log the SMS (in production, integrate with SMS service)
      console.log('Test SMS:', {
        to: recipient,
        content: processedTemplate.substring(0, 160) // SMS limit
      })

      // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Teste de ${type} enviado com sucesso`,
        preview: processedTemplate
      }),
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