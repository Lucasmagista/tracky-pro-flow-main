/**
 * Accessibility Utilities
 * 
 * Utilitários para melhorar a acessibilidade da aplicação
 * 
 * @module lib/accessibility
 */

/**
 * Gera ID único para aria-describedby e aria-labelledby
 * 
 * @param prefix - Prefixo do ID
 * @returns ID único
 * 
 * @example
 * ```typescript
 * const errorId = generateAriaId('error');
 * // 'error-abc123'
 * ```
 */
export function generateAriaId(prefix: string = 'aria'): string {
  const randomId = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${randomId}`;
}

/**
 * Verifica se um elemento está visível na tela
 * Útil para lazy loading de imagens e componentes
 * 
 * @param element - Elemento DOM
 * @returns true se visível
 */
export function isElementVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Anuncia mensagem para leitores de tela
 * Usa ARIA live regions
 * 
 * @param message - Mensagem a ser anunciada
 * @param priority - Nível de prioridade ('polite' ou 'assertive')
 * 
 * @example
 * ```typescript
 * announceToScreenReader('Pedido criado com sucesso!', 'polite');
 * ```
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove após 1 segundo
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Configura trap de foco para modais
 * Previne navegação por tab para fora do modal
 * 
 * @param element - Elemento do modal
 * @returns Função para remover o trap
 * 
 * @example
 * ```typescript
 * const modal = document.querySelector('.modal');
 * const removeTrap = trapFocus(modal);
 * 
 * // Quando fechar o modal
 * removeTrap();
 * ```
 */
export function trapFocus(element: HTMLElement): () => void {
  const focusableElements = element.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  element.addEventListener('keydown', handleTabKey);

  // Foca no primeiro elemento
  firstElement?.focus();

  // Retorna função para remover o trap
  return () => {
    element.removeEventListener('keydown', handleTabKey);
  };
}

/**
 * Verifica contraste de cores (WCAG AA)
 * 
 * @param foreground - Cor do texto (hex)
 * @param background - Cor de fundo (hex)
 * @returns Ratio de contraste
 * 
 * @example
 * ```typescript
 * const ratio = checkColorContrast('#000000', '#FFFFFF');
 * console.log(ratio); // 21 (excelente)
 * 
 * if (ratio < 4.5) {
 *   console.warn('Contraste insuficiente para WCAG AA');
 * }
 * ```
 */
export function checkColorContrast(
  foreground: string,
  background: string
): number {
  const getLuminance = (hex: string): number => {
    // Remove # se presente
    hex = hex.replace('#', '');

    // Converte para RGB
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    // Aplica correção gamma
    const [rs, gs, bs] = [r, g, b].map((c) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    );

    // Calcula luminância relativa
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Valida se contraste atende WCAG AA
 * 
 * @param foreground - Cor do texto
 * @param background - Cor de fundo
 * @param isLargeText - Se é texto grande (18pt+ ou 14pt+ bold)
 * @returns true se atende WCAG AA
 */
export function meetsWCAGAA(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): boolean {
  const ratio = checkColorContrast(foreground, background);
  const threshold = isLargeText ? 3 : 4.5;
  return ratio >= threshold;
}

/**
 * Adiciona skip links para navegação por teclado
 * 
 * @example
 * ```typescript
 * // No início da aplicação
 * addSkipLinks();
 * ```
 */
export function addSkipLinks(): void {
  const skipLinks = document.createElement('div');
  skipLinks.className = 'skip-links';
  skipLinks.innerHTML = `
    <a href="#main-content" class="skip-link">
      Pular para o conteúdo principal
    </a>
    <a href="#navigation" class="skip-link">
      Pular para a navegação
    </a>
  `;

  document.body.insertBefore(skipLinks, document.body.firstChild);
}

/**
 * Hook React para gerenciar foco
 * 
 * @param elementRef - Ref do elemento
 * @param shouldFocus - Se deve focar
 * 
 * @example
 * ```tsx
 * function Modal({ isOpen }) {
 *   const modalRef = useRef<HTMLDivElement>(null);
 *   useFocusManagement(modalRef, isOpen);
 *   
 *   return <div ref={modalRef}>...</div>;
 * }
 * ```
 */
export function useFocusManagement(
  elementRef: React.RefObject<HTMLElement>,
  shouldFocus: boolean
): void {
  React.useEffect(() => {
    if (shouldFocus && elementRef.current) {
      const previouslyFocused = document.activeElement as HTMLElement;
      elementRef.current.focus();

      return () => {
        previouslyFocused?.focus();
      };
    }
  }, [shouldFocus, elementRef]);
}

/**
 * Hook para trap de foco em modais
 * 
 * @param isOpen - Se o modal está aberto
 * 
 * @example
 * ```tsx
 * function Modal({ isOpen, onClose }) {
 *   const modalRef = useFocusTrap(isOpen);
 *   
 *   return (
 *     <div ref={modalRef}>
 *       <button onClick={onClose}>Fechar</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFocusTrap(isOpen: boolean): React.RefObject<HTMLDivElement> {
  const elementRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen || !elementRef.current) return;

    const removeTrap = trapFocus(elementRef.current);
    return removeTrap;
  }, [isOpen]);

  return elementRef;
}

/**
 * Hook para anúncios em leitores de tela
 * 
 * @returns Função para fazer anúncios
 * 
 * @example
 * ```tsx
 * function OrderForm() {
 *   const announce = useScreenReaderAnnouncement();
 *   
 *   const handleSubmit = async () => {
 *     await saveOrder();
 *     announce('Pedido salvo com sucesso!');
 *   };
 * }
 * ```
 */
export function useScreenReaderAnnouncement(): (
  message: string,
  priority?: 'polite' | 'assertive'
) => void {
  return React.useCallback(
    (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      announceToScreenReader(message, priority);
    },
    []
  );
}

/**
 * Hook para gerenciar estados de loading acessíveis
 * 
 * @param isLoading - Se está carregando
 * @returns Props ARIA para o elemento
 * 
 * @example
 * ```tsx
 * function LoadingButton({ onClick, isLoading }) {
 *   const ariaProps = useAccessibleLoading(isLoading);
 *   
 *   return (
 *     <button onClick={onClick} {...ariaProps}>
 *       {isLoading ? 'Carregando...' : 'Enviar'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useAccessibleLoading(isLoading: boolean): {
  'aria-busy': boolean;
  'aria-live': 'polite';
} {
  return {
    'aria-busy': isLoading,
    'aria-live': 'polite',
  };
}

/**
 * Adiciona estilos CSS para classes de acessibilidade
 * 
 * @example
 * ```typescript
 * // No início da aplicação
 * injectAccessibilityStyles();
 * ```
 */
export function injectAccessibilityStyles(): void {
  const styles = `
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
    }

    .skip-links {
      position: fixed;
      top: 0;
      left: 0;
      z-index: 9999;
    }

    .skip-link {
      position: absolute;
      left: -9999px;
      top: 0;
      padding: 1rem;
      background: var(--primary);
      color: var(--primary-foreground);
      text-decoration: none;
      font-weight: 600;
      border-radius: 0 0 0.5rem 0;
    }

    .skip-link:focus {
      left: 0;
    }

    *:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }

    button:focus-visible,
    a:focus-visible,
    input:focus-visible,
    select:focus-visible,
    textarea:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }
  `;

  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

// Import React
import * as React from 'react';

/**
 * Exporta todas as funções e hooks
 */
export const a11y = {
  generateAriaId,
  isElementVisible,
  announce: announceToScreenReader,
  trapFocus,
  checkColorContrast,
  meetsWCAGAA,
  addSkipLinks,
  injectAccessibilityStyles,
};

export default a11y;
