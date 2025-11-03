import { useState, useCallback } from 'react';

/**
 * Resultado de validação individual
 */
export interface ValidationResult {
  id: string;
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
  data?: Record<string, unknown>;
}

/**
 * Opções para validação em chunks
 */
export interface ChunkValidationOptions<T> {
  data: T[];
  chunkSize: number;
  validator: (chunk: T[], chunkIndex: number) => Promise<ValidationResult[]>;
  onProgress?: (current: number, total: number, percentage: number) => void;
  signal?: AbortSignal;
  delayBetweenChunks?: number;
}

/**
 * Resultado completo da validação em chunks
 */
export interface ChunkValidationResult {
  success: boolean;
  results: ValidationResult[];
  totalProcessed: number;
  totalValid: number;
  totalInvalid: number;
  cancelled: boolean;
  processingTime: number;
}

/**
 * Hook para processar validações em chunks grandes de dados
 * 
 * Evita bloquear a UI processando dados em lotes menores
 * Permite cancelamento via AbortSignal
 * Reporta progresso durante o processamento
 * 
 * @example
 * const { validateInChunks, progress, isProcessing } = useChunkedValidation();
 * 
 * const results = await validateInChunks({
 *   data: allOrders,
 *   chunkSize: 100,
 *   validator: async (chunk) => {
 *     return await validateOrdersChunk(chunk);
 *   },
 *   onProgress: (current, total, percentage) => {
 *     console.log(`${percentage}% - ${current}/${total}`);
 *   },
 *   signal: abortController.signal
 * });
 */
export function useChunkedValidation() {
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);

  /**
   * Valida dados em chunks para evitar bloquear a UI
   */
  const validateInChunks = useCallback(async <T,>(
    options: ChunkValidationOptions<T>
  ): Promise<ChunkValidationResult> => {
    const {
      data,
      chunkSize,
      validator,
      onProgress,
      signal,
      delayBetweenChunks = 10
    } = options;

    const startTime = Date.now();
    const results: ValidationResult[] = [];
    const totalChunksCount = Math.ceil(data.length / chunkSize);
    let cancelled = false;

    setIsProcessing(true);
    setTotalChunks(totalChunksCount);
    setProgress(0);
    setCurrentChunk(0);

    try {
      for (let i = 0; i < data.length; i += chunkSize) {
        // ✅ Verificar cancelamento
        if (signal?.aborted) {
          console.log('[ChunkedValidation] Processamento cancelado');
          cancelled = true;
          break;
        }

        const chunkIndex = Math.floor(i / chunkSize);
        const chunk = data.slice(i, i + chunkSize);
        
        setCurrentChunk(chunkIndex + 1);

        try {
          // Executar validação do chunk
          const chunkResults = await validator(chunk, chunkIndex);
          results.push(...chunkResults);

          // ✅ Atualizar progresso
          const processedCount = Math.min(i + chunkSize, data.length);
          const percentage = Math.min(100, Math.round((processedCount / data.length) * 100));
          
          setProgress(percentage);
          onProgress?.(processedCount, data.length, percentage);

        } catch (error) {
          console.error(`[ChunkedValidation] Erro no chunk ${chunkIndex}:`, error);
          
          // Adicionar resultados de erro para o chunk
          chunk.forEach((_, idx) => {
            results.push({
              id: `chunk-${chunkIndex}-item-${idx}`,
              isValid: false,
              errors: [error instanceof Error ? error.message : 'Erro desconhecido no processamento']
            });
          });
        }

        // ✅ Pequeno delay para não bloquear a UI
        if (i + chunkSize < data.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenChunks));
        }
      }

      const processingTime = Date.now() - startTime;
      const totalValid = results.filter(r => r.isValid).length;
      const totalInvalid = results.filter(r => !r.isValid).length;

      console.log(`[ChunkedValidation] Completo: ${results.length} itens processados em ${processingTime}ms`);

      return {
        success: !cancelled && totalInvalid === 0,
        results,
        totalProcessed: results.length,
        totalValid,
        totalInvalid,
        cancelled,
        processingTime
      };

    } finally {
      setIsProcessing(false);
      setProgress(0);
      setCurrentChunk(0);
      setTotalChunks(0);
    }
  }, []);

  /**
   * Reseta o estado do hook
   */
  const reset = useCallback(() => {
    setProgress(0);
    setIsProcessing(false);
    setCurrentChunk(0);
    setTotalChunks(0);
  }, []);

  return {
    validateInChunks,
    progress,
    isProcessing,
    currentChunk,
    totalChunks,
    reset
  };
}
