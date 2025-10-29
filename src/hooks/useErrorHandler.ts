// Hook para tratamento de erros em componentes funcionais
export const useErrorHandler = () => {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    console.error("Error caught by useErrorHandler:", error, errorInfo);

    // TODO: Log to external service (e.g., Sentry, LogRocket)
    // You can integrate with error monitoring services here
    // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
  };
};