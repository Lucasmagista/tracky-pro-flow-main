import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/types/supabase';
type MappingPatternRow = Database['public']['Tables']['mapping_patterns']['Row'];
import { isSimilarColumnName, findContextualPatterns } from './mlUtils';
import { useAuth } from '@/contexts/AuthContext';

export interface MappingPattern {
  id: string;
  csvColumnName: string;
  systemField: string;
  confidence: number;
  occurrences: number;
  lastUsed: string;
  context: {
    csvHeaders: string[];
    sampleData: Record<string, string>[];
    dataTypes: Record<string, 'string' | 'number' | 'date' | 'boolean'>;
  };
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MLAnalysis {
  patterns: MappingPattern[];
  suggestions: {
    csvColumn: string;
    suggestedField: string;
    confidence: number;
    reasoning: string;
    alternatives: Array<{
      field: string;
      confidence: number;
      reasoning: string;
    }>;
  }[];
  learningStats: {
    totalPatterns: number;
    averageConfidence: number;
    mostUsedMappings: Array<{
      from: string;
      to: string;
      count: number;
    }>;
  };
}

export interface MLTrainingData {
  csvHeaders: string[];
  sampleData: Record<string, string>[];
  userMapping: Record<string, string>;
  context?: {
    dataSource?: string;
    industry?: string;
    region?: string;
  };
}


// Função utilitária para garantir o tipo correto do contexto
const parseContext = (context: unknown): MappingPattern['context'] => {
  if (
    context &&
    typeof context === 'object' &&
    'csvHeaders' in context &&
    'sampleData' in context &&
    'dataTypes' in context
  ) {
    return context as MappingPattern['context'];
  }
  if (typeof context === 'string') {
    try {
      const parsed = JSON.parse(context);
      if (
        parsed &&
        typeof parsed === 'object' &&
        'csvHeaders' in parsed &&
        'sampleData' in parsed &&
        'dataTypes' in parsed
      ) {
        return parsed as MappingPattern['context'];
      }
    } catch {
      void 0; // ignora erro propositalmente
    }
  }
  return { csvHeaders: [], sampleData: [], dataTypes: {} };
};

export const useMLMappingLearning = () => {
  const { user } = useAuth();
  const [patterns, setPatterns] = useState<MappingPattern[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Carregar padrões de mapeamento aprendidos
  const loadPatterns = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('mapping_patterns')
        .select('*')
        .eq('user_id', user.id)
        .order('occurrences', { ascending: false });

      if (error) throw error;
      if (!data) {
        setPatterns([]);
        return;
      }
      // Forçar tipagem correta
      function parseContext(context: unknown): MappingPattern['context'] {
        if (
          context &&
          typeof context === 'object' &&
          'csvHeaders' in context &&
          'sampleData' in context &&
          'dataTypes' in context
        ) {
          return context as MappingPattern['context'];
        }
        if (typeof context === 'string') {
          try {
            const parsed = JSON.parse(context);
            if (
              parsed &&
              typeof parsed === 'object' &&
              'csvHeaders' in parsed &&
              'sampleData' in parsed &&
              'dataTypes' in parsed
            ) {
              return parsed as MappingPattern['context'];
            }
          } catch { void 0; /* ignora erro propositalmente */ }
        }
        return { csvHeaders: [], sampleData: [], dataTypes: {} };
      }

      const formattedPatterns: MappingPattern[] = (data as MappingPatternRow[]).map((pattern) => ({
        id: pattern.id,
        csvColumnName: pattern.csv_column_name,
        systemField: pattern.system_field,
        confidence: pattern.confidence,
        occurrences: pattern.occurrences,
        lastUsed: pattern.last_used,
        context: parseContext(pattern.context_data),
        userId: pattern.user_id,
        createdAt: pattern.created_at ?? '',
        updatedAt: pattern.updated_at ?? ''
      }));
      setPatterns(formattedPatterns);
    } catch (error) {
      console.error('Erro ao carregar padrões de mapeamento:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Aprender com um novo mapeamento do usuário
  const learnFromMapping = useCallback(async (
    csvHeaders: string[],
    sampleData: Record<string, string>[],
    userMapping: Record<string, string>
  ): Promise<void> => {
    if (!user) return;

    try {
      // Analisar tipos de dados das colunas
      const dataTypes = analyzeDataTypes(csvHeaders, sampleData);

      // Para cada mapeamento do usuário, atualizar ou criar padrão
      for (const [csvColumn, systemField] of Object.entries(userMapping)) {
        if (!systemField) continue;

        // Verificar se já existe um padrão para esta combinação
        const existingPattern = patterns.find(p =>
          p.csvColumnName === csvColumn && p.systemField === systemField
        );

        const context = {
          csvHeaders,
          sampleData: sampleData.slice(0, 3), // Apenas primeiras 3 linhas
          dataTypes
        };

        if (existingPattern) {
          // Atualizar padrão existente
          const newOccurrences = existingPattern.occurrences + 1;
          const newConfidence = Math.min(existingPattern.confidence + 0.1, 1.0); // Aumentar confiança gradualmente

          await supabase
            .from('mapping_patterns')
            .update({
              confidence: newConfidence,
              occurrences: newOccurrences,
              last_used: new Date().toISOString(),
              context_data: context,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingPattern.id);

          // Atualizar estado local
          setPatterns(prev => prev.map(p =>
            p.id === existingPattern.id
              ? { ...p, confidence: newConfidence, occurrences: newOccurrences, lastUsed: new Date().toISOString() }
              : p
          ));
        } else {
          // Criar novo padrão
          const { data, error } = await supabase
            .from('mapping_patterns')
            .insert({
              user_id: user.id,
              csv_column_name: csvColumn,
              system_field: systemField,
              confidence: 0.6, // Confiança inicial moderada
              occurrences: 1,
              last_used: new Date().toISOString(),
              context_data: context
            })
            .select()
            .single();

          if (!error && data) {
            const d = data as MappingPatternRow;
            const newPattern: MappingPattern = {
              id: d.id,
              csvColumnName: d.csv_column_name,
              systemField: d.system_field,
              confidence: d.confidence,
              occurrences: d.occurrences,
              lastUsed: d.last_used,
              context: parseContext(d.context_data),
              userId: d.user_id,
              createdAt: d.created_at ?? '',
              updatedAt: d.updated_at ?? ''
            };
            setPatterns(prev => [...prev, newPattern]);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao aprender com mapeamento:', error);
    }
  }, [user, patterns]);

  // Analisar tipos de dados das colunas
  const analyzeDataTypes = (
    csvHeaders: string[],
    sampleData: Record<string, string>[]
  ): Record<string, 'string' | 'number' | 'date' | 'boolean'> => {
    const types: Record<string, 'string' | 'number' | 'date' | 'boolean'> = {};

    csvHeaders.forEach(header => {
      const values = sampleData.map(row => row[header] || '').filter(v => v.trim());

      if (values.length === 0) {
        types[header] = 'string';
        return;
      }

      // Verificar se todos os valores são números
      const numericValues = values.filter(v => !isNaN(Number(v)) && v.trim() !== '');
      if (numericValues.length === values.length) {
        types[header] = 'number';
        return;
      }

      // Verificar se são datas
      const dateValues = values.filter(v => {
        const date = new Date(v);
        return !isNaN(date.getTime()) && v.match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/);
      });
      if (dateValues.length / values.length > 0.8) {
        types[header] = 'date';
        return;
      }

      // Verificar se são booleanos
      const booleanValues = values.filter(v =>
        ['true', 'false', '1', '0', 'sim', 'não', 'yes', 'no'].includes(v.toLowerCase())
      );
      if (booleanValues.length === values.length) {
        types[header] = 'boolean';
        return;
      }

      // Default para string
      types[header] = 'string';
    });

    return types;
  };

  // Gerar sugestões de mapeamento baseadas no aprendizado
  const generateMappingSuggestions = useCallback((
    csvHeaders: string[],
    sampleData: Record<string, string>[]
  ): MLAnalysis['suggestions'] => {
    const suggestions: MLAnalysis['suggestions'] = [];
    const dataTypes = analyzeDataTypes(csvHeaders, sampleData);

    csvHeaders.forEach(csvColumn => {
      const columnPatterns = patterns.filter(p =>
        p.csvColumnName === csvColumn ||
        isSimilarColumnName(p.csvColumnName, csvColumn)
      );

      if (columnPatterns.length === 0) {
        // Procurar por padrões contextuais
        const contextualPatterns = findContextualPatterns(csvColumn, dataTypes[csvColumn], csvHeaders, patterns);
        if (contextualPatterns.length > 0) {
          const bestMatch = contextualPatterns[0];
          suggestions.push({
            csvColumn,
            suggestedField: bestMatch.systemField,
            confidence: Math.min(bestMatch.confidence * 0.8, 0.7), // Reduzir confiança para padrões contextuais
            reasoning: `Baseado em padrões similares e contexto dos dados`,
            alternatives: contextualPatterns.slice(1, 4).map(p => ({
              field: p.systemField,
              confidence: p.confidence * 0.6,
              reasoning: `Alternativa baseada em contexto`
            }))
          });
        }
      } else {
        // Ordenar por confiança e ocorrências
        const sortedPatterns = columnPatterns.sort((a, b) => {
          const scoreA = a.confidence * Math.log(a.occurrences + 1);
          const scoreB = b.confidence * Math.log(b.occurrences + 1);
          return scoreB - scoreA;
        });

        const bestPattern = sortedPatterns[0];
        const alternatives = sortedPatterns.slice(1, 4);

        suggestions.push({
          csvColumn,
          suggestedField: bestPattern.systemField,
          confidence: bestPattern.confidence,
          reasoning: `Aprendido de ${bestPattern.occurrences} mapeamento(s) anterior(es)`,
          alternatives: alternatives.map(alt => ({
            field: alt.systemField,
            confidence: alt.confidence,
            reasoning: `Usado ${alt.occurrences} vez(es) anteriormente`
          }))
        });
      }
    });

    return suggestions;
  }, [patterns]);

  // Gerar estatísticas de aprendizado
  const generateLearningStats = useCallback((): MLAnalysis['learningStats'] => {
    const totalPatterns = patterns.length;
    const averageConfidence = patterns.length > 0
      ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
      : 0;

    // Encontrar mapeamentos mais usados
    const mappingCounts: Record<string, { from: string; to: string; count: number }> = {};

    patterns.forEach(pattern => {
      const key = `${pattern.csvColumnName}->${pattern.systemField}`;
      if (!mappingCounts[key]) {
        mappingCounts[key] = {
          from: pattern.csvColumnName,
          to: pattern.systemField,
          count: 0
        };
      }
      mappingCounts[key].count += pattern.occurrences;
    });

    const mostUsedMappings = Object.values(mappingCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalPatterns,
      averageConfidence,
      mostUsedMappings
    };
  }, [patterns]);

  // Limpar padrões antigos com baixa confiança
  const cleanupOldPatterns = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - 6); // 6 meses atrás

      const { error } = await supabase
        .from('mapping_patterns')
        .delete()
        .eq('user_id', user.id)
        .lt('confidence', 0.3)
        .lt('last_used', cutoffDate.toISOString());

      if (!error) {
        // Recarregar padrões após limpeza
        await loadPatterns();
      }
    } catch (error) {
      console.error('Erro ao limpar padrões antigos:', error);
    }
  }, [user, loadPatterns]);

  // Carregar padrões na inicialização
  useEffect(() => {
    loadPatterns();
  }, [loadPatterns]);

  return {
    patterns,
    isLoading,
    loadPatterns,
    learnFromMapping,
    generateMappingSuggestions,
    generateLearningStats,
    cleanupOldPatterns
  };
};