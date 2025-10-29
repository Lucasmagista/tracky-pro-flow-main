import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ScheduledReport {
  id: string;
  user_id: string;
  name: string;
  report_type: 'pdf' | 'excel' | 'csv' | 'complete';
  frequency: 'daily' | 'weekly' | 'monthly';
  day_of_week?: number; // 0-6 (Domingo-Sábado)
  day_of_month?: number; // 1-31
  time: string; // HH:MM format
  filters?: {
    statuses?: string[];
    carriers?: string[];
    dateRange?: string; // 'last7days', 'last30days', 'lastMonth'
  };
  email_recipients: string[];
  is_active: boolean;
  last_sent_at?: string;
  next_run_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduledReportInput {
  name: string;
  report_type: 'pdf' | 'excel' | 'csv' | 'complete';
  frequency: 'daily' | 'weekly' | 'monthly';
  day_of_week?: number;
  day_of_month?: number;
  time: string;
  filters?: ScheduledReport['filters'];
  email_recipients: string[];
}

export function useScheduledReports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar relatórios agendados
  const loadReports = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: fetchError } = await (supabase as any)
        .from('scheduled_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setReports((data || []) as ScheduledReport[]);
    } catch (err) {
      console.error('Error loading scheduled reports:', err);
      setError('Erro ao carregar relatórios agendados');
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os relatórios agendados.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Criar novo relatório agendado
  const createReport = useCallback(
    async (input: CreateScheduledReportInput): Promise<ScheduledReport | null> => {
      if (!user) return null;

      try {
        const nextRunAt = calculateNextRun(
          input.frequency,
          input.time,
          input.day_of_week,
          input.day_of_month
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error: createError } = await (supabase as any)
          .from('scheduled_reports')
          .insert({
            user_id: user.id,
            name: input.name,
            report_type: input.report_type,
            frequency: input.frequency,
            day_of_week: input.day_of_week,
            day_of_month: input.day_of_month,
            time: input.time,
            filters: input.filters,
            email_recipients: input.email_recipients,
            is_active: true,
            next_run_at: nextRunAt,
          })
          .select()
          .single();

        if (createError) throw createError;

        toast({
          title: 'Relatório agendado!',
          description: `${input.name} será enviado ${getFrequencyLabel(input.frequency)}.`,
        });

        await loadReports();
        return data as ScheduledReport;
      } catch (err) {
        console.error('Error creating scheduled report:', err);
        toast({
          title: 'Erro',
          description: 'Não foi possível criar o relatório agendado.',
          variant: 'destructive',
        });
        return null;
      }
    },
    [user, toast, loadReports]
  );

  // Atualizar relatório agendado
  const updateReport = useCallback(
    async (
      id: string,
      updates: Partial<CreateScheduledReportInput>
    ): Promise<boolean> => {
      try {
        const updateData: Record<string, unknown> = { ...updates };

        // Recalcular next_run_at se frequência ou horário mudaram
        if (updates.frequency || updates.time || updates.day_of_week || updates.day_of_month) {
          const report = reports.find((r) => r.id === id);
          if (report) {
            updateData.next_run_at = calculateNextRun(
              updates.frequency || report.frequency,
              updates.time || report.time,
              updates.day_of_week !== undefined ? updates.day_of_week : report.day_of_week,
              updates.day_of_month !== undefined ? updates.day_of_month : report.day_of_month
            );
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from('scheduled_reports')
          .update(updateData)
          .eq('id', id);

        if (updateError) throw updateError;

        toast({
          title: 'Atualizado!',
          description: 'Relatório agendado atualizado com sucesso.',
        });

        await loadReports();
        return true;
      } catch (err) {
        console.error('Error updating scheduled report:', err);
        toast({
          title: 'Erro',
          description: 'Não foi possível atualizar o relatório.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [reports, toast, loadReports]
  );

  // Ativar/desativar relatório
  const toggleActive = useCallback(
    async (id: string, isActive: boolean): Promise<boolean> => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from('scheduled_reports')
          .update({ is_active: isActive })
          .eq('id', id);

        if (updateError) throw updateError;

        toast({
          title: isActive ? 'Ativado' : 'Desativado',
          description: `Relatório ${isActive ? 'ativado' : 'desativado'} com sucesso.`,
        });

        await loadReports();
        return true;
      } catch (err) {
        console.error('Error toggling report:', err);
        toast({
          title: 'Erro',
          description: 'Não foi possível alterar o status do relatório.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast, loadReports]
  );

  // Deletar relatório
  const deleteReport = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: deleteError } = await (supabase as any)
          .from('scheduled_reports')
          .delete()
          .eq('id', id);

        if (deleteError) throw deleteError;

        toast({
          title: 'Deletado',
          description: 'Relatório agendado removido com sucesso.',
        });

        await loadReports();
        return true;
      } catch (err) {
        console.error('Error deleting report:', err);
        toast({
          title: 'Erro',
          description: 'Não foi possível deletar o relatório.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast, loadReports]
  );

  // Enviar relatório manualmente
  const sendNow = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        // Chamar edge function para enviar relatório
        const { error: sendError } = await supabase.functions.invoke('send-scheduled-report', {
          body: { report_id: id },
        });

        if (sendError) throw sendError;

        toast({
          title: 'Enviado!',
          description: 'Relatório enviado com sucesso.',
        });

        await loadReports();
        return true;
      } catch (err) {
        console.error('Error sending report:', err);
        toast({
          title: 'Erro',
          description: 'Não foi possível enviar o relatório.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast, loadReports]
  );

  return {
    reports,
    isLoading,
    error,
    createReport,
    updateReport,
    toggleActive,
    deleteReport,
    sendNow,
    refresh: loadReports,
  };
}

// Funções auxiliares
function calculateNextRun(
  frequency: string,
  time: string,
  dayOfWeek?: number,
  dayOfMonth?: number
): string {
  const now = new Date();
  const [hours, minutes] = time.split(':').map(Number);

  const next = new Date();
  next.setHours(hours, minutes, 0, 0);

  switch (frequency) {
    case 'daily': {
      // Se já passou a hora de hoje, agendar para amanhã
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      break;
    }

    case 'weekly': {
      // Encontrar próximo dia da semana
      const currentDay = next.getDay();
      const targetDay = dayOfWeek || 0;
      let daysUntilTarget = targetDay - currentDay;

      if (daysUntilTarget < 0 || (daysUntilTarget === 0 && next <= now)) {
        daysUntilTarget += 7;
      }

      next.setDate(next.getDate() + daysUntilTarget);
      break;
    }

    case 'monthly': {
      // Definir dia do mês
      const targetDayOfMonth = dayOfMonth || 1;
      next.setDate(targetDayOfMonth);

      // Se já passou este mês, agendar para o próximo
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      break;
    }
  }

  return next.toISOString();
}

function getFrequencyLabel(frequency: string): string {
  const labels: Record<string, string> = {
    daily: 'diariamente',
    weekly: 'semanalmente',
    monthly: 'mensalmente',
  };
  return labels[frequency] || frequency;
}
