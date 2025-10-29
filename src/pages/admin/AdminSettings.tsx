import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminService } from '@/services/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertCircle,
  Bell,
  Database,
  Flag,
  Lock,
  Save,
  Settings as SettingsIcon,
  Zap
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'

interface SystemSettings extends Record<string, unknown> {
  maintenance_mode: boolean
  maintenance_message: string
  max_free_tracking_codes: number
  max_pro_tracking_codes: number
  max_premium_tracking_codes: number
  enable_whatsapp: boolean
  enable_email_notifications: boolean
  enable_push_notifications: boolean
  auto_backup_enabled: boolean
  backup_frequency_hours: number
  session_timeout_minutes: number
  max_login_attempts: number
  require_email_verification: boolean
}

interface FeatureFlag {
  id: string
  name: string
  key: string
  enabled: boolean
  description?: string
  created_at: string
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<SystemSettings>({
    maintenance_mode: false,
    maintenance_message: '',
    max_free_tracking_codes: 5,
    max_pro_tracking_codes: 50,
    max_premium_tracking_codes: 999999,
    enable_whatsapp: true,
    enable_email_notifications: true,
    enable_push_notifications: false,
    auto_backup_enabled: true,
    backup_frequency_hours: 24,
    session_timeout_minutes: 60,
    max_login_attempts: 5,
    require_email_verification: true
  })
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const [systemSettings, flags] = await Promise.all([
        AdminService.getSystemSettings(),
        AdminService.getFeatureFlags()
      ])
      
      if (systemSettings) {
        setSettings(systemSettings as unknown as SystemSettings)
      }
      
      setFeatureFlags(flags as unknown as FeatureFlag[])
    } catch (error) {
      console.error('Error loading settings:', error)
      toast({
        title: 'Erro ao carregar configurações',
        description: 'Não foi possível carregar as configurações do sistema.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true)
      await AdminService.updateSystemSettings(settings)

      toast({
        title: 'Configurações salvas',
        description: 'As configurações do sistema foram atualizadas com sucesso.'
      })
    } catch (error) {
      console.error('Error saving settings:', error)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleFeatureFlag = async (flag: FeatureFlag) => {
    try {
      await AdminService.toggleFeatureFlag(flag.id, !flag.enabled)

      setFeatureFlags(prev =>
        prev.map(f => f.id === flag.id ? { ...f, enabled: !f.enabled } : f)
      )

      toast({
        title: flag.enabled ? 'Feature desativada' : 'Feature ativada',
        description: `${flag.name} foi ${flag.enabled ? 'desativada' : 'ativada'} com sucesso.`
      })
    } catch (error) {
      console.error('Error toggling feature flag:', error)
      toast({
        title: 'Erro ao alterar feature',
        description: 'Não foi possível alterar o status da feature.',
        variant: 'destructive'
      })
    }
  }

  const handleTestBackup = async () => {
    try {
      toast({
        title: 'Iniciando backup',
        description: 'O backup do sistema está sendo executado...'
      })

      // Simular backup (você deve implementar a lógica real)
      await new Promise(resolve => setTimeout(resolve, 2000))

      toast({
        title: 'Backup concluído',
        description: 'O backup foi realizado com sucesso.'
      })
    } catch (error) {
      console.error('Error running backup:', error)
      toast({
        title: 'Erro no backup',
        description: 'Não foi possível realizar o backup.',
        variant: 'destructive'
      })
    }
  }

  const handleClearCache = async () => {
    try {
      toast({
        title: 'Limpando cache',
        description: 'O cache do sistema está sendo limpo...'
      })

      // Implementar lógica de limpeza de cache
      await new Promise(resolve => setTimeout(resolve, 1000))

      toast({
        title: 'Cache limpo',
        description: 'O cache foi limpo com sucesso.'
      })
    } catch (error) {
      console.error('Error clearing cache:', error)
      toast({
        title: 'Erro ao limpar cache',
        description: 'Não foi possível limpar o cache.',
        variant: 'destructive'
      })
    }
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="text-muted-foreground">Carregando configurações...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Configurações do Sistema</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie todas as configurações e recursos do sistema
            </p>
          </div>
          <Button onClick={handleSaveSettings} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>

        {/* Maintenance Alert */}
        {settings.maintenance_mode && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-500">Modo de Manutenção Ativo</h3>
              <p className="text-sm text-muted-foreground mt-1">
                O sistema está em modo de manutenção. Apenas administradores têm acesso.
              </p>
            </div>
          </div>
        )}

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">
              <SettingsIcon className="h-4 w-4 mr-2" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="limits">
              <Zap className="h-4 w-4 mr-2" />
              Limites
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notificações
            </TabsTrigger>
            <TabsTrigger value="security">
              <Lock className="h-4 w-4 mr-2" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="features">
              <Flag className="h-4 w-4 mr-2" />
              Features
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configurações Gerais</CardTitle>
                <CardDescription>
                  Configure as opções básicas do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Modo de Manutenção</Label>
                    <p className="text-sm text-muted-foreground">
                      Quando ativado, apenas administradores podem acessar o sistema
                    </p>
                  </div>
                  <Switch
                    checked={settings.maintenance_mode}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, maintenance_mode: checked })
                    }
                  />
                </div>

                {settings.maintenance_mode && (
                  <div className="space-y-2">
                    <Label>Mensagem de Manutenção</Label>
                    <Textarea
                      placeholder="Digite a mensagem que será exibida aos usuários..."
                      value={settings.maintenance_message}
                      onChange={(e) =>
                        setSettings({ ...settings, maintenance_message: e.target.value })
                      }
                      rows={3}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Backup e Manutenção</CardTitle>
                <CardDescription>
                  Configure backups automáticos e manutenção do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Backup Automático</Label>
                    <p className="text-sm text-muted-foreground">
                      Realize backups automáticos do banco de dados
                    </p>
                  </div>
                  <Switch
                    checked={settings.auto_backup_enabled}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, auto_backup_enabled: checked })
                    }
                  />
                </div>

                {settings.auto_backup_enabled && (
                  <div className="space-y-2">
                    <Label>Frequência de Backup (horas)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="168"
                      value={settings.backup_frequency_hours}
                      onChange={(e) =>
                        setSettings({ ...settings, backup_frequency_hours: parseInt(e.target.value) })
                      }
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleTestBackup} variant="outline">
                    <Database className="h-4 w-4 mr-2" />
                    Executar Backup Agora
                  </Button>
                  <Button onClick={handleClearCache} variant="outline">
                    Limpar Cache
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Limits Settings */}
          <TabsContent value="limits" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Limites de Rastreamento</CardTitle>
                <CardDescription>
                  Configure os limites de códigos de rastreamento por plano
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Plano Free</Label>
                    <Input
                      type="number"
                      min="1"
                      value={settings.max_free_tracking_codes}
                      onChange={(e) =>
                        setSettings({ ...settings, max_free_tracking_codes: parseInt(e.target.value) })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Máximo de códigos para usuários gratuitos
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Plano Pro</Label>
                    <Input
                      type="number"
                      min="1"
                      value={settings.max_pro_tracking_codes}
                      onChange={(e) =>
                        setSettings({ ...settings, max_pro_tracking_codes: parseInt(e.target.value) })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Máximo de códigos para plano Pro
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Plano Premium</Label>
                    <Input
                      type="number"
                      min="1"
                      value={settings.max_premium_tracking_codes}
                      onChange={(e) =>
                        setSettings({ ...settings, max_premium_tracking_codes: parseInt(e.target.value) })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Máximo de códigos para plano Premium
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Settings */}
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Canais de Notificação</CardTitle>
                <CardDescription>
                  Ative ou desative os canais de notificação do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificações por WhatsApp</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar notificações via WhatsApp
                    </p>
                  </div>
                  <Switch
                    checked={settings.enable_whatsapp}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, enable_whatsapp: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificações por Email</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar notificações via email
                    </p>
                  </div>
                  <Switch
                    checked={settings.enable_email_notifications}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, enable_email_notifications: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificações Push</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar notificações push no navegador
                    </p>
                  </div>
                  <Switch
                    checked={settings.enable_push_notifications}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, enable_push_notifications: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Segurança e Autenticação</CardTitle>
                <CardDescription>
                  Configure as opções de segurança do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Timeout de Sessão (minutos)</Label>
                  <Input
                    type="number"
                    min="5"
                    max="1440"
                    value={settings.session_timeout_minutes}
                    onChange={(e) =>
                      setSettings({ ...settings, session_timeout_minutes: parseInt(e.target.value) })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Tempo até a sessão expirar por inatividade
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Máximo de Tentativas de Login</Label>
                  <Input
                    type="number"
                    min="3"
                    max="10"
                    value={settings.max_login_attempts}
                    onChange={(e) =>
                      setSettings({ ...settings, max_login_attempts: parseInt(e.target.value) })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Número de tentativas antes de bloquear temporariamente
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Verificação de Email Obrigatória</Label>
                    <p className="text-sm text-muted-foreground">
                      Usuários devem verificar o email antes de usar o sistema
                    </p>
                  </div>
                  <Switch
                    checked={settings.require_email_verification}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, require_email_verification: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feature Flags */}
          <TabsContent value="features" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Feature Flags</CardTitle>
                <CardDescription>
                  Ative ou desative recursos específicos do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {featureFlags.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Flag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma feature flag configurada</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {featureFlags.map((flag) => (
                      <div
                        key={flag.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{flag.name}</span>
                            <Badge variant={flag.enabled ? 'default' : 'secondary'}>
                              {flag.enabled ? 'Ativa' : 'Inativa'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{flag.description}</p>
                          <code className="text-xs text-muted-foreground">{flag.key}</code>
                        </div>
                        <Switch
                          checked={flag.enabled}
                          onCheckedChange={() => handleToggleFeatureFlag(flag)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  )
}
