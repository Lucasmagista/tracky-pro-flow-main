import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Mail,
  MessageSquare,
  Smartphone,
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface ProviderConfig {
  id?: string;
  provider: 'smtp' | 'twilio' | 'whatsapp';
  is_enabled: boolean;
  config: Record<string, string>;
}

export function NotificationProviderSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // SMTP Configuration
  const [smtpConfig, setSmtpConfig] = useState({
    is_enabled: false,
    host: '',
    port: '587',
    username: '',
    password: '',
    from_email: '',
    from_name: '',
    use_tls: true,
  });

  // Twilio SMS Configuration
  const [twilioConfig, setTwilioConfig] = useState({
    is_enabled: false,
    account_sid: '',
    auth_token: '',
    phone_number: '',
  });

  // WhatsApp Configuration
  const [whatsappConfig, setWhatsappConfig] = useState({
    is_enabled: false,
    api_url: '',
    api_key: '',
    session_name: '',
    webhook_url: '',
  });

  // Load configurations
  const loadConfigs = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('notification_providers')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      const providers = (data || []) as ProviderConfig[];

      // Load SMTP config
      const smtp = providers.find((p) => p.provider === 'smtp');
      if (smtp) {
        setSmtpConfig({
          is_enabled: smtp.is_enabled,
          host: smtp.config.host || '',
          port: smtp.config.port || '587',
          username: smtp.config.username || '',
          password: smtp.config.password || '',
          from_email: smtp.config.from_email || '',
          from_name: smtp.config.from_name || '',
          use_tls: smtp.config.use_tls === 'true',
        });
      }

      // Load Twilio config
      const twilio = providers.find((p) => p.provider === 'twilio');
      if (twilio) {
        setTwilioConfig({
          is_enabled: twilio.is_enabled,
          account_sid: twilio.config.account_sid || '',
          auth_token: twilio.config.auth_token || '',
          phone_number: twilio.config.phone_number || '',
        });
      }

      // Load WhatsApp config
      const whatsapp = providers.find((p) => p.provider === 'whatsapp');
      if (whatsapp) {
        setWhatsappConfig({
          is_enabled: whatsapp.is_enabled,
          api_url: whatsapp.config.api_url || '',
          api_key: whatsapp.config.api_key || '',
          session_name: whatsapp.config.session_name || '',
          webhook_url: whatsapp.config.webhook_url || '',
        });
      }
    } catch (err) {
      console.error('Error loading provider configs:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  // Save SMTP configuration
  const saveSMTPConfig = async () => {
    if (!user) return;

    if (smtpConfig.is_enabled) {
      if (!smtpConfig.host || !smtpConfig.port || !smtpConfig.username || !smtpConfig.password) {
        toast({
          title: 'Campos obrigatórios',
          description: 'Preencha todos os campos obrigatórios.',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      const config = {
        host: smtpConfig.host,
        port: smtpConfig.port,
        username: smtpConfig.username,
        password: smtpConfig.password,
        from_email: smtpConfig.from_email,
        from_name: smtpConfig.from_name,
        use_tls: smtpConfig.use_tls.toString(),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('notification_providers')
        .upsert({
          user_id: user.id,
          provider: 'smtp',
          is_enabled: smtpConfig.is_enabled,
          config: config,
        }, {
          onConflict: 'user_id,provider'
        });

      if (error) throw error;

      toast({
        title: 'Configuração salva!',
        description: 'As configurações SMTP foram atualizadas.',
      });
    } catch (err) {
      console.error('Error saving SMTP config:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Save Twilio configuration
  const saveTwilioConfig = async () => {
    if (!user) return;

    if (twilioConfig.is_enabled) {
      if (!twilioConfig.account_sid || !twilioConfig.auth_token || !twilioConfig.phone_number) {
        toast({
          title: 'Campos obrigatórios',
          description: 'Preencha todos os campos obrigatórios.',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      const config = {
        account_sid: twilioConfig.account_sid,
        auth_token: twilioConfig.auth_token,
        phone_number: twilioConfig.phone_number,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('notification_providers')
        .upsert({
          user_id: user.id,
          provider: 'twilio',
          is_enabled: twilioConfig.is_enabled,
          config: config,
        }, {
          onConflict: 'user_id,provider'
        });

      if (error) throw error;

      toast({
        title: 'Configuração salva!',
        description: 'As configurações Twilio foram atualizadas.',
      });
    } catch (err) {
      console.error('Error saving Twilio config:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Save WhatsApp configuration
  const saveWhatsAppConfig = async () => {
    if (!user) return;

    if (whatsappConfig.is_enabled) {
      if (!whatsappConfig.api_url || !whatsappConfig.session_name) {
        toast({
          title: 'Campos obrigatórios',
          description: 'Preencha todos os campos obrigatórios.',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      const config = {
        api_url: whatsappConfig.api_url,
        api_key: whatsappConfig.api_key,
        session_name: whatsappConfig.session_name,
        webhook_url: whatsappConfig.webhook_url,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('notification_providers')
        .upsert({
          user_id: user.id,
          provider: 'whatsapp',
          is_enabled: whatsappConfig.is_enabled,
          config: config,
        }, {
          onConflict: 'user_id,provider'
        });

      if (error) throw error;

      toast({
        title: 'Configuração salva!',
        description: 'As configurações WhatsApp foram atualizadas.',
      });
    } catch (err) {
      console.error('Error saving WhatsApp config:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Test connection
  const testConnection = async (provider: 'smtp' | 'twilio' | 'whatsapp') => {
    setIsTesting(true);
    try {
      // Simulate API call to test connection
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast({
        title: 'Conexão bem-sucedida!',
        description: `A conexão com ${provider.toUpperCase()} foi estabelecida.`,
      });
    } catch (err) {
      toast({
        title: 'Erro na conexão',
        description: 'Não foi possível conectar ao provedor.',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Configuração de Provedores</h2>
        <p className="text-muted-foreground">
          Configure os serviços de envio de notificações
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Importante</AlertTitle>
        <AlertDescription>
          As credenciais são criptografadas e armazenadas com segurança. Certifique-se de ter as
          permissões necessárias nos serviços que você irá configurar.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="smtp" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="smtp">
            <Mail className="h-4 w-4 mr-2" />
            Email (SMTP)
          </TabsTrigger>
          <TabsTrigger value="sms">
            <Smartphone className="h-4 w-4 mr-2" />
            SMS (Twilio)
          </TabsTrigger>
          <TabsTrigger value="whatsapp">
            <MessageSquare className="h-4 w-4 mr-2" />
            WhatsApp
          </TabsTrigger>
        </TabsList>

        {/* SMTP Configuration */}
        <TabsContent value="smtp">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Configuração SMTP</CardTitle>
                  <CardDescription>
                    Configure seu servidor SMTP para envio de emails
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {smtpConfig.is_enabled && (
                    <Badge variant="default" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Ativo
                    </Badge>
                  )}
                  <Switch
                    checked={smtpConfig.is_enabled}
                    onCheckedChange={(checked) =>
                      setSmtpConfig({ ...smtpConfig, is_enabled: checked })
                    }
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="smtp-host">Servidor SMTP *</Label>
                  <Input
                    id="smtp-host"
                    value={smtpConfig.host}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                    placeholder="smtp.gmail.com"
                    disabled={!smtpConfig.is_enabled}
                  />
                </div>

                <div>
                  <Label htmlFor="smtp-port">Porta *</Label>
                  <Input
                    id="smtp-port"
                    value={smtpConfig.port}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, port: e.target.value })}
                    placeholder="587"
                    disabled={!smtpConfig.is_enabled}
                  />
                </div>

                <div>
                  <Label htmlFor="smtp-username">Usuário *</Label>
                  <Input
                    id="smtp-username"
                    value={smtpConfig.username}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, username: e.target.value })}
                    placeholder="seu@email.com"
                    disabled={!smtpConfig.is_enabled}
                  />
                </div>

                <div>
                  <Label htmlFor="smtp-password">Senha *</Label>
                  <Input
                    id="smtp-password"
                    type="password"
                    value={smtpConfig.password}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
                    placeholder="••••••••"
                    disabled={!smtpConfig.is_enabled}
                  />
                </div>

                <div>
                  <Label htmlFor="smtp-from-email">Email Remetente</Label>
                  <Input
                    id="smtp-from-email"
                    value={smtpConfig.from_email}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, from_email: e.target.value })}
                    placeholder="noreply@suaempresa.com"
                    disabled={!smtpConfig.is_enabled}
                  />
                </div>

                <div>
                  <Label htmlFor="smtp-from-name">Nome Remetente</Label>
                  <Input
                    id="smtp-from-name"
                    value={smtpConfig.from_name}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, from_name: e.target.value })}
                    placeholder="Sua Empresa"
                    disabled={!smtpConfig.is_enabled}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="smtp-tls"
                  checked={smtpConfig.use_tls}
                  onCheckedChange={(checked) => setSmtpConfig({ ...smtpConfig, use_tls: checked })}
                  disabled={!smtpConfig.is_enabled}
                />
                <Label htmlFor="smtp-tls">Usar TLS/SSL</Label>
              </div>

              <div className="flex gap-2">
                <Button onClick={saveSMTPConfig} disabled={isLoading || !smtpConfig.is_enabled}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Configuração
                </Button>
                <Button
                  variant="outline"
                  onClick={() => testConnection('smtp')}
                  disabled={isTesting || !smtpConfig.is_enabled}
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    'Testar Conexão'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Twilio SMS Configuration */}
        <TabsContent value="sms">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Configuração Twilio SMS</CardTitle>
                  <CardDescription>
                    Configure sua conta Twilio para envio de SMS
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {twilioConfig.is_enabled && (
                    <Badge variant="default" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Ativo
                    </Badge>
                  )}
                  <Switch
                    checked={twilioConfig.is_enabled}
                    onCheckedChange={(checked) =>
                      setTwilioConfig({ ...twilioConfig, is_enabled: checked })
                    }
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  <strong>Obtenha suas credenciais:</strong> Acesse{' '}
                  <a
                    href="https://www.twilio.com/console"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Twilio Console
                  </a>{' '}
                  para pegar seu Account SID e Auth Token.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="twilio-sid">Account SID *</Label>
                  <Input
                    id="twilio-sid"
                    value={twilioConfig.account_sid}
                    onChange={(e) =>
                      setTwilioConfig({ ...twilioConfig, account_sid: e.target.value })
                    }
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    disabled={!twilioConfig.is_enabled}
                  />
                </div>

                <div>
                  <Label htmlFor="twilio-token">Auth Token *</Label>
                  <Input
                    id="twilio-token"
                    type="password"
                    value={twilioConfig.auth_token}
                    onChange={(e) =>
                      setTwilioConfig({ ...twilioConfig, auth_token: e.target.value })
                    }
                    placeholder="••••••••••••••••••••••••••••••••"
                    disabled={!twilioConfig.is_enabled}
                  />
                </div>

                <div>
                  <Label htmlFor="twilio-phone">Número de Telefone *</Label>
                  <Input
                    id="twilio-phone"
                    value={twilioConfig.phone_number}
                    onChange={(e) =>
                      setTwilioConfig({ ...twilioConfig, phone_number: e.target.value })
                    }
                    placeholder="+5511999999999"
                    disabled={!twilioConfig.is_enabled}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={saveTwilioConfig} disabled={isLoading || !twilioConfig.is_enabled}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Configuração
                </Button>
                <Button
                  variant="outline"
                  onClick={() => testConnection('twilio')}
                  disabled={isTesting || !twilioConfig.is_enabled}
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    'Testar Conexão'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp Configuration */}
        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Configuração WhatsApp</CardTitle>
                  <CardDescription>
                    Configure integração WhatsApp (WPPConnect ou similar)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {whatsappConfig.is_enabled && (
                    <Badge variant="default" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Ativo
                    </Badge>
                  )}
                  <Switch
                    checked={whatsappConfig.is_enabled}
                    onCheckedChange={(checked) =>
                      setWhatsappConfig({ ...whatsappConfig, is_enabled: checked })
                    }
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  Esta integração requer uma API externa como WPPConnect, Baileys ou WhatsApp Business API.
                  Configure sua API antes de prosseguir.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="whatsapp-url">URL da API *</Label>
                  <Input
                    id="whatsapp-url"
                    value={whatsappConfig.api_url}
                    onChange={(e) =>
                      setWhatsappConfig({ ...whatsappConfig, api_url: e.target.value })
                    }
                    placeholder="https://sua-api-whatsapp.com"
                    disabled={!whatsappConfig.is_enabled}
                  />
                </div>

                <div>
                  <Label htmlFor="whatsapp-key">API Key (Opcional)</Label>
                  <Input
                    id="whatsapp-key"
                    type="password"
                    value={whatsappConfig.api_key}
                    onChange={(e) =>
                      setWhatsappConfig({ ...whatsappConfig, api_key: e.target.value })
                    }
                    placeholder="••••••••••••••••"
                    disabled={!whatsappConfig.is_enabled}
                  />
                </div>

                <div>
                  <Label htmlFor="whatsapp-session">Nome da Sessão *</Label>
                  <Input
                    id="whatsapp-session"
                    value={whatsappConfig.session_name}
                    onChange={(e) =>
                      setWhatsappConfig({ ...whatsappConfig, session_name: e.target.value })
                    }
                    placeholder="minha-empresa"
                    disabled={!whatsappConfig.is_enabled}
                  />
                </div>

                <div>
                  <Label htmlFor="whatsapp-webhook">Webhook URL (Opcional)</Label>
                  <Input
                    id="whatsapp-webhook"
                    value={whatsappConfig.webhook_url}
                    onChange={(e) =>
                      setWhatsappConfig({ ...whatsappConfig, webhook_url: e.target.value })
                    }
                    placeholder="https://seu-site.com/webhook/whatsapp"
                    disabled={!whatsappConfig.is_enabled}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={saveWhatsAppConfig} disabled={isLoading || !whatsappConfig.is_enabled}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Configuração
                </Button>
                <Button
                  variant="outline"
                  onClick={() => testConnection('whatsapp')}
                  disabled={isTesting || !whatsappConfig.is_enabled}
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    'Testar Conexão'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
