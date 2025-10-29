/**
 * Sentry Configuration
 * 
 * Error tracking e performance monitoring para produção
 */

import * as Sentry from '@sentry/react';
import React, { useEffect } from 'react';
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const ENVIRONMENT = import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development';
const IS_PRODUCTION = ENVIRONMENT === 'production';

/**
 * Inicializa Sentry
 * Só ativa em produção se DSN estiver configurado
 */
export function initSentry() {
  // Não inicializar em desenvolvimento sem DSN
  if (!SENTRY_DSN) {
    console.warn('Sentry DSN não configurado. Error tracking desabilitado.');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    
    // Integrations
    integrations: [
      // Performance monitoring com React Router v6
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      
      // Replay sessions (opcional, mas muito útil)
      Sentry.replayIntegration({
        maskAllText: true, // Máscara de texto para privacidade
        blockAllMedia: true, // Bloquear imagens/vídeos
      }),
    ],

    // Performance Monitoring
    tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0, // 10% em prod, 100% em dev
    
    // Session Replay
    replaysSessionSampleRate: IS_PRODUCTION ? 0.01 : 0.1, // 1% em prod, 10% em dev
    replaysOnErrorSampleRate: 1.0, // Sempre capturar quando houver erro

    // Release tracking
    release: `tracky-pro-flow@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,

    // Filtering
    beforeSend(event, hint) {
      // Filtrar erros conhecidos ou irrelevantes
      const error = hint.originalException;
      
      if (error instanceof Error) {
        // Ignorar erros de extensões do navegador
        if (error.message.includes('Extension')) {
          return null;
        }
        
        // Ignorar erros de rede conhecidos
        if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
          // Log mas não enviar para Sentry
          console.warn('Network error:', error);
          return null;
        }
      }

      return event;
    },

    // Breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Filtrar breadcrumbs sensíveis
      if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
        return null; // Não enviar console.logs
      }
      
      // Mascarar dados sensíveis em URLs
      if (breadcrumb.category === 'navigation') {
        if (breadcrumb.data?.to) {
          breadcrumb.data.to = maskSensitiveUrl(breadcrumb.data.to);
        }
      }

      return breadcrumb;
    },

    // Ignore errors comuns
    ignoreErrors: [
      // Erros de navegador
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      
      // Erros de extensões
      'chrome-extension://',
      'moz-extension://',
      
      // Erros de rede
      'NetworkError',
      'Failed to fetch',
      'Load failed',
    ],

    // Deny URLs (scripts de terceiros)
    denyUrls: [
      /extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,
    ],
  });

  console.log(`✅ Sentry inicializado (${ENVIRONMENT})`);
}

/**
 * Mascara URLs com dados sensíveis
 */
function maskSensitiveUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Mascarar tokens em query params
    if (parsed.searchParams.has('token')) {
      parsed.searchParams.set('token', '[REDACTED]');
    }
    if (parsed.searchParams.has('access_token')) {
      parsed.searchParams.set('access_token', '[REDACTED]');
    }
    if (parsed.searchParams.has('code')) {
      parsed.searchParams.set('code', '[REDACTED]');
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Captura exceção manualmente
 */
export function captureException(error: Error, context?: Record<string, unknown>) {
  if (!SENTRY_DSN) {
    console.error('Error:', error, context);
    return;
  }

  Sentry.captureException(error, {
    contexts: context ? { custom: context } : undefined,
  });
}

/**
 * Captura mensagem manualmente
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  if (!SENTRY_DSN) {
    console[level === 'error' ? 'error' : 'log'](message);
    return;
  }

  Sentry.captureMessage(message, level);
}

/**
 * Adiciona contexto de usuário
 */
export function setUser(user: { id: string; email?: string; username?: string }) {
  if (!SENTRY_DSN) return;

  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
}

/**
 * Remove contexto de usuário (logout)
 */
export function clearUser() {
  if (!SENTRY_DSN) return;
  Sentry.setUser(null);
}

/**
 * Adiciona breadcrumb customizado
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, unknown>
) {
  if (!SENTRY_DSN) return;

  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
  });
}

/**
 * Inicia transação de performance
 * Usando a nova API de spans do Sentry v10
 */
export function startTransaction(name: string, op: string) {
  if (!SENTRY_DSN) return null;

  return Sentry.startSpan({
    name,
    op,
  }, (span) => span);
}

/**
 * Adiciona tag customizada
 */
export function setTag(key: string, value: string) {
  if (!SENTRY_DSN) return;
  Sentry.setTag(key, value);
}

/**
 * Adiciona contexto extra
 */
export function setContext(key: string, context: Record<string, unknown>) {
  if (!SENTRY_DSN) return;
  Sentry.setContext(key, context);
}

/**
 * ErrorBoundary wrapper do Sentry
 */
export const SentryErrorBoundary = SENTRY_DSN 
  ? Sentry.ErrorBoundary 
  : ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children);

/**
 * Profiler wrapper do Sentry
 */
export const SentryProfiler = SENTRY_DSN
  ? Sentry.Profiler
  : ({ children }: { children: React.ReactNode; name: string }) => React.createElement(React.Fragment, null, children);

/**
 * withProfiler HOC do Sentry
 */
export const withSentryProfiler = SENTRY_DSN
  ? Sentry.withProfiler
  : <P extends object>(Component: React.ComponentType<P>) => Component;
