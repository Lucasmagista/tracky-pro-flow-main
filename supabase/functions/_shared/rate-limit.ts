/**
 * Rate Limiting Middleware para Edge Functions
 * 
 * Previne abuse e DoS attacks
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RateLimitConfig {
  windowMs: number; // Janela de tempo em ms
  max: number; // Máximo de requisições
  keyGenerator?: (req: Request) => string; // Gerador de chave customizado
  skipSuccessfulRequests?: boolean; // Não contar requisições bem-sucedidas
  skipFailedRequests?: boolean; // Não contar requisições que falharam
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (simples, para Edge Functions sem Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Middleware de rate limiting
 */
export async function rateLimit(
  req: Request,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const {
    windowMs = 60000, // 1 minuto padrão
    max = 60, // 60 requisições por minuto
    keyGenerator = defaultKeyGenerator,
  } = config;

  // Gerar chave única para o cliente
  const key = keyGenerator(req);

  // Buscar entrada atual
  let entry = rateLimitStore.get(key);
  const now = Date.now();

  // Se não existe ou expirou, criar nova
  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(key, entry);
  }

  // Incrementar contador
  entry.count++;

  // Verificar se excedeu o limite
  const allowed = entry.count <= max;
  const remaining = Math.max(0, max - entry.count);

  // Limpar entradas expiradas (garbage collection)
  if (Math.random() < 0.01) { // 1% de chance
    cleanupExpiredEntries();
  }

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
  };
}

/**
 * Gerador de chave padrão
 * Usa IP + User-Agent para identificar cliente
 */
function defaultKeyGenerator(req: Request): string {
  const ip = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || 'unknown';
  return `${ip}:${hashString(userAgent)}`;
}

/**
 * Extrai IP do cliente considerando proxies
 */
function getClientIp(req: Request): string {
  // Tentar headers de proxy primeiro
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback (pode não funcionar em Edge Functions)
  return 'unknown';
}

/**
 * Hash simples de string
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Limpa entradas expiradas do store
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Rate limit por usuário autenticado
 */
export async function rateLimitByUser(
  req: Request,
  supabaseUrl: string,
  supabaseKey: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number; userId?: string }> {
  // Extrair token JWT
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return rateLimit(req, config);
  }

  try {
    // Verificar token
    const token = authHeader.substring(7);
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return rateLimit(req, config);
    }

    // Rate limit por user_id
    const userId = data.user.id;
    const result = await rateLimit(req, {
      ...config,
      keyGenerator: () => `user:${userId}`,
    });

    return {
      ...result,
      userId,
    };
  } catch (error) {
    console.error('Error in rateLimitByUser:', error);
    return rateLimit(req, config);
  }
}

/**
 * Cria resposta HTTP para rate limit excedido
 */
export function createRateLimitResponse(resetAt: number): Response {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);

  return new Response(
    JSON.stringify({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Reset': new Date(resetAt).toISOString(),
      },
    }
  );
}

/**
 * Adiciona headers de rate limit na resposta
 */
export function addRateLimitHeaders(
  response: Response,
  result: { remaining: number; resetAt: number }
): Response {
  const newHeaders = new Headers(response.headers);
  newHeaders.set('X-RateLimit-Remaining', result.remaining.toString());
  newHeaders.set('X-RateLimit-Reset', new Date(result.resetAt).toISOString());

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Exemplo de uso em Edge Function:
 * 
 * ```typescript
 * import { rateLimit, createRateLimitResponse, addRateLimitHeaders } from './rate-limit.ts';
 * 
 * Deno.serve(async (req) => {
 *   // Rate limit: 10 req/min
 *   const rateLimitResult = await rateLimit(req, {
 *     windowMs: 60000,
 *     max: 10,
 *   });
 * 
 *   if (!rateLimitResult.allowed) {
 *     return createRateLimitResponse(rateLimitResult.resetAt);
 *   }
 * 
 *   // Processar requisição normal...
 *   const response = new Response(JSON.stringify({ success: true }), {
 *     headers: { 'Content-Type': 'application/json' },
 *   });
 * 
 *   return addRateLimitHeaders(response, rateLimitResult);
 * });
 * ```
 */

/**
 * Configurações pré-definidas
 */
export const RateLimitPresets = {
  // Strict: 10 req/min
  strict: {
    windowMs: 60000,
    max: 10,
  },
  
  // Standard: 60 req/min
  standard: {
    windowMs: 60000,
    max: 60,
  },
  
  // Relaxed: 120 req/min
  relaxed: {
    windowMs: 60000,
    max: 120,
  },
  
  // API: 100 req/5min
  api: {
    windowMs: 300000, // 5 minutos
    max: 100,
  },
  
  // Webhook: 500 req/hour
  webhook: {
    windowMs: 3600000, // 1 hora
    max: 500,
  },
  
  // Auth: 5 req/15min (login attempts)
  auth: {
    windowMs: 900000, // 15 minutos
    max: 5,
  },
};
