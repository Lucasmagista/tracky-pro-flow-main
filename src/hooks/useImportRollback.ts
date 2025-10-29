/**
 * Hook para gerenciar rollback de importações
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  ImportRollbackService,
  type ImportBatch,
  type ImportRecord,
  type RollbackResult,
} from '@/services/importRollback';

export function useImportRollback() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [currentBatch, setCurrentBatch] = useState<{
    batch: ImportBatch;
    records: ImportRecord[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const { toast } = useToast();

  /**
   * Carrega a lista de batches
   */
  const loadBatches = useCallback(async (limit = 50) => {
    setIsLoading(true);
    try {
      const data = await ImportRollbackService.listBatches(limit);
      setBatches(data);
    } catch (error) {
      console.error('Erro ao carregar batches:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar histórico de importações',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  /**
   * Carrega detalhes de um batch específico
   */
  const loadBatchDetails = useCallback(async (batchId: string) => {
    setIsLoading(true);
    try {
      const data = await ImportRollbackService.getBatchDetails(batchId);
      setCurrentBatch(data);
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar detalhes da importação',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  /**
   * Executa rollback completo de um batch
   */
  const rollbackBatch = useCallback(async (batchId: string): Promise<boolean> => {
    setIsRollingBack(true);
    try {
      const result: RollbackResult = await ImportRollbackService.rollbackBatch(batchId);

      if (result.success) {
        toast({
          title: '✅ Rollback Concluído',
          description: `${result.records_deleted} registros foram removidos`,
        });

        // Recarrega os batches
        await loadBatches();
        return true;
      } else {
        toast({
          title: '⚠️ Rollback com Erros',
          description: result.errors.join(', '),
          variant: 'destructive',
        });
        return false;
      }
    } catch (error) {
      console.error('Erro no rollback:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Falha ao executar rollback',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsRollingBack(false);
    }
  }, [loadBatches, toast]);

  /**
   * Executa rollback parcial
   */
  const rollbackRecords = useCallback(async (recordIds: string[]): Promise<boolean> => {
    setIsRollingBack(true);
    try {
      const result: RollbackResult = await ImportRollbackService.rollbackRecords(recordIds);

      if (result.success) {
        toast({
          title: '✅ Rollback Parcial Concluído',
          description: `${result.records_deleted} registros foram removidos`,
        });

        // Recarrega os detalhes do batch
        if (result.batch_id) {
          await loadBatchDetails(result.batch_id);
        }
        return true;
      } else {
        toast({
          title: '⚠️ Rollback com Erros',
          description: result.errors.join(', '),
          variant: 'destructive',
        });
        return false;
      }
    } catch (error) {
      console.error('Erro no rollback parcial:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Falha ao executar rollback',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsRollingBack(false);
    }
  }, [loadBatchDetails, toast]);

  /**
   * Busca estatísticas de importação
   */
  const getStats = useCallback(async () => {
    try {
      return await ImportRollbackService.getImportStats();
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar estatísticas',
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  /**
   * Limpa batches antigos
   */
  const cleanupOldBatches = useCallback(async (daysToKeep = 90) => {
    try {
      const count = await ImportRollbackService.cleanupOldBatches(daysToKeep);
      toast({
        title: '🗑️ Limpeza Concluída',
        description: `${count} batches antigos foram removidos`,
      });
      await loadBatches();
      return count;
    } catch (error) {
      console.error('Erro na limpeza:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao limpar batches antigos',
        variant: 'destructive',
      });
      return 0;
    }
  }, [loadBatches, toast]);

  return {
    batches,
    currentBatch,
    isLoading,
    isRollingBack,
    loadBatches,
    loadBatchDetails,
    rollbackBatch,
    rollbackRecords,
    getStats,
    cleanupOldBatches,
  };
}
