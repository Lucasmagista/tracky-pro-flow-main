import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TrackingUpdate {
  tracking_code: string;
  carrier: string;
  status: string;
  events: Array<{
    date: string;
    time: string;
    location: string;
    description: string;
  }>;
  estimated_delivery?: string;
  last_updated: string;
}

interface AutoUpdateConfig {
  enabled: boolean;
  interval: number; // em milissegundos
  onlyPending: boolean; // Atualizar apenas pedidos não entregues
  useCache: boolean; // Usar cache quando possível
}

export function useAutoTrackingUpdates(config: AutoUpdateConfig) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [updatedCount, setUpdatedCount] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Determinar intervalo inteligente baseado no status
  const getSmartInterval = useCallback((status: string): number => {
    const intervals = {
      delivered: 24 * 60 * 60 * 1000, // 24 horas (não precisa atualizar)
      out_for_delivery: 30 * 60 * 1000, // 30 minutos (atualização frequente)
      in_transit: 2 * 60 * 60 * 1000, // 2 horas
      posted: 4 * 60 * 60 * 1000, // 4 horas
      pending: 6 * 60 * 60 * 1000, // 6 horas
      delayed: 1 * 60 * 60 * 1000, // 1 hora (verificar com frequência)
      exception: 1 * 60 * 60 * 1000, // 1 hora
      default: config.interval,
    };

    return intervals[status as keyof typeof intervals] || intervals.default;
  }, [config.interval]);

  // Verificar se deve usar cache
  const shouldUseCache = useCallback((lastCacheUpdate: string): boolean => {
    if (!config.useCache) return false;

    const cacheAge = Date.now() - new Date(lastCacheUpdate).getTime();
    const cacheLimit = 15 * 60 * 1000; // 15 minutos

    return cacheAge < cacheLimit;
  }, [config.useCache]);

  // Atualizar rastreamento de um pedido
  const updateSingleTracking = useCallback(async (
    orderId: string,
    trackingCode: string,
    carrier: string
  ): Promise<TrackingUpdate | null> => {
    try {
      // Verificar cache primeiro
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cachedData } = await (supabase as any)
        .from('tracking_cache')
        .select('*')
        .eq('tracking_code', trackingCode)
        .single();

      if (cachedData && shouldUseCache(cachedData.last_updated)) {
        console.log(`Using cached data for ${trackingCode}`);
        return {
          tracking_code: trackingCode,
          carrier: carrier,
          status: cachedData.current_status,
          events: cachedData.events || [],
          estimated_delivery: cachedData.estimated_delivery,
          last_updated: cachedData.last_updated,
        };
      }

      // Chamar edge function para atualizar
      const { data, error } = await supabase.functions.invoke('track-multi-carrier', {
        body: {
          tracking_code: trackingCode,
          carrier: carrier,
        },
      });

      if (error) throw error;

      if (data.success) {
        // Atualizar pedido com novos dados
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('orders')
          .update({
            status: data.current_status,
            estimated_delivery: data.estimated_delivery,
            last_tracking_update: new Date().toISOString(),
          })
          .eq('id', orderId);

        return {
          tracking_code: trackingCode,
          carrier: data.carrier,
          status: data.current_status,
          events: data.events,
          estimated_delivery: data.estimated_delivery,
          last_updated: new Date().toISOString(),
        };
      }

      return null;
    } catch (error) {
      console.error(`Error updating tracking for ${trackingCode}:`, error);
      return null;
    }
  }, [shouldUseCache]);

  // Atualizar todos os rastreamentos
  const updateAllTrackings = useCallback(async () => {
    setIsUpdating(true);
    let count = 0;

    try {
      // Buscar pedidos que precisam de atualização
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('orders')
        .select('id, tracking_code, carrier, status')
        .not('tracking_code', 'is', null);

      // Filtrar apenas pedidos não entregues se configurado
      if (config.onlyPending) {
        query = query.not('status', 'in', '(delivered,cancelled)');
      }

      const { data: orders, error } = await query;

      if (error) throw error;

      if (!orders || orders.length === 0) {
        console.log('No orders to update');
        return;
      }

      // Atualizar em lotes para não sobrecarregar
      const batchSize = 5;
      for (let i = 0; i < orders.length; i += batchSize) {
        const batch = orders.slice(i, i + batchSize);
        
        const updates = await Promise.allSettled(
          batch.map((order: { id: string; tracking_code: string; carrier: string }) =>
            updateSingleTracking(order.id, order.tracking_code, order.carrier)
          )
        );

        updates.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            count++;
          }
        });

        // Pequeno delay entre lotes
        if (i + batchSize < orders.length) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      setUpdatedCount(count);
      setLastUpdate(new Date());

      if (count > 0) {
        toast({
          title: 'Rastreamentos atualizados',
          description: `${count} rastreamento(s) atualizado(s) com sucesso.`,
        });
      }
    } catch (error) {
      console.error('Error in auto-update:', error);
      toast({
        title: 'Erro na atualização',
        description: 'Não foi possível atualizar os rastreamentos.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  }, [config.onlyPending, updateSingleTracking, toast]);

  // Iniciar atualização automática
  const startAutoUpdate = useCallback(() => {
    if (!config.enabled) return;

    console.log('Starting auto-update with interval:', config.interval);

    // Executar primeira atualização imediatamente
    updateAllTrackings();

    // Configurar intervalo
    intervalRef.current = setInterval(() => {
      updateAllTrackings();
    }, config.interval);
  }, [config.enabled, config.interval, updateAllTrackings]);

  // Parar atualização automática
  const stopAutoUpdate = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('Auto-update stopped');
    }
  }, []);

  // Configurar e limpar intervalo
  useEffect(() => {
    if (config.enabled) {
      startAutoUpdate();
    } else {
      stopAutoUpdate();
    }

    return () => {
      stopAutoUpdate();
    };
  }, [config.enabled, startAutoUpdate, stopAutoUpdate]);

  // Atualização manual
  const manualUpdate = useCallback(async () => {
    await updateAllTrackings();
  }, [updateAllTrackings]);

  // Atualizar pedido específico
  const updateSpecific = useCallback(async (
    orderId: string,
    trackingCode: string,
    carrier: string
  ) => {
    setIsUpdating(true);
    try {
      const result = await updateSingleTracking(orderId, trackingCode, carrier);
      
      if (result) {
        toast({
          title: 'Rastreamento atualizado',
          description: `Status: ${result.status}`,
        });
      }

      return result;
    } catch (error) {
      console.error('Error updating specific tracking:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o rastreamento.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, [updateSingleTracking, toast]);

  return {
    isUpdating,
    lastUpdate,
    updatedCount,
    manualUpdate,
    updateSpecific,
    startAutoUpdate,
    stopAutoUpdate,
  };
}

// Hook para rastreamento em tempo real via Supabase Realtime
export function useRealtimeTracking(trackingCode?: string) {
  const [updates, setUpdates] = useState<TrackingUpdate[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!trackingCode) return;

    console.log(`Setting up realtime tracking for ${trackingCode}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (supabase as any)
      .channel(`tracking_${trackingCode}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tracking_cache',
          filter: `tracking_code=eq.${trackingCode}`,
        },
        (payload: {
          new: {
            tracking_code: string;
            carrier: string;
            current_status: string;
            events: Array<{
              date: string;
              time: string;
              location: string;
              description: string;
            }>;
            estimated_delivery?: string;
            last_updated: string;
          };
        }) => {
          console.log('Realtime update received:', payload);

          const update: TrackingUpdate = {
            tracking_code: payload.new.tracking_code,
            carrier: payload.new.carrier,
            status: payload.new.current_status,
            events: payload.new.events,
            estimated_delivery: payload.new.estimated_delivery,
            last_updated: payload.new.last_updated,
          };

          setUpdates((prev) => [update, ...prev]);

          toast({
            title: 'Atualização em tempo real',
            description: `Status: ${payload.new.current_status}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [trackingCode, toast]);

  return { updates };
}

// Hook para notificações push
export function useTrackingNotifications() {
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if ('Notification' in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    }
    return false;
  }, []);

  const sendNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (permission === 'granted') {
        const notification = new Notification(title, {
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          ...options,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        return notification;
      } else {
        // Fallback para toast
        toast({
          title: title,
          description: options?.body,
        });
      }
    },
    [permission, toast]
  );

  return {
    permission,
    requestPermission,
    sendNotification,
    isSupported: 'Notification' in window,
  };
}
