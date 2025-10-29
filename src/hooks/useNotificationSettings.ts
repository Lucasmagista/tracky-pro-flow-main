import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface NotificationSettings {
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_number: string;
  auto_notifications: boolean;
  delay_hours: number;
}

export interface NotificationTemplate {
  id: string;
  type: 'email' | 'whatsapp' | 'sms';
  name: string;
  subject?: string;
  content: string;
  is_default: boolean;
  is_active: boolean;
}

export const useNotificationSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>({
    whatsapp_enabled: false,
    email_enabled: true,
    sms_enabled: false,
    whatsapp_number: '',
    auto_notifications: true,
    delay_hours: 2,
  });
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!user) return;

    try {
      // Carregar configurações da tabela profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      if (profileData) {
        setSettings({
          whatsapp_enabled: (profileData as any).whatsapp_enabled || false,
          email_enabled: (profileData as any).email_enabled !== false,
          sms_enabled: (profileData as any).sms_enabled || false,
          whatsapp_number: (profileData as any).whatsapp_phone || '',
          auto_notifications: (profileData as any).whatsapp_auto_reply !== false,
          delay_hours: 2,
        });
      }

      const { data: templatesData, error: templatesError } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('type', { ascending: true })
        .order('name', { ascending: true });

      if (templatesError) throw templatesError;

      setTemplates((templatesData || []).map(t => ({ ...t as any, is_default: false })));
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  }, [user]);

  const saveSettings = useCallback(async (newSettings: NotificationSettings) => {
    if (!user) return;

    setLoading(true);
    try {
      // Salvar na tabela profiles
      const { error } = await supabase
        .from('profiles')
        .update({
          whatsapp_enabled: newSettings.whatsapp_enabled,
          whatsapp_phone: newSettings.whatsapp_number,
          whatsapp_auto_reply: newSettings.auto_notifications,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', user.id);

      if (error) throw error;

      setSettings(newSettings);
      toast.success('Configurações de notificação salvas!');
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast.error('Erro ao salvar configurações');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const saveTemplate = useCallback(async (template: Omit<NotificationTemplate, 'id'>) => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notification_templates')
        .upsert({
          user_id: user.id,
          ...template,
        })
        .select()
        .single();

      if (error) throw error;

      // Reload templates
      await loadSettings();
      toast.success('Template salvo!');
      return data;
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Erro ao salvar template');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, loadSettings]);

  const deleteTemplate = useCallback(async (templateId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notification_templates')
        .delete()
        .eq('id', templateId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Reload templates
      await loadSettings();
      toast.success('Template excluído!');
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Erro ao excluir template');
      throw error;
    }
  }, [user, loadSettings]);

  const testNotification = useCallback(async (type: 'email' | 'whatsapp' | 'sms', recipient: string) => {
    if (!user) return;

    try {
      const template = templates.find(t => t.type === type && t.is_default);
      if (!template) {
        toast.error(`Template ${type} não encontrado`);
        return;
      }

      const { error } = await supabase.functions.invoke('test-notification', {
        body: {
          type,
          recipient,
          template: template.content,
          subject: template.subject,
        }
      });

      if (error) throw error;

      toast.success(`Teste de ${type} enviado!`);
    } catch (error) {
      console.error('Error testing notification:', error);
      toast.error(`Erro ao testar ${type}`);
      throw error;
    }
  }, [user, templates]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    templates,
    loading,
    saveSettings,
    saveTemplate,
    deleteTemplate,
    testNotification,
    reload: loadSettings,
  };
};