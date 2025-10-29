/**
 * CSRF Token Input Component
 * 
 * Componente React para campo hidden com token CSRF
 */

import React from 'react';
import { useCSRFToken } from '@/lib/csrf';

/**
 * Componente para input hidden com token CSRF
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

export default CSRFTokenInput;
