import { supabase } from '@/integrations/supabase/client';

export interface WhatsAppConfig {
  enabled: boolean;
  apiKey?: string;
  sessionId?: string;
}

export interface WhatsAppStatus {
  isConnected: boolean;
  qrCode?: string;
  sessionId?: string;
}

class WhatsAppService {
  private config: WhatsAppConfig = { enabled: false };
  private status: WhatsAppStatus = { isConnected: false };
  private isReady = false;
  private statusCallbacks: ((status: WhatsAppStatus) => void)[] = [];

  constructor() {
    this.loadConfig();
  }

  private async loadConfig() {
    try {
      // TODO: Load WhatsApp configuration from database
      // For now, assume it's enabled
      this.config.enabled = true;
      this.isReady = true;
    } catch (error) {
      console.error('Error loading WhatsApp config:', error);
    }
  }

  async initialize(): Promise<WhatsAppStatus> {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-service?action=initialize');

      if (error) throw error;

      this.status = {
        isConnected: false,
        qrCode: data.qrCode,
        sessionId: data.sessionId
      };

      this.notifyStatusChange();
      return this.status;
    } catch (error) {
      console.error('Erro ao inicializar WhatsApp:', error);
      throw error;
    }
  }

  async connect(): Promise<void> {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-service?action=connect');

      if (error) throw error;

      this.status.isConnected = true;
      this.status.qrCode = undefined;
      this.notifyStatusChange();
    } catch (error) {
      console.error('Erro ao conectar WhatsApp:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-service?action=disconnect');

      if (error) throw error;

      this.status = { isConnected: false };
      this.notifyStatusChange();
    } catch (error) {
      console.error('Erro ao desconectar WhatsApp:', error);
      throw error;
    }
  }

  async getStatus(): Promise<WhatsAppStatus> {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-service?action=get_status');

      if (error) throw error;

      this.status = {
        isConnected: data.isConnected,
        qrCode: data.qrCode,
        sessionId: data.sessionId
      };

      return this.status;
    } catch (error) {
      console.error('Erro ao obter status do WhatsApp:', error);
      return this.status;
    }
  }

  isConnected(): boolean {
    return this.status.isConnected;
  }

  onStatusChange(callback: (status: WhatsAppStatus) => void) {
    this.statusCallbacks.push(callback);
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyStatusChange() {
    this.statusCallbacks.forEach(callback => callback(this.status));
  }

  async sendMessage(to: string, message: string): Promise<boolean> {
    if (!this.isConnected()) {
      throw new Error('WhatsApp não está conectado');
    }

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-service?action=send_message', {
        body: { phone: to, message }
      });

      if (error) throw error;

      return data.success || false;
    } catch (error) {
      console.error('Erro ao enviar mensagem WhatsApp:', error);
      throw error;
    }
  }

  async getQRCode(): Promise<string | null> {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-service?action=get_qr');

      if (error) throw error;

      return data.qrCode || null;
    } catch (error) {
      console.error('Erro ao obter QR code:', error);
      return null;
    }
  }
}

// Singleton instance
export const whatsAppService = new WhatsAppService();

// Função utilitária para enviar notificações
export const sendWhatsAppNotification = async (
  phoneNumber: string,
  template: string,
  variables: Record<string, string>
): Promise<boolean> => {
  try {
    // Substituir variáveis no template
    let message = template;
    Object.entries(variables).forEach(([key, value]) => {
      message = message.replace(new RegExp(`{${key}}`, 'g'), value);
    });

    return await whatsAppService.sendMessage(phoneNumber, message);
  } catch (error) {
    console.error('Erro ao enviar notificação WhatsApp:', error);
    return false;
  }
};

// Hook para gerenciar WhatsApp
export const useWhatsApp = () => {
  const initialize = async () => {
    try {
      const status = await whatsAppService.initialize();
      return status;
    } catch (error) {
      console.error('Erro ao inicializar WhatsApp:', error);
      throw error;
    }
  };

  const connect = async () => {
    try {
      await whatsAppService.connect();
      return true;
    } catch (error) {
      console.error('Erro ao conectar WhatsApp:', error);
      return false;
    }
  };

  const disconnect = async () => {
    try {
      await whatsAppService.disconnect();
      return true;
    } catch (error) {
      console.error('Erro ao desconectar WhatsApp:', error);
      return false;
    }
  };

  const getStatus = () => whatsAppService.getStatus();

  const isConnected = () => whatsAppService.isConnected();

  const onStatusChange = (callback: (status: WhatsAppStatus) => void) => {
    return whatsAppService.onStatusChange(callback);
  };

  const getQRCode = () => whatsAppService.getQRCode();

  return {
    initialize,
    connect,
    disconnect,
    getStatus,
    isConnected,
    onStatusChange,
    getQRCode,
    sendMessage: whatsAppService.sendMessage.bind(whatsAppService)
  };
};