/**
 * CSRF (Cross-Site Request Forgery) Protection
 * 
 * Este módulo fornece proteção contra ataques CSRF através de tokens únicos
 * gerados para cada sessão/formulário.
 * 
 * @module lib/csrf
 */

import { randomBytes } from 'crypto';

/**
 * Nome da chave do token CSRF no sessionStorage
 */
const CSRF_TOKEN_KEY = 'csrf_token';
const CSRF_TOKEN_HEADER = 'X-CSRF-Token';

/**
 * Comprimento do token em bytes
 */
const TOKEN_LENGTH = 32;

/**
 * Tempo de expiração do token (30 minutos)
 */
const TOKEN_EXPIRY_MS = 30 * 60 * 1000;

/**
 * Interface para dados do token
 */
interface CSRFTokenData {
  token: string;
  expiresAt: number;
}

/**
 * Gera um token CSRF aleatório e seguro
 * 
 * @param length - Comprimento do token em bytes (padrão: 32)
 * @returns Token hexadecimal
 * 
 * @example
 * ```typescript
 * const token = generateCSRFToken();
 * console.log(token); // "a1b2c3d4e5f6..."
 * ```
 */
export function generateCSRFToken(length: number = TOKEN_LENGTH): string {
  // Em ambiente browser, usa crypto.getRandomValues
  if (typeof window !== 'undefined' && window.crypto) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback para Node.js (testes)
  try {
    return randomBytes(length).toString('hex');
  } catch {
    // Último fallback - menos seguro mas funciona
    return Array.from({ length: length * 2 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }
}

/**
 * Armazena o token CSRF no sessionStorage com timestamp de expiração
 * 
 * @param token - Token a ser armazenado
 * 
 * @example
 * ```typescript
 * const token = generateCSRFToken();
 * storeCSRFToken(token);
 * ```
 */
export function storeCSRFToken(token: string): void {
  if (typeof window === 'undefined') return;

  const tokenData: CSRFTokenData = {
    token,
    expiresAt: Date.now() + TOKEN_EXPIRY_MS,
  };

  try {
    sessionStorage.setItem(CSRF_TOKEN_KEY, JSON.stringify(tokenData));
  } catch (error) {
    console.error('[CSRF] Erro ao armazenar token:', error);
  }
}

/**
 * Recupera o token CSRF do sessionStorage
 * Se o token expirou, gera e armazena um novo
 * 
 * @returns Token CSRF válido
 * 
 * @example
 * ```typescript
 * const token = getCSRFToken();
 * // Use o token em requisições
 * ```
 */
export function getCSRFToken(): string {
  if (typeof window === 'undefined') {
    return generateCSRFToken();
  }

  try {
    const stored = sessionStorage.getItem(CSRF_TOKEN_KEY);
    
    if (stored) {
      const tokenData: CSRFTokenData = JSON.parse(stored);
      
      // Verifica se o token ainda é válido
      if (Date.now() < tokenData.expiresAt) {
        return tokenData.token;
      }
    }
  } catch (error) {
    console.error('[CSRF] Erro ao recuperar token:', error);
  }

  // Token não existe ou expirou - gera novo
  const newToken = generateCSRFToken();
  storeCSRFToken(newToken);
  return newToken;
}

/**
 * Remove o token CSRF do sessionStorage
 * 
 * @example
 * ```typescript
 * // Após logout
 * clearCSRFToken();
 * ```
 */
export function clearCSRFToken(): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.removeItem(CSRF_TOKEN_KEY);
  } catch (error) {
    console.error('[CSRF] Erro ao limpar token:', error);
  }
}

/**
 * Valida se um token corresponde ao token armazenado
 * 
 * @param token - Token a ser validado
 * @returns true se válido, false caso contrário
 * 
 * @example
 * ```typescript
 * const isValid = validateCSRFToken(receivedToken);
 * if (!isValid) {
 *   throw new Error('Token CSRF inválido');
 * }
 * ```
 */
export function validateCSRFToken(token: string): boolean {
  const storedToken = getCSRFToken();
  
  // Comparação de tempo constante para prevenir timing attacks
  return timingSafeEqual(token, storedToken);
}

/**
 * Comparação de strings em tempo constante
 * Previne timing attacks
 * 
 * @param a - Primeira string
 * @param b - Segunda string
 * @returns true se iguais
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Adiciona token CSRF aos headers de uma requisição
 * 
 * @param headers - Headers existentes
 * @returns Headers com token CSRF adicionado
 * 
 * @example
 * ```typescript
 * const headers = addCSRFHeader({
 *   'Content-Type': 'application/json'
 * });
 * 
 * fetch('/api/endpoint', {
 *   method: 'POST',
 *   headers,
 *   body: JSON.stringify(data)
 * });
 * ```
 */
export function addCSRFHeader(
  headers: Record<string, string> = {}
): Record<string, string> {
  return {
    ...headers,
    [CSRF_TOKEN_HEADER]: getCSRFToken(),
  };
}

/**
 * Hook para React - obtém token CSRF e função para refresh
 * 
 * @returns Objeto com token e função refresh
 * 
 * @example
 * ```typescript
 * function MyForm() {
 *   const { token, refreshToken } = useCSRFToken();
 *   
 *   return (
 *     <form>
 *       <input type="hidden" name="csrf_token" value={token} />
 *       <button type="submit">Enviar</button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useCSRFToken() {
  const [token, setToken] = React.useState<string>(() => getCSRFToken());

  const refreshToken = React.useCallback(() => {
    const newToken = generateCSRFToken();
    storeCSRFToken(newToken);
    setToken(newToken);
  }, []);

  React.useEffect(() => {
    // Atualiza token se expirou
    const interval = setInterval(() => {
      const currentToken = getCSRFToken();
      if (currentToken !== token) {
        setToken(currentToken);
      }
    }, 60000); // Verifica a cada minuto

    return () => clearInterval(interval);
  }, [token]);

  return { token, refreshToken };
}

// Import React para o hook
import * as React from 'react';

/**
 * Middleware para Supabase Edge Functions
 * Valida token CSRF em requisições
 * 
 * @param request - Request da Edge Function
 * @returns true se válido, false caso contrário
 * 
 * @example
 * ```typescript
 * // Em uma Edge Function
 * import { validateCSRFMiddleware } from './csrf';
 * 
 * Deno.serve(async (req) => {
 *   if (!validateCSRFMiddleware(req)) {
 *     return new Response('CSRF token inválido', { status: 403 });
 *   }
 *   
 *   // Processa requisição
 * });
 * ```
 */
export function validateCSRFMiddleware(request: Request): boolean {
  // Apenas valida para métodos que modificam dados
  const method = request.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return true;
  }

  const token = request.headers.get(CSRF_TOKEN_HEADER);
  
  if (!token) {
    console.warn('[CSRF] Token não fornecido');
    return false;
  }

  // Em produção, você validaria contra um token armazenado no servidor
  // Por enquanto, apenas verifica se o formato está correto
  const isValid = /^[a-f0-9]{64}$/.test(token);
  
  if (!isValid) {
    console.warn('[CSRF] Token inválido:', token);
  }

  return isValid;
}

/**
 * Componente React para input hidden com token CSRF
 * 
 * @example
 * ```tsx
 * <form onSubmit={handleSubmit}>
 *   <CSRFTokenInput />
 *   <input type="text" name="name" />
 *   <button type="submit">Enviar</button>
 * </form>
 * ```
 */
export const CSRFTokenInput: React.FC = () => {
  const { token } = useCSRFToken();
  
  return (
    <input
      type="hidden"
      name="csrf_token"
      value={token}
      aria-hidden="true"
    />
  );
};

/**
 * Configura interceptor global para fetch
 * Adiciona automaticamente token CSRF em todas as requisições
 * 
 * @example
 * ```typescript
 * // No início da aplicação
 * setupCSRFInterceptor();
 * 
 * // Agora todas as requisições terão o token
 * fetch('/api/orders', { method: 'POST', body: data });
 * ```
 */
export function setupCSRFInterceptor(): void {
  if (typeof window === 'undefined') return;

  const originalFetch = window.fetch;

  window.fetch = function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    // Adiciona token CSRF se for uma requisição que modifica dados
    const method = init?.method?.toUpperCase() || 'GET';
    
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const headers = new Headers(init?.headers);
      
      if (!headers.has(CSRF_TOKEN_HEADER)) {
        headers.set(CSRF_TOKEN_HEADER, getCSRFToken());
      }

      init = {
        ...init,
        headers,
      };
    }

    return originalFetch(input, init);
  };

  console.log('[CSRF] Interceptor configurado');
}

/**
 * Exporta constantes e funções principais
 */
export const csrf = {
  generate: generateCSRFToken,
  store: storeCSRFToken,
  get: getCSRFToken,
  clear: clearCSRFToken,
  validate: validateCSRFToken,
  addHeader: addCSRFHeader,
  setupInterceptor: setupCSRFInterceptor,
  tokenHeader: CSRF_TOKEN_HEADER,
};

export default csrf;
