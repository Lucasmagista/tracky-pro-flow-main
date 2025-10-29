/// <reference types="vite/client" />

/**
 * Extensões de tipos globais
 */

// Google Analytics tipos
type GtagCommand = 'config' | 'set' | 'event' | 'js';

interface GtagConfigParams {
  send_page_view?: boolean;
  anonymize_ip?: boolean;
  [key: string]: unknown;
}

interface GtagEventParams {
  [key: string]: unknown;
}

interface Gtag {
  (command: 'config', targetId: string, config?: GtagConfigParams): void;
  (command: 'set', params: Record<string, unknown>): void;
  (command: 'event', eventName: string, params?: GtagEventParams): void;
  (command: 'js', date: Date): void;
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: Gtag;
  }
}

export {};
