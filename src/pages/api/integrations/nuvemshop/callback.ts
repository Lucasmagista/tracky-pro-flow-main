/**
 * OAuth Callback Route para Nuvemshop
 * 
 * Processa o código de autorização retornado pela Nuvemshop
 * e troca por access_token, salvando no banco de dados
 */

import { createClient } from '@supabase/supabase-js'
import { NuvemshopService } from '@/services/nuvemshop'
import type { NuvemshopConfig } from '@/types/nuvemshop'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
)

interface CallbackQueryParams {
  code?: string
  state?: string
  error?: string
  error_description?: string
}

/**
 * Processa callback OAuth da Nuvemshop
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const params: CallbackQueryParams = {
    code: url.searchParams.get('code') || undefined,
    state: url.searchParams.get('state') || undefined,
    error: url.searchParams.get('error') || undefined,
    error_description: url.searchParams.get('error_description') || undefined
  }

  console.log('[Nuvemshop OAuth] Callback received', {
    hasCode: !!params.code,
    hasState: !!params.state,
    hasError: !!params.error
  })

  try {
    // 1. Verificar se houve erro no OAuth
    if (params.error) {
      console.error('[Nuvemshop OAuth] Authorization error:', params.error_description)
      return redirectWithError(params.error_description || params.error)
    }

    // 2. Validar parâmetros obrigatórios
    if (!params.code || !params.state) {
      console.error('[Nuvemshop OAuth] Missing required parameters')
      return redirectWithError('Parâmetros inválidos')
    }

    // 3. Validar state (CSRF protection)
    const storedState = sessionStorage.getItem('nuvemshop_oauth_state')
    if (storedState !== params.state) {
      console.error('[Nuvemshop OAuth] State mismatch - possible CSRF attack')
      return redirectWithError('Estado OAuth inválido')
    }

    // 4. Buscar user_id associado ao state
    const userId = sessionStorage.getItem('nuvemshop_oauth_user_id')
    if (!userId) {
      console.error('[Nuvemshop OAuth] User ID not found in session')
      return redirectWithError('Sessão expirada')
    }

    // 5. Trocar código por access_token
    const config: Partial<NuvemshopConfig> = {
      app_id: import.meta.env.VITE_NUVEMSHOP_APP_ID!,
      app_secret: import.meta.env.VITE_NUVEMSHOP_APP_SECRET!,
      user_id: userId
    }

    const tokenResponse = await exchangeCodeForToken(config, params.code)

    if (!tokenResponse.access_token) {
      console.error('[Nuvemshop OAuth] No access token in response')
      return redirectWithError('Falha ao obter token de acesso')
    }

    // 6. Buscar informações da loja
    const storeInfo = await fetchStoreInfo(tokenResponse.access_token)

    // 7. Salvar integração no banco de dados
    const { error: insertError } = await supabase
      .from('integrations')
      .upsert({
        user_id: userId,
        provider: 'nuvemshop',
        name: `Nuvemshop - ${storeInfo.name}`,
        is_active: true,
        config: {
          app_id: config.app_id,
          app_secret: config.app_secret,
          access_token: tokenResponse.access_token,
          store_id: storeInfo.id,
          store_url: storeInfo.url,
          store_name: storeInfo.name,
          token_expires_at: tokenResponse.expires_in
            ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
            : null
        },
        settings: {
          auto_sync: true,
          sync_interval: 300, // 5 minutos
          webhook_enabled: true
        },
        last_sync: new Date().toISOString()
      }, {
        onConflict: 'user_id,provider'
      })

    if (insertError) {
      console.error('[Nuvemshop OAuth] Error saving integration:', insertError)
      return redirectWithError('Erro ao salvar configuração')
    }

    // 8. Registrar webhooks
    try {
      const webhookUrl = `${import.meta.env.VITE_API_URL}/api/webhooks/nuvemshop`
      
      await NuvemshopService.registerWebhooks(
        {
          ...config,
          access_token: tokenResponse.access_token,
          store_id: storeInfo.id.toString(),
          store_url: storeInfo.url,
          user_id: userId
        } as NuvemshopConfig,
        webhookUrl,
        [
          'order/created',
          'order/updated',
          'order/paid',
          'order/fulfilled',
          'order/cancelled'
        ]
      )
      console.log('[Nuvemshop OAuth] Webhooks registered successfully')
    } catch (webhookError) {
      console.error('[Nuvemshop OAuth] Error registering webhooks:', webhookError)
      // Não bloqueia - webhooks podem ser registrados depois
    }

    // 9. Limpar session storage
    sessionStorage.removeItem('nuvemshop_oauth_state')
    sessionStorage.removeItem('nuvemshop_oauth_user_id')

    console.log('[Nuvemshop OAuth] Integration completed successfully')

    // 10. Redirecionar para página de configurações com sucesso
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/settings/integrations?provider=nuvemshop&status=success'
      }
    })
  } catch (error) {
    console.error('[Nuvemshop OAuth] Fatal error:', error)
    return redirectWithError(
      error instanceof Error ? error.message : 'Erro desconhecido'
    )
  }
}

/**
 * Troca código de autorização por access_token
 */
async function exchangeCodeForToken(
  config: Partial<NuvemshopConfig>,
  code: string
): Promise<{
  access_token: string
  token_type: string
  expires_in?: number
  scope?: string
}> {
  const response = await fetch('https://www.tiendanube.com/apps/authorize/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.app_id,
      client_secret: config.app_secret,
      code: code,
      grant_type: 'authorization_code'
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to exchange token: ${error}`)
  }

  return response.json()
}

/**
 * Busca informações da loja
 */
async function fetchStoreInfo(accessToken: string): Promise<{
  id: number
  name: string
  url: string
  email: string
}> {
  const response = await fetch('https://api.tiendanube.com/v1/store', {
    headers: {
      'Authentication': `bearer ${accessToken}`,
      'User-Agent': 'Tracky (contato@tracky.app)'
    }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch store info')
  }

  return response.json()
}

/**
 * Redireciona para página de configurações com erro
 */
function redirectWithError(error: string): Response {
  const errorMessage = encodeURIComponent(error)
  return new Response(null, {
    status: 302,
    headers: {
      'Location': `/settings/integrations?provider=nuvemshop&status=error&message=${errorMessage}`
    }
  })
}
