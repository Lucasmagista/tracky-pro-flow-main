import Papa from 'papaparse';
import chardet from 'chardet';

/**
 * Interface para resultado do parsing de CSV
 */
export interface CSVParseResult {
  data: Record<string, string>[];
  headers: string[];
  errors: Papa.ParseError[];
  meta: {
    delimiter: string;
    linebreak: string;
    encoding: string;
    aborted: boolean;
    truncated: boolean;
    fields?: string[];
  };
  stats: {
    totalRows: number;
    validRows: number;
    emptyRows: number;
    errorRows: number;
  };
}

/**
 * Opções de configuração para o parser
 */
export interface CSVParserOptions {
  delimiter?: string;           // Auto-detectar se vazio
  encoding?: string;             // Auto-detectar se vazio
  skipEmptyLines?: boolean | 'greedy';
  trimHeaders?: boolean;
  transformHeader?: (header: string) => string;
  preview?: number;              // Número de linhas para preview (0 = todas)
}

/**
 * Detecta o encoding de um arquivo
 */
export async function detectEncoding(file: File): Promise<string> {
  try {
    // Ler primeiros 64KB do arquivo para detectar encoding
    const chunk = await file.slice(0, 65536).arrayBuffer();
    const uint8Array = new Uint8Array(chunk);
    
    // chardet funciona com Uint8Array diretamente no browser
    const detected = chardet.detect(uint8Array);
    const encoding = detected ? (Array.isArray(detected) ? detected[0].name : detected) : 'UTF-8';
    
    console.log(`[CSVParser] Encoding detectado: ${encoding}`);
    
    // Normalizar para encodings suportados
    if (encoding.toLowerCase().includes('iso-8859') || encoding.toLowerCase().includes('latin')) {
      return 'ISO-8859-1';
    }
    if (encoding.toLowerCase().includes('windows-1252') || encoding.toLowerCase().includes('cp1252')) {
      return 'windows-1252';
    }
    
    return 'UTF-8';
  } catch (error) {
    console.warn('[CSVParser] Erro ao detectar encoding, usando UTF-8:', error);
    return 'UTF-8';
  }
}

/**
 * Remove BOM (Byte Order Mark) se presente
 */
function removeBOM(text: string): string {
  if (text.charCodeAt(0) === 0xFEFF) {
    console.log('[CSVParser] BOM removido');
    return text.slice(1);
  }
  return text;
}

/**
 * Normaliza quebras de linha
 */
function normalizeLineBreaks(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Remove caracteres de controle invisíveis (exceto \n e \t)
 */
function removeControlCharacters(text: string): string {
  // Remove caracteres de controle exceto \n (10) e \t (9)
  return text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Normaliza o conteúdo do CSV
 */
export function normalizeCSVContent(text: string): string {
  let normalized = removeBOM(text);
  normalized = normalizeLineBreaks(normalized);
  normalized = removeControlCharacters(normalized);
  return normalized;
}

/**
 * Lê o arquivo com o encoding correto
 */
async function readFileWithEncoding(file: File, encoding: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      resolve(text);
    };
    
    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };
    
    // Ler com encoding específico
    if (encoding === 'UTF-8') {
      reader.readAsText(file, 'UTF-8');
    } else if (encoding === 'ISO-8859-1' || encoding === 'windows-1252') {
      // Para estes encodings, ler como binary e depois decodificar
      const binaryReader = new FileReader();
      binaryReader.onload = (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Decodificar manualmente para ISO-8859-1/Windows-1252
        let text = '';
        for (let i = 0; i < uint8Array.length; i++) {
          text += String.fromCharCode(uint8Array[i]);
        }
        resolve(text);
      };
      binaryReader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      binaryReader.readAsArrayBuffer(file);
      return;
    } else {
      // Fallback para UTF-8
      reader.readAsText(file, 'UTF-8');
    }
  });
}

/**
 * Parser robusto de CSV usando PapaParse
 */
export async function parseCSVFile(
  file: File,
  options: CSVParserOptions = {}
): Promise<CSVParseResult> {
  
  console.log('[CSVParser] Iniciando parsing de arquivo:', file.name);
  
  // 1. Detectar encoding
  const encoding = options.encoding || await detectEncoding(file);
  console.log('[CSVParser] Usando encoding:', encoding);
  
  // 2. Ler arquivo com encoding correto
  let fileContent = await readFileWithEncoding(file, encoding);
  
  // 3. Normalizar conteúdo
  fileContent = normalizeCSVContent(fileContent);
  
  // 4. Configurar PapaParse
  const parseConfig: Papa.ParseConfig = {
    header: true,
    delimiter: options.delimiter || '',  // Auto-detectar se vazio
    skipEmptyLines: options.skipEmptyLines ?? 'greedy',
    transformHeader: options.transformHeader || ((h: string) => h.toLowerCase().trim()),
    dynamicTyping: false,  // Manter tudo como string
    preview: options.preview || 0  // 0 = processar tudo
  };
  
  // 5. Parsear com PapaParse
  return new Promise((resolve) => {
    Papa.parse(fileContent, {
      ...parseConfig,
      complete: (results: Papa.ParseResult<Record<string, string>>) => {
        console.log('[CSVParser] Parsing completo');
        console.log('[CSVParser] Delimitador detectado:', results.meta.delimiter);
        console.log('[CSVParser] Total de linhas:', results.data.length);
        console.log('[CSVParser] Erros:', results.errors.length);
        
        // Calcular estatísticas
        const stats = {
          totalRows: results.data.length,
          validRows: results.data.filter(row => Object.values(row).some(v => v && v.trim())).length,
          emptyRows: results.data.filter(row => !Object.values(row).some(v => v && v.trim())).length,
          errorRows: results.errors.length
        };
        
        // Filtrar linhas vazias
        const validData = results.data.filter(row => 
          Object.values(row).some(v => v && v.trim())
        );
        
        resolve({
          data: validData,
          headers: results.meta.fields || [],
          errors: results.errors,
          meta: {
            delimiter: results.meta.delimiter,
            linebreak: results.meta.linebreak,
            encoding: encoding,
            aborted: results.meta.aborted,
            truncated: results.meta.truncated,
            fields: results.meta.fields
          },
          stats
        });
      }
    });
  });
}

/**
 * Parser síncrono para texto CSV já carregado
 */
export function parseCSVText(
  text: string,
  options: CSVParserOptions = {}
): CSVParseResult {
  
  console.log('[CSVParser] Parsing de texto CSV');
  
  // Normalizar conteúdo
  const normalizedText = normalizeCSVContent(text);
  
  // Configurar PapaParse
  const parseConfig: Papa.ParseConfig = {
    header: true,
    delimiter: options.delimiter || '',
    skipEmptyLines: options.skipEmptyLines ?? 'greedy',
    transformHeader: options.transformHeader || ((h: string) => h.toLowerCase().trim()),
    dynamicTyping: false,
    preview: options.preview || 0
  };
  
  // Parsear
  const results = Papa.parse<Record<string, string>>(normalizedText, parseConfig);
  
  console.log('[CSVParser] Delimitador detectado:', results.meta.delimiter);
  console.log('[CSVParser] Total de linhas:', results.data.length);
  
  // Calcular estatísticas
  const stats = {
    totalRows: results.data.length,
    validRows: results.data.filter(row => Object.values(row).some(v => v && v.trim())).length,
    emptyRows: results.data.filter(row => !Object.values(row).some(v => v && v.trim())).length,
    errorRows: results.errors.length
  };
  
  // Filtrar linhas vazias
  const validData = results.data.filter(row => 
    Object.values(row).some(v => v && v.trim())
  );
  
  return {
    data: validData,
    headers: results.meta.fields || [],
    errors: results.errors,
    meta: {
      delimiter: results.meta.delimiter,
      linebreak: results.meta.linebreak,
      encoding: 'UTF-8',
      aborted: results.meta.aborted,
      truncated: results.meta.truncated,
      fields: results.meta.fields
    },
    stats
  };
}

/**
 * Formata erros de parsing para exibição
 */
export function formatParsingErrors(errors: Papa.ParseError[]): string[] {
  return errors.map(error => {
    const line = error.row !== undefined ? ` (linha ${error.row + 2})` : '';
    return `${error.type}: ${error.message}${line}`;
  });
}
