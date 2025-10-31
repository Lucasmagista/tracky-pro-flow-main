// Função utilitária para similaridade de nomes de colunas
export function isSimilarColumnName(a: string, b: string): boolean {
  // Exemplo simples: case-insensitive e ignora espaços/underscores
  return a.replace(/[_\s]/g, '').toLowerCase() === b.replace(/[_\s]/g, '').toLowerCase();
}

// Função utilitária para encontrar padrões contextuais
import type { MappingPattern } from './useMLMappingLearning';

export function findContextualPatterns(
  csvColumn: string,
  dataType: 'string' | 'number' | 'date' | 'boolean',
  csvHeaders: string[],
  patterns: MappingPattern[]
): MappingPattern[] {
  // Exemplo: retorna padrões do mesmo tipo de dado e contexto de cabeçalho
  return patterns.filter(
    p =>
      p.context &&
      p.context.dataTypes &&
      p.context.dataTypes[p.csvColumnName] === dataType &&
      p.context.csvHeaders.length === csvHeaders.length
  );
}
