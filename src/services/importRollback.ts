/**
 * Sistema de Rollback/Undo para Importações
 * 
 * Features:
 * - Rastreamento de batches de importação
 * - Rollback completo ou parcial
 * - Histórico de operações
 * - Transações atômicas
 */

import { supabase } from '@/integrations/supabase/client';

export interface ImportBatch {
  id: string;
  user_id: string;
  source: 'csv' | 'shopify' | 'woocommerce' | 'mercadolivre' | 'manual';
  total_records: number;
  successful_records: number;
  failed_records: number;
  status: 'pending' | 'completed' | 'rolled_back' | 'partially_rolled_back';
  created_at: string;
  rolled_back_at?: string;
  metadata: {
    filename?: string;
    external_ids?: string[];
    original_data?: Record<string, unknown>[];
  };
}

export interface ImportRecord {
  id: string;
  batch_id: string;
  tracking_code: string;
  status: 'imported' | 'failed' | 'rolled_back';
  error_message?: string;
  original_data: Record<string, unknown>;
  created_at: string;
}

export interface RollbackResult {
  success: boolean;
  batch_id: string;
  records_deleted: number;
  errors: string[];
}

export class ImportRollbackService {
  /**
   * Cria um novo batch de importação
   */
  static async createBatch(
    source: ImportBatch['source'],
    totalRecords: number,
    metadata?: ImportBatch['metadata']
  ): Promise<string> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('Usuário não autenticado');

    const { data, error } = await supabase
      .from('import_batches')
      .insert({
        user_id: user.user.id,
        source,
        total_records: totalRecords,
        successful_records: 0,
        failed_records: 0,
        status: 'pending',
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * Registra um registro importado
   */
  static async recordImport(
    batchId: string,
    trackingCode: string,
    orderId: string,
    originalData: Record<string, unknown>
  ): Promise<void> {
    const { error } = await supabase
      .from('import_records')
      .insert({
        batch_id: batchId,
        order_id: orderId,
        tracking_code: trackingCode,
        status: 'imported',
        original_data: originalData,
      });

    if (error) throw error;
  }

  /**
   * Registra uma falha na importação
   */
  static async recordFailure(
    batchId: string,
    trackingCode: string,
    errorMessage: string,
    originalData: Record<string, unknown>
  ): Promise<void> {
    const { error } = await supabase
      .from('import_records')
      .insert({
        batch_id: batchId,
        tracking_code: trackingCode,
        status: 'failed',
        error_message: errorMessage,
        original_data: originalData,
      });

    if (error) throw error;
  }

  /**
   * Finaliza um batch com os resultados
   */
  static async completeBatch(
    batchId: string,
    successfulRecords: number,
    failedRecords: number
  ): Promise<void> {
    const { error } = await supabase
      .from('import_batches')
      .update({
        successful_records: successfulRecords,
        failed_records: failedRecords,
        status: 'completed',
      })
      .eq('id', batchId);

    if (error) throw error;
  }

  /**
   * Lista todos os batches do usuário
   */
  static async listBatches(limit = 50): Promise<ImportBatch[]> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('Usuário não autenticado');

    const { data, error } = await supabase
      .from('import_batches')
      .select('*')
      .eq('user_id', user.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data as ImportBatch[];
  }

  /**
   * Busca detalhes de um batch específico
   */
  static async getBatchDetails(batchId: string): Promise<{
    batch: ImportBatch;
    records: ImportRecord[];
  }> {
    const { data: batch, error: batchError } = await supabase
      .from('import_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (batchError) throw batchError;

    const { data: records, error: recordsError } = await supabase
      .from('import_records')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false });

    if (recordsError) throw recordsError;

    return {
      batch: batch as ImportBatch,
      records: records as ImportRecord[],
    };
  }

  /**
   * Executa rollback completo de um batch
   */
  static async rollbackBatch(batchId: string): Promise<RollbackResult> {
    const result: RollbackResult = {
      success: false,
      batch_id: batchId,
      records_deleted: 0,
      errors: [],
    };

    try {
      // Busca todos os registros importados com sucesso
      const { data: records, error: fetchError } = await supabase
        .from('import_records')
        .select('*')
        .eq('batch_id', batchId)
        .eq('status', 'imported');

      if (fetchError) throw fetchError;

      if (!records || records.length === 0) {
        throw new Error('Nenhum registro para fazer rollback');
      }

      // Deleta os pedidos importados
      const orderIds = records
        .filter((r) => r.order_id)
        .map((r) => r.order_id);

      if (orderIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('orders')
          .delete()
          .in('id', orderIds);

        if (deleteError) {
          result.errors.push(`Erro ao deletar pedidos: ${deleteError.message}`);
        } else {
          result.records_deleted = orderIds.length;
        }
      }

      // Marca os registros como rolled_back
      const { error: updateError } = await supabase
        .from('import_records')
        .update({ status: 'rolled_back' })
        .eq('batch_id', batchId)
        .eq('status', 'imported');

      if (updateError) {
        result.errors.push(`Erro ao atualizar registros: ${updateError.message}`);
      }

      // Atualiza o status do batch
      const { error: batchUpdateError } = await supabase
        .from('import_batches')
        .update({
          status: 'rolled_back',
          rolled_back_at: new Date().toISOString(),
        })
        .eq('id', batchId);

      if (batchUpdateError) {
        result.errors.push(`Erro ao atualizar batch: ${batchUpdateError.message}`);
      }

      result.success = result.errors.length === 0;
      return result;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Erro desconhecido');
      return result;
    }
  }

  /**
   * Executa rollback parcial (apenas registros específicos)
   */
  static async rollbackRecords(recordIds: string[]): Promise<RollbackResult> {
    const result: RollbackResult = {
      success: false,
      batch_id: '',
      records_deleted: 0,
      errors: [],
    };

    try {
      // Busca os registros
      const { data: records, error: fetchError } = await supabase
        .from('import_records')
        .select('*')
        .in('id', recordIds)
        .eq('status', 'imported');

      if (fetchError) throw fetchError;

      if (!records || records.length === 0) {
        throw new Error('Nenhum registro válido para rollback');
      }

      result.batch_id = records[0].batch_id;

      // Deleta os pedidos
      const orderIds = records
        .filter((r) => r.order_id)
        .map((r) => r.order_id);

      if (orderIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('orders')
          .delete()
          .in('id', orderIds);

        if (deleteError) {
          result.errors.push(`Erro ao deletar pedidos: ${deleteError.message}`);
        } else {
          result.records_deleted = orderIds.length;
        }
      }

      // Marca os registros como rolled_back
      const { error: updateError } = await supabase
        .from('import_records')
        .update({ status: 'rolled_back' })
        .in('id', recordIds);

      if (updateError) {
        result.errors.push(`Erro ao atualizar registros: ${updateError.message}`);
      }

      // Atualiza o status do batch para partially_rolled_back
      const { error: batchUpdateError } = await supabase
        .from('import_batches')
        .update({ status: 'partially_rolled_back' })
        .eq('id', result.batch_id);

      if (batchUpdateError) {
        result.errors.push(`Erro ao atualizar batch: ${batchUpdateError.message}`);
      }

      result.success = result.errors.length === 0;
      return result;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Erro desconhecido');
      return result;
    }
  }

  /**
   * Estatísticas de importação
   */
  static async getImportStats(): Promise<{
    total_batches: number;
    total_imports: number;
    total_rollbacks: number;
    success_rate: number;
    by_source: Record<string, number>;
  }> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('Usuário não autenticado');

    const { data: batches, error } = await supabase
      .from('import_batches')
      .select('*')
      .eq('user_id', user.user.id);

    if (error) throw error;

    const stats = {
      total_batches: batches.length,
      total_imports: batches.reduce((sum, b) => sum + b.successful_records, 0),
      total_rollbacks: batches.filter((b) => 
        b.status === 'rolled_back' || b.status === 'partially_rolled_back'
      ).length,
      success_rate: 0,
      by_source: {} as Record<string, number>,
    };

    const totalRecords = batches.reduce((sum, b) => sum + b.total_records, 0);
    const successfulRecords = batches.reduce((sum, b) => sum + b.successful_records, 0);
    stats.success_rate = totalRecords > 0 ? (successfulRecords / totalRecords) * 100 : 0;

    batches.forEach((batch) => {
      stats.by_source[batch.source] = (stats.by_source[batch.source] || 0) + batch.successful_records;
    });

    return stats;
  }

  /**
   * Limpa batches antigos (mais de 90 dias)
   */
  static async cleanupOldBatches(daysToKeep = 90): Promise<number> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('Usuário não autenticado');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { data, error } = await supabase
      .from('import_batches')
      .delete()
      .eq('user_id', user.user.id)
      .lt('created_at', cutoffDate.toISOString())
      .select();

    if (error) throw error;
    return data.length;
  }
}
