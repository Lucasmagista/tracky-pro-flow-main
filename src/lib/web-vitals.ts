/**
 * Web Vitals Monitoring
 * 
 * Este módulo monitora Core Web Vitals (LCP, INP, CLS) e envia
 * para Google Analytics para análise de performance.
 * 
 * @module lib/web-vitals
 */

import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from 'web-vitals';
import { trackEvent } from './analytics';

/**
 * Callback para métricas de Web Vitals
 * 
 * @param metric - Métrica capturada
 */
const sendToAnalytics = (metric: Metric): void => {
  // Envia para Google Analytics
  trackEvent('web_vitals', {
    event_category: 'Web Vitals',
    event_label: metric.name,
    value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    metric_id: metric.id,
    metric_value: metric.value,
    metric_delta: metric.delta,
    metric_rating: metric.rating,
  });

  // Log para desenvolvimento
  if (import.meta.env.DEV) {
    console.log('[Web Vitals]', {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
    });
  }
};

/**
 * Inicializa monitoramento de Web Vitals
 * Deve ser chamado no início da aplicação
 * 
 * @example
 * ```typescript
 * initWebVitals();
 * ```
 */
export const initWebVitals = (): void => {
  try {
    // Cumulative Layout Shift
    onCLS(sendToAnalytics);

    // Interaction to Next Paint (substituiu FID)
    onINP(sendToAnalytics);

    // Largest Contentful Paint
    onLCP(sendToAnalytics);

    // First Contentful Paint
    onFCP(sendToAnalytics);

    // Time to First Byte
    onTTFB(sendToAnalytics);
  } catch (error) {
    console.error('[Web Vitals] Erro ao inicializar:', error);
  }
};

/**
 * Thresholds recomendados para Web Vitals
 */
export const WEB_VITALS_THRESHOLDS = {
  LCP: {
    good: 2500,
    needsImprovement: 4000,
  },
  INP: {
    good: 200,
    needsImprovement: 500,
  },
  CLS: {
    good: 0.1,
    needsImprovement: 0.25,
  },
  FCP: {
    good: 1800,
    needsImprovement: 3000,
  },
  TTFB: {
    good: 800,
    needsImprovement: 1800,
  },
};

/**
 * Avalia rating de uma métrica
 * 
 * @param name - Nome da métrica
 * @param value - Valor da métrica
 * @returns Rating: 'good', 'needs-improvement' ou 'poor'
 */
export const getRating = (
  name: keyof typeof WEB_VITALS_THRESHOLDS,
  value: number
): 'good' | 'needs-improvement' | 'poor' => {
  const thresholds = WEB_VITALS_THRESHOLDS[name];

  if (value <= thresholds.good) {
    return 'good';
  }

  if (value <= thresholds.needsImprovement) {
    return 'needs-improvement';
  }

  return 'poor';
};

export default {
  init: initWebVitals,
  thresholds: WEB_VITALS_THRESHOLDS,
  getRating,
};
