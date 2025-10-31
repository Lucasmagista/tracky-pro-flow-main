import { useState, useCallback } from 'react';

export interface IncrementalImportConfig {
  enabled: boolean;
  strategy: 'merge' | 'replace' | 'append';
  conflictResolution: 'newer_wins' | 'source_wins' | 'target_wins' | 'manual';
  keyFields: string[]; // Campos que identificam registros únicos
  lastSyncTimestamp?: string;
  syncDirection: 'unidirectional' | 'bidirectional';
}

export type ManualResolutionData = Record<string, string | number | boolean | null | string[] | Record<string, string | number | boolean | null>> & {
  _conflicted_fields?: string[];
  _source_values?: Record<string, string | number | boolean | null>;
};

export interface SyncRecord {
  id: string;
  sourceData: Record<string, string | number | boolean | null>;
  targetData: Record<string, string | number | boolean | null>;
  conflictType: 'new' | 'modified' | 'deleted' | 'conflict';
  resolution?: 'source' | 'target' | 'merged' | 'skip';
  lastModified: string;
  manualResolutionData?: ManualResolutionData;
}

export interface IncrementalImportResult {
  summary: {
    totalRecords: number;
    newRecords: number;
    updatedRecords: number;
    deletedRecords: number;
    conflictedRecords: number;
    skippedRecords: number;
  };
  records: SyncRecord[];
  conflicts: SyncRecord[];
  appliedChanges: SyncRecord[];
  errors: string[];
}

export interface SyncOperation {
  type: 'insert' | 'update' | 'delete';
  recordId: string;
  data: Record<string, string | number | boolean | null>;
  timestamp: string;
}

export const useIncrementalImport = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [config, setConfig] = useState<IncrementalImportConfig>({
    enabled: false,
    strategy: 'merge',
    conflictResolution: 'newer_wins',
    keyFields: ['tracking_code'],
    syncDirection: 'unidirectional'
  });

  const generateRecordId = useCallback((record: Record<string, string | number | boolean | null>, keyFields: string[]): string => {
    // Gerar ID único baseado nos campos chave
    const keyValues = keyFields.map(field => record[field] || '').join('|');
    return btoa(keyValues).replace(/[^A-Za-z0-9]/g, '').substr(0, 32);
  }, []);

  const compareRecords = useCallback((
    sourceRecord: Record<string, string | number | boolean | null>,
    targetRecord: Record<string, string | number | boolean | null>,
    keyFields: string[]
  ): { hasChanges: boolean; changedFields: string[] } => {
    const changedFields: string[] = [];

    // Comparar todos os campos exceto os campos chave e timestamps
    Object.keys(sourceRecord).forEach(field => {
      if (!keyFields.includes(field) && field !== 'updated_at' && field !== 'created_at') {
        const sourceValue = String(sourceRecord[field] || '').trim();
        const targetValue = String(targetRecord[field] || '').trim();

        if (sourceValue !== targetValue) {
          changedFields.push(field);
        }
      }
    });

    return {
      hasChanges: changedFields.length > 0,
      changedFields
    };
  }, []);

  const resolveConflict = useCallback((
    sourceRecord: Record<string, string | number | boolean | null>,
    targetRecord: Record<string, string | number | boolean | null>,
    strategy: string
  ): Record<string, string | number | boolean | null | string[] | Record<string, string | number | boolean | null>> => {
    switch (strategy) {
      case 'source_wins':
        return { ...targetRecord, ...sourceRecord };

      case 'target_wins':
        return targetRecord;

      case 'newer_wins': {
        const sourceTime = new Date(String(sourceRecord.updated_at || sourceRecord.created_at || 0));
        const targetTime = new Date(String(targetRecord.updated_at || targetRecord.created_at || 0));
        return sourceTime > targetTime ? { ...targetRecord, ...sourceRecord } : targetRecord;
      }

      case 'manual':
      default:
        // Para resolução manual, manter ambos os registros para decisão posterior
        return {
          ...targetRecord,
          _conflicted_fields: Object.keys(sourceRecord).filter(key =>
            sourceRecord[key] !== targetRecord[key]
          ),
          _source_values: sourceRecord
        };
    }
  }, []);

  const performIncrementalImport = useCallback(async (
    sourceData: Record<string, string | number | boolean | null>[],
    targetData: Record<string, string | number | boolean | null>[],
    importConfig?: Partial<IncrementalImportConfig>
  ): Promise<IncrementalImportResult> => {
    setIsImporting(true);

    try {
      const activeConfig = { ...config, ...importConfig };
      const records: SyncRecord[] = [];
      const conflicts: SyncRecord[] = [];
      const appliedChanges: SyncRecord[] = [];

      let newRecords = 0;
      let updatedRecords = 0;
      const deletedRecords = 0; // Será usado em futuras implementações
      let conflictedRecords = 0;
      let skippedRecords = 0;

      const errors: string[] = [];

      // Criar mapa de registros existentes por ID
      const targetMap = new Map<string, Record<string, string | number | boolean | null>>();
      targetData.forEach(record => {
        const id = generateRecordId(record, activeConfig.keyFields);
        targetMap.set(id, record);
      });

      // Criar mapa de registros fonte por ID
      const sourceMap = new Map<string, Record<string, string | number | boolean | null>>();
      sourceData.forEach(record => {
        const id = generateRecordId(record, activeConfig.keyFields);
        sourceMap.set(id, record);
      });

      // Processar registros fonte
      for (const [recordId, sourceRecord] of sourceMap) {
        const targetRecord = targetMap.get(recordId);
        const lastModified = new Date().toISOString();

        if (!targetRecord) {
          // Novo registro
          const syncRecord: SyncRecord = {
            id: recordId,
            sourceData: sourceRecord,
            targetData: {},
            conflictType: 'new',
            lastModified
          };

          records.push(syncRecord);

          if (activeConfig.strategy !== 'replace') {
            appliedChanges.push({ ...syncRecord, resolution: 'source' });
            newRecords++;
          } else {
            skippedRecords++;
          }
        } else {
          // Registro existente - verificar mudanças
          const comparison = compareRecords(sourceRecord, targetRecord, activeConfig.keyFields);

          if (comparison.hasChanges) {
            const syncRecord: SyncRecord = {
              id: recordId,
              sourceData: sourceRecord,
              targetData: targetRecord,
              conflictType: 'modified',
              lastModified
            };

            records.push(syncRecord);

            // Resolver conflito baseado na estratégia
            if (activeConfig.conflictResolution === 'manual') {
              const resolvedData = resolveConflict(sourceRecord, targetRecord, activeConfig.conflictResolution);
              conflicts.push({ ...syncRecord, manualResolutionData: resolvedData });
              conflictedRecords++;
            } else {
              const resolvedData = resolveConflict(sourceRecord, targetRecord, activeConfig.conflictResolution);
              appliedChanges.push({
                ...syncRecord,
                resolution: 'merged',
                sourceData: resolvedData as Record<string, string | number | boolean | null>
              });
              updatedRecords++;
            }
          } else {
            // Sem mudanças
            skippedRecords++;
          }
        }
      }

      // Verificar registros deletados (apenas se estratégia for merge)
      if (activeConfig.strategy === 'merge') {
        for (const [recordId, targetRecord] of targetMap) {
          if (!sourceMap.has(recordId)) {
            const syncRecord: SyncRecord = {
              id: recordId,
              sourceData: {},
              targetData: targetRecord,
              conflictType: 'deleted',
              lastModified: new Date().toISOString()
            };

            records.push(syncRecord);

            if (activeConfig.syncDirection === 'bidirectional') {
              // Em sincronização bidirecional, perguntar se deve deletar
              conflicts.push(syncRecord);
              conflictedRecords++;
            } else {
              // Em sincronização unidirecional, manter registros existentes
              skippedRecords++;
            }
          }
        }
      }

      return {
        summary: {
          totalRecords: sourceData.length,
          newRecords,
          updatedRecords,
          deletedRecords,
          conflictedRecords,
          skippedRecords
        },
        records,
        conflicts,
        appliedChanges,
        errors
      };
    } catch (error) {
      console.error('Erro na importação incremental:', error);
      return {
        summary: {
          totalRecords: sourceData.length,
          newRecords: 0,
          updatedRecords: 0,
          deletedRecords: 0,
          conflictedRecords: 0,
          skippedRecords: sourceData.length
        },
        records: [],
        conflicts: [],
        appliedChanges: [],
        errors: [`Erro na importação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]
      };
    } finally {
      setIsImporting(false);
    }
  }, [config, generateRecordId, compareRecords, resolveConflict]);

  const applySyncOperations = useCallback(async (
    operations: SyncOperation[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<{ success: boolean; errors: string[] }> => {
    const errors: string[] = [];

    try {
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];

        try {
          // Aqui seria implementada a lógica real de aplicação das operações
          // Por exemplo, chamadas para APIs, updates no banco, etc.
          console.log(`Aplicando operação ${operation.type} para registro ${operation.recordId}`);

          // Simular delay de processamento
          await new Promise(resolve => setTimeout(resolve, 10));

        } catch (error) {
          errors.push(`Erro ao aplicar ${operation.type} no registro ${operation.recordId}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }

        // Reportar progresso
        if (onProgress) {
          onProgress(i + 1, operations.length);
        }
      }

      return {
        success: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Erro geral na aplicação das operações: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]
      };
    }
  }, []);

  const updateConfig = useCallback((newConfig: Partial<IncrementalImportConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfig({
      enabled: false,
      strategy: 'merge',
      conflictResolution: 'newer_wins',
      keyFields: ['tracking_code'],
      syncDirection: 'unidirectional'
    });
  }, []);

  const validateConfig = useCallback((testConfig: IncrementalImportConfig): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!testConfig.keyFields || testConfig.keyFields.length === 0) {
      errors.push('Pelo menos um campo chave deve ser definido');
    }

    if (!['merge', 'replace', 'append'].includes(testConfig.strategy)) {
      errors.push('Estratégia de importação inválida');
    }

    if (!['newer_wins', 'source_wins', 'target_wins', 'manual'].includes(testConfig.conflictResolution)) {
      errors.push('Estratégia de resolução de conflitos inválida');
    }

    if (!['unidirectional', 'bidirectional'].includes(testConfig.syncDirection)) {
      errors.push('Direção de sincronização inválida');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, []);

  return {
    config,
    isImporting,
    performIncrementalImport,
    applySyncOperations,
    updateConfig,
    resetConfig,
    validateConfig
  };
};