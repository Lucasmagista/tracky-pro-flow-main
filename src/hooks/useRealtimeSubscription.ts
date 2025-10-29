import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeSubscriptionOptions {
  table: string;
  event?: RealtimeEvent | '*';
  filter?: string;
  onInsert?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  onChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  invalidateQueries?: string[];
  showNotification?: boolean;
}

/**
 * Hook para subscrever em mudanças em tempo real do Supabase
 */
export function useRealtimeSubscription(options: RealtimeSubscriptionOptions) {
  const {
    table,
    event = '*',
    filter,
    onInsert,
    onUpdate,
    onDelete,
    onChange,
    invalidateQueries = [],
    showNotification = false,
  } = options;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleChange = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      // Callback genérico
      onChange?.(payload);

      // Callbacks específicos por evento
      switch (payload.eventType) {
        case 'INSERT':
          onInsert?.(payload);
          if (showNotification) {
            toast({
              title: 'Novo registro',
              description: `Um novo item foi adicionado em ${table}`,
            });
          }
          break;
        case 'UPDATE':
          onUpdate?.(payload);
          if (showNotification) {
            toast({
              title: 'Registro atualizado',
              description: `Um item foi atualizado em ${table}`,
            });
          }
          break;
        case 'DELETE':
          onDelete?.(payload);
          if (showNotification) {
            toast({
              title: 'Registro removido',
              description: `Um item foi removido de ${table}`,
            });
          }
          break;
      }

      // Invalidar queries do React Query
      invalidateQueries.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });
    },
    [onChange, onInsert, onUpdate, onDelete, invalidateQueries, queryClient, toast, table, showNotification]
  );

  useEffect(() => {
    // Criar canal de realtime
    const channelName = `${table}_${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Configurar subscription - sem tipagem estrita
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (channel as any)
      .on(
        'postgres_changes',
        {
          event: event,
          schema: 'public',
          table: table,
          filter: filter,
        },
        handleChange
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to ${table} changes`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Error subscribing to ${table}`);
        }
      });

    channelRef.current = channel;

    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, event, filter, handleChange]);

  return {
    isSubscribed: !!channelRef.current,
  };
}

/**
 * Hook específico para subscrever mudanças em pedidos
 */
export function useOrdersRealtime(userId?: string) {
  return useRealtimeSubscription({
    table: 'orders',
    filter: userId ? `user_id=eq.${userId}` : undefined,
    invalidateQueries: ['orders', 'dashboard-metrics'],
    showNotification: true,
    onInsert: (payload) => {
      console.log('Novo pedido:', payload.new);
    },
    onUpdate: (payload) => {
      console.log('Pedido atualizado:', payload.new);
    },
    onDelete: (payload) => {
      console.log('Pedido removido:', payload.old);
    },
  });
}

/**
 * Hook específico para subscrever mudanças em notificações
 */
export function useNotificationsRealtime(userId?: string) {
  return useRealtimeSubscription({
    table: 'notifications',
    filter: userId ? `user_id=eq.${userId}` : undefined,
    event: 'INSERT',
    invalidateQueries: ['notifications'],
    showNotification: true,
  });
}

/**
 * Hook específico para subscrever mudanças em métricas
 */
export function useMetricsRealtime(userId?: string) {
  return useRealtimeSubscription({
    table: 'analytics_metrics',
    filter: userId ? `user_id=eq.${userId}` : undefined,
    invalidateQueries: ['dashboard-metrics', 'analytics'],
    showNotification: false,
  });
}

/**
 * Hook para broadcast de eventos customizados
 */
export function useBroadcast(channelName: string) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const channel = supabase.channel(channelName);
    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [channelName]);

  const broadcast = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event,
          payload,
        });
      }
    },
    []
  );

  const on = useCallback((event: string, callback: (payload: Record<string, unknown>) => void) => {
    if (channelRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (channelRef.current as any).on('broadcast', { event }, callback);
    }
  }, []);

  return { broadcast, on };
}

interface UserPresence {
  user_id: string;
  online_at: string;
  [key: string]: unknown;
}

/**
 * Hook para presença de usuários (quem está online)
 */
export function usePresence(channelName: string, userInfo: UserPresence) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);

  useEffect(() => {
    const channel = supabase.channel(channelName);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flat() as unknown as UserPresence[];
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(userInfo);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [channelName, userInfo]);

  return { onlineUsers };
}
