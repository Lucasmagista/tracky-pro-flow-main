import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface CSVTemplate {
  id: string;
  name: string;
  description?: string;
  mapping: Record<string, string>;
  csvHeaders: string[];
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  isPublic: boolean;
  tags?: string[];
}

export interface TemplateStats {
  totalTemplates: number;
  totalUsage: number;
  mostUsedTemplate?: CSVTemplate;
  recentTemplates: CSVTemplate[];
}

export const useCSVTemplate = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<CSVTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<TemplateStats>({
    totalTemplates: 0,
    totalUsage: 0,
    recentTemplates: []
  });

  // Carregar templates do usuário
  const loadTemplates = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('csv_templates')
        .select('*')
        .or(`user_id.eq.${user.id},is_public.eq.true`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const formattedTemplates: CSVTemplate[] = (data as Database['public']['Tables']['csv_templates']['Row'][]).map(template => ({
        id: template.id,
        name: template.name,
        description: template.description ?? undefined,
        mapping: template.mapping as Record<string, string>,
        csvHeaders: template.csv_headers as string[],
        createdAt: template.created_at ?? '',
        updatedAt: template.updated_at ?? '',
        usageCount: template.usage_count || 0,
        isPublic: template.is_public || false,
        tags: template.tags ?? undefined
      }));

      setTemplates(formattedTemplates);

      // Calcular estatísticas
      const userTemplates = formattedTemplates.filter(t => !t.isPublic);
      const totalUsage = userTemplates.reduce((sum, t) => sum + t.usageCount, 0);
      const mostUsed = userTemplates.reduce((prev, current) =>
        (prev?.usageCount || 0) > current.usageCount ? prev : current
      );
      const recentTemplates = userTemplates.slice(0, 5);

      setStats({
        totalTemplates: userTemplates.length,
        totalUsage,
        mostUsedTemplate: mostUsed,
        recentTemplates
      });

    } catch (error) {
      console.error('Erro ao carregar templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Salvar novo template
  const saveTemplate = useCallback(async (
    name: string,
    mapping: Record<string, string>,
    csvHeaders: string[],
    description?: string,
    isPublic: boolean = false,
    tags?: string[]
  ): Promise<CSVTemplate | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('csv_templates')
        .insert({
          user_id: user.id,
          name,
          description,
          mapping,
          csv_headers: csvHeaders,
          is_public: isPublic,
          tags: tags || [],
          usage_count: 0
        })
        .select()
        .single();

      if (error) throw error;

      const newTemplate: CSVTemplate = {
        id: data.id,
        name: data.name,
        description: data.description ?? undefined,
        mapping: data.mapping as Record<string, string>,
        csvHeaders: data.csv_headers as string[],
        createdAt: data.created_at ?? '',
        updatedAt: data.updated_at ?? '',
        usageCount: data.usage_count || 0,
        isPublic: data.is_public || false,
        tags: data.tags ?? undefined
      };

      setTemplates(prev => [newTemplate, ...prev]);
      return newTemplate;
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      return null;
    }
  }, [user]);

  // Atualizar template existente
  const updateTemplate = useCallback(async (
    templateId: string,
    updates: Partial<Pick<CSVTemplate, 'name' | 'description' | 'mapping' | 'isPublic' | 'tags'>>
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('csv_templates')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId)
        .eq('user_id', user.id); // Garantir que só o dono pode editar

      if (error) throw error;

      setTemplates(prev => prev.map(template =>
        template.id === templateId
          ? { ...template, ...updates, updatedAt: new Date().toISOString() }
          : template
      ));

      return true;
    } catch (error) {
      console.error('Erro ao atualizar template:', error);
      return false;
    }
  }, [user]);

  // Excluir template
  const deleteTemplate = useCallback(async (templateId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('csv_templates')
        .delete()
        .eq('id', templateId)
        .eq('user_id', user.id); // Garantir que só o dono pode excluir

      if (error) throw error;

      setTemplates(prev => prev.filter(template => template.id !== templateId));
      return true;
    } catch (error) {
      console.error('Erro ao excluir template:', error);
      return false;
    }
  }, [user]);

  // Incrementar contador de uso
  const incrementUsage = useCallback(async (templateId: string): Promise<void> => {
    try {
      const { error } = await supabase.rpc('increment_template_usage', {
        template_id: templateId
      });

      if (error) throw error;

      setTemplates(prev => prev.map(template =>
        template.id === templateId
          ? { ...template, usageCount: template.usageCount + 1 }
          : template
      ));
    } catch (error) {
      console.error('Erro ao incrementar uso do template:', error);
    }
  }, []);

  // Buscar templates compatíveis com headers CSV
  const findCompatibleTemplates = useCallback((csvHeaders: string[]): CSVTemplate[] => {
    return templates.filter(template => {
      // Verificar se o template tem pelo menos alguns headers em comum
      const commonHeaders = template.csvHeaders.filter(header =>
        csvHeaders.some(csvHeader =>
          csvHeader.toLowerCase().includes(header.toLowerCase()) ||
          header.toLowerCase().includes(csvHeader.toLowerCase())
        )
      );

      // Considerar compatível se tiver pelo menos 30% de headers em comum
      return commonHeaders.length >= Math.max(1, csvHeaders.length * 0.3);
    }).sort((a, b) => b.usageCount - a.usageCount); // Ordenar por uso
  }, [templates]);

  // Aplicar template a mapeamento atual
  const applyTemplate = useCallback(async (
    template: CSVTemplate,
    currentCsvHeaders: string[]
  ): Promise<Record<string, string>> => {
    // Função auxiliar para calcular similaridade de strings
    const calculateSimilarity = (str1: string, str2: string): number => {
      const longer = str1.length > str2.length ? str1 : str2;
      const shorter = str1.length > str2.length ? str2 : str1;

      if (longer.length === 0) return 1.0;

      const distance = levenshteinDistance(longer, shorter);
      return (longer.length - distance) / longer.length;
    };

    // Distância de Levenshtein para similaridade de strings
    const levenshteinDistance = (str1: string, str2: string): number => {
      const matrix = [];

      for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
      }

      for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
      }

      for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
          if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1, // substituição
              matrix[i][j - 1] + 1,     // inserção
              matrix[i - 1][j] + 1      // deleção
            );
          }
        }
      }

      return matrix[str2.length][str1.length];
    };

    const mapping: Record<string, string> = {};

    // Para cada campo do template, tentar encontrar correspondência nos headers atuais
    Object.entries(template.mapping).forEach(([templateHeader, systemField]) => {
      // Procurar header similar nos headers atuais
      const matchingHeader = currentCsvHeaders.find(currentHeader =>
        currentHeader.toLowerCase().includes(templateHeader.toLowerCase()) ||
        templateHeader.toLowerCase().includes(currentHeader.toLowerCase()) ||
        // Similaridade de string básica
        calculateSimilarity(templateHeader, currentHeader) > 0.8
      );

      if (matchingHeader) {
        mapping[matchingHeader] = systemField;
      }
    });

    // Incrementar uso do template
    await incrementUsage(template.id);

    return mapping;
  }, [incrementUsage]);

  // Carregar templates na inicialização
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  return {
    templates,
    stats,
    isLoading,
    loadTemplates,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
    findCompatibleTemplates,
    applyTemplate,
    incrementUsage
  };
};