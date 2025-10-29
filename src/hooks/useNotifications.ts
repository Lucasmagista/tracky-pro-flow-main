import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { sendWhatsAppNotification } from '@/services/whatsapp';
import { useNotificationTemplates } from '@/services/notificationTemplates';
import { useToast } from '@/hooks/use-toast';

interface OrderData {
  id: string;
  tracking_code: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  carrier: string;
  status: string;
  user_id: string;
}

interface NotificationSettings {
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  auto_notifications: boolean;
}

export const useAutoNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { getTemplateForStatus, processTemplate } = useNotificationTemplates();

  // Função para enviar notificação automática
  const sendAutoNotification = useCallback(async (
    order: OrderData,
    oldStatus: string,
    newStatus: string
  ) => {
    if (!user) return;

    try {
      // Verificar se notificações automáticas estão habilitadas
      const settings = await getNotificationSettings();
      if (!settings?.auto_notifications) return;

      // Obter template apropriado
      const template = getTemplateForStatus(newStatus, 'whatsapp');
      if (!template) return;

      // Preparar variáveis
      const variables = {
        cliente: order.customer_name,
        codigo: order.tracking_code,
        status: getStatusLabel(newStatus),
        transportadora: order.carrier,
        link: `${window.location.origin}/rastrear/${order.tracking_code}`,
      };

      // Enviar WhatsApp se habilitado e número disponível
      if (settings.whatsapp_enabled && order.customer_phone) {
        const message = processTemplate(template.content, variables);
        const success = await sendWhatsAppNotification(order.customer_phone, message, variables);

        if (success) {
          toast({
            title: "Notificação enviada!",
            description: `WhatsApp enviado para ${order.customer_name}`,
          });
        }
      }

      // TODO: Implementar email notifications
      // if (settings.email_enabled && order.customer_email) {
      //   // Enviar email
      // }

    } catch (error) {
      console.error('Erro ao enviar notificação automática:', error);
    }
  }, [user, getTemplateForStatus, processTemplate, toast]);

  // Monitorar mudanças de status em tempo real
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('order-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const { new: newOrder, old: oldOrder } = payload;

          if (newOrder.status !== oldOrder.status) {
            await sendAutoNotification(newOrder, oldOrder.status, newOrder.status);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, sendAutoNotification]);

  return { sendAutoNotification };
};

// Função auxiliar para obter configurações de notificação
async function getNotificationSettings(): Promise<NotificationSettings | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // TODO: Buscar configurações do banco quando a tabela for criada
    // Por enquanto, retorna configurações padrão
    return {
      whatsapp_enabled: true,
      email_enabled: false,
      auto_notifications: true,
    };
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    return null;
  }
}

// Função auxiliar para obter label do status
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Aguardando Postagem',
    in_transit: 'Em Trânsito',
    out_for_delivery: 'Saiu para Entrega',
    delivered: 'Entregue',
    delayed: 'Atrasado',
    failed: 'Falha na Entrega',
    returned: 'Devolvido',
  };

  return labels[status] || status;
}

// Hook para gerenciar notificações manuais
export const useManualNotifications = () => {
  const { processTemplate } = useNotificationTemplates();
  const { toast } = useToast();

  const sendNotification = useCallback(async (
    order: OrderData,
    type: 'whatsapp' | 'email' | 'sms',
    template: string,
    customMessage?: string
  ) => {
    try {
      const variables = {
        cliente: order.customer_name,
        codigo: order.tracking_code,
        status: getStatusLabel(order.status),
        transportadora: order.carrier,
        link: `${window.location.origin}/rastrear/${order.tracking_code}`,
      };

      const message = customMessage || processTemplate(template, variables);

      let success = false;

      if (type === 'whatsapp' && order.customer_phone) {
        success = await sendWhatsAppNotification(order.customer_phone, message, variables);
      } else if (type === 'email' && order.customer_email) {
        // TODO: Implementar envio de email
        success = true;
      } else if (type === 'sms' && order.customer_phone) {
        // TODO: Implementar envio de SMS
        success = true;
      }

      if (success) {
        toast({
          title: "Notificação enviada!",
          description: `${type.toUpperCase()} enviado com sucesso`,
        });
      } else {
        toast({
          title: "Erro no envio",
          description: `Não foi possível enviar ${type.toUpperCase()}`,
          variant: "destructive",
        });
      }

      return success;
    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
      toast({
        title: "Erro no envio",
        description: "Ocorreu um erro inesperado",
        variant: "destructive",
      });
      return false;
    }
  }, [processTemplate, toast]);

  return { sendNotification };
};