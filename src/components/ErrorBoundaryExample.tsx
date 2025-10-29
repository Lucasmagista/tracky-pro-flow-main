/**
 * Exemplo de uso do Sentry Error Boundary
 * 
 * Este componente demonstra como usar o Error Boundary do Sentry
 * para capturar e exibir erros de forma elegante
 */

import { SentryErrorBoundary } from '@/lib/sentry';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Componente de fallback para erros
 * Exibido quando ocorre um erro dentro do Error Boundary
 */
interface ErrorFallbackProps {
  error: Error;
  componentStack: string;
  eventId: string;
  resetError: () => void;
}

function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="max-w-md w-full space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Ops! Algo deu errado</AlertTitle>
          <AlertDescription>
            Encontramos um erro inesperado. Nossa equipe foi notificada e
            estamos trabalhando para resolver o problema.
          </AlertDescription>
        </Alert>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-sm text-gray-700 mb-2">
            Detalhes do erro:
          </h3>
          <pre className="text-xs text-gray-600 overflow-x-auto bg-gray-50 p-2 rounded">
            {error.message}
          </pre>
        </div>

        <div className="flex gap-2">
          <Button onClick={resetError} className="flex-1">
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
          <Button
            onClick={() => window.location.href = '/'}
            variant="outline"
            className="flex-1"
          >
            Voltar ao início
          </Button>
        </div>

        <p className="text-xs text-center text-gray-500">
          Se o problema persistir, entre em contato com o suporte
        </p>
      </div>
    </div>
  );
}

/**
 * Componente wrapper com Error Boundary
 * Use este padrão para proteger componentes críticos
 */
interface ErrorBoundaryWrapperProps {
  children: React.ReactNode;
  fallback?: (props: ErrorFallbackProps) => React.ReactElement;
}

export function ErrorBoundaryWrapper({ 
  children, 
  fallback 
}: ErrorBoundaryWrapperProps) {
  return (
    <SentryErrorBoundary
      fallback={fallback || ErrorFallback}
      showDialog={false} // Não mostrar dialog do Sentry
      onError={(error, errorInfo) => {
        // Log adicional ou ação customizada
        console.error('Error capturado pelo boundary:', error, errorInfo);
      }}
    >
      {children}
    </SentryErrorBoundary>
  );
}

/**
 * Exemplo de uso em uma página/componente
 */
export function ExampleUsage() {
  return (
    <ErrorBoundaryWrapper>
      {/* Seu componente que pode ter erros */}
      <YourComponent />
    </ErrorBoundaryWrapper>
  );
}

/**
 * Componente de exemplo (pode ter erros)
 */
function YourComponent() {
  return (
    <div>
      <h1>Meu Componente</h1>
      <p>Conteúdo seguro protegido pelo Error Boundary</p>
    </div>
  );
}
