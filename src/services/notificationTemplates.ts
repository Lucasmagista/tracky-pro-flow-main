import { supabase } from '@/integrations/supabase/client';

export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'whatsapp' | 'email' | 'sms';
  subject?: string; // Para email
  content: string;
  variables: string[]; // Lista de variáveis disponíveis
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationVariables {
  cliente: string;
  codigo: string;
  status: string;
  transportadora: string;
  link: string;
  data_estimada?: string;
  data_atual?: string;
}

// Templates padrão
export const defaultTemplates: Omit<NotificationTemplate, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Pedido Postado',
    type: 'whatsapp',
    content: 'Olá {cliente}! 📦\n\nSeu pedido *{codigo}* foi postado na *{transportadora}*.\n\nAcompanhe em tempo real: {link}',
    variables: ['cliente', 'codigo', 'transportadora', 'link'],
    is_default: true,
  },
  {
    name: 'Em Trânsito',
    type: 'whatsapp',
    content: 'Olá {cliente}! 🚚\n\nSeu pedido *{codigo}* está em trânsito pela *{transportadora}*.\n\nStatus atual: *{status}*\nAcompanhe: {link}',
    variables: ['cliente', 'codigo', 'transportadora', 'status', 'link'],
    is_default: true,
  },
  {
    name: 'Saiu para Entrega',
    type: 'whatsapp',
    content: 'Olá {cliente}! 🏠\n\nSeu pedido *{codigo}* saiu para entrega!\n\n*{transportadora}* está a caminho.\nAcompanhe: {link}',
    variables: ['cliente', 'codigo', 'transportadora', 'link'],
    is_default: true,
  },
  {
    name: 'Entregue',
    type: 'whatsapp',
    content: 'Olá {cliente}! ✅\n\nSeu pedido *{codigo}* foi entregue com sucesso!\n\nObrigado por escolher nossa loja! 🛍️',
    variables: ['cliente', 'codigo'],
    is_default: true,
  },
  {
    name: 'Atrasado',
    type: 'whatsapp',
    content: 'Olá {cliente}! ⏰\n\nInformamos que seu pedido *{codigo}* está com atraso.\n\n*{transportadora}* - Status: *{status}*\n\nEstamos acompanhando e entraremos em contato em breve.\nAcompanhe: {link}',
    variables: ['cliente', 'codigo', 'transportadora', 'status', 'link'],
    is_default: true,
  },
  {
    name: 'Recuperação de Senha',
    type: 'email',
    subject: 'Recuperação de senha - Tracky Pro Flow',
    content: `Olá!

Recebemos uma solicitação para redefinir sua senha no Tracky Pro Flow.

Para criar uma nova senha, clique no link abaixo:
{reset_link}

Este link é válido por 1 hora. Se você não solicitou esta recuperação, ignore este email.

Atenciosamente,
Equipe Tracky Pro Flow`,
    variables: ['reset_link'],
    is_default: true,
  },
];

// Classe para gerenciar templates
export class NotificationTemplateManager {
  static async getTemplates(userId: string, type?: 'whatsapp' | 'email' | 'sms'): Promise<NotificationTemplate[]> {
    try {
      let query = supabase
        .from('notification_templates')
        .select('*')
        .eq('user_id', userId);

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Se não há templates personalizados, retorna os padrões
      if (!data || data.length === 0) {
        return defaultTemplates.map(template => ({
          ...template,
          id: `default-${template.name.toLowerCase().replace(/\s+/g, '-')}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
      }

      return data;
    } catch (error) {
      console.error('Erro ao buscar templates:', error);
      // Retorna templates padrão em caso de erro
      return defaultTemplates.map(template => ({
        ...template,
        id: `default-${template.name.toLowerCase().replace(/\s+/g, '-')}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
    }
  }

  static async saveTemplate(userId: string, template: Omit<NotificationTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<NotificationTemplate | null> {
    try {
      const { data, error } = await supabase
        .from('notification_templates')
        .insert({
          ...template,
          user_id: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      return null;
    }
  }

  static async updateTemplate(templateId: string, updates: Partial<NotificationTemplate>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notification_templates')
        .update(updates)
        .eq('id', templateId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Erro ao atualizar template:', error);
      return false;
    }
  }

  static async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notification_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Erro ao deletar template:', error);
      return false;
    }
  }

  static getTemplateByStatus(status: string, type: 'whatsapp' | 'email' | 'sms' = 'whatsapp'): NotificationTemplate | null {
    const statusMap: Record<string, string> = {
      'pending': 'Pedido Postado',
      'in_transit': 'Em Trânsito',
      'out_for_delivery': 'Saiu para Entrega',
      'delivered': 'Entregue',
      'delayed': 'Atrasado',
      'failed': 'Atrasado',
      'returned': 'Atrasado',
    };

    const templateName = statusMap[status];
    if (!templateName) return null;

    return defaultTemplates.find(t => t.name === templateName && t.type === type) || null;
  }

  static replaceVariables(template: string, variables: NotificationVariables): string {
    let result = template;

    Object.entries(variables).forEach(([key, value]) => {
      if (value) {
        result = result.replace(new RegExp(`{${key}}`, 'g'), value);
      }
    });

    return result;
  }
}

// Hook para usar templates
export const useNotificationTemplates = () => {
  const getTemplates = async (type?: 'whatsapp' | 'email' | 'sms') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    return await NotificationTemplateManager.getTemplates(user.id, type);
  };

  const saveTemplate = async (template: Omit<NotificationTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    return await NotificationTemplateManager.saveTemplate(user.id, template);
  };

  const updateTemplate = async (templateId: string, updates: Partial<NotificationTemplate>) => {
    return await NotificationTemplateManager.updateTemplate(templateId, updates);
  };

  const deleteTemplate = async (templateId: string) => {
    return await NotificationTemplateManager.deleteTemplate(templateId);
  };

  const getTemplateForStatus = (status: string, type: 'whatsapp' | 'email' | 'sms' = 'whatsapp') => {
    return NotificationTemplateManager.getTemplateByStatus(status, type);
  };

  const processTemplate = (template: string, variables: NotificationVariables) => {
    return NotificationTemplateManager.replaceVariables(template, variables);
  };

  return {
    getTemplates,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplateForStatus,
    processTemplate,
  };
};