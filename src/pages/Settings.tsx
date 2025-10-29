import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Settings as SettingsIcon,
  Bell,
  MessageSquare,
  Store,
  ArrowLeft,
  Save,
  TestTube,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Mail,
  Webhook
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import EmptyState from '@/components/EmptyState'
import { useMarketplaceIntegrations, useCarrierIntegrations } from "@/hooks/useIntegrations";
import { useNotificationSettings, type NotificationTemplate } from "@/hooks/useNotificationSettings";
import { WebhookManager } from "@/components/WebhookManager";
import { NuvemshopConfig } from "@/components/NuvemshopConfig";
import { SmartenviosConfig } from "@/components/SmartenviosConfig";
import { toast } from "sonner";

interface StoreSettings {
  store_name: string;
  store_email: string;
  store_phone: string;
  store_address: string;
  timezone: string;
  currency: string;
}

interface Session {
  id: string;
  device: string;
  location: string;
  ip: string;
  lastActive: string;
  current: boolean;
}

interface ActivityLog {
  id: string;
  action: string;
  timestamp: string;
  ip: string;
  device: string;
}

const Settings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    store_name: "",
    store_email: "",
    store_phone: "",
    store_address: "",
    timezone: "America/Sao_Paulo",
    currency: "BRL",
  });

  // Integration hooks
  const {
    settings: notificationSettings,
    templates,
    loading: notificationLoading,
    saveSettings: saveNotificationSettings,
    saveTemplate,
    deleteTemplate,
    testNotification,
  } = useNotificationSettings();

  const {
    integrations: marketplaceIntegrations,
    loading: marketplaceLoading,
    connectShopify,
    connectWooCommerce,
    connectMercadoLivre,
    disconnect: disconnectMarketplace,
  } = useMarketplaceIntegrations();

  const {
    integrations: carrierIntegrations,
    loading: carrierLoading,
    connectCarrier,
    disconnectCarrier: disconnectCarrierIntegration,
  } = useCarrierIntegrations();

  // Preferences state (real implementation)
  const [preferences, setPreferences] = useState({
    darkMode: false,
    autoUpdate: true,
    notificationSounds: true,
    compactTables: false,
    language: 'pt-BR',
    dateFormat: 'dd/mm/yyyy',
    itemsPerPage: 20,
  });

  // Appearance state (real implementation)
  const [appearance, setAppearance] = useState({
    theme: 'light',
    accentColor: 'blue',
    density: 'comfortable',
    font: 'inter',
    fontSize: 'medium',
    sidebarAlwaysVisible: true,
    showBreadcrumbs: true,
    coloredIcons: true,
    menuPosition: 'left',
    animatedWidgets: true,
    realTimeCharts: true,
    visibleWidgets: {
      totalOrders: true,
      deliveryRate: true,
      inTransit: true,
      activeAlerts: true,
      salesChart: true,
      deliveryMap: true,
    },
  });

  // Template management state
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    type: 'email' as 'email' | 'whatsapp' | 'sms',
    name: '',
    subject: '',
    content: '',
    is_default: false,
    is_active: true,
  });

  // Integration dialogs state
  const [shopifyDialogOpen, setShopifyDialogOpen] = useState(false);
  const [woocommerceDialogOpen, setWoocommerceDialogOpen] = useState(false);
  const [mercadolivreDialogOpen, setMercadolivreDialogOpen] = useState(false);
  const [nuvemshopDialogOpen, setNuvemshopDialogOpen] = useState(false);
  const [carrierDialogOpen, setCarrierDialogOpen] = useState(false);
  const [smartenviosDialogOpen, setSmartenviosDialogOpen] = useState(false);

  // Integration credentials state
  const [shopifyCredentials, setShopifyCredentials] = useState({ shopDomain: '', accessToken: '' });
  const [woocommerceCredentials, setWoocommerceCredentials] = useState({ storeUrl: '', consumerKey: '', consumerSecret: '' });
  const [mercadolivreCredentials, setMercadolivreCredentials] = useState({ accessToken: '', sellerId: '' });
  const [carrierCredentials, setCarrierCredentials] = useState({ carrier: '', apiKey: '', apiSecret: '' });

  // Test notification state
  const [testRecipient, setTestRecipient] = useState('');
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testType, setTestType] = useState<'email' | 'whatsapp' | 'sms'>('email');

  // Security dialogs state
  const [twoFactorDialogOpen, setTwoFactorDialogOpen] = useState(false);
  const [sessionsDialogOpen, setSessionsDialogOpen] = useState(false);
  const [activityLogsDialogOpen, setActivityLogsDialogOpen] = useState(false);
  const [exportDataDialogOpen, setExportDataDialogOpen] = useState(false);
  
  // Security states
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [exportProgress, setExportProgress] = useState(0);

  const loadSettings = useCallback(async () => {
    if (!user) return;

    try {
      // Carregar configurações da loja
      const { data: profile } = await supabase
        .from("profiles")
        .select("store_name, store_email, store_phone, store_address")
        .eq("id", user.id)
        .single();

      if (profile) {
        setStoreSettings(prev => ({
          ...prev,
          store_name: profile.store_name || "",
          store_email: profile.store_email || "",
          store_phone: profile.store_phone || "",
          store_address: profile.store_address || "",
        }));
      }

      // Carregar preferências (se existir tabela user_preferences)
      const savedPreferences = localStorage.getItem(`preferences_${user.id}`);
      if (savedPreferences) {
        setPreferences(JSON.parse(savedPreferences));
      }

      // Carregar aparência
      const savedAppearance = localStorage.getItem(`appearance_${user.id}`);
      if (savedAppearance) {
        setAppearance(JSON.parse(savedAppearance));
      }

      // Carregar estado do 2FA
      const saved2FA = localStorage.getItem(`2fa_enabled_${user.id}`);
      if (saved2FA === 'true') {
        setTwoFactorEnabled(true);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user, loadSettings]);

  // Aplicar configurações de aparência automaticamente ao carregar
  useEffect(() => {
    if (!appearance) return;

    const root = document.documentElement;
    
    // Aplicar tema
    if (appearance.theme === 'dark') {
      root.classList.add('dark');
    } else if (appearance.theme === 'light') {
      root.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }

    // Aplicar cor de destaque
    const getAccentColorValue = (color: string): string => {
      const colorMap: Record<string, string> = {
        blue: '#3b82f6',
        green: '#22c55e',
        purple: '#a855f7',
        pink: '#ec4899',
        orange: '#f97316',
        red: '#ef4444',
      };
      return colorMap[color] || colorMap.blue;
    };
    root.style.setProperty('--color-primary', getAccentColorValue(appearance.accentColor));
    
    // Aplicar densidade
    switch (appearance.density) {
      case 'compact':
        root.style.setProperty('--spacing-unit', '0.75rem');
        root.style.setProperty('--padding-card', '0.75rem');
        root.style.setProperty('--gap-unit', '0.5rem');
        break;
      case 'comfortable':
        root.style.setProperty('--spacing-unit', '1rem');
        root.style.setProperty('--padding-card', '1.5rem');
        root.style.setProperty('--gap-unit', '1rem');
        break;
      case 'spacious':
        root.style.setProperty('--spacing-unit', '1.5rem');
        root.style.setProperty('--padding-card', '2rem');
        root.style.setProperty('--gap-unit', '1.5rem');
        break;
    }

    // Aplicar fonte
    switch (appearance.font) {
      case 'inter':
        root.style.fontFamily = 'Inter, system-ui, sans-serif';
        break;
      case 'roboto':
        root.style.fontFamily = 'Roboto, system-ui, sans-serif';
        break;
      case 'opensans':
        root.style.fontFamily = '"Open Sans", system-ui, sans-serif';
        break;
      case 'lato':
        root.style.fontFamily = 'Lato, system-ui, sans-serif';
        break;
    }

    // Aplicar tamanho da fonte
    switch (appearance.fontSize) {
      case 'small':
        root.style.fontSize = '14px';
        break;
      case 'medium':
        root.style.fontSize = '16px';
        break;
      case 'large':
        root.style.fontSize = '18px';
        break;
    }

    // Aplicar configurações de ícones
    if (appearance.coloredIcons) {
      root.classList.add('colored-icons');
    } else {
      root.classList.remove('colored-icons');
    }

    // Aplicar animações
    if (appearance.animatedWidgets) {
      root.classList.add('animated-widgets');
    } else {
      root.classList.remove('animated-widgets');
    }
  }, [appearance]);

  const handleSaveStoreSettings = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          store_name: storeSettings.store_name,
          store_email: storeSettings.store_email,
          store_phone: storeSettings.store_phone,
          store_address: storeSettings.store_address,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Configurações da loja salvas com sucesso!");
    } catch (error) {
      console.error("Error saving store settings:", error);
      toast.error("Erro ao salvar configurações da loja");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = useCallback(async () => {
    if (!user) return;

    try {
      // Salvar no localStorage (pode ser migrado para banco posteriormente)
      localStorage.setItem(`preferences_${user.id}`, JSON.stringify(preferences));
      toast.success("Preferências salvas com sucesso!");
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error("Erro ao salvar preferências");
    }
  }, [user, preferences]);

  const handleSaveAppearance = useCallback(async () => {
    if (!user) return;

    try {
      // Salvar no localStorage
      localStorage.setItem(`appearance_${user.id}`, JSON.stringify(appearance));
      
      const root = document.documentElement;
      
      // Aplicar tema (dark/light/system)
      if (appearance.theme === 'dark') {
        root.classList.add('dark');
      } else if (appearance.theme === 'light') {
        root.classList.remove('dark');
      } else {
        // Sistema
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }

      // Aplicar cor de destaque
      root.style.setProperty('--color-primary', getAccentColorValue(appearance.accentColor));
      
      // Aplicar densidade da interface
      switch (appearance.density) {
        case 'compact':
          root.style.setProperty('--spacing-unit', '0.75rem');
          root.style.setProperty('--padding-card', '0.75rem');
          root.style.setProperty('--gap-unit', '0.5rem');
          break;
        case 'comfortable':
          root.style.setProperty('--spacing-unit', '1rem');
          root.style.setProperty('--padding-card', '1.5rem');
          root.style.setProperty('--gap-unit', '1rem');
          break;
        case 'spacious':
          root.style.setProperty('--spacing-unit', '1.5rem');
          root.style.setProperty('--padding-card', '2rem');
          root.style.setProperty('--gap-unit', '1.5rem');
          break;
      }

      // Aplicar fonte
      switch (appearance.font) {
        case 'inter':
          root.style.fontFamily = 'Inter, system-ui, sans-serif';
          break;
        case 'roboto':
          root.style.fontFamily = 'Roboto, system-ui, sans-serif';
          break;
        case 'opensans':
          root.style.fontFamily = '"Open Sans", system-ui, sans-serif';
          break;
        case 'lato':
          root.style.fontFamily = 'Lato, system-ui, sans-serif';
          break;
      }

      // Aplicar tamanho da fonte
      switch (appearance.fontSize) {
        case 'small':
          root.style.fontSize = '14px';
          break;
        case 'medium':
          root.style.fontSize = '16px';
          break;
        case 'large':
          root.style.fontSize = '18px';
          break;
      }

      // Aplicar configurações de sidebar
      const sidebar = document.querySelector('[data-sidebar]');
      if (sidebar) {
        if (appearance.sidebarAlwaysVisible) {
          sidebar.classList.add('sidebar-visible');
        } else {
          sidebar.classList.remove('sidebar-visible');
        }
      }

      // Aplicar configurações de ícones
      if (appearance.coloredIcons) {
        root.classList.add('colored-icons');
      } else {
        root.classList.remove('colored-icons');
      }

      // Aplicar animações
      if (appearance.animatedWidgets) {
        root.classList.add('animated-widgets');
      } else {
        root.classList.remove('animated-widgets');
      }

      toast.success("Aparência salva e aplicada com sucesso!");
    } catch (error) {
      console.error("Error saving appearance:", error);
      toast.error("Erro ao salvar aparência");
    }
  }, [user, appearance]);

  // Função auxiliar para obter o valor da cor de destaque
  const getAccentColorValue = (color: string): string => {
    const colorMap: Record<string, string> = {
      blue: '#3b82f6',
      green: '#22c55e',
      purple: '#a855f7',
      pink: '#ec4899',
      orange: '#f97316',
      red: '#ef4444',
    };
    return colorMap[color] || colorMap.blue;
  };

  const handleResetAppearance = useCallback(() => {
    if (!user) return;

    const defaultAppearance = {
      theme: 'light',
      accentColor: 'blue',
      density: 'comfortable',
      font: 'inter',
      fontSize: 'medium',
      sidebarAlwaysVisible: true,
      showBreadcrumbs: true,
      coloredIcons: true,
      menuPosition: 'left',
      animatedWidgets: true,
      realTimeCharts: true,
      visibleWidgets: {
        totalOrders: true,
        deliveryRate: true,
        inTransit: true,
        activeAlerts: true,
        salesChart: true,
        deliveryMap: true,
      },
    };

    setAppearance(defaultAppearance);
    localStorage.setItem(`appearance_${user.id}`, JSON.stringify(defaultAppearance));
    document.documentElement.classList.remove('dark');
    toast.success("Aparência resetada para padrão!");
  }, [user]);

  const handleSaveNotificationSettings = async () => {
    try {
      await saveNotificationSettings(notificationSettings);
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    setTemplateForm({
      type: 'email',
      name: '',
      subject: '',
      content: '',
      is_default: false,
      is_active: true,
    });
    setTemplateDialogOpen(true);
  };

  const handleEditTemplate = (template: NotificationTemplate) => {
    setSelectedTemplate(template);
    setTemplateForm({
      type: template.type,
      name: template.name,
      subject: template.subject || '',
      content: template.content,
      is_default: template.is_default,
      is_active: template.is_active,
    });
    setTemplateDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    try {
      if (selectedTemplate) {
        await saveTemplate(templateForm);
      } else {
        await saveTemplate(templateForm);
      }
      setTemplateDialogOpen(false);
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (confirm('Tem certeza que deseja excluir este template?')) {
      try {
        await deleteTemplate(templateId);
      } catch (error) {
        // Error already handled in hook
      }
    }
  };

  const handleTestNotification = async () => {
    if (!testRecipient) {
      toast.error('Digite um destinatário para o teste');
      return;
    }

    try {
      await testNotification(testType, testRecipient);
      setTestDialogOpen(false);
      setTestRecipient('');
    } catch (error) {
      // Error already handled in hook
    }
  };

  const openTestDialog = (type: 'email' | 'whatsapp' | 'sms') => {
    setTestType(type);
    setTestDialogOpen(true);
  };

  // Security handlers
  const handleEnable2FA = async () => {
    if (!user) return;
    
    try {
      // Simular geração de QR Code (em produção, isso viria do backend)
      const mockQRCode = `otpauth://totp/${user.email}?secret=JBSWY3DPEHPK3PXP&issuer=TrackyProFlow`;
      setQrCode(mockQRCode);
      setTwoFactorDialogOpen(true);
      toast.info("Escaneie o QR Code com seu app autenticador");
    } catch (error) {
      console.error("Error enabling 2FA:", error);
      toast.error("Erro ao ativar 2FA");
    }
  };

  const handleVerify2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error("Digite um código de 6 dígitos");
      return;
    }

    try {
      // Em produção, verificar com o backend
      setTwoFactorEnabled(true);
      localStorage.setItem(`2fa_enabled_${user?.id}`, 'true');
      setTwoFactorDialogOpen(false);
      setVerificationCode('');
      toast.success("Autenticação de dois fatores ativada com sucesso!");
    } catch (error) {
      console.error("Error verifying 2FA:", error);
      toast.error("Código inválido");
    }
  };

  const handleDisable2FA = async () => {
    if (!window.confirm("Tem certeza que deseja desativar a autenticação de dois fatores?")) {
      return;
    }

    try {
      setTwoFactorEnabled(false);
      localStorage.removeItem(`2fa_enabled_${user?.id}`);
      toast.success("Autenticação de dois fatores desativada");
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      toast.error("Erro ao desativar 2FA");
    }
  };

  const handleLoadSessions = async () => {
    if (!user) return;
    
    try {
      // Simular dados de sessões (em produção, viria do backend)
      const mockSessions: Session[] = [
        {
          id: '1',
          device: 'Chrome no Windows',
          location: 'São Paulo, Brasil',
          ip: '192.168.1.1',
          lastActive: new Date().toISOString(),
          current: true,
        },
        {
          id: '2',
          device: 'Firefox no Mac',
          location: 'Rio de Janeiro, Brasil',
          ip: '192.168.1.2',
          lastActive: new Date(Date.now() - 86400000).toISOString(),
          current: false,
        },
      ];
      
      setSessions(mockSessions);
      setSessionsDialogOpen(true);
    } catch (error) {
      console.error("Error loading sessions:", error);
      toast.error("Erro ao carregar sessões");
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    try {
      setSessions(sessions.filter(s => s.id !== sessionId));
      toast.success("Sessão encerrada com sucesso");
    } catch (error) {
      console.error("Error terminating session:", error);
      toast.error("Erro ao encerrar sessão");
    }
  };

  const handleLoadActivityLogs = async () => {
    if (!user) return;
    
    try {
      // Simular logs de atividade (em produção, viria do backend)
      const mockLogs: ActivityLog[] = [
        {
          id: '1',
          action: 'Login realizado',
          timestamp: new Date().toISOString(),
          ip: '192.168.1.1',
          device: 'Chrome no Windows',
        },
        {
          id: '2',
          action: 'Configurações alteradas',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          ip: '192.168.1.1',
          device: 'Chrome no Windows',
        },
        {
          id: '3',
          action: 'Template criado',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          ip: '192.168.1.1',
          device: 'Chrome no Windows',
        },
      ];
      
      setActivityLogs(mockLogs);
      setActivityLogsDialogOpen(true);
    } catch (error) {
      console.error("Error loading activity logs:", error);
      toast.error("Erro ao carregar logs");
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    
    try {
      setExportDataDialogOpen(true);
      setExportProgress(0);
      
      // Simular progresso de exportação
      const interval = setInterval(() => {
        setExportProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              toast.success("Dados exportados! Verifique seu email.");
              setExportDataDialogOpen(false);
              setExportProgress(0);
            }, 500);
            return 100;
          }
          return prev + 10;
        });
      }, 300);
      
    } catch (error) {
      console.error("Error exporting data:", error);
      toast.error("Erro ao exportar dados");
    }
  };

  const handleConnectShopify = async () => {
    try {
      await connectShopify(shopifyCredentials.shopDomain, shopifyCredentials.accessToken);
      setShopifyDialogOpen(false);
      setShopifyCredentials({ shopDomain: '', accessToken: '' });
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleConnectWooCommerce = async () => {
    try {
      await connectWooCommerce(
        woocommerceCredentials.storeUrl,
        woocommerceCredentials.consumerKey,
        woocommerceCredentials.consumerSecret
      );
      setWoocommerceDialogOpen(false);
      setWoocommerceCredentials({ storeUrl: '', consumerKey: '', consumerSecret: '' });
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleConnectMercadoLivre = async () => {
    try {
      await connectMercadoLivre(mercadolivreCredentials.accessToken, mercadolivreCredentials.sellerId);
      setMercadolivreDialogOpen(false);
      setMercadolivreCredentials({ accessToken: '', sellerId: '' });
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleConnectCarrier = async () => {
    try {
      await connectCarrier(carrierCredentials.carrier, {
        apiKey: carrierCredentials.apiKey,
        apiSecret: carrierCredentials.apiSecret,
      });
      setCarrierDialogOpen(false);
      setCarrierCredentials({ carrier: '', apiKey: '', apiSecret: '' });
    } catch (error) {
      // Error already handled in hook
    }
  };

  const getIntegrationStatus = (platform: string) => {
    const integration = marketplaceIntegrations.find(i => i.platform === platform);
    return integration?.is_connected ? 'Conectado' : 'Disponível';
  };

  const getCarrierStatus = (carrier: string) => {
    const integration = carrierIntegrations.find(i => i.carrier === carrier);
    return integration?.is_connected ? 'Conectado' : 'Disponível';
  };

  if (!user) {
    return (
      <EmptyState
        variant="info"
        title="Carregando configurações..."
        description="Estamos carregando suas configurações pessoais e preferências da conta."
        badge={{ text: "Carregando", variant: "secondary" }}
        tips={[
          "Suas configurações são mantidas seguras na nuvem",
          "Aguarde enquanto sincronizamos seus dados",
          "Configurações incluem notificações e integrações"
        ]}
      />
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 pt-20 pb-12 px-4">
        <div className="container mx-auto max-w-6xl space-y-8">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Configurações</h1>
              <p className="text-muted-foreground">
                Gerencie as configurações da sua loja e notificações
              </p>
            </div>
          </div>

          <Tabs defaultValue="store" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="store" className="flex items-center gap-2">
                <Store className="h-4 w-4" />
                Loja
              </TabsTrigger>
              <TabsTrigger value="preferences" className="flex items-center gap-2">
                <SettingsIcon className="h-4 w-4" />
                Preferências
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notificações
              </TabsTrigger>
              <TabsTrigger value="integrations" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Integrações
              </TabsTrigger>
              <TabsTrigger value="webhooks" className="flex items-center gap-2">
                <Webhook className="h-4 w-4" />
                Webhooks
              </TabsTrigger>
              <TabsTrigger value="appearance" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Aparência
              </TabsTrigger>
            </TabsList>

            {/* Preferences Tab */}
            <TabsContent value="preferences">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Preferências do Sistema</CardTitle>
                    <CardDescription>
                      Configure como o sistema deve se comportar
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Modo Escuro Automático</Label>
                          <p className="text-sm text-muted-foreground">
                            Alternar automaticamente baseado no horário
                          </p>
                        </div>
                        <Switch 
                          checked={preferences.darkMode} 
                          onCheckedChange={(checked) => {
                            setPreferences({ ...preferences, darkMode: checked });
                            // Sincronizar com configuração de tema na aparência
                            if (checked) {
                              setAppearance({ ...appearance, theme: 'dark' });
                              document.documentElement.classList.add('dark');
                            } else {
                              setAppearance({ ...appearance, theme: 'light' });
                              document.documentElement.classList.remove('dark');
                            }
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Sons de Notificação</Label>
                          <p className="text-sm text-muted-foreground">
                            Reproduzir som ao receber notificações
                          </p>
                        </div>
                        <Switch 
                          checked={preferences.notificationSounds} 
                          onCheckedChange={(checked) => setPreferences({ ...preferences, notificationSounds: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Atualização Automática</Label>
                          <p className="text-sm text-muted-foreground">
                            Atualizar rastreamentos automaticamente
                          </p>
                        </div>
                        <Switch 
                          checked={preferences.autoUpdate} 
                          onCheckedChange={(checked) => setPreferences({ ...preferences, autoUpdate: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Compactar Tabelas</Label>
                          <p className="text-sm text-muted-foreground">
                            Mostrar mais informações em menos espaço
                          </p>
                        </div>
                        <Switch 
                          checked={preferences.compactTables} 
                          onCheckedChange={(checked) => setPreferences({ ...preferences, compactTables: checked })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Idioma</Label>
                        <Select 
                          value={preferences.language} 
                          onValueChange={(value) => setPreferences({ ...preferences, language: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                            <SelectItem value="en-US">English (US)</SelectItem>
                            <SelectItem value="es-ES">Español</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Formato de Data</Label>
                        <Select 
                          value={preferences.dateFormat} 
                          onValueChange={(value) => setPreferences({ ...preferences, dateFormat: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dd/mm/yyyy">DD/MM/AAAA</SelectItem>
                            <SelectItem value="mm/dd/yyyy">MM/DD/AAAA</SelectItem>
                            <SelectItem value="yyyy-mm-dd">AAAA-MM-DD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Itens por Página</Label>
                        <Select 
                          value={preferences.itemsPerPage.toString()} 
                          onValueChange={(value) => setPreferences({ ...preferences, itemsPerPage: parseInt(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button onClick={handleSavePreferences}>
                        <Save className="mr-2 h-4 w-4" />
                        Salvar Preferências
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Privacidade e Segurança</CardTitle>
                    <CardDescription>
                      Gerencie suas configurações de privacidade
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Autenticação de Dois Fatores</Label>
                          <p className="text-sm text-muted-foreground">
                            Adicionar camada extra de segurança
                          </p>
                        </div>
                        {twoFactorEnabled ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="default" className="bg-green-500">Ativado</Badge>
                            <Button variant="outline" size="sm" onClick={handleDisable2FA}>
                              Desativar
                            </Button>
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" onClick={handleEnable2FA}>
                            Configurar
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Sessões Ativas</Label>
                          <p className="text-sm text-muted-foreground">
                            Gerenciar dispositivos conectados
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleLoadSessions}>
                          Ver Sessões
                        </Button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Logs de Atividade</Label>
                          <p className="text-sm text-muted-foreground">
                            Histórico de ações realizadas
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleLoadActivityLogs}>
                          Ver Logs
                        </Button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Exportar Dados</Label>
                          <p className="text-sm text-muted-foreground">
                            Baixar todos os seus dados (LGPD)
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleExportData}>
                          Solicitar Exportação
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Store Settings */}
            <TabsContent value="store">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="h-5 w-5" />
                    Informações da Loja
                  </CardTitle>
                  <CardDescription>
                    Configure os dados básicos da sua loja
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="storeName">Nome da Loja</Label>
                      <Input
                        id="storeName"
                        value={storeSettings.store_name}
                        onChange={(e) => setStoreSettings({ ...storeSettings, store_name: e.target.value })}
                        placeholder="Minha Loja Online"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="storeEmail">Email da Loja</Label>
                      <Input
                        id="storeEmail"
                        type="email"
                        value={storeSettings.store_email}
                        onChange={(e) => setStoreSettings({ ...storeSettings, store_email: e.target.value })}
                        placeholder="contato@minhaloja.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="storePhone">Telefone</Label>
                      <Input
                        id="storePhone"
                        value={storeSettings.store_phone}
                        onChange={(e) => setStoreSettings({ ...storeSettings, store_phone: e.target.value })}
                        placeholder="(11) 99999-9999"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timezone">Fuso Horário</Label>
                      <Select value={storeSettings.timezone} onValueChange={(value) => setStoreSettings({ ...storeSettings, timezone: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/Sao_Paulo">Brasília (GMT-3)</SelectItem>
                          <SelectItem value="America/Manaus">Manaus (GMT-4)</SelectItem>
                          <SelectItem value="America/Rio_Branco">Rio Branco (GMT-5)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storeAddress">Endereço</Label>
                    <Textarea
                      id="storeAddress"
                      value={storeSettings.store_address}
                      onChange={(e) => setStoreSettings({ ...storeSettings, store_address: e.target.value })}
                      placeholder="Rua das Flores, 123 - Centro, São Paulo - SP"
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleSaveStoreSettings} disabled={loading}>
                      <Save className="mr-2 h-4 w-4" />
                      {loading ? "Salvando..." : "Salvar Configurações"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notification Settings */}
            <TabsContent value="notifications">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Canais de Notificação
                    </CardTitle>
                    <CardDescription>
                      Configure quais canais usar para notificar seus clientes
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Notificações por WhatsApp</Label>
                        <p className="text-sm text-muted-foreground">
                          Envie atualizações via WhatsApp Business
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={notificationSettings.whatsapp_enabled}
                          onCheckedChange={(checked) => saveNotificationSettings({ ...notificationSettings, whatsapp_enabled: checked })}
                        />
                        {notificationSettings.whatsapp_enabled && (
                          <Button variant="outline" size="sm" onClick={() => openTestDialog('whatsapp')}>
                            <TestTube className="mr-2 h-3 w-3" />
                            Testar
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Notificações por Email</Label>
                        <p className="text-sm text-muted-foreground">
                          Envie atualizações por email
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={notificationSettings.email_enabled}
                          onCheckedChange={(checked) => saveNotificationSettings({ ...notificationSettings, email_enabled: checked })}
                        />
                        {notificationSettings.email_enabled && (
                          <Button variant="outline" size="sm" onClick={() => openTestDialog('email')}>
                            <TestTube className="mr-2 h-3 w-3" />
                            Testar
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Notificações por SMS</Label>
                        <p className="text-sm text-muted-foreground">
                          Envie atualizações por SMS (custo adicional)
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={notificationSettings.sms_enabled}
                          onCheckedChange={(checked) => saveNotificationSettings({ ...notificationSettings, sms_enabled: checked })}
                        />
                        {notificationSettings.sms_enabled && (
                          <Button variant="outline" size="sm" onClick={() => openTestDialog('sms')}>
                            <TestTube className="mr-2 h-3 w-3" />
                            Testar
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Notificações Automáticas</Label>
                        <p className="text-sm text-muted-foreground">
                          Envie notificações automaticamente quando o status mudar
                        </p>
                      </div>
                      <Switch
                        checked={notificationSettings.auto_notifications}
                        onCheckedChange={(checked) => saveNotificationSettings({ ...notificationSettings, auto_notifications: checked })}
                      />
                    </div>

                    {notificationSettings.whatsapp_enabled && (
                      <div className="space-y-2">
                        <Label htmlFor="whatsappNumber">Número do WhatsApp</Label>
                        <Input
                          id="whatsappNumber"
                          value={notificationSettings.whatsapp_number}
                          onChange={(e) => saveNotificationSettings({ ...notificationSettings, whatsapp_number: e.target.value })}
                          placeholder="5511999999999"
                        />
                        <p className="text-xs text-muted-foreground">
                          Número com código do país (55) e DDD, sem espaços ou símbolos
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      Templates de Mensagem
                      <Button onClick={handleCreateTemplate} size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Template
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      Personalize as mensagens enviadas aos clientes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {templates.map((template) => (
                        <div key={template.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{template.name}</h4>
                              <Badge variant={template.type === 'email' ? 'default' : template.type === 'whatsapp' ? 'secondary' : 'outline'}>
                                {template.type}
                              </Badge>
                              {template.is_default && <Badge variant="outline">Padrão</Badge>}
                              {template.is_active ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {template.content.substring(0, 100)}...
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleEditTemplate(template)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDeleteTemplate(template.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {templates.length === 0 && (
                        <EmptyState
                          variant="notifications"
                          title="Nenhum template de notificação criado"
                          description="Crie templates personalizados para enviar notificações por email e WhatsApp aos seus clientes em diferentes situações do processo de entrega."
                          actions={[
                            {
                              label: "Criar Primeiro Template",
                              onClick: handleCreateTemplate,
                              variant: "hero",
                              icon: Plus
                            }
                          ]}
                          badge={{ text: "Templates", variant: "secondary" }}
                          metrics={[
                            { label: "Templates Criados", value: "0", icon: Mail },
                            { label: "Tipos Disponíveis", value: "3", icon: MessageSquare },
                            { label: "Personalização", value: "100%", icon: Edit }
                          ]}
                          tips={[
                            "Templates ajudam a manter consistência nas comunicações",
                            "Use variáveis para personalizar mensagens automaticamente",
                            "Crie templates para diferentes status de entrega"
                          ]}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Integrations */}
            <TabsContent value="integrations">
              <div className="space-y-6">
                {/* Marketplaces Section - Always visible */}
                <Card>
                    <CardHeader>
                      <CardTitle>Integrações com Marketplaces</CardTitle>
                      <CardDescription>
                        Conecte sua loja com plataformas de e-commerce
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded flex items-center justify-center bg-white border">
                              <img 
                                src="/media/shopify/shopify-seeklogo.png" 
                                alt="Shopify" 
                                className="w-10 h-10 object-contain"
                              />
                            </div>
                            <div>
                              <p className="font-medium">Shopify</p>
                              <p className="text-sm text-muted-foreground">{getIntegrationStatus('shopify')}</p>
                            </div>
                          </div>
                          {getIntegrationStatus('shopify') === 'Conectado' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => disconnectMarketplace('shopify')}
                              disabled={marketplaceLoading}
                            >
                              Desconectar
                            </Button>
                          ) : (
                            <Dialog open={shopifyDialogOpen} onOpenChange={setShopifyDialogOpen}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  Conectar
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Conectar Shopify</DialogTitle>
                                  <DialogDescription>
                                    Insira suas credenciais do Shopify para conectar sua loja.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label>Domínio da Loja</Label>
                                    <Input
                                      placeholder="minhaloja.myshopify.com"
                                      value={shopifyCredentials.shopDomain}
                                      onChange={(e) => setShopifyCredentials({ ...shopifyCredentials, shopDomain: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Access Token</Label>
                                    <Input
                                      type="password"
                                      placeholder="shpat_..."
                                      value={shopifyCredentials.accessToken}
                                      onChange={(e) => setShopifyCredentials({ ...shopifyCredentials, accessToken: e.target.value })}
                                    />
                                  </div>
                                  <Button onClick={handleConnectShopify} disabled={marketplaceLoading} className="w-full">
                                    {marketplaceLoading ? 'Conectando...' : 'Conectar'}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>

                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded flex items-center justify-center bg-white border">
                              <img 
                                src="/media/woocommerce/woocommerce-2025-seeklogo.svg" 
                                alt="WooCommerce" 
                                className="w-10 h-10 object-contain"
                              />
                            </div>
                            <div>
                              <p className="font-medium">WooCommerce</p>
                              <p className="text-sm text-muted-foreground">{getIntegrationStatus('woocommerce')}</p>
                            </div>
                          </div>
                          {getIntegrationStatus('woocommerce') === 'Conectado' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => disconnectMarketplace('woocommerce')}
                              disabled={marketplaceLoading}
                            >
                              Desconectar
                            </Button>
                          ) : (
                            <Dialog open={woocommerceDialogOpen} onOpenChange={setWoocommerceDialogOpen}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  Conectar
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Conectar WooCommerce</DialogTitle>
                                  <DialogDescription>
                                    Insira suas credenciais do WooCommerce para conectar sua loja.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label>URL da Loja</Label>
                                    <Input
                                      placeholder="https://minhaloja.com"
                                      value={woocommerceCredentials.storeUrl}
                                      onChange={(e) => setWoocommerceCredentials({ ...woocommerceCredentials, storeUrl: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Consumer Key</Label>
                                    <Input
                                      placeholder="ck_..."
                                      value={woocommerceCredentials.consumerKey}
                                      onChange={(e) => setWoocommerceCredentials({ ...woocommerceCredentials, consumerKey: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Consumer Secret</Label>
                                    <Input
                                      type="password"
                                      placeholder="cs_..."
                                      value={woocommerceCredentials.consumerSecret}
                                      onChange={(e) => setWoocommerceCredentials({ ...woocommerceCredentials, consumerSecret: e.target.value })}
                                    />
                                  </div>
                                  <Button onClick={handleConnectWooCommerce} disabled={marketplaceLoading} className="w-full">
                                    {marketplaceLoading ? 'Conectando...' : 'Conectar'}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>

                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded flex items-center justify-center bg-white border">
                              <img 
                                src="/media/mercado-livre/mercado-livre-seeklogo.png" 
                                alt="Mercado Livre" 
                                className="w-10 h-10 object-contain"
                              />
                            </div>
                            <div>
                              <p className="font-medium">Mercado Livre</p>
                              <p className="text-sm text-muted-foreground">{getIntegrationStatus('mercadolivre')}</p>
                            </div>
                          </div>
                          {getIntegrationStatus('mercadolivre') === 'Conectado' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => disconnectMarketplace('mercadolivre')}
                              disabled={marketplaceLoading}
                            >
                              Desconectar
                            </Button>
                          ) : (
                            <Dialog open={mercadolivreDialogOpen} onOpenChange={setMercadolivreDialogOpen}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  Conectar
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Conectar Mercado Livre</DialogTitle>
                                  <DialogDescription>
                                    Insira suas credenciais do Mercado Livre para conectar sua loja.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label>Access Token</Label>
                                    <Input
                                      placeholder="APP_USR-..."
                                      value={mercadolivreCredentials.accessToken}
                                      onChange={(e) => setMercadolivreCredentials({ ...mercadolivreCredentials, accessToken: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Seller ID</Label>
                                    <Input
                                      placeholder="123456789"
                                      value={mercadolivreCredentials.sellerId}
                                      onChange={(e) => setMercadolivreCredentials({ ...mercadolivreCredentials, sellerId: e.target.value })}
                                    />
                                  </div>
                                  <Button onClick={handleConnectMercadoLivre} disabled={marketplaceLoading} className="w-full">
                                    {marketplaceLoading ? 'Conectando...' : 'Conectar'}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>

                        {/* Nuvemshop Integration */}
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded flex items-center justify-center bg-white border">
                              <img 
                                src="/media/nuvemshop/nuvemshop-seeklogo.svg" 
                                alt="Nuvemshop" 
                                className="w-10 h-10 object-contain"
                              />
                            </div>
                            <div>
                              <p className="font-medium">Nuvemshop</p>
                              <p className="text-sm text-muted-foreground">{getIntegrationStatus('nuvemshop')}</p>
                            </div>
                          </div>
                          {getIntegrationStatus('nuvemshop') === 'Conectado' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => disconnectMarketplace('nuvemshop')}
                              disabled={marketplaceLoading}
                            >
                              Desconectar
                            </Button>
                          ) : (
                            <Dialog open={nuvemshopDialogOpen} onOpenChange={setNuvemshopDialogOpen}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  Conectar
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <NuvemshopConfig />
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Transportadoras</CardTitle>
                    <CardDescription>
                      Configure integrações com transportadoras
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Correios */}
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded flex items-center justify-center bg-white border">
                            <img 
                              src="/media/correios/correios-seeklogo.png" 
                              alt="Correios" 
                              className="w-10 h-10 object-contain"
                            />
                          </div>
                          <div>
                            <p className="font-medium">Correios</p>
                            <p className="text-sm text-muted-foreground">{getCarrierStatus('correios')}</p>
                          </div>
                        </div>
                        {getCarrierStatus('correios') === 'Conectado' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => disconnectCarrierIntegration('correios')}
                            disabled={carrierLoading}
                          >
                            Desconectar
                          </Button>
                        ) : (
                          <Dialog open={carrierDialogOpen && carrierCredentials.carrier === 'correios'} onOpenChange={(open) => {
                            setCarrierDialogOpen(open);
                            if (open) setCarrierCredentials({ ...carrierCredentials, carrier: 'correios' });
                          }}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                Conectar
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Conectar Correios</DialogTitle>
                                <DialogDescription>
                                  Insira suas credenciais da transportadora para conectar.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label>API Key</Label>
                                  <Input
                                    placeholder="Sua API Key"
                                    value={carrierCredentials.apiKey}
                                    onChange={(e) => setCarrierCredentials({ ...carrierCredentials, apiKey: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>API Secret</Label>
                                  <Input
                                    type="password"
                                    placeholder="Seu API Secret"
                                    value={carrierCredentials.apiSecret}
                                    onChange={(e) => setCarrierCredentials({ ...carrierCredentials, apiSecret: e.target.value })}
                                  />
                                </div>
                                <Button onClick={handleConnectCarrier} disabled={carrierLoading} className="w-full">
                                  {carrierLoading ? 'Conectando...' : 'Conectar'}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>

                      {/* Jadlog */}
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded flex items-center justify-center bg-white border">
                            <img 
                              src="/media/jadlog/jadlog-seeklogo.png" 
                              alt="Jadlog" 
                              className="w-10 h-10 object-contain"
                            />
                          </div>
                          <div>
                            <p className="font-medium">Jadlog</p>
                            <p className="text-sm text-muted-foreground">{getCarrierStatus('jadlog')}</p>
                          </div>
                        </div>
                        {getCarrierStatus('jadlog') === 'Conectado' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => disconnectCarrierIntegration('jadlog')}
                            disabled={carrierLoading}
                          >
                            Desconectar
                          </Button>
                        ) : (
                          <Dialog open={carrierDialogOpen && carrierCredentials.carrier === 'jadlog'} onOpenChange={(open) => {
                            setCarrierDialogOpen(open);
                            if (open) setCarrierCredentials({ ...carrierCredentials, carrier: 'jadlog' });
                          }}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                Conectar
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Conectar Jadlog</DialogTitle>
                                <DialogDescription>
                                  Insira suas credenciais da transportadora para conectar.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label>API Key</Label>
                                  <Input
                                    placeholder="Sua API Key"
                                    value={carrierCredentials.apiKey}
                                    onChange={(e) => setCarrierCredentials({ ...carrierCredentials, apiKey: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>API Secret</Label>
                                  <Input
                                    type="password"
                                    placeholder="Seu API Secret"
                                    value={carrierCredentials.apiSecret}
                                    onChange={(e) => setCarrierCredentials({ ...carrierCredentials, apiSecret: e.target.value })}
                                  />
                                </div>
                                <Button onClick={handleConnectCarrier} disabled={carrierLoading} className="w-full">
                                  {carrierLoading ? 'Conectando...' : 'Conectar'}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>

                      {/* Total Express */}
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded flex items-center justify-center bg-white border">
                            <img 
                              src="/media/total-express/total-express-logo.svg" 
                              alt="Total Express" 
                              className="w-10 h-10 object-contain"
                            />
                          </div>
                          <div>
                            <p className="font-medium">Total Express</p>
                            <p className="text-sm text-muted-foreground">{getCarrierStatus('total_express')}</p>
                          </div>
                        </div>
                        {getCarrierStatus('total_express') === 'Conectado' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => disconnectCarrierIntegration('total_express')}
                            disabled={carrierLoading}
                          >
                            Desconectar
                          </Button>
                        ) : (
                          <Dialog open={carrierDialogOpen && carrierCredentials.carrier === 'total_express'} onOpenChange={(open) => {
                            setCarrierDialogOpen(open);
                            if (open) setCarrierCredentials({ ...carrierCredentials, carrier: 'total_express' });
                          }}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                Conectar
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Conectar Total Express</DialogTitle>
                                <DialogDescription>
                                  Insira suas credenciais da transportadora para conectar.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label>API Key</Label>
                                  <Input
                                    placeholder="Sua API Key"
                                    value={carrierCredentials.apiKey}
                                    onChange={(e) => setCarrierCredentials({ ...carrierCredentials, apiKey: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>API Secret</Label>
                                  <Input
                                    type="password"
                                    placeholder="Seu API Secret"
                                    value={carrierCredentials.apiSecret}
                                    onChange={(e) => setCarrierCredentials({ ...carrierCredentials, apiSecret: e.target.value })}
                                  />
                                </div>
                                <Button onClick={handleConnectCarrier} disabled={carrierLoading} className="w-full">
                                  {carrierLoading ? 'Conectando...' : 'Conectar'}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>

                      {/* Azul Cargo */}
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded flex items-center justify-center bg-white border">
                            <img 
                              src="/media/Azul-cargo/Azul_Cargo_Express.png" 
                              alt="Azul Cargo" 
                              className="w-10 h-10 object-contain"
                            />
                          </div>
                          <div>
                            <p className="font-medium">Azul Cargo</p>
                            <p className="text-sm text-muted-foreground">{getCarrierStatus('azul_cargo')}</p>
                          </div>
                        </div>
                        {getCarrierStatus('azul_cargo') === 'Conectado' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => disconnectCarrierIntegration('azul_cargo')}
                            disabled={carrierLoading}
                          >
                            Desconectar
                          </Button>
                        ) : (
                          <Dialog open={carrierDialogOpen && carrierCredentials.carrier === 'azul_cargo'} onOpenChange={(open) => {
                            setCarrierDialogOpen(open);
                            if (open) setCarrierCredentials({ ...carrierCredentials, carrier: 'azul_cargo' });
                          }}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                Conectar
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Conectar Azul Cargo</DialogTitle>
                                <DialogDescription>
                                  Insira suas credenciais da transportadora para conectar.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label>API Key</Label>
                                  <Input
                                    placeholder="Sua API Key"
                                    value={carrierCredentials.apiKey}
                                    onChange={(e) => setCarrierCredentials({ ...carrierCredentials, apiKey: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>API Secret</Label>
                                  <Input
                                    type="password"
                                    placeholder="Seu API Secret"
                                    value={carrierCredentials.apiSecret}
                                    onChange={(e) => setCarrierCredentials({ ...carrierCredentials, apiSecret: e.target.value })}
                                  />
                                </div>
                                <Button onClick={handleConnectCarrier} disabled={carrierLoading} className="w-full">
                                  {carrierLoading ? 'Conectando...' : 'Conectar'}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>

                      {/* Loggi */}
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded flex items-center justify-center bg-white border">
                            <img 
                              src="/media/loggi/loggi-seeklogo.svg" 
                              alt="Loggi" 
                              className="w-10 h-10 object-contain"
                            />
                          </div>
                          <div>
                            <p className="font-medium">Loggi</p>
                            <p className="text-sm text-muted-foreground">{getCarrierStatus('loggi')}</p>
                          </div>
                        </div>
                        {getCarrierStatus('loggi') === 'Conectado' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => disconnectCarrierIntegration('loggi')}
                            disabled={carrierLoading}
                          >
                            Desconectar
                          </Button>
                        ) : (
                          <Dialog open={carrierDialogOpen && carrierCredentials.carrier === 'loggi'} onOpenChange={(open) => {
                            setCarrierDialogOpen(open);
                            if (open) setCarrierCredentials({ ...carrierCredentials, carrier: 'loggi' });
                          }}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                Conectar
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Conectar Loggi</DialogTitle>
                                <DialogDescription>
                                  Insira suas credenciais da transportadora para conectar.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label>API Key</Label>
                                  <Input
                                    placeholder="Sua API Key"
                                    value={carrierCredentials.apiKey}
                                    onChange={(e) => setCarrierCredentials({ ...carrierCredentials, apiKey: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>API Secret</Label>
                                  <Input
                                    type="password"
                                    placeholder="Seu API Secret"
                                    value={carrierCredentials.apiSecret}
                                    onChange={(e) => setCarrierCredentials({ ...carrierCredentials, apiSecret: e.target.value })}
                                  />
                                </div>
                                <Button onClick={handleConnectCarrier} disabled={carrierLoading} className="w-full">
                                  {carrierLoading ? 'Conectando...' : 'Conectar'}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>

                      {/* Melhor Envio */}
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded flex items-center justify-center bg-white border">
                            <img 
                              src="/media/melhor-envio/melhor-envio-seeklogo-2.svg" 
                              alt="Melhor Envio" 
                              className="w-10 h-10 object-contain"
                            />
                          </div>
                          <div>
                            <p className="font-medium">Melhor Envio</p>
                            <p className="text-sm text-muted-foreground">{getCarrierStatus('melhor_envio')}</p>
                          </div>
                        </div>
                        {getCarrierStatus('melhor_envio') === 'Conectado' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => disconnectCarrierIntegration('melhor_envio')}
                            disabled={carrierLoading}
                          >
                            Desconectar
                          </Button>
                        ) : (
                          <Dialog open={carrierDialogOpen && carrierCredentials.carrier === 'melhor_envio'} onOpenChange={(open) => {
                            setCarrierDialogOpen(open);
                            if (open) setCarrierCredentials({ ...carrierCredentials, carrier: 'melhor_envio' });
                          }}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                Conectar
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Conectar Melhor Envio</DialogTitle>
                                <DialogDescription>
                                  Insira suas credenciais da transportadora para conectar.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label>API Key</Label>
                                  <Input
                                    placeholder="Sua API Key"
                                    value={carrierCredentials.apiKey}
                                    onChange={(e) => setCarrierCredentials({ ...carrierCredentials, apiKey: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>API Secret</Label>
                                  <Input
                                    type="password"
                                    placeholder="Seu API Secret"
                                    value={carrierCredentials.apiSecret}
                                    onChange={(e) => setCarrierCredentials({ ...carrierCredentials, apiSecret: e.target.value })}
                                  />
                                </div>
                                <Button onClick={handleConnectCarrier} disabled={carrierLoading} className="w-full">
                                  {carrierLoading ? 'Conectando...' : 'Conectar'}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>

                      {/* Smartenvios Integration */}
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded flex items-center justify-center bg-white border">
                            <img 
                              src="/media/smartenvios/smartenvios.svg" 
                              alt="Smartenvios" 
                              className="w-10 h-10 object-contain"
                            />
                          </div>
                          <div>
                            <p className="font-medium">Smartenvios</p>
                            <p className="text-sm text-muted-foreground">{getCarrierStatus('smartenvios')}</p>
                          </div>
                        </div>
                        {getCarrierStatus('smartenvios') === 'Conectado' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => disconnectCarrierIntegration('smartenvios')}
                            disabled={carrierLoading}
                          >
                            Desconectar
                          </Button>
                        ) : (
                          <Dialog open={smartenviosDialogOpen} onOpenChange={setSmartenviosDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                Conectar
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                              <SmartenviosConfig />
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Appearance Tab */}
            <TabsContent value="appearance">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Tema e Cores</CardTitle>
                    <CardDescription>
                      Personalize a aparência do sistema
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Tema</Label>
                        <div className="grid grid-cols-3 gap-4">
                          <div 
                            className={`cursor-pointer border-2 ${appearance.theme === 'light' ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-transparent hover:border-primary'} rounded-lg p-4 text-center transition-all`}
                            onClick={() => {
                              setAppearance({ ...appearance, theme: 'light' });
                              setPreferences({ ...preferences, darkMode: false });
                              document.documentElement.classList.remove('dark');
                              toast.success("Tema claro ativado");
                            }}
                          >
                            <div className="w-full h-20 bg-gradient-to-br from-white to-gray-100 rounded mb-2 border"></div>
                            <p className="font-medium">Claro</p>
                          </div>
                          <div 
                            className={`cursor-pointer border-2 ${appearance.theme === 'dark' ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-transparent hover:border-primary'} rounded-lg p-4 text-center transition-all`}
                            onClick={() => {
                              setAppearance({ ...appearance, theme: 'dark' });
                              setPreferences({ ...preferences, darkMode: true });
                              document.documentElement.classList.add('dark');
                              toast.success("Tema escuro ativado");
                            }}
                          >
                            <div className="w-full h-20 bg-gradient-to-br from-gray-800 to-gray-900 rounded mb-2"></div>
                            <p className="font-medium">Escuro</p>
                          </div>
                          <div 
                            className={`cursor-pointer border-2 ${appearance.theme === 'system' ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-transparent hover:border-primary'} rounded-lg p-4 text-center transition-all`}
                            onClick={() => {
                              setAppearance({ ...appearance, theme: 'system' });
                              const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                              if (prefersDark) {
                                document.documentElement.classList.add('dark');
                              } else {
                                document.documentElement.classList.remove('dark');
                              }
                              toast.success("Tema do sistema ativado");
                            }}
                          >
                            <div className="w-full h-20 bg-gradient-to-br from-white via-gray-100 to-gray-800 rounded mb-2"></div>
                            <p className="font-medium">Sistema</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Cor de Destaque</Label>
                        <div className="grid grid-cols-6 gap-3">
                          {[
                            { name: 'Azul', color: 'bg-blue-500', value: 'blue' },
                            { name: 'Verde', color: 'bg-green-500', value: 'green' },
                            { name: 'Roxo', color: 'bg-purple-500', value: 'purple' },
                            { name: 'Rosa', color: 'bg-pink-500', value: 'pink' },
                            { name: 'Laranja', color: 'bg-orange-500', value: 'orange' },
                            { name: 'Vermelho', color: 'bg-red-500', value: 'red' },
                          ].map((item) => (
                            <div
                              key={item.value}
                              className="cursor-pointer hover:scale-105 transition-transform"
                              title={item.name}
                              onClick={() => {
                                setAppearance({ ...appearance, accentColor: item.value });
                                // Aplicar imediatamente
                                const colorMap: Record<string, string> = {
                                  blue: '#3b82f6',
                                  green: '#22c55e',
                                  purple: '#a855f7',
                                  pink: '#ec4899',
                                  orange: '#f97316',
                                  red: '#ef4444',
                                };
                                document.documentElement.style.setProperty('--color-primary', colorMap[item.value]);
                                toast.success(`Cor ${item.name} selecionada`);
                              }}
                            >
                              <div className={`w-full h-10 ${item.color} rounded-lg ${appearance.accentColor === item.value ? 'ring-4 ring-offset-2' : 'ring-0'} transition-all shadow-lg hover:shadow-xl`}></div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Densidade da Interface</Label>
                        <Select 
                          value={appearance.density} 
                          onValueChange={(value) => {
                            setAppearance({ ...appearance, density: value });
                            // Aplicar imediatamente
                            const root = document.documentElement;
                            switch (value) {
                              case 'compact':
                                root.style.setProperty('--spacing-unit', '0.75rem');
                                root.style.setProperty('--padding-card', '0.75rem');
                                root.style.setProperty('--gap-unit', '0.5rem');
                                toast.success("Densidade compacta ativada");
                                break;
                              case 'comfortable':
                                root.style.setProperty('--spacing-unit', '1rem');
                                root.style.setProperty('--padding-card', '1.5rem');
                                root.style.setProperty('--gap-unit', '1rem');
                                toast.success("Densidade confortável ativada");
                                break;
                              case 'spacious':
                                root.style.setProperty('--spacing-unit', '1.5rem');
                                root.style.setProperty('--padding-card', '2rem');
                                root.style.setProperty('--gap-unit', '1.5rem');
                                toast.success("Densidade espaçosa ativada");
                                break;
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="compact">Compacta</SelectItem>
                            <SelectItem value="comfortable">Confortável</SelectItem>
                            <SelectItem value="spacious">Espaçosa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Fonte</Label>
                        <Select 
                          value={appearance.font} 
                          onValueChange={(value) => {
                            setAppearance({ ...appearance, font: value });
                            // Aplicar imediatamente
                            const root = document.documentElement;
                            switch (value) {
                              case 'inter':
                                root.style.fontFamily = 'Inter, system-ui, sans-serif';
                                toast.success("Fonte Inter ativada");
                                break;
                              case 'roboto':
                                root.style.fontFamily = 'Roboto, system-ui, sans-serif';
                                toast.success("Fonte Roboto ativada");
                                break;
                              case 'opensans':
                                root.style.fontFamily = '"Open Sans", system-ui, sans-serif';
                                toast.success("Fonte Open Sans ativada");
                                break;
                              case 'lato':
                                root.style.fontFamily = 'Lato, system-ui, sans-serif';
                                toast.success("Fonte Lato ativada");
                                break;
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inter">Inter (Padrão)</SelectItem>
                            <SelectItem value="roboto">Roboto</SelectItem>
                            <SelectItem value="opensans">Open Sans</SelectItem>
                            <SelectItem value="lato">Lato</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Tamanho da Fonte</Label>
                        <Select 
                          value={appearance.fontSize} 
                          onValueChange={(value) => {
                            setAppearance({ ...appearance, fontSize: value });
                            // Aplicar imediatamente
                            const root = document.documentElement;
                            switch (value) {
                              case 'small':
                                root.style.fontSize = '14px';
                                toast.success("Fonte pequena ativada");
                                break;
                              case 'medium':
                                root.style.fontSize = '16px';
                                toast.success("Fonte média ativada");
                                break;
                              case 'large':
                                root.style.fontSize = '18px';
                                toast.success("Fonte grande ativada");
                                break;
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small">Pequena (14px)</SelectItem>
                            <SelectItem value="medium">Média (16px)</SelectItem>
                            <SelectItem value="large">Grande (18px)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Sidebar e Navegação</CardTitle>
                    <CardDescription>
                      Configure a barra lateral e menus
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Sidebar Sempre Visível</Label>
                        <p className="text-sm text-muted-foreground">
                          Manter menu lateral sempre aberto
                        </p>
                      </div>
                      <Switch 
                        checked={appearance.sidebarAlwaysVisible} 
                        onCheckedChange={(checked) => {
                          setAppearance({ ...appearance, sidebarAlwaysVisible: checked });
                          toast.info(checked ? "Sidebar sempre visível ativada" : "Sidebar sempre visível desativada");
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Mostrar Breadcrumbs</Label>
                        <p className="text-sm text-muted-foreground">
                          Exibir caminho de navegação
                        </p>
                      </div>
                      <Switch 
                        checked={appearance.showBreadcrumbs} 
                        onCheckedChange={(checked) => {
                          setAppearance({ ...appearance, showBreadcrumbs: checked });
                          toast.info(checked ? "Breadcrumbs ativados" : "Breadcrumbs desativados");
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Ícones Coloridos</Label>
                        <p className="text-sm text-muted-foreground">
                          Usar cores nos ícones do menu
                        </p>
                      </div>
                      <Switch 
                        checked={appearance.coloredIcons} 
                        onCheckedChange={(checked) => {
                          setAppearance({ ...appearance, coloredIcons: checked });
                          // Aplicar imediatamente
                          if (checked) {
                            document.documentElement.classList.add('colored-icons');
                          } else {
                            document.documentElement.classList.remove('colored-icons');
                          }
                          toast.info(checked ? "Ícones coloridos ativados" : "Ícones coloridos desativados");
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Posição do Menu</Label>
                      <Select 
                        value={appearance.menuPosition} 
                        onValueChange={(value) => {
                          setAppearance({ ...appearance, menuPosition: value });
                          toast.info(`Posição do menu: ${value === 'left' ? 'Esquerda' : 'Topo'}`);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Esquerda</SelectItem>
                          <SelectItem value="top">Topo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Dashboard</CardTitle>
                    <CardDescription>
                      Personalize widgets e métricas
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Widgets Animados</Label>
                        <p className="text-sm text-muted-foreground">
                          Adicionar animações aos cards
                        </p>
                      </div>
                      <Switch 
                        checked={appearance.animatedWidgets} 
                        onCheckedChange={(checked) => {
                          setAppearance({ ...appearance, animatedWidgets: checked });
                          // Aplicar imediatamente
                          if (checked) {
                            document.documentElement.classList.add('animated-widgets');
                          } else {
                            document.documentElement.classList.remove('animated-widgets');
                          }
                          toast.info(checked ? "Animações de widgets ativadas" : "Animações de widgets desativadas");
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Gráficos em Tempo Real</Label>
                        <p className="text-sm text-muted-foreground">
                          Atualizar gráficos automaticamente
                        </p>
                      </div>
                      <Switch 
                        checked={appearance.realTimeCharts} 
                        onCheckedChange={(checked) => {
                          setAppearance({ ...appearance, realTimeCharts: checked });
                          toast.info(checked ? "Gráficos em tempo real ativados" : "Gráficos em tempo real desativados");
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Widgets Visíveis</Label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Switch 
                            checked={appearance.visibleWidgets.totalOrders} 
                            onCheckedChange={(checked) => setAppearance({ 
                              ...appearance, 
                              visibleWidgets: { ...appearance.visibleWidgets, totalOrders: checked }
                            })}
                            id="totalOrders" 
                          />
                          <Label htmlFor="totalOrders" className="font-normal cursor-pointer">
                            Total de Pedidos
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch 
                            checked={appearance.visibleWidgets.deliveryRate} 
                            onCheckedChange={(checked) => setAppearance({ 
                              ...appearance, 
                              visibleWidgets: { ...appearance.visibleWidgets, deliveryRate: checked }
                            })}
                            id="deliveryRate" 
                          />
                          <Label htmlFor="deliveryRate" className="font-normal cursor-pointer">
                            Taxa de Entrega
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch 
                            checked={appearance.visibleWidgets.inTransit} 
                            onCheckedChange={(checked) => setAppearance({ 
                              ...appearance, 
                              visibleWidgets: { ...appearance.visibleWidgets, inTransit: checked }
                            })}
                            id="inTransit" 
                          />
                          <Label htmlFor="inTransit" className="font-normal cursor-pointer">
                            Pedidos em Trânsito
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch 
                            checked={appearance.visibleWidgets.activeAlerts} 
                            onCheckedChange={(checked) => setAppearance({ 
                              ...appearance, 
                              visibleWidgets: { ...appearance.visibleWidgets, activeAlerts: checked }
                            })}
                            id="activeAlerts" 
                          />
                          <Label htmlFor="activeAlerts" className="font-normal cursor-pointer">
                            Alertas Ativos
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch 
                            checked={appearance.visibleWidgets.salesChart} 
                            onCheckedChange={(checked) => setAppearance({ 
                              ...appearance, 
                              visibleWidgets: { ...appearance.visibleWidgets, salesChart: checked }
                            })}
                            id="salesChart" 
                          />
                          <Label htmlFor="salesChart" className="font-normal cursor-pointer">
                            Gráfico de Vendas
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch 
                            checked={appearance.visibleWidgets.deliveryMap} 
                            onCheckedChange={(checked) => setAppearance({ 
                              ...appearance, 
                              visibleWidgets: { ...appearance.visibleWidgets, deliveryMap: checked }
                            })}
                            id="deliveryMap" 
                          />
                          <Label htmlFor="deliveryMap" className="font-normal cursor-pointer">
                            Mapa de Entregas
                          </Label>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Personalização Avançada</CardTitle>
                    <CardDescription>
                      Opções avançadas de personalização
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>CSS Customizado</Label>
                      <Textarea
                        placeholder="/* Adicione seu CSS aqui */"
                        rows={6}
                        className="font-mono text-sm"
                        disabled
                      />
                      <p className="text-xs text-muted-foreground">
                        Funcionalidade em desenvolvimento - CSS customizado estará disponível em breve
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={handleResetAppearance}>
                        Resetar Padrões
                      </Button>
                      <Button className="flex-1" onClick={handleSaveAppearance}>
                        <Save className="mr-2 h-4 w-4" />
                        Salvar Aparência
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Webhooks Tab */}
            <TabsContent value="webhooks">
              <WebhookManager />
            </TabsContent>
          </Tabs>

          {/* Template Dialog */}
          <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {selectedTemplate ? 'Editar Template' : 'Novo Template'}
                </DialogTitle>
                <DialogDescription>
                  Configure um template de mensagem para notificações.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={templateForm.type} onValueChange={(value: 'email' | 'whatsapp' | 'sms') => setTemplateForm({ ...templateForm, type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nome do Template</Label>
                    <Input
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                      placeholder="Ex: Pedido em Trânsito"
                    />
                  </div>
                </div>

                {templateForm.type === 'email' && (
                  <div className="space-y-2">
                    <Label>Assunto</Label>
                    <Input
                      value={templateForm.subject}
                      onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                      placeholder="Ex: Seu pedido está em trânsito"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Conteúdo</Label>
                  <Textarea
                    value={templateForm.content}
                    onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                    rows={6}
                    placeholder="Use {cliente}, {codigo}, {status}, {link} como placeholders"
                  />
                  <p className="text-xs text-muted-foreground">
                    Placeholders disponíveis: {"{cliente}"}, {"{codigo}"}, {"{status}"}, {"{link}"}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={templateForm.is_default}
                      onCheckedChange={(checked) => setTemplateForm({ ...templateForm, is_default: checked })}
                    />
                    <Label>Template Padrão</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={templateForm.is_active}
                      onCheckedChange={(checked) => setTemplateForm({ ...templateForm, is_active: checked })}
                    />
                    <Label>Ativo</Label>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveTemplate} disabled={notificationLoading}>
                    {notificationLoading ? 'Salvando...' : 'Salvar Template'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Test Notification Dialog */}
          <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Testar Notificação {testType.toUpperCase()}</DialogTitle>
                <DialogDescription>
                  Envie um teste de notificação para verificar se está funcionando.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>
                    {testType === 'email' ? 'Email' : testType === 'whatsapp' ? 'Número WhatsApp' : 'Número SMS'}
                  </Label>
                  <Input
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder={testType === 'email' ? 'teste@email.com' : '5511999999999'}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleTestNotification} disabled={notificationLoading}>
                    {notificationLoading ? 'Enviando...' : 'Enviar Teste'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* 2FA Dialog */}
          <Dialog open={twoFactorDialogOpen} onOpenChange={setTwoFactorDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Configurar Autenticação de Dois Fatores</DialogTitle>
                <DialogDescription>
                  Adicione uma camada extra de segurança à sua conta
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    1. Instale um app autenticador (Google Authenticator, Authy, etc)
                  </p>
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="w-48 h-48 mx-auto bg-white flex items-center justify-center">
                      <p className="text-xs text-center px-4">QR Code apareceria aqui<br/>(simulação)</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    2. Escaneie o QR Code acima
                  </p>
                  <p className="text-sm text-muted-foreground">
                    3. Digite o código de 6 dígitos gerado
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Código de Verificação</Label>
                  <Input
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="text-center text-2xl tracking-widest"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => {
                    setTwoFactorDialogOpen(false);
                    setVerificationCode('');
                  }}>
                    Cancelar
                  </Button>
                  <Button onClick={handleVerify2FA} disabled={verificationCode.length !== 6}>
                    Verificar e Ativar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Sessions Dialog */}
          <Dialog open={sessionsDialogOpen} onOpenChange={setSessionsDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Sessões Ativas</DialogTitle>
                <DialogDescription>
                  Gerencie os dispositivos conectados à sua conta
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{session.device}</p>
                        {session.current && (
                          <Badge variant="default" className="bg-green-500">Atual</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{session.location}</p>
                      <p className="text-xs text-muted-foreground">
                        IP: {session.ip} • Última atividade: {new Date(session.lastActive).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    {!session.current && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleTerminateSession(session.id)}
                      >
                        Encerrar
                      </Button>
                    )}
                  </div>
                ))}
                {sessions.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma sessão ativa encontrada
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Activity Logs Dialog */}
          <Dialog open={activityLogsDialogOpen} onOpenChange={setActivityLogsDialogOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Logs de Atividade</DialogTitle>
                <DialogDescription>
                  Histórico de ações realizadas na sua conta
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                    <div className="flex-1 space-y-1">
                      <p className="font-medium">{log.action}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.device} • IP: {log.ip}
                      </p>
                    </div>
                  </div>
                ))}
                {activityLogs.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum log de atividade encontrado
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Export Data Dialog */}
          <Dialog open={exportDataDialogOpen} onOpenChange={setExportDataDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Exportar Dados</DialogTitle>
                <DialogDescription>
                  Exportação de dados conforme LGPD
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm">
                    Estamos preparando uma exportação completa dos seus dados:
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Informações da conta</li>
                    <li>Pedidos e histórico</li>
                    <li>Configurações e preferências</li>
                    <li>Logs de atividade</li>
                    <li>Templates e notificações</li>
                  </ul>
                </div>

                {exportProgress > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progresso</span>
                      <span>{exportProgress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${exportProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {exportProgress === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Você receberá um email com o link para download quando a exportação estiver pronta.
                  </p>
                )}

                {exportProgress === 100 && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      ✓ Exportação concluída! Verifique seu email.
                    </p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
};

export default Settings;
