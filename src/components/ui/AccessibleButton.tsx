/**
 * Accessible Button Component
 * 
 * Botão com suporte completo de acessibilidade
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccessibleLoading } from '@/lib/accessibility';

export interface AccessibleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Variante visual do botão
   */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  
  /**
   * Tamanho do botão
   */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  
  /**
   * Estado de carregamento
   */
  isLoading?: boolean;
  
  /**
   * Texto alternativo para estado de loading (para leitores de tela)
   */
  loadingText?: string;
  
  /**
   * Ícone à esquerda
   */
  leftIcon?: React.ReactNode;
  
  /**
   * Ícone à direita
   */
  rightIcon?: React.ReactNode;
}

/**
 * Botão acessível com estados de loading e ícones
 * 
 * @example
 * ```tsx
 * <AccessibleButton
 *   onClick={handleSave}
 *   isLoading={isSaving}
 *   loadingText="Salvando pedido..."
 *   leftIcon={<Save />}
 * >
 *   Salvar Pedido
 * </AccessibleButton>
 * ```
 */
export const AccessibleButton = React.forwardRef<
  HTMLButtonElement,
  AccessibleButtonProps
>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const ariaProps = useAccessibleLoading(isLoading);

    const variantClasses = {
      default: 'bg-primary text-primary-foreground hover:bg-primary/90',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      ghost: 'hover:bg-accent hover:text-accent-foreground',
      link: 'text-primary underline-offset-4 hover:underline',
    };

    const sizeClasses = {
      default: 'h-10 px-4 py-2',
      sm: 'h-9 rounded-md px-3',
      lg: 'h-11 rounded-md px-8',
      icon: 'h-10 w-10',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium',
          'ring-offset-background transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        disabled={disabled || isLoading}
        aria-disabled={disabled || isLoading}
        {...ariaProps}
        {...props}
      >
        {isLoading && (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {loadingText && <span className="sr-only">{loadingText}</span>}
          </>
        )}
        
        {!isLoading && leftIcon && (
          <span aria-hidden="true">{leftIcon}</span>
        )}
        
        {children}
        
        {!isLoading && rightIcon && (
          <span aria-hidden="true">{rightIcon}</span>
        )}
      </button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';

export default AccessibleButton;
