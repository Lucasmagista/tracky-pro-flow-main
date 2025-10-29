/**
 * Google Analytics 4 Integration
 * 
 * Este módulo fornece funções para integração com Google Analytics 4,
 * incluindo tracking de páginas, eventos customizados e conversões.
 * 
 * @module lib/analytics
 */

/**
 * Configuração do Google Analytics
 */
const GA_TRACKING_ID = import.meta.env.VITE_GA_ID;

/**
 * Tipos de eventos trackáveis
 */
export type AnalyticsEventName =
  | 'page_view'
  | 'import_orders_success'
  | 'import_orders_error'
  | 'integration_connected'
  | 'integration_disconnected'
  | 'notification_sent'
  | 'notification_error'
  | 'tracking_started'
  | 'tracking_updated'
  | 'label_generated'
  | 'quote_requested'
  | 'subscription_upgraded'
  | 'feature_used'
  | 'error_occurred'
  | 'web_vitals';

/**
 * Parâmetros de eventos
 */
export interface AnalyticsEventParams {
  event_category?: string;
  event_label?: string;
  value?: number | string;
  integration_type?: string;
  error_type?: string;
  feature_name?: string;
  carrier?: string;
  notification_channel?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Verifica se o GA está habilitado e configurado
 */
export const isGAEnabled = (): boolean => {
  return !!GA_TRACKING_ID && typeof window !== 'undefined' && 'gtag' in window;
};

/**
 * Inicializa o Google Analytics
 * Deve ser chamado no início da aplicação
 * 
 * @example
 * ```typescript
 * initGA();
 * ```
 */
export const initGA = (): void => {
  if (!GA_TRACKING_ID) {
    console.warn('Google Analytics ID não configurado');
    return;
  }

  // Adiciona script do GA
  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`;
  script.async = true;
  document.head.appendChild(script);

  // Inicializa gtag
  window.dataLayer = window.dataLayer || [];
  function gtag(command: string, ...args: unknown[]) {
    window.dataLayer.push([command, ...args]);
  }
  gtag('js', new Date());
  gtag('config', GA_TRACKING_ID, {
    send_page_view: false, // Desabilita page view automático
    anonymize_ip: true, // LGPD compliance
  });

  // Expõe gtag globalmente
  window.gtag = gtag as Window['gtag'];
};

/**
 * Trackeia visualização de página
 * 
 * @param page_path - Caminho da página (ex: '/dashboard')
 * @param page_title - Título da página
 * 
 * @example
 * ```typescript
 * trackPageView('/dashboard', 'Dashboard');
 * ```
 */
export const trackPageView = (page_path: string, page_title?: string): void => {
  if (!isGAEnabled()) return;

  window.gtag('event', 'page_view', {
    page_path,
    page_title: page_title || document.title,
  });
};

/**
 * Trackeia evento customizado
 * 
 * @param eventName - Nome do evento
 * @param params - Parâmetros adicionais do evento
 * 
 * @example
 * ```typescript
 * trackEvent('import_orders_success', {
 *   integration_type: 'nuvemshop',
 *   value: 150,
 *   event_label: '150 pedidos importados'
 * });
 * ```
 */
export const trackEvent = (
  eventName: AnalyticsEventName,
  params?: AnalyticsEventParams
): void => {
  if (!isGAEnabled()) return;

  window.gtag('event', eventName, {
    ...params,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Trackeia importação de pedidos
 * 
 * @param integration - Tipo de integração
 * @param count - Quantidade de pedidos importados
 * @param success - Se a importação foi bem-sucedida
 */
export const trackOrdersImport = (
  integration: string,
  count: number,
  success: boolean
): void => {
  trackEvent(success ? 'import_orders_success' : 'import_orders_error', {
    event_category: 'Orders',
    event_label: `${integration} - ${count} pedidos`,
    integration_type: integration,
    value: count,
  });
};

/**
 * Trackeia conexão de integração
 * 
 * @param integration - Tipo de integração conectada
 */
export const trackIntegrationConnected = (integration: string): void => {
  trackEvent('integration_connected', {
    event_category: 'Integrations',
    event_label: integration,
    integration_type: integration,
  });
};

/**
 * Trackeia desconexão de integração
 * 
 * @param integration - Tipo de integração desconectada
 */
export const trackIntegrationDisconnected = (integration: string): void => {
  trackEvent('integration_disconnected', {
    event_category: 'Integrations',
    event_label: integration,
    integration_type: integration,
  });
};

/**
 * Trackeia envio de notificação
 * 
 * @param channel - Canal de notificação (email, sms, whatsapp)
 * @param count - Quantidade de notificações enviadas
 * @param success - Se o envio foi bem-sucedido
 */
export const trackNotificationSent = (
  channel: 'email' | 'sms' | 'whatsapp',
  count: number,
  success: boolean
): void => {
  trackEvent(success ? 'notification_sent' : 'notification_error', {
    event_category: 'Notifications',
    event_label: `${channel} - ${count} notificações`,
    notification_channel: channel,
    value: count,
  });
};

/**
 * Trackeia início de rastreamento
 * 
 * @param carrier - Transportadora
 */
export const trackTrackingStarted = (carrier: string): void => {
  trackEvent('tracking_started', {
    event_category: 'Tracking',
    event_label: carrier,
    carrier,
  });
};

/**
 * Trackeia geração de etiqueta
 * 
 * @param carrier - Transportadora
 * @param count - Quantidade de etiquetas geradas
 */
export const trackLabelGenerated = (carrier: string, count: number = 1): void => {
  trackEvent('label_generated', {
    event_category: 'Shipping',
    event_label: `${carrier} - ${count} etiquetas`,
    carrier,
    value: count,
  });
};

/**
 * Trackeia solicitação de cotação
 * 
 * @param carrier - Transportadora
 */
export const trackQuoteRequested = (carrier: string): void => {
  trackEvent('quote_requested', {
    event_category: 'Shipping',
    event_label: carrier,
    carrier,
  });
};

/**
 * Trackeia upgrade de assinatura
 * 
 * @param plan - Nome do plano
 */
export const trackSubscriptionUpgraded = (plan: string): void => {
  trackEvent('subscription_upgraded', {
    event_category: 'Subscription',
    event_label: plan,
    value: 1,
  });
};

/**
 * Trackeia uso de feature
 * 
 * @param featureName - Nome da feature utilizada
 */
export const trackFeatureUsed = (featureName: string): void => {
  trackEvent('feature_used', {
    event_category: 'Features',
    event_label: featureName,
    feature_name: featureName,
  });
};

/**
 * Trackeia erro
 * 
 * @param errorType - Tipo do erro
 * @param errorMessage - Mensagem de erro
 */
export const trackError = (errorType: string, errorMessage?: string): void => {
  trackEvent('error_occurred', {
    event_category: 'Errors',
    event_label: errorType,
    error_type: errorType,
    value: errorMessage,
  });
};

/**
 * Define informações do usuário
 * 
 * @param userId - ID do usuário
 * @param properties - Propriedades adicionais do usuário
 */
export const setUserProperties = (
  userId: string,
  properties?: Record<string, string | number | boolean>
): void => {
  if (!isGAEnabled()) return;

  window.gtag('set', {
    user_id: userId,
    ...properties,
  });
};

/**
 * Define dimensões customizadas
 * 
 * @param dimensions - Dimensões a serem configuradas
 */
export const setCustomDimensions = (
  dimensions: Record<string, string | number | boolean>
): void => {
  if (!isGAEnabled()) return;

  window.gtag('set', dimensions);
};

/**
 * Limpa dados do usuário (LGPD compliance)
 */
export const clearUserData = (): void => {
  if (!isGAEnabled()) return;

  window.gtag('set', {
    user_id: undefined,
  });
};

// Exporta todas as funções
export const analytics = {
  init: initGA,
  isEnabled: isGAEnabled,
  trackPageView,
  trackEvent,
  trackOrdersImport,
  trackIntegrationConnected,
  trackIntegrationDisconnected,
  trackNotificationSent,
  trackTrackingStarted,
  trackLabelGenerated,
  trackQuoteRequested,
  trackSubscriptionUpgraded,
  trackFeatureUsed,
  trackError,
  setUserProperties,
  setCustomDimensions,
  clearUserData,
};

export default analytics;
