import { useState, useCallback } from 'react';

export interface TrackingValidationResult {
  isValid: boolean;
  status: 'valid' | 'invalid' | 'unknown' | 'checking';
  carrier?: string;
  lastUpdate?: string;
  error?: string;
}

export interface TrackingValidationResponse {
  [trackingCode: string]: TrackingValidationResult;
}

export const useTrackingValidation = () => {
  const [isValidating, setIsValidating] = useState(false);

  // Simulação de validação de códigos de rastreio
  // Em produção, isso faria chamadas reais para APIs das transportadoras
  const validateTrackingCodes = useCallback(async (
    trackingCodes: string[],
    carriers?: string[]
  ): Promise<TrackingValidationResponse> => {
    setIsValidating(true);

    try {
      const results: TrackingValidationResponse = {};

      // Simular delay de API
      await new Promise(resolve => setTimeout(resolve, 1000));

      for (let i = 0; i < trackingCodes.length; i++) {
        const code = trackingCodes[i];
        const carrier = carriers?.[i];

        // Validações básicas por padrão de código
        let validation: TrackingValidationResult;

        if (!code || code.trim() === '') {
          validation = {
            isValid: false,
            status: 'invalid',
            error: 'Código vazio'
          };
        } else if (code.match(/^[A-Z]{2}\d{9}[A-Z]{2}$|^[A-Z]{2}\d{10}[A-Z]{2}$/)) {
          // Padrão Correios
          validation = {
            isValid: true,
            status: 'valid',
            carrier: carrier || 'Correios',
            lastUpdate: new Date().toISOString()
          };
        } else if (code.match(/^\d{12,14}$/)) {
          // Padrão Jadlog
          validation = {
            isValid: true,
            status: 'valid',
            carrier: carrier || 'Jadlog',
            lastUpdate: new Date().toISOString()
          };
        } else if (code.match(/^LG\d{9}BR$/)) {
          // Padrão Loggi
          validation = {
            isValid: true,
            status: 'valid',
            carrier: carrier || 'Loggi',
            lastUpdate: new Date().toISOString()
          };
        } else if (code.match(/^TE\d{9}BR$/)) {
          // Padrão Total Express
          validation = {
            isValid: true,
            status: 'valid',
            carrier: carrier || 'Total Express',
            lastUpdate: new Date().toISOString()
          };
        } else if (code.match(/^AC\d{9}BR$/)) {
          // Padrão Azul Cargo
          validation = {
            isValid: true,
            status: 'valid',
            carrier: carrier || 'Azul Cargo',
            lastUpdate: new Date().toISOString()
          };
        } else {
          // Código não reconhecido
          validation = {
            isValid: false,
            status: 'unknown',
            error: 'Formato não reconhecido pelas transportadoras suportadas'
          };
        }

        results[code] = validation;
      }

      return results;
    } finally {
      setIsValidating(false);
    }
  }, []);

  // Validação em lote para performance
  const validateBatch = useCallback(async (
    trackingData: Array<{ code: string; carrier?: string }>
  ): Promise<TrackingValidationResponse> => {
    const codes = trackingData.map(item => item.code);
    const carriers = trackingData.map(item => item.carrier);

    return validateTrackingCodes(codes, carriers);
  }, [validateTrackingCodes]);

  return {
    validateTrackingCodes,
    validateBatch,
    isValidating
  };
};