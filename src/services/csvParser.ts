/**
 * Serviço robusto de parsing CSV
 * 
 * Features:
 * - Detecção automática de encoding
 * - Mapeamento inteligente de colunas
 * - Validação de dados
 * - Suporte a múltiplos delimitadores
 * - Tratamento de erros detalhado
 */

import { TrackingValidationService } from './trackingValidation';

export interface CSVColumn {
  index: number;
  name: string;
  mappedTo?: string;
  type?: 'string' | 'number' | 'date' | 'email' | 'phone' | 'tracking_code';
  required?: boolean;
  sample?: string[];
}

export interface CSVParseResult {
  success: boolean;
  data: Record<string, unknown>[];
  columns: CSVColumn[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: CSVError[];
  warnings: CSVWarning[];
  encoding?: string;
  delimiter?: string;
}

export interface CSVError {
  row: number;
  column?: string;
  message: string;
  type: 'validation' | 'format' | 'required' | 'duplicate';
}

export interface CSVWarning {
  row: number;
  column?: string;
  message: string;
  suggestion?: string;
}

export interface CSVParseOptions {
  delimiter?: string;
  encoding?: string;
  hasHeaders?: boolean;
  skipEmptyLines?: boolean;
  trimValues?: boolean;
  validateData?: boolean;
  autoDetectColumns?: boolean;
  maxRows?: number;
}

/**
 * Mapeamento de colunas conhecidas
 */
const COLUMN_MAPPINGS: Record<string, string[]> = {
  tracking_code: [
    'código',
    'codigo',
    'rastreio',
    'tracking',
    'tracking_code',
    'track',
    'código de rastreio',
    'código rastreio',
    'numero',
    'número',
  ],
  customer_name: [
    'cliente',
    'customer',
    'name',
    'nome',
    'destinatário',
    'destinatario',
    'comprador',
  ],
  customer_email: [
    'email',
    'e-mail',
    'mail',
    'correio',
    'customer_email',
  ],
  customer_phone: [
    'telefone',
    'phone',
    'tel',
    'celular',
    'whatsapp',
    'fone',
  ],
  carrier: [
    'transportadora',
    'carrier',
    'correios',
    'entrega',
    'shipping',
  ],
  destination: [
    'destino',
    'destination',
    'cidade',
    'city',
    'endereço',
    'endereco',
    'address',
  ],
  status: [
    'status',
    'estado',
    'situação',
    'situacao',
    'state',
  ],
  order_id: [
    'pedido',
    'order',
    'order_id',
    'número pedido',
    'numero pedido',
    'id',
  ],
};

/**
 * Serviço de parsing CSV
 */
export class CSVParserService {
  /**
   * Faz parse de um arquivo CSV
   */
  static async parse(
    file: File,
    options: CSVParseOptions = {}
  ): Promise<CSVParseResult> {
    const defaultOptions: CSVParseOptions = {
      delimiter: ',',
      hasHeaders: true,
      skipEmptyLines: true,
      trimValues: true,
      validateData: true,
      autoDetectColumns: true,
      maxRows: 10000,
      ...options,
    };

    try {
      // Lê o arquivo
      const text = await this.readFile(file, defaultOptions.encoding);

      // Detecta delimiter se não especificado
      const delimiter = defaultOptions.delimiter || this.detectDelimiter(text);

      // Faz parse do CSV
      const rows = this.parseCSV(text, delimiter, defaultOptions);

      if (rows.length === 0) {
        return {
          success: false,
          data: [],
          columns: [],
          totalRows: 0,
          validRows: 0,
          invalidRows: 0,
          errors: [{ row: 0, message: 'Arquivo vazio ou formato inválido', type: 'format' }],
          warnings: [],
          delimiter,
        };
      }

      // Extrai headers
      const headers = defaultOptions.hasHeaders ? rows[0] : this.generateHeaders(rows[0].length);
      const dataRows = defaultOptions.hasHeaders ? rows.slice(1) : rows;

      // Cria colunas
      const columns = this.createColumns(headers, dataRows, defaultOptions);

      // Valida e converte dados
      const { data, errors, warnings } = this.validateAndConvertData(
        dataRows,
        columns,
        defaultOptions
      );

      const validRows = data.filter((row) => {
        const rowErrors = errors.filter((e) => e.row === data.indexOf(row) + 1);
        return rowErrors.length === 0;
      }).length;

      return {
        success: errors.filter((e) => e.type !== 'validation').length === 0,
        data,
        columns,
        totalRows: dataRows.length,
        validRows,
        invalidRows: dataRows.length - validRows,
        errors,
        warnings,
        encoding: defaultOptions.encoding || 'UTF-8',
        delimiter,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        columns: [],
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        errors: [
          {
            row: 0,
            message: error instanceof Error ? error.message : 'Erro ao processar arquivo',
            type: 'format',
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Lê o arquivo como texto
   */
  private static readFile(file: File, encoding?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const text = e.target?.result as string;
        resolve(text);
      };

      reader.onerror = () => {
        reject(new Error('Erro ao ler arquivo'));
      };

      if (encoding) {
        reader.readAsText(file, encoding);
      } else {
        // Tenta detectar encoding
        const detectedEncoding = this.detectEncoding(file);
        reader.readAsText(file, detectedEncoding);
      }
    });
  }

  /**
   * Detecta o encoding do arquivo
   */
  private static detectEncoding(file: File): string {
    // Por enquanto retorna UTF-8, mas pode ser melhorado
    // com uma biblioteca de detecção de encoding
    return 'UTF-8';
  }

  /**
   * Detecta o delimiter usado no CSV
   */
  private static detectDelimiter(text: string): string {
    const delimiters = [',', ';', '\t', '|'];
    const firstLine = text.split('\n')[0];

    let bestDelimiter = ',';
    let maxCount = 0;

    for (const delimiter of delimiters) {
      const count = (firstLine.match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        bestDelimiter = delimiter;
      }
    }

    return bestDelimiter;
  }

  /**
   * Faz parse do CSV em array de arrays
   */
  private static parseCSV(
    text: string,
    delimiter: string,
    options: CSVParseOptions
  ): string[][] {
    const rows: string[][] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      if (options.skipEmptyLines && line.trim().length === 0) {
        continue;
      }

      const cells: string[] = [];
      let currentCell = '';
      let insideQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
          if (insideQuotes && nextChar === '"') {
            currentCell += '"';
            i++; // Skip next quote
          } else {
            insideQuotes = !insideQuotes;
          }
        } else if (char === delimiter && !insideQuotes) {
          cells.push(options.trimValues ? currentCell.trim() : currentCell);
          currentCell = '';
        } else {
          currentCell += char;
        }
      }

      cells.push(options.trimValues ? currentCell.trim() : currentCell);

      if (cells.some((cell) => cell.length > 0) || !options.skipEmptyLines) {
        rows.push(cells);
      }

      if (options.maxRows && rows.length >= options.maxRows) {
        break;
      }
    }

    return rows;
  }

  /**
   * Gera headers automáticos
   */
  private static generateHeaders(count: number): string[] {
    return Array.from({ length: count }, (_, i) => `Coluna ${i + 1}`);
  }

  /**
   * Cria estrutura de colunas
   */
  private static createColumns(
    headers: string[],
    dataRows: string[][],
    options: CSVParseOptions
  ): CSVColumn[] {
    const columns: CSVColumn[] = headers.map((name, index) => {
      const sample = dataRows.slice(0, 5).map((row) => row[index]).filter(Boolean);

      const column: CSVColumn = {
        index,
        name: name.trim(),
        sample,
      };

      // Auto-mapeia se ativado
      if (options.autoDetectColumns) {
        column.mappedTo = this.autoMapColumn(name, sample);
        column.type = this.detectColumnType(sample, column.mappedTo);
        column.required = ['tracking_code', 'customer_name'].includes(column.mappedTo || '');
      }

      return column;
    });

    return columns;
  }

  /**
   * Mapeia automaticamente uma coluna
   */
  private static autoMapColumn(columnName: string, sample: string[]): string | undefined {
    const normalizedName = columnName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    for (const [fieldName, patterns] of Object.entries(COLUMN_MAPPINGS)) {
      for (const pattern of patterns) {
        if (normalizedName.includes(pattern.toLowerCase())) {
          return fieldName;
        }
      }
    }

    // Tenta detectar pelo conteúdo
    if (sample.length > 0) {
      // Email
      if (sample.some((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))) {
        return 'customer_email';
      }

      // Telefone
      if (sample.some((s) => /^[\d\s()+-]{8,}$/.test(s))) {
        return 'customer_phone';
      }

      // Código de rastreio
      if (sample.some((s) => TrackingValidationService.validate(s).isValid)) {
        return 'tracking_code';
      }
    }

    return undefined;
  }

  /**
   * Detecta o tipo de uma coluna
   */
  private static detectColumnType(
    sample: string[],
    mappedTo?: string
  ): CSVColumn['type'] {
    if (!sample || sample.length === 0) return 'string';

    if (mappedTo === 'customer_email') return 'email';
    if (mappedTo === 'customer_phone') return 'phone';
    if (mappedTo === 'tracking_code') return 'tracking_code';

    // Detecta por conteúdo
    if (sample.every((s) => !isNaN(Number(s)))) return 'number';
    if (sample.every((s) => !isNaN(Date.parse(s)))) return 'date';
    if (sample.some((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))) return 'email';

    return 'string';
  }

  /**
   * Valida e converte dados
   */
  private static validateAndConvertData(
    rows: string[][],
    columns: CSVColumn[],
    options: CSVParseOptions
  ): {
    data: Record<string, unknown>[];
    errors: CSVError[];
    warnings: CSVWarning[];
  } {
    const data: Record<string, unknown>[] = [];
    const errors: CSVError[] = [];
    const warnings: CSVWarning[] = [];
    const seenTrackingCodes = new Set<string>();

    rows.forEach((row, rowIndex) => {
      const rowData: Record<string, unknown> = {};
      const rowNumber = rowIndex + 2; // +2 porque rowIndex começa em 0 e tem header

      columns.forEach((column) => {
        const value = row[column.index];

        if (!value || value.trim().length === 0) {
          if (column.required) {
            errors.push({
              row: rowNumber,
              column: column.name,
              message: `Campo obrigatório "${column.name}" está vazio`,
              type: 'required',
            });
          }
          return;
        }

        const mappedName = column.mappedTo || column.name;

        // Valida baseado no tipo
        if (options.validateData) {
          const validation = this.validateValue(value, column.type, mappedName);

          if (!validation.valid) {
            errors.push({
              row: rowNumber,
              column: column.name,
              message: validation.error || 'Valor inválido',
              type: 'validation',
            });
          }

          if (validation.warning) {
            warnings.push({
              row: rowNumber,
              column: column.name,
              message: validation.warning,
              suggestion: validation.suggestion,
            });
          }

          // Verifica duplicatas de código de rastreio
          if (mappedName === 'tracking_code' && seenTrackingCodes.has(value)) {
            errors.push({
              row: rowNumber,
              column: column.name,
              message: 'Código de rastreio duplicado',
              type: 'duplicate',
            });
          } else if (mappedName === 'tracking_code') {
            seenTrackingCodes.add(value);
          }
        }

        rowData[mappedName] = this.convertValue(value, column.type);
      });

      data.push(rowData);
    });

    return { data, errors, warnings };
  }

  /**
   * Valida um valor
   */
  private static validateValue(
    value: string,
    type?: CSVColumn['type'],
    fieldName?: string
  ): { valid: boolean; error?: string; warning?: string; suggestion?: string } {
    switch (type) {
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return { valid: false, error: 'Email inválido' };
        }
        break;

      case 'phone': {
        const cleanPhone = value.replace(/\D/g, '');
        if (cleanPhone.length < 8 || cleanPhone.length > 15) {
          return { valid: false, error: 'Telefone inválido' };
        }
        break;
      }

      case 'tracking_code': {
        const validation = TrackingValidationService.validate(value);
        if (!validation.isValid) {
          return {
            valid: validation.errors.length === 0,
            warning: validation.errors[0] || 'Código de rastreio com problemas',
            suggestion: validation.correctedCode,
          };
        }
        if (validation.warnings.length > 0) {
          return {
            valid: true,
            warning: validation.warnings[0],
            suggestion: validation.correctedCode,
          };
        }
        break;
      }

      case 'number':
        if (isNaN(Number(value))) {
          return { valid: false, error: 'Não é um número válido' };
        }
        break;

      case 'date':
        if (isNaN(Date.parse(value))) {
          return { valid: false, error: 'Data inválida' };
        }
        break;
    }

    return { valid: true };
  }

  /**
   * Converte um valor para o tipo apropriado
   */
  private static convertValue(value: string, type?: CSVColumn['type']): unknown {
    if (!value) return null;

    switch (type) {
      case 'number':
        return Number(value);
      case 'date':
        return new Date(value);
      case 'phone':
        return value.replace(/\D/g, '');
      default:
        return value;
    }
  }

  /**
   * Exporta template CSV
   */
  static generateTemplate(): string {
    const headers = [
      'Código de Rastreio',
      'Cliente',
      'Email',
      'Telefone',
      'Transportadora',
      'Destino',
      'Status',
    ];

    const examples = [
      'AA123456789BR',
      'João Silva',
      'joao@email.com',
      '(11) 98765-4321',
      'Correios',
      'São Paulo - SP',
      'em_transito',
    ];

    return `${headers.join(',')}\n${examples.join(',')}`;
  }

  /**
   * Download do template
   */
  static downloadTemplate(): void {
    const csv = this.generateTemplate();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', 'template-importacao-pedidos.csv');
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
