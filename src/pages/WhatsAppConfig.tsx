import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  Info,
  Smartphone,
  Settings,
  RefreshCw,
  TestTube,
  Zap,
  Clock,
  MessageCircle,
  Loader2,
  PowerOff,
  QrCode,
  CheckCircle,
  XCircle,
  HelpCircle,
  Plus,
  Wifi,
  WifiOff,
  Bell,
  Package,
  Truck,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { whatsappService, type WhatsAppSession } from "@/services/whatsappService";

interface WhatsAppTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  is_active: boolean;
  created_at: string;
}

interface WhatsAppStats {
  messagesSent: number;
  messagesDelivered: number;
  messagesRead: number;
  messagesFailed: number;
  activeChats: number;
  responseTime: number;
}

const WhatsAppConfig = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const sessionNameInitialized = useRef(false); // Controlar se já foi inicializado
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [session, setSession] = useState<WhatsAppSession | null>(null);

  const [config, setConfig] = useState({
    enabled: false,
    auto_reply_enabled: true,
    business_hours_only: false,
    daily_limit: 1000,
    templates_enabled: true,
  });

  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [stats, setStats] = useState<WhatsAppStats>({
    messagesSent: 0,
    messagesDelivered: 0,
    messagesRead: 0,
    messagesFailed: 0,
    activeChats: 0,
    responseTime: 0,
  });

  // Verificar status da sessão
  const checkSessionStatus = useCallback(async (name?: string) => {
    const sessionToCheck = name || sessionName;
    if (!sessionToCheck) return;

    setCheckingStatus(true);
    try {
      const currentSession = await whatsappService.checkSession(sessionToCheck);
      if (currentSession) {
        setSession(currentSession);
        if (user) {
          await whatsappService.saveSessionToDatabase(user.id, currentSession);
        }
      }
    } catch (error) {
      console.error("Error checking session status:", error);
    } finally {
      setCheckingStatus(false);
    }
  }, [sessionName, user]);

  // Carregar configuração e sessão
  const loadConfig = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        const profileData = data as Record<string, unknown>;
        setConfig({
          enabled: (profileData.whatsapp_enabled as boolean) || false,
          auto_reply_enabled: (profileData.whatsapp_auto_reply as boolean) !== false,
          business_hours_only: (profileData.whatsapp_business_hours as boolean) || false,
          daily_limit: (profileData.whatsapp_daily_limit as number) || 1000,
          templates_enabled: (profileData.whatsapp_templates_enabled as boolean) !== false,
        });
        // Só atualizar sessionName na primeira vez (evitar sobrescrever durante edição)
        if (!sessionNameInitialized.current) {
          setSessionName((profileData.whatsapp_session_name as string) || `session_${user.id.substring(0, 8)}`);
          sessionNameInitialized.current = true;
        }
      }

      // Carregar sessão do banco
      const savedSession = await whatsappService.loadSessionFromDatabase(user.id);
      if (savedSession && savedSession.name) {
        setSession(savedSession);
        // Verificar status atual da sessão
        checkSessionStatus(savedSession.name);
      }
    } catch (error) {
      console.error("Error loading WhatsApp config:", error);
    }
  }, [user, checkSessionStatus]);

  // Carregar templates
  const loadTemplates = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("notification_templates")
        .select("*")
        .eq("user_id", user.id)
        .eq("type", "whatsapp")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTemplates(
        (data || []).map((t) => ({
          id: t.id,
          name: t.name,
          category: "general",
          content: t.content,
          is_active: t.is_active,
          created_at: t.created_at,
        }))
      );
    } catch (error) {
      console.error("Error loading templates:", error);
    }
  }, [user]);

  // Carregar estatísticas
  const loadStats = useCallback(async () => {
    if (!user) return;

    setStatsLoading(true);
    try {
      const { count: sentCount } = await supabase
        .from("logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("action", "whatsapp_sent");

      const { count: deliveredCount } = await supabase
        .from("logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("action", "whatsapp_delivered");

      const { count: readCount } = await supabase
        .from("logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("action", "whatsapp_read");

      const { count: failedCount } = await supabase
        .from("logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("action", "whatsapp_failed");

      setStats({
        messagesSent: sentCount || 0,
        messagesDelivered: deliveredCount || 0,
        messagesRead: readCount || 0,
        messagesFailed: failedCount || 0,
        activeChats: 0, // Remover valor aleatório que causava piscar
        responseTime: 0, // Remover valor aleatório que causava piscar
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setStatsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadConfig();
      loadTemplates();
      loadStats();
    }
  }, [user, loadConfig, loadTemplates, loadStats]);

  // Iniciar nova sessão (gerar QR Code)
  const handleStartSession = async () => {
    if (!sessionName) {
      toast({
        title: "Nome da sessão obrigatório",
        description: "Digite um nome para identificar sua sessão do WhatsApp",
        variant: "destructive",
      });
      return;
    }

    console.log("🔄 Iniciando sessão:", sessionName);
    setConnecting(true);
    setQrCode(null);
    setQrDialogOpen(true);

    try {
      console.log("📡 Chamando whatsappService.startSession...");
      const result = await whatsappService.startSession(sessionName);
      console.log("📥 Resultado recebido:", result);

      if (result.success && result.qrCode) {
        console.log("✅ QR Code recebido, length:", result.qrCode.length);
        setQrCode(result.qrCode);
        toast({
          title: "QR Code gerado!",
          description: "Escaneie o código com seu WhatsApp para conectar",
        });

        // Iniciar polling para verificar conexão
        let pollCount = 0;
        const maxPolls = 40; // 2 minutos (40 * 3s)
        const pollInterval = setInterval(async () => {
          pollCount++;
          console.log(`🔍 Verificando conexão (${pollCount}/${maxPolls})...`);
          
          const currentSession = await whatsappService.checkSession(sessionName);
          console.log("📊 Estado atual da sessão:", currentSession);
          
          if (currentSession?.status === "connected") {
            console.log("✅ CONEXÃO DETECTADA! Limpando intervalo...");
            clearInterval(pollInterval);
            setSession(currentSession);
            setQrDialogOpen(false);
            setConnecting(false);
            
            if (user) {
              await whatsappService.saveSessionToDatabase(user.id, currentSession);
            }

            toast({
              title: "✅ WhatsApp conectado!",
              description: `Conectado como ${currentSession.phone || "WhatsApp"}`,
            });
          } else if (pollCount >= maxPolls) {
            // Timeout atingido
            console.log("⏰ Timeout atingido, parando polling");
            clearInterval(pollInterval);
            setConnecting(false);
            toast({
              title: "Tempo esgotado",
              description: "Tente gerar um novo QR Code",
              variant: "destructive",
            });
          }
        }, 3000);
      } else {
        console.error("❌ QR Code não encontrado na resposta:", result);
        throw new Error(result.error || "Erro ao gerar QR Code");
      }
    } catch (error: unknown) {
      console.error("❌ Error starting session:", error);
      setConnecting(false);
      setQrDialogOpen(false);
      toast({
        title: "Erro ao conectar",
        description: error instanceof Error ? error.message : "Não foi possível iniciar a sessão. Verifique se o servidor WPPConnect está rodando.",
        variant: "destructive",
      });
    }
  };

  // Desconectar sessão
  const handleLogout = async () => {
    if (!sessionName) return;

    setLoading(true);
    try {
      const success = await whatsappService.logoutSession(sessionName);

      if (success) {
        setSession(null);
        setQrCode(null);

        if (user) {
          await supabase
            .from("profiles")
            .update({
              whatsapp_status: "disconnected",
              whatsapp_phone: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", user.id);

          await supabase.from("logs").insert({
            user_id: user.id,
            action: "whatsapp_disconnected",
            details: { timestamp: new Date().toISOString() },
          });
        }

        toast({
          title: "WhatsApp desconectado",
          description: "Sua sessão foi encerrada com sucesso",
        });
      }
    } catch (error) {
      console.error("Error logging out:", error);
      toast({
        title: "Erro ao desconectar",
        description: "Não foi possível encerrar a sessão",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Salvar configurações
  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const updateData = {
        whatsapp_enabled: config.enabled,
        whatsapp_auto_reply: config.auto_reply_enabled,
        whatsapp_business_hours: config.business_hours_only,
        whatsapp_daily_limit: config.daily_limit,
        whatsapp_templates_enabled: config.templates_enabled,
        whatsapp_session_name: sessionName,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>;

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);

      if (error) throw error;

      await supabase.from("logs").insert({
        user_id: user.id,
        action: "whatsapp_config_updated",
        details: {
          timestamp: new Date().toISOString(),
          enabled: config.enabled,
        },
      });

      toast({
        title: "Configurações salvas!",
        description: "As configurações do WhatsApp foram atualizadas com sucesso.",
      });

      loadStats();
    } catch (error) {
      console.error("Error saving config:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Enviar mensagem de teste
  const handleTestMessage = async () => {
    if (!testPhone || !testMessage) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o número e a mensagem de teste.",
        variant: "destructive",
      });
      return;
    }

    if (!sessionName || !session || session.status !== "connected") {
      toast({
        title: "WhatsApp não conectado",
        description: "Conecte seu WhatsApp antes de enviar mensagens.",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      const result = await whatsappService.sendMessage(sessionName, testPhone, testMessage);

      if (result.success) {
        await supabase.from("logs").insert({
          user_id: user!.id,
          action: "whatsapp_test_sent",
          details: {
            timestamp: new Date().toISOString(),
            phone: testPhone,
            message: testMessage,
            messageId: result.messageId,
          },
        });

        toast({
          title: "Mensagem enviada!",
          description: `Mensagem enviada para ${testPhone} com sucesso`,
        });

        setTestDialogOpen(false);
        setTestPhone("");
        setTestMessage("");
        loadStats();
      } else {
        throw new Error(result.error || "Erro ao enviar mensagem");
      }
    } catch (error: unknown) {
      console.error("Error sending test:", error);
      toast({
        title: "Erro ao enviar",
        description: error instanceof Error ? error.message : "Não foi possível enviar a mensagem de teste.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const getDeliveryRate = () => {
    if (stats.messagesSent === 0) return 0;
    return Math.round((stats.messagesDelivered / stats.messagesSent) * 100);
  };

  const getReadRate = () => {
    if (stats.messagesDelivered === 0) return 0;
    return Math.round((stats.messagesRead / stats.messagesDelivered) * 100);
  };

  const getStatusIcon = () => {
    if (connecting || checkingStatus) {
      return <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />;
    }
    if (session?.status === "connected") {
      return <Wifi className="h-5 w-5 text-green-500" />;
    }
    return <WifiOff className="h-5 w-5 text-gray-400" />;
  };

  const getStatusBadge = () => {
    if (connecting) {
      return (
        <Badge variant="secondary" className="gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Conectando...
        </Badge>
      );
    }
    if (session?.status === "connected") {
      return (
        <Badge className="gap-2 bg-green-500">
          <CheckCircle2 className="h-3 w-3" />
          Conectado
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-2">
        <XCircle className="h-3 w-3" />
        Desconectado
      </Badge>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 pt-20 pb-12 px-4">
        <div className="container mx-auto max-w-7xl space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/profile">
                <Button variant="outline" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <MessageSquare className="h-8 w-8" />
                  Configuração do WhatsApp
                </h1>
                <p className="text-muted-foreground">
                  Conecte seu WhatsApp e gerencie notificações automatizadas
                </p>
              </div>
            </div>
            <Button onClick={() => setHelpDialogOpen(true)} variant="outline">
              <HelpCircle className="mr-2 h-4 w-4" />
              Ajuda
            </Button>
          </div>

          {/* Connection Status Banner */}
          <Card className={session?.status === "connected" ? "border-green-500" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon()}
                  <div>
                    <CardTitle className="text-lg">Status da Conexão</CardTitle>
                    <CardDescription>
                      {session?.status === "connected"
                        ? `Conectado como ${session.phone || "WhatsApp"}`
                        : "WhatsApp não conectado"}
                    </CardDescription>
                  </div>
                </div>
                {getStatusBadge()}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                {session?.status === "connected" ? (
                  <>
                    <Button
                      onClick={() => checkSessionStatus()}
                      variant="outline"
                      disabled={checkingStatus}
                    >
                      {checkingStatus ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Verificar Status
                    </Button>
                    <Button onClick={handleLogout} variant="destructive" disabled={loading}>
                      {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <PowerOff className="mr-2 h-4 w-4" />
                      )}
                      Desconectar
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleStartSession} disabled={connecting || !sessionName}>
                    {connecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Conectando...
                      </>
                    ) : (
                      <>
                        <QrCode className="mr-2 h-4 w-4" />
                        Conectar WhatsApp
                      </>
                    )}
                  </Button>
                )}
              </div>
              {session?.lastActivity && (
                <p className="text-xs text-muted-foreground mt-3">
                  Última atividade:{" "}
                  {format(new Date(session.lastActivity), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Mensagens Enviadas</CardTitle>
                <Send className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="h-8 bg-muted rounded animate-pulse" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">{stats.messagesSent}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.messagesFailed} falharam
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Entrega</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="h-8 bg-muted rounded animate-pulse" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">{getDeliveryRate()}%</div>
                    <Progress value={getDeliveryRate()} className="h-1 mt-2" />
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Leitura</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="h-8 bg-muted rounded animate-pulse" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">{getReadRate()}%</div>
                    <Progress value={getReadRate()} className="h-1 mt-2" />
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tempo de Resposta</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="h-8 bg-muted rounded animate-pulse" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {Math.floor(stats.responseTime / 60)}m {stats.responseTime % 60}s
                    </div>
                    <p className="text-xs text-muted-foreground">Média de resposta</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="config" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="config">
                <Settings className="mr-2 h-4 w-4" />
                Configuração
              </TabsTrigger>
              <TabsTrigger value="templates">
                <MessageCircle className="mr-2 h-4 w-4" />
                Templates
              </TabsTrigger>
              <TabsTrigger value="automation">
                <Zap className="mr-2 h-4 w-4" />
                Automação
              </TabsTrigger>
            </TabsList>

            {/* Configuration Tab */}
            <TabsContent value="config" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Configurações Gerais</CardTitle>
                  <CardDescription>
                    Configure seu WhatsApp usando WPPConnect (WhatsApp Web)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Session Name */}
                  <div className="space-y-2">
                    <Label htmlFor="sessionName">Nome da Sessão</Label>
                    <Input
                      id="sessionName"
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      placeholder="minha-sessao-whatsapp"
                      disabled={session?.status === "connected"}
                    />
                    <p className="text-xs text-muted-foreground">
                      Identificador único para sua sessão do WhatsApp
                    </p>
                  </div>

                  <Separator />

                  {/* Enable/Disable */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="enabled">Ativar Notificações</Label>
                      <p className="text-sm text-muted-foreground">
                        Habilitar envio de notificações via WhatsApp
                      </p>
                    </div>
                    <Switch
                      id="enabled"
                      checked={config.enabled}
                      onCheckedChange={(checked) =>
                        setConfig({ ...config, enabled: checked })
                      }
                      disabled={session?.status !== "connected"}
                    />
                  </div>

                  <Separator />

                  {/* Daily Limit */}
                  <div className="space-y-2">
                    <Label htmlFor="dailyLimit">Limite Diário de Mensagens</Label>
                    <Input
                      id="dailyLimit"
                      type="number"
                      value={config.daily_limit}
                      onChange={(e) =>
                        setConfig({ ...config, daily_limit: parseInt(e.target.value) || 0 })
                      }
                      min="1"
                      max="10000"
                    />
                    <p className="text-xs text-muted-foreground">
                      Limite máximo de mensagens por dia (recomendado: 1000)
                    </p>
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Usando WPPConnect</AlertTitle>
                    <AlertDescription>
                      Você está usando WPPConnect que se conecta ao WhatsApp Web. Não é
                      necessário API oficial ou aprovação do Meta. Basta escanear o QR Code!
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Configurações Avançadas</CardTitle>
                  <CardDescription>
                    Personalize o comportamento das notificações
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="autoReply">Resposta Automática</Label>
                      <p className="text-sm text-muted-foreground">
                        Enviar confirmação automática ao receber mensagens
                      </p>
                    </div>
                    <Switch
                      id="autoReply"
                      checked={config.auto_reply_enabled}
                      onCheckedChange={(checked) =>
                        setConfig({ ...config, auto_reply_enabled: checked })
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="businessHours">Apenas em Horário Comercial</Label>
                      <p className="text-sm text-muted-foreground">
                        Enviar mensagens apenas das 8h às 18h
                      </p>
                    </div>
                    <Switch
                      id="businessHours"
                      checked={config.business_hours_only}
                      onCheckedChange={(checked) =>
                        setConfig({ ...config, business_hours_only: checked })
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="templates">Usar Templates</Label>
                      <p className="text-sm text-muted-foreground">
                        Enviar mensagens usando templates pré-definidos
                      </p>
                    </div>
                    <Switch
                      id="templates"
                      checked={config.templates_enabled}
                      onCheckedChange={(checked) =>
                        setConfig({ ...config, templates_enabled: checked })
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-3">
                <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={session?.status !== "connected"}
                    >
                      <TestTube className="mr-2 h-4 w-4" />
                      Enviar Teste
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Enviar Mensagem de Teste</DialogTitle>
                      <DialogDescription>
                        Envie uma mensagem de teste para verificar a conexão
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="testPhone">Número de Telefone</Label>
                        <Input
                          id="testPhone"
                          value={testPhone}
                          onChange={(e) => setTestPhone(e.target.value)}
                          placeholder="5511987654321"
                        />
                        <p className="text-xs text-muted-foreground">
                          Apenas números, incluindo código do país (ex: 5511987654321)
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="testMessage">Mensagem</Label>
                        <Textarea
                          id="testMessage"
                          value={testMessage}
                          onChange={(e) => setTestMessage(e.target.value)}
                          placeholder="Digite sua mensagem de teste..."
                          rows={4}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setTestDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button onClick={handleTestMessage} disabled={testing}>
                        {testing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Enviar Teste
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button onClick={handleSave} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Salvar Configurações
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Templates Tab */}
            <TabsContent value="templates" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Templates de Mensagens</CardTitle>
                      <CardDescription>
                        Gerencie templates personalizados para diferentes situações
                      </CardDescription>
                    </div>
                    <Link to="/settings">
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Template
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  {templates.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Nenhum template criado</h3>
                      <p className="text-muted-foreground mb-4">
                        Crie templates personalizados para diferentes situações
                      </p>
                      <Link to="/settings">
                        <Button>
                          <Plus className="mr-2 h-4 w-4" />
                          Criar Primeiro Template
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {templates.map((template) => (
                        <Card key={template.id}>
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-base">{template.name}</CardTitle>
                                <CardDescription className="mt-1">
                                  Categoria: {template.category}
                                </CardDescription>
                              </div>
                              <Badge variant={template.is_active ? "default" : "secondary"}>
                                {template.is_active ? "Ativo" : "Inativo"}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="bg-muted p-4 rounded-lg">
                              <p className="text-sm whitespace-pre-wrap">{template.content}</p>
                            </div>
                            <div className="mt-4 flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                Criado em{" "}
                                {format(new Date(template.created_at), "dd/MM/yyyy", {
                                  locale: ptBR,
                                })}
                              </span>
                              <Link to="/settings">
                                <Button variant="outline" size="sm">
                                  Editar
                                </Button>
                              </Link>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Automation Tab */}
            <TabsContent value="automation" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Notificações Automáticas</CardTitle>
                  <CardDescription>
                    Configure quando enviar notificações automáticas via WhatsApp
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 border rounded-lg">
                      <Package className="h-6 w-6 text-primary mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">Pedido Criado</h4>
                            <p className="text-sm text-muted-foreground">
                              Notificar cliente quando um novo pedido for criado
                            </p>
                          </div>
                          <Switch defaultChecked disabled={!config.enabled} />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 border rounded-lg">
                      <Truck className="h-6 w-6 text-primary mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">Em Trânsito</h4>
                            <p className="text-sm text-muted-foreground">
                              Notificar quando o pedido entrar em trânsito
                            </p>
                          </div>
                          <Switch defaultChecked disabled={!config.enabled} />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 border rounded-lg">
                      <CheckCircle className="h-6 w-6 text-primary mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">Pedido Entregue</h4>
                            <p className="text-sm text-muted-foreground">
                              Notificar quando o pedido for entregue
                            </p>
                          </div>
                          <Switch defaultChecked disabled={!config.enabled} />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 border rounded-lg">
                      <AlertTriangle className="h-6 w-6 text-destructive mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">Atraso Detectado</h4>
                            <p className="text-sm text-muted-foreground">
                              Notificar quando houver atraso na entrega
                            </p>
                          </div>
                          <Switch defaultChecked disabled={!config.enabled} />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 border rounded-lg">
                      <XCircle className="h-6 w-6 text-destructive mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">Falha na Entrega</h4>
                            <p className="text-sm text-muted-foreground">
                              Notificar quando houver falha na tentativa de entrega
                            </p>
                          </div>
                          <Switch defaultChecked disabled={!config.enabled} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <Alert>
                    <Bell className="h-4 w-4" />
                    <AlertTitle>Importante</AlertTitle>
                    <AlertDescription>
                      As notificações automáticas serão enviadas de acordo com as regras
                      configuradas. Certifique-se de que seu WhatsApp está sempre conectado.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent 
          className="max-w-md"
          onInteractOutside={(e) => {
            // Impedir fechamento ao clicar fora enquanto está conectando
            if (connecting) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu WhatsApp para conectar
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            {qrCode ? (
              <>
                <div className="bg-white p-4 rounded-lg">
                  <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  1. Abra o WhatsApp no seu celular
                  <br />
                  2. Toque em Menu ou Configurações
                  <br />
                  3. Toque em Aparelhos conectados
                  <br />
                  4. Toque em Conectar um aparelho
                  <br />
                  5. Aponte seu celular para esta tela para capturar o código
                </p>
                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {connecting 
                      ? "🔍 Verificando conexão automaticamente a cada 3 segundos..." 
                      : "Conexão estabelecida ou cancelada"}
                  </AlertDescription>
                </Alert>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Gerando QR Code, aguarde...
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                await checkSessionStatus();
                toast({
                  title: "Status verificado",
                  description: session?.status === "connected" 
                    ? "WhatsApp conectado!" 
                    : "Ainda não conectado",
                });
              }}
              disabled={!sessionName || checkingStatus}
            >
              {checkingStatus ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Verificar Conexão
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setQrDialogOpen(false);
                setConnecting(false);
              }}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Help Dialog */}
      <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Guia de Configuração - WPPConnect</DialogTitle>
            <DialogDescription>
              Como configurar e usar o WhatsApp com WPPConnect
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <Alert>
              <Smartphone className="h-4 w-4" />
              <AlertTitle>O que é WPPConnect?</AlertTitle>
              <AlertDescription>
                WPPConnect é uma biblioteca que permite conectar ao WhatsApp Web sem
                precisar da API oficial. Você conecta escaneando um QR Code, como no
                WhatsApp Web normal.
              </AlertDescription>
            </Alert>

            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                  1
                </span>
                Iniciar o Servidor WPPConnect
              </h3>
              <div className="ml-8 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Execute o comando no terminal:
                </p>
                <code className="block bg-muted p-2 rounded text-sm">
                  node wppconnect-server.js
                </code>
                <p className="text-xs text-muted-foreground">
                  O servidor ficará rodando na porta 21465
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                  2
                </span>
                Conectar seu WhatsApp
              </h3>
              <div className="ml-8">
                <p className="text-sm text-muted-foreground">
                  Clique em "Conectar WhatsApp" e escaneie o QR Code que aparecerá com
                  seu celular. É o mesmo processo do WhatsApp Web.
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                  3
                </span>
                Configurar Notificações
              </h3>
              <div className="ml-8">
                <p className="text-sm text-muted-foreground">
                  Após conectar, ative as notificações e configure os templates e
                  automações desejadas.
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                  4
                </span>
                Testar o Envio
              </h3>
              <div className="ml-8">
                <p className="text-sm text-muted-foreground">
                  Use o botão "Enviar Teste" para confirmar que tudo está funcionando
                  corretamente.
                </p>
              </div>
            </div>

            <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-500">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertTitle>Importante</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  • Mantenha o servidor WPPConnect sempre rodando para receber mensagens
                </p>
                <p>
                  • Seu celular precisa estar conectado à internet (mas não precisa
                  estar aberto)
                </p>
                <p>• Evite usar o mesmo número em múltiplos navegadores</p>
                <p>
                  • Se desconectar, basta escanear o QR Code novamente para reconectar
                </p>
              </AlertDescription>
            </Alert>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppConfig;
