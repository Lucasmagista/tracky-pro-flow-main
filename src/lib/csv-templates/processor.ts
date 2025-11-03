/**
 * Processador Principal
 * Orquestra todo o fluxo de importação
 */

import type { ProcessingResult, ImportConfig } from './types';
import { detectPlatform } from './detector';
import { processCSV, extractStats } from './normalizer';
import { validateOrders } from './validator';
import { parseCSVFile } from '../../utils/csvParser';

/**
 * Processa arquivo CSV completo
 * Fluxo: Detectar → Normalizar → Validar → Preview
 */
export async function processImport(
  file: File,
  config?: ImportConfig
): Promise<ProcessingResult> {
  try {
    // 1. Parse do CSV
    const parseResult = await parseCSVFile(file, {
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
    });
    
    // Verificar se houve erros críticos ou dados vazios
    if (!parseResult.data || parseResult.data.length === 0 || parseResult.errors.length > 0) {
      const errorMessage = parseResult.errors.length > 0
        ? parseResult.errors[0].message
        : 'Arquivo CSV vazio ou inválido';
      
      return {
        success: false,
        detection: {
          platform: 'unknown',
          confidence: 0,
          matchedHeaders: [],
          suggestions: ['Erro ao ler arquivo CSV'],
        },
        orders: [],
        validation: {
          valid: false,
          errors: [{
            row: 0,
            field: 'file',
            value: null,
            message: errorMessage,
            severity: 'error',
          }],
          warnings: [],
          fixedRows: 0,
          totalRows: 0,
          stats: {
            validOrders: 0,
            invalidOrders: 0,
            multiProductOrders: 0,
          },
        },
        preview: [],
      };
    }
    
    const csvData = parseResult.data;
    
    // 2. Detectar plataforma
    const headers = parseResult.meta?.fields || Object.keys(csvData[0] || {});
    const detection = config?.customTemplate
      ? {
          platform: config.customTemplate.platform,
          confidence: 100,
          matchedHeaders: headers,
          template: config.customTemplate,
        }
      : detectPlatform(headers);
    
    if (!detection.template) {
      return {
        success: false,
        detection,
        orders: [],
        validation: {
          valid: false,
          errors: [{
            row: 0,
            field: 'platform',
            value: null,
            message: 'Formato de CSV não reconhecido. Configure o mapeamento manualmente.',
            severity: 'error',
          }],
          warnings: [],
          fixedRows: 0,
          totalRows: 0,
          stats: {
            validOrders: 0,
            invalidOrders: 0,
            multiProductOrders: 0,
          },
        },
        preview: [],
      };
    }
    
    // 3. Processar e normalizar dados
    let orders = processCSV(csvData, detection.template);
    
    // 4. Aplicar filtros se configurados
    if (config?.dateRange) {
      const { from, to } = config.dateRange;
      orders = orders.filter(order => {
        const orderDate = new Date(order.order_date);
        return orderDate >= new Date(from) && orderDate <= new Date(to);
      });
    }
    
    if (config?.statusFilter && config.statusFilter.length > 0) {
      orders = orders.filter(order => 
        config.statusFilter!.includes(order.shipping_status)
      );
    }
    
    // 5. Validar pedidos
    const validation = validateOrders(orders, config?.autoFix ?? true);
    
    // 6. Gerar preview (primeiras 5 linhas)
    const preview = orders.slice(0, 5);
    
    // 7. Adicionar estatísticas ao resultado
    const stats = extractStats(orders);
    
    return {
      success: validation.errors.length === 0,
      detection,
      orders,
      validation: {
        ...validation,
        stats: {
          ...validation.stats,
          ...stats,
        },
      },
      preview,
    };
  } catch (error) {
    console.error('Erro ao processar importação:', error);
    
    return {
      success: false,
      detection: {
        platform: 'unknown',
        confidence: 0,
        matchedHeaders: [],
        suggestions: ['Erro inesperado ao processar arquivo'],
      },
      orders: [],
      validation: {
        valid: false,
        errors: [{
          row: 0,
          field: 'system',
          value: null,
          message: error instanceof Error ? error.message : 'Erro desconhecido',
          severity: 'error',
        }],
        warnings: [],
        fixedRows: 0,
        totalRows: 0,
        stats: {
          validOrders: 0,
          invalidOrders: 0,
          multiProductOrders: 0,
        },
      },
      preview: [],
    };
  }
}

/**
 * Valida se arquivo é CSV válido
 */
export function isValidCSVFile(file: File): boolean {
  const validExtensions = ['.csv', '.txt'];
  const validMimeTypes = ['text/csv', 'text/plain', 'application/csv'];
  
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  const isValidExtension = validExtensions.includes(extension);
  const isValidMimeType = validMimeTypes.includes(file.type);
  
  return isValidExtension || isValidMimeType;
}

/**
 * Formata tamanho de arquivo para exibição
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
