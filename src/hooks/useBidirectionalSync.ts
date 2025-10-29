/**
 * Hook para sincronização bidirecional
 */

import { useState, useCallback } from 'react';
import { BidirectionalSyncService } from '@/services/bidirectionalSync';
import { useToast } from '@/hooks/use-toast';

interface SyncOptions {
  trackingCode?: string;
  status?: string;
  carrier?: string;
  notes?: string;
}

export function useBidirectionalSync() {
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncHistory, setSyncHistory] = useState<Array<Record<string, unknown>>>([]);

  // Sincronizar código de rastreio
  const syncTrackingCode = useCallback(
    async (orderId: string, trackingCode: string, carrier: string) => {
      setIsSyncing(true);
      try {
        await BidirectionalSyncService.syncTrackingCode(
          orderId,
          trackingCode,
          carrier
        );

        toast({
          title: '✅ Código sincronizado',
          description: 'Código de rastreio enviado para o marketplace.',
        });

        return true;
      } catch (error) {
        console.error('Error syncing tracking code:', error);
        toast({
          title: '❌ Erro na sincronização',
          description:
            error instanceof Error
              ? error.message
              : 'Não foi possível sincronizar o código de rastreio.',
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [toast]
  );

  // Sincronizar status
  const syncStatus = useCallback(
    async (orderId: string, newStatus: string) => {
      setIsSyncing(true);
      try {
        await BidirectionalSyncService.syncOrderStatus(orderId, newStatus);

        toast({
          title: '✅ Status sincronizado',
          description: 'Status atualizado no marketplace.',
        });

        return true;
      } catch (error) {
        console.error('Error syncing status:', error);
        toast({
          title: '❌ Erro na sincronização',
          description:
            error instanceof Error
              ? error.message
              : 'Não foi possível sincronizar o status.',
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [toast]
  );

  // Sincronizar atualizações gerais
  const syncOrderUpdate = useCallback(
    async (orderId: string, platform: string, updates: SyncOptions) => {
      setIsSyncing(true);
      try {
        await BidirectionalSyncService.syncOrderUpdate(
          orderId,
          platform,
          updates
        );

        toast({
          title: '✅ Pedido sincronizado',
          description: 'Alterações enviadas para o marketplace.',
        });

        return true;
      } catch (error) {
        console.error('Error syncing order:', error);
        toast({
          title: '❌ Erro na sincronização',
          description:
            error instanceof Error
              ? error.message
              : 'Não foi possível sincronizar as alterações.',
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [toast]
  );

  // Sincronizar lote de pedidos
  const syncBatch = useCallback(
    async (orderIds: string[], updates: SyncOptions) => {
      setIsSyncing(true);
      try {
        const results = await BidirectionalSyncService.syncBatch(
          orderIds,
          updates
        );

        const successCount = results.success.length;
        const failedCount = results.failed.length;

        if (failedCount === 0) {
          toast({
            title: '✅ Sincronização completa',
            description: `${successCount} pedidos sincronizados com sucesso.`,
          });
        } else {
          toast({
            title: '⚠️ Sincronização parcial',
            description: `${successCount} sucesso, ${failedCount} falhas.`,
            variant: 'destructive',
          });
        }

        return results;
      } catch (error) {
        console.error('Error syncing batch:', error);
        toast({
          title: '❌ Erro na sincronização',
          description: 'Não foi possível sincronizar os pedidos.',
          variant: 'destructive',
        });
        return { success: [], failed: orderIds };
      } finally {
        setIsSyncing(false);
      }
    },
    [toast]
  );

  // Verificar se sincronização está habilitada
  const checkSyncEnabled = useCallback(async (orderId: string) => {
    try {
      return await BidirectionalSyncService.isSyncEnabled(orderId);
    } catch (error) {
      console.error('Error checking sync status:', error);
      return false;
    }
  }, []);

  // Habilitar/desabilitar sincronização automática
  const toggleAutoSync = useCallback(
    async (platform: string, enabled: boolean) => {
      try {
        await BidirectionalSyncService.enableAutoSync(platform, enabled);

        toast({
          title: enabled
            ? '✅ Sincronização automática ativada'
            : 'Sincronização automática desativada',
          description: enabled
            ? 'Alterações serão enviadas automaticamente para o marketplace.'
            : 'Sincronização automática foi desativada.',
        });

        return true;
      } catch (error) {
        console.error('Error toggling auto sync:', error);
        toast({
          title: 'Erro ao alterar configuração',
          description: 'Não foi possível alterar a configuração de sincronização.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast]
  );

  // Buscar histórico de sincronização
  const loadSyncHistory = useCallback(
    async (orderId: string, limit = 10) => {
      try {
        const history = await BidirectionalSyncService.getSyncHistory(
          orderId,
          limit
        );
        setSyncHistory(history);
        return history;
      } catch (error) {
        console.error('Error loading sync history:', error);
        return [];
      }
    },
    []
  );

  // Retentar sincronização falha
  const retrySyncFailure = useCallback(
    async (syncLogId: string) => {
      setIsSyncing(true);
      try {
        await BidirectionalSyncService.retrySyncFailure(syncLogId);

        toast({
          title: '✅ Sincronização retentada',
          description: 'Sincronização executada com sucesso.',
        });

        return true;
      } catch (error) {
        console.error('Error retrying sync:', error);
        toast({
          title: '❌ Erro na retentativa',
          description: 'Não foi possível executar a sincronização.',
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [toast]
  );

  // Sincronizar notificação enviada
  const syncNotificationSent = useCallback(
    async (
      orderId: string,
      notificationType: string,
      sentAt: string
    ) => {
      try {
        await BidirectionalSyncService.syncNotificationSent(
          orderId,
          notificationType,
          sentAt
        );
        return true;
      } catch (error) {
        console.error('Error syncing notification:', error);
        return false;
      }
    },
    []
  );

  return {
    isSyncing,
    syncHistory,
    syncTrackingCode,
    syncStatus,
    syncOrderUpdate,
    syncBatch,
    checkSyncEnabled,
    toggleAutoSync,
    loadSyncHistory,
    retrySyncFailure,
    syncNotificationSent,
  };
}
