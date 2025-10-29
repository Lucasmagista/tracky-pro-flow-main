/**
 * Progress Indicator Components
 * 
 * Componentes para indicadores de progresso e loading
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ProgressProps {
  /**
   * Valor do progresso (0-100)
   */
  value: number;
  
  /**
   * Mostrar label com percentual
   */
  showLabel?: boolean;
  
  /**
   * Tamanho da barra
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Variante de cor
   */
  variant?: 'default' | 'success' | 'warning' | 'error';
  
  /**
   * Classes CSS adicionais
   */
  className?: string;
}

/**
 * Barra de progresso
 * 
 * @example
 * ```tsx
 * <Progress value={75} showLabel />
 * ```
 */
export const Progress: React.FC<ProgressProps> = ({
  value,
  showLabel = false,
  size = 'md',
  variant = 'default',
  className,
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const variantClasses = {
    default: 'bg-primary',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-full bg-muted',
          sizeClasses[size]
        )}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            'h-full transition-all duration-300 ease-in-out',
            variantClasses[variant]
          )}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 text-xs text-muted-foreground text-right">
          {Math.round(clampedValue)}%
        </div>
      )}
    </div>
  );
};

/**
 * Spinner de loading
 */
export const Spinner: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ size = 'md', className }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <Loader2
      className={cn('animate-spin text-muted-foreground', sizeClasses[size], className)}
      aria-label="Carregando"
    />
  );
};

/**
 * Loading overlay com spinner
 */
export const LoadingOverlay: React.FC<{
  message?: string;
  className?: string;
}> = ({ message = 'Carregando...', className }) => {
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm',
        className
      )}
      role="alert"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3 rounded-lg bg-card p-6 shadow-lg">
        <Spinner size="lg" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};

/**
 * Loading inline (versão compacta)
 */
export const LoadingInline: React.FC<{
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ message = 'Carregando...', size = 'md', className }) => {
  return (
    <div
      className={cn('flex items-center gap-2', className)}
      role="status"
      aria-live="polite"
    >
      <Spinner size={size} />
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  );
};

/**
 * Dots loading animation
 */
export const LoadingDots: React.FC<{
  className?: string;
}> = ({ className }) => {
  return (
    <div className={cn('flex items-center gap-1', className)} role="status" aria-label="Carregando">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
};

/**
 * Progress Steps (stepper)
 */
export interface Step {
  label: string;
  description?: string;
}

export interface ProgressStepsProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export const ProgressSteps: React.FC<ProgressStepsProps> = ({
  steps,
  currentStep,
  className,
}) => {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={index}>
              <div className="flex flex-col items-center gap-2">
                {/* Circle */}
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    isActive && 'border-primary bg-background text-primary',
                    !isActive && !isCompleted && 'border-muted-foreground bg-background text-muted-foreground'
                  )}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>

                {/* Label */}
                <div className="text-center">
                  <div
                    className={cn(
                      'text-sm font-medium',
                      isActive && 'text-primary',
                      !isActive && 'text-muted-foreground'
                    )}
                  >
                    {step.label}
                  </div>
                  {step.description && (
                    <div className="text-xs text-muted-foreground">{step.description}</div>
                  )}
                </div>
              </div>

              {/* Connector Line */}
              {!isLast && (
                <div
                  className={cn(
                    'h-0.5 flex-1 transition-colors',
                    isCompleted ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Circular progress (radial)
 */
export const CircularProgress: React.FC<{
  value: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
  className?: string;
}> = ({
  value,
  size = 120,
  strokeWidth = 8,
  showLabel = true,
  variant = 'default',
  className,
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedValue / 100) * circumference;

  const variantColors = {
    default: 'stroke-primary',
    success: 'stroke-green-500',
    warning: 'stroke-yellow-500',
    error: 'stroke-red-500',
  };

  return (
    <div className={cn('relative inline-flex', className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={cn('transition-all duration-300', variantColors[variant])}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-semibold">{Math.round(clampedValue)}%</span>
        </div>
      )}
    </div>
  );
};

export {
  Progress as default,
};
