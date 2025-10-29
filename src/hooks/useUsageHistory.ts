import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';

interface UsageDataPoint {
  date: string;
  orders: number;
  notifications: number;
  integrations: number;
}

interface UsageRecord {
  id: string;
  user_id: string;
  orders_count: number;
  notifications_count: number;
  integrations_count: number;
  created_at: string;
}

export function useUsageHistory(userId: string | undefined, days = 30) {
  return useQuery({
    queryKey: ['usage-history', userId, days],
    queryFn: async () => {
      if (!userId) return [];

      const startDate = subDays(new Date(), days);

      // Buscar registros de uso dos últimos N dias
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: usageRecords, error } = await (supabase as any)
        .from('usage_records')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      const records = usageRecords as UsageRecord[];

      // Agrupar por dia
      const dataByDate = new Map<string, UsageDataPoint>();

      // Inicializar todos os dias com zeros
      for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), days - i - 1), 'dd/MM');
        dataByDate.set(date, {
          date,
          orders: 0,
          notifications: 0,
          integrations: 0,
        });
      }

      // Preencher com dados reais
      records?.forEach((record) => {
        const date = format(new Date(record.created_at), 'dd/MM');
        const existing = dataByDate.get(date) || {
          date,
          orders: 0,
          notifications: 0,
          integrations: 0,
        };

        existing.orders += record.orders_count || 0;
        existing.notifications += record.notifications_count || 0;
        existing.integrations += record.integrations_count || 0;

        dataByDate.set(date, existing);
      });

      return Array.from(dataByDate.values());
    },
    enabled: !!userId,
  });
}
