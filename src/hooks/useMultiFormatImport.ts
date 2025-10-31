import { useState, useCallback, useMemo } from 'react';

export interface SupportedFormat {
  extension: string;
  mimeType: string;
  name: string;
  description: string;
  canRead: boolean;
  canWrite: boolean;
  parser: (file: File) => Promise<Record<string, string | number | boolean | null>[]>;
  serializer?: (data: Record<string, string | number | boolean | null>[]) => Promise<string>;
}

export interface ImportOptions {
  format: string;
  encoding?: string;
  delimiter?: string;
  hasHeaders?: boolean;
  skipRows?: number;
  sheetName?: string; // Para Excel
  tableName?: string; // Para bancos de dados
  apiEndpoint?: string; // Para APIs
  authToken?: string;
}

export interface MultiFormatImportResult {
  success: boolean;
  data: Record<string, string | number | boolean | null>[];
  metadata: {
    format: string;
    totalRows: number;
    totalColumns: number;
    headers: string[];
    detectedEncoding?: string;
    parseTime: number;
  };
  errors: string[];
  warnings: string[];
}

export interface ExportOptions {
  format: string;
  filename: string;
  encoding?: string;
  delimiter?: string;
  includeHeaders?: boolean;
  sheetName?: string;
}

// Funções de parsing e serialização fora do hook para evitar dependências circulares
const parseCSV = async (file: File, delimiter: string = ','): Promise<Record<string, string | number | boolean | null>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length === 0) {
          resolve([]);
          return;
        }

        // Detectar se tem headers
        const firstLine = lines[0];
        const columns = firstLine.split(delimiter).length;

        // Assumir que a primeira linha é header se não for numérica
        const hasHeaders = !/^\d/.test(firstLine.split(delimiter)[0]);

        const headers = hasHeaders
          ? lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''))
          : Array.from({ length: columns }, (_, i) => `col_${i + 1}`);

        const data: Record<string, string | number | boolean | null>[] = [];
        const startIndex = hasHeaders ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
          const values = lines[i].split(delimiter).map(v => v.trim().replace(/"/g, ''));
          if (values.length === headers.length) {
            const record: Record<string, string | number | boolean | null> = {};
            headers.forEach((header, index) => {
              record[header] = values[index] || null;
            });
            data.push(record);
          }
        }

        resolve(data);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Erro ao ler arquivo CSV'));
    reader.readAsText(file);
  });
};

const parseExcel = async (file: File, sheetName?: string): Promise<Record<string, string | number | boolean | null>[]> => {
  return new Promise((resolve, reject) => {
    // Simulação - em produção usaria uma biblioteca como xlsx
    reject(new Error('Parser Excel não implementado - requer biblioteca externa'));
  });
};

const parseJSON = async (file: File): Promise<Record<string, string | number | boolean | null>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);

        if (Array.isArray(data)) {
          resolve(data);
        } else if (typeof data === 'object' && data !== null) {
          // Se for um objeto único, converter para array
          resolve([data]);
        } else {
          reject(new Error('Formato JSON inválido - esperado array ou objeto'));
        }
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Erro ao ler arquivo JSON'));
    reader.readAsText(file);
  });
};

const parseXML = async (file: File): Promise<Record<string, string | number | boolean | null>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        // Simulação básica de parser XML - em produção usaria uma biblioteca adequada
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');

        const records: Record<string, string | number | boolean | null>[] = [];
        const rootElements = xmlDoc.querySelectorAll('record, item, row');

        rootElements.forEach(element => {
          const record: Record<string, string | number | boolean | null> = {};
          const childNodes = element.children;

          for (let i = 0; i < childNodes.length; i++) {
            const child = childNodes[i];
            record[child.tagName] = child.textContent || '';
          }

          records.push(record);
        });

        resolve(records);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Erro ao ler arquivo XML'));
    reader.readAsText(file);
  });
};

const serializeCSV = async (data: Record<string, string | number | boolean | null>[], delimiter: string = ','): Promise<string> => {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvLines: string[] = [];

  // Adicionar headers
  csvLines.push(headers.map(h => `"${h}"`).join(delimiter));

  // Adicionar dados
  data.forEach(record => {
    const values = headers.map(header => {
      const value = record[header] || '';
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvLines.push(values.join(delimiter));
  });

  return csvLines.join('\n');
};

const serializeExcel = async (data: Record<string, string | number | boolean | null>[]): Promise<string> => {
  // Simulação - em produção usaria uma biblioteca como xlsx
  throw new Error('Serializer Excel não implementado - requer biblioteca externa');
};

const serializeJSON = async (data: Record<string, string | number | boolean | null>[]): Promise<string> => {
  return JSON.stringify(data, null, 2);
};

const serializeXML = async (data: Record<string, string | number | boolean | null>[]): Promise<string> => {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<records>\n';

  data.forEach((record, index) => {
    xml += `  <record id="${index + 1}">\n`;
    Object.entries(record).forEach(([key, value]) => {
      xml += `    <${key}>${String(value || '').replace(/[<>&"]/g, '')}</${key}>\n`;
    });
    xml += '  </record>\n';
  });

  xml += '</records>';
  return xml;
};

export const useMultiFormatImport = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Definição dos formatos suportados
  const supportedFormats = useMemo<SupportedFormat[]>(() => [
    {
      extension: '.csv',
      mimeType: 'text/csv',
      name: 'CSV',
      description: 'Comma-Separated Values',
      canRead: true,
      canWrite: true,
      parser: parseCSV,
      serializer: serializeCSV
    },
    {
      extension: '.tsv',
      mimeType: 'text/tab-separated-values',
      name: 'TSV',
      description: 'Tab-Separated Values',
      canRead: true,
      canWrite: true,
      parser: (file) => parseCSV(file, '\t'),
      serializer: (data) => serializeCSV(data, '\t')
    },
    {
      extension: '.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      name: 'Excel',
      description: 'Microsoft Excel (XLSX)',
      canRead: true,
      canWrite: true,
      parser: parseExcel,
      serializer: serializeExcel
    },
    {
      extension: '.xls',
      mimeType: 'application/vnd.ms-excel',
      name: 'Excel 97-2003',
      description: 'Microsoft Excel (XLS)',
      canRead: true,
      canWrite: false,
      parser: parseExcel
    },
    {
      extension: '.json',
      mimeType: 'application/json',
      name: 'JSON',
      description: 'JavaScript Object Notation',
      canRead: true,
      canWrite: true,
      parser: parseJSON,
      serializer: serializeJSON
    },
    {
      extension: '.xml',
      mimeType: 'application/xml',
      name: 'XML',
      description: 'Extensible Markup Language',
      canRead: true,
      canWrite: true,
      parser: parseXML,
      serializer: serializeXML
    }
  ], []);

  const detectFormat = useCallback((file: File): SupportedFormat | null => {
    // Detectar por extensão
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    const formatByExtension = supportedFormats.find(f => f.extension === extension);
    if (formatByExtension) return formatByExtension;

    // Detectar por MIME type
    const formatByMime = supportedFormats.find(f => f.mimeType === file.type);
    if (formatByMime) return formatByMime;

    return null;
  }, [supportedFormats]);

  const importFile = useCallback(async (
    file: File,
    options: ImportOptions = { format: 'auto' }
  ): Promise<MultiFormatImportResult> => {
    setIsImporting(true);
    const startTime = Date.now();

    try {
      let format: SupportedFormat | null = null;

      if (options.format === 'auto') {
        format = detectFormat(file);
        if (!format) {
          return {
            success: false,
            data: [],
            metadata: {
              format: 'unknown',
              totalRows: 0,
              totalColumns: 0,
              headers: [],
              parseTime: Date.now() - startTime
            },
            errors: ['Formato de arquivo não suportado'],
            warnings: []
          };
        }
      } else {
        format = supportedFormats.find(f => f.extension === options.format || f.name.toLowerCase() === options.format.toLowerCase());
        if (!format) {
          return {
            success: false,
            data: [],
            metadata: {
              format: options.format,
              totalRows: 0,
              totalColumns: 0,
              headers: [],
              parseTime: Date.now() - startTime
            },
            errors: [`Formato '${options.format}' não suportado`],
            warnings: []
          };
        }
      }

      if (!format.canRead) {
        return {
          success: false,
          data: [],
          metadata: {
            format: format.name,
            totalRows: 0,
            totalColumns: 0,
            headers: [],
            parseTime: Date.now() - startTime
          },
          errors: [`Leitura não suportada para o formato ${format.name}`],
          warnings: []
        };
      }

      const data = await format.parser(file);
      const parseTime = Date.now() - startTime;

      const headers = data.length > 0 ? Object.keys(data[0]) : [];
      const totalColumns = headers.length;

      return {
        success: true,
        data,
        metadata: {
          format: format.name,
          totalRows: data.length,
          totalColumns,
          headers,
          parseTime
        },
        errors: [],
        warnings: []
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        metadata: {
          format: options.format,
          totalRows: 0,
          totalColumns: 0,
          headers: [],
          parseTime: Date.now() - startTime
        },
        errors: [`Erro ao importar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`],
        warnings: []
      };
    } finally {
      setIsImporting(false);
    }
  }, [detectFormat, supportedFormats]);

  const exportData = useCallback(async (
    data: Record<string, string | number | boolean | null>[],
    options: ExportOptions
  ): Promise<{ success: boolean; blob?: Blob; error?: string }> => {
    setIsExporting(true);

    try {
      const format = supportedFormats.find(f =>
        f.extension === options.format ||
        f.name.toLowerCase() === options.format.toLowerCase()
      );

      if (!format) {
        return { success: false, error: `Formato '${options.format}' não suportado` };
      }

      if (!format.canWrite || !format.serializer) {
        return { success: false, error: `Exportação não suportada para o formato ${format.name}` };
      }

      const content = await format.serializer(data);
      const blob = new Blob([content], { type: format.mimeType });

      return { success: true, blob };
    } catch (error) {
      return {
        success: false,
        error: `Erro ao exportar dados: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    } finally {
      setIsExporting(false);
    }
  }, [supportedFormats]);

  const validateFile = useCallback((file: File): { isValid: boolean; errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Verificar tamanho (máximo 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      errors.push(`Arquivo muito grande. Tamanho máximo: ${maxSize / (1024 * 1024)}MB`);
    }

    // Verificar formato
    const format = detectFormat(file);
    if (!format) {
      errors.push('Formato de arquivo não suportado');
    } else if (!format.canRead) {
      errors.push(`Leitura não suportada para o formato ${format.name}`);
    }

    // Avisos
    if (file.size > 10 * 1024 * 1024) {
      warnings.push('Arquivo grande pode demorar para processar');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }, [detectFormat]);

  return {
    supportedFormats,
    isImporting,
    isExporting,
    importFile,
    exportData,
    validateFile,
    detectFormat
  };
};