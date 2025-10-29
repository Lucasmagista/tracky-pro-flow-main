/**
 * Hook React para Detecção Automática de Transportadora
 * 
 * Funcionalidades:
 * - Detecção em tempo real
 * - Cache de resultados
 * - Debounce para performance
 * - Múltiplas sugestões
 * - Validação automática
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CarrierDetectionService, type DetectionResult, type DetectionOptions } from '@/services/carrierDetection';

interface UseCarrierDetectionOptions extends Omit<DetectionOptions, 'userId'> {
  debounceMs?: number; // Tempo de debounce (padrão: 300ms)
  autoDetect?: boolean; // Detectar automaticamente ao digitar
  cacheResults?: boolean; // Cachear resultados
}

interface UseCarrierDetectionReturn {
  // Estado
  results: DetectionResult[];
  bestMatch: DetectionResult | null;
  isDetecting: boolean;
  error: string | null;

  // Métodos
  detect: (code: string) => Promise<void>;
  validate: (code: string, carrierId: string) => boolean;
  suggestCorrections: (code: string) => Promise<string[]>;
  clearResults: () => void;

  // Utilitários
  getCarrierName: (code: string) => string | null;
  getCarrierIcon: (carrierId: string) => string;
  getConfidenceLabel: (confidence: number) => string;
  getConfidenceColor: (confidence: number) => string;
}

/**
 * Hook para detecção automática de transportadora
 */
export function useCarrierDetection(
  options: UseCarrierDetectionOptions = {}
): UseCarrierDetectionReturn {
  const { user } = useAuth();
  const {
    debounceMs = 300,
    autoDetect = true,
    cacheResults = true,
    ...detectionOptions
  } = options;

  // Estado
  const [results, setResults] = useState<DetectionResult[]>([]);
  const [bestMatch, setBestMatch] = useState<DetectionResult | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache de resultados
  const cacheRef = useRef<Map<string, DetectionResult[]>>(new Map());
  
  // Timer para debounce
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Detecta transportadora de um código
   */
  const detect = useCallback(async (code: string) => {
    if (!code || code.trim().length < 3) {
      setResults([]);
      setBestMatch(null);
      setError(null);
      return;
    }

    const normalizedCode = code.trim().toUpperCase();

    // Verificar cache
    if (cacheResults && cacheRef.current.has(normalizedCode)) {
      const cachedResults = cacheRef.current.get(normalizedCode)!;
      setResults(cachedResults);
      setBestMatch(cachedResults[0] || null);
      return;
    }

    setIsDetecting(true);
    setError(null);

    try {
      const detectionResults = await CarrierDetectionService.detect(normalizedCode, {
        ...detectionOptions,
        userId: user?.id,
      });

      setResults(detectionResults);
      setBestMatch(detectionResults[0] || null);

      // Salvar no cache
      if (cacheResults) {
        cacheRef.current.set(normalizedCode, detectionResults);
      }
    } catch (err) {
      console.error('Erro ao detectar transportadora:', err);
      setError('Erro ao detectar transportadora');
      setResults([]);
      setBestMatch(null);
    } finally {
      setIsDetecting(false);
    }
  }, [user, cacheResults, detectionOptions]);

  /**
   * Detecta com debounce
   */
  const detectDebounced = useCallback((code: string): Promise<void> => {
    return new Promise((resolve) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        await detect(code);
        resolve();
      }, debounceMs);
    });
  }, [detect, debounceMs]);

  /**
   * Valida se um código pertence a uma transportadora
   */
  const validate = useCallback((code: string, carrierId: string): boolean => {
    return CarrierDetectionService.validate(code, carrierId);
  }, []);

  /**
   * Sugere correções para um código
   */
  const suggestCorrections = useCallback(async (code: string): Promise<string[]> => {
    try {
      return await CarrierDetectionService.suggestCorrections(code, {
        ...detectionOptions,
        userId: user?.id,
      });
    } catch (err) {
      console.error('Erro ao sugerir correções:', err);
      return [];
    }
  }, [user, detectionOptions]);

  /**
   * Limpa resultados
   */
  const clearResults = useCallback(() => {
    setResults([]);
    setBestMatch(null);
    setError(null);
  }, []);

  /**
   * Obtém nome da transportadora de um código
   */
  const getCarrierName = useCallback((code: string): string | null => {
    const normalizedCode = code.trim().toUpperCase();
    const cached = cacheRef.current.get(normalizedCode);
    
    if (cached && cached[0]) {
      return cached[0].carrier.name;
    }

    return null;
  }, []);

  /**
   * Retorna ícone da transportadora
   */
  const getCarrierIcon = useCallback((carrierId: string): string => {
    const icons: Record<string, string> = {
      'correios': '📮',
      'jadlog': '📦',
      'total-express': '🚚',
      'loggi': '🏍️',
      'azul-cargo': '✈️',
      'fedex': '📦',
      'ups': '📦',
      'dhl': '📦',
      'usps': '📮',
      'china-post': '🇨🇳',
      'aramex': '📦',
      'tnt': '📦',
      'correios-portugal': '🇵🇹',
      'mercado-envios': '💙',
      'shopee': '🛒',
    };

    return icons[carrierId] || '📦';
  }, []);

  /**
   * Retorna label de confiança
   */
  const getConfidenceLabel = useCallback((confidence: number): string => {
    if (confidence >= 90) return 'Muito Alta';
    if (confidence >= 75) return 'Alta';
    if (confidence >= 60) return 'Média';
    if (confidence >= 40) return 'Baixa';
    return 'Muito Baixa';
  }, []);

  /**
   * Retorna cor da confiança
   */
  const getConfidenceColor = useCallback((confidence: number): string => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 75) return 'text-blue-600';
    if (confidence >= 60) return 'text-yellow-600';
    if (confidence >= 40) return 'text-orange-600';
    return 'text-red-600';
  }, []);

  // Limpar timer ao desmontar
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    // Estado
    results,
    bestMatch,
    isDetecting,
    error,

    // Métodos
    detect: autoDetect ? detectDebounced : detect,
    validate,
    suggestCorrections,
    clearResults,

    // Utilitários
    getCarrierName,
    getCarrierIcon,
    getConfidenceLabel,
    getConfidenceColor,
  };
}

/**
 * Hook simplificado para detecção única
 */
export function useCarrierDetectionSimple(trackingCode: string) {
  const detection = useCarrierDetection({
    autoDetect: true,
    maxResults: 1,
  });

  const { detect, clearResults } = detection;

  useEffect(() => {
    if (trackingCode) {
      detect(trackingCode);
    } else {
      clearResults();
    }
  }, [trackingCode, detect, clearResults]);

  return {
    carrier: detection.bestMatch?.carrier.name || null,
    carrierId: detection.bestMatch?.carrier.id || null,
    confidence: detection.bestMatch?.confidence || 0,
    isDetecting: detection.isDetecting,
  };
}
