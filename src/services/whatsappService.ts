import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppSession {
  id: string;
  name: string;
  status: "connected" | "disconnected" | "connecting" | "qr";
  qrCode?: string;
  phone?: string;
  lastActivity?: string;
}

export interface WhatsAppMessage {
  id: string;
  session_id: string;
  to: string;
  message: string;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  error?: string;
}

// Base URL do servidor WPPConnect (você precisará configurar isso)
const WPP_SERVER_URL = import.meta.env.VITE_WPP_SERVER_URL || "http://localhost:21465";
const WPP_SECRET_KEY = import.meta.env.VITE_WPP_SECRET_KEY || "THISISMYSECURETOKEN";

class WhatsAppService {
  /**
   * Iniciar uma nova sessão do WhatsApp
   */
  async startSession(sessionName: string): Promise<{ success: boolean; qrCode?: string; error?: string }> {
    try {
      console.log("📡 Fazendo requisição para:", `${WPP_SERVER_URL}/api/${sessionName}/start-session`);
      
      const response = await fetch(`${WPP_SERVER_URL}/api/${sessionName}/start-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${WPP_SECRET_KEY}`,
        },
        body: JSON.stringify({
          webhook: `${window.location.origin}/api/whatsapp/webhook`,
          waitQrCode: true,
        }),
      });

      console.log("📥 Response status:", response.status);
      const data = await response.json();
      console.log("📥 Response data:", data);

      // Verificar se já está conectado
      const connectedStates = ["CONNECTED", "inChat", "qrReadSuccess", "MAIN"];
      const isConnected = connectedStates.includes(data.status) || 
                         connectedStates.includes(data.state) ||
                         data.message === "Connected";

      if (isConnected) {
        console.log("✅ Já conectado");
        return { success: true };
      }

      // Verificar se tem QR Code
      const qrStates = ["QRCODE", "notLogged", "QR"];
      const hasQR = qrStates.includes(data.status) || 
                   qrStates.includes(data.state) ||
                   data.qrcode || 
                   data.qr;

      if (hasQR) {
        const qrCodeValue = data.qrcode || data.qr;
        console.log("✅ QR Code encontrado:", qrCodeValue ? `${qrCodeValue.substring(0, 50)}...` : "null");
        return {
          success: true,
          qrCode: qrCodeValue,
        };
      }

      console.error("❌ Status não reconhecido:", data.status);
      return {
        success: false,
        error: data.message || "Erro ao iniciar sessão",
      };
    } catch (error) {
      console.error("❌ Error starting session:", error);
      return {
        success: false,
        error: "Erro ao conectar com o servidor WPPConnect",
      };
    }
  }

  /**
   * Verificar o status de uma sessão
   */
  async checkSession(sessionName: string): Promise<WhatsAppSession | null> {
    try {
      const response = await fetch(`${WPP_SERVER_URL}/api/${sessionName}/check-connection-session`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${WPP_SECRET_KEY}`,
        },
      });

      const data = await response.json();
      console.log("📊 Status da sessão:", data);

      // Estados que indicam conexão bem-sucedida
      const connectedStates = ["CONNECTED", "inChat", "qrReadSuccess", "MAIN"];
      const isConnected = connectedStates.includes(data.status) || 
                         connectedStates.includes(data.state) ||
                         data.message === "Connected";

      if (isConnected) {
        return {
          id: sessionName,
          name: sessionName,
          status: "connected",
          phone: data.phone || data.wid?.user,
          lastActivity: new Date().toISOString(),
        };
      }

      // Estados que indicam QR Code aguardando scan
      const qrStates = ["QRCODE", "notLogged", "QR"];
      const hasQR = qrStates.includes(data.status) || 
                   qrStates.includes(data.state) ||
                   data.qrcode || 
                   data.qr;

      if (hasQR) {
        return {
          id: sessionName,
          name: sessionName,
          status: "qr",
          qrCode: data.qrcode || data.qr,
        };
      }

      return {
        id: sessionName,
        name: sessionName,
        status: "disconnected",
      };
    } catch (error) {
      console.error("Error checking session:", error);
      return null;
    }
  }

  /**
   * Desconectar uma sessão
   */
  async logoutSession(sessionName: string): Promise<boolean> {
    try {
      const response = await fetch(`${WPP_SERVER_URL}/api/${sessionName}/logout-session`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WPP_SECRET_KEY}`,
        },
      });

      const data = await response.json();
      return data.status === true || data.message === "Successfully closed session";
    } catch (error) {
      console.error("Error logging out:", error);
      return false;
    }
  }

  /**
   * Enviar mensagem de texto
   */
  async sendMessage(
    sessionName: string,
    phone: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Formatar número de telefone (remover caracteres especiais)
      const cleanPhone = phone.replace(/[^\d]/g, "");
      const formattedPhone = cleanPhone.includes("@") ? cleanPhone : `${cleanPhone}@c.us`;

      const response = await fetch(`${WPP_SERVER_URL}/api/${sessionName}/send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${WPP_SECRET_KEY}`,
        },
        body: JSON.stringify({
          phone: formattedPhone,
          message: message,
          isGroup: false,
        }),
      });

      const data = await response.json();

      if (data.status === "success" || data.result === "success") {
        return {
          success: true,
          messageId: data.messageId || data.id,
        };
      }

      return {
        success: false,
        error: data.message || "Erro ao enviar mensagem",
      };
    } catch (error) {
      console.error("Error sending message:", error);
      return {
        success: false,
        error: "Erro ao enviar mensagem",
      };
    }
  }

  /**
   * Enviar mensagem com imagem
   */
  async sendImage(
    sessionName: string,
    phone: string,
    imageUrl: string,
    caption?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const cleanPhone = phone.replace(/[^\d]/g, "");
      const formattedPhone = cleanPhone.includes("@") ? cleanPhone : `${cleanPhone}@c.us`;

      const response = await fetch(`${WPP_SERVER_URL}/api/${sessionName}/send-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${WPP_SECRET_KEY}`,
        },
        body: JSON.stringify({
          phone: formattedPhone,
          path: imageUrl,
          caption: caption || "",
        }),
      });

      const data = await response.json();

      if (data.status === "success" || data.result === "success") {
        return {
          success: true,
          messageId: data.messageId || data.id,
        };
      }

      return {
        success: false,
        error: data.message || "Erro ao enviar imagem",
      };
    } catch (error) {
      console.error("Error sending image:", error);
      return {
        success: false,
        error: "Erro ao enviar imagem",
      };
    }
  }

  /**
   * Obter QR Code para conexão
   */
  async getQRCode(sessionName: string): Promise<string | null> {
    try {
      const response = await fetch(`${WPP_SERVER_URL}/api/${sessionName}/start-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${WPP_SECRET_KEY}`,
        },
        body: JSON.stringify({
          waitQrCode: true,
        }),
      });

      const data = await response.json();
      return data.qrcode || data.qr || null;
    } catch (error) {
      console.error("Error getting QR code:", error);
      return null;
    }
  }

  /**
   * Obter informações do telefone conectado
   */
  async getPhoneInfo(sessionName: string): Promise<{ phone?: string; name?: string } | null> {
    try {
      const response = await fetch(`${WPP_SERVER_URL}/api/${sessionName}/show-all-contacts`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${WPP_SECRET_KEY}`,
        },
      });

      const data = await response.json();
      
      if (data.me) {
        return {
          phone: data.me.user,
          name: data.me.pushname || data.me.name,
        };
      }

      return null;
    } catch (error) {
      console.error("Error getting phone info:", error);
      return null;
    }
  }

  /**
   * Salvar sessão no banco de dados
   */
  async saveSessionToDatabase(userId: string, session: WhatsAppSession): Promise<void> {
    try {
      await supabase.from("profiles").update({
        whatsapp_session_name: session.name,
        whatsapp_status: session.status,
        whatsapp_phone: session.phone,
        whatsapp_last_activity: session.lastActivity,
        updated_at: new Date().toISOString(),
      }).eq("id", userId);
    } catch (error) {
      console.error("Error saving session to database:", error);
    }
  }

  /**
   * Carregar sessão do banco de dados
   */
  async loadSessionFromDatabase(userId: string): Promise<WhatsAppSession | null> {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error || !data) return null;

      const profileData = data as unknown as Record<string, unknown>;

      return {
        id: (profileData.whatsapp_session_name as string) || "",
        name: (profileData.whatsapp_session_name as string) || "",
        status: (profileData.whatsapp_status as "connected" | "disconnected" | "connecting" | "qr") || "disconnected",
        phone: (profileData.whatsapp_phone as string) || undefined,
        lastActivity: (profileData.whatsapp_last_activity as string) || undefined,
      };
    } catch (error) {
      console.error("Error loading session from database:", error);
      return null;
    }
  }
}

export const whatsappService = new WhatsAppService();
