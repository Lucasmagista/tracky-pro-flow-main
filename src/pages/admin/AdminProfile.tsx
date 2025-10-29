import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { 
  User, 
  Mail, 
  Phone, 
  Building, 
  Shield, 
  Bell, 
  Key, 
  Camera,
  Save,
  Clock,
  Activity,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Monitor
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { SessionManagementTab } from '@/components/admin/SessionManagementTab'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Profile {
  id: string
  name: string
  email: string
  phone?: string
  store_name?: string
  avatar_url?: string
  role: string
  email_verified: boolean
  two_factor_enabled: boolean
  notification_preferences: {
    email: boolean
    push: boolean
    sms: boolean
  }
  created_at: string
  last_login?: string
}

interface ActivityLog {
  id: string
  action: string
  description: string
  timestamp: string
  ip_address?: string
}

export default function AdminProfile() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Form states
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [storeName, setStoreName] = useState('')
  const [notificationEmail, setNotificationEmail] = useState(true)
  const [notificationPush, setNotificationPush] = useState(true)
  const [notificationSms, setNotificationSms] = useState(false)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)

  // Password states
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    loadProfile()
    loadActivityLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const loadProfile = async () => {
    try {
      setIsLoading(true)
      if (!user?.id) return

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error

      const profileData: Profile = {
        id: data.id,
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        store_name: data.store_name || '',
        avatar_url: data.avatar_url || '',
        role: (data.role as string) || 'user',
        email_verified: (data.email_verified as boolean) || false,
        two_factor_enabled: (data.two_factor_enabled as boolean) || false,
        notification_preferences: (data.notification_preferences as { email: boolean; push: boolean; sms: boolean }) || {
          email: true,
          push: true,
          sms: false
        },
        created_at: data.created_at,
        last_login: (data.last_login as string) || null
      }

      setProfile(profileData)
      setName(profileData.name)
      setEmail(profileData.email)
      setPhone(profileData.phone || '')
      setStoreName(profileData.store_name || '')
      setNotificationEmail(profileData.notification_preferences.email)
      setNotificationPush(profileData.notification_preferences.push)
      setNotificationSms(profileData.notification_preferences.sms)
      setTwoFactorEnabled(profileData.two_factor_enabled)
    } catch (error) {
      console.error('Error loading profile:', error)
      toast({
        title: 'Erro ao carregar perfil',
        description: 'Não foi possível carregar as informações do perfil.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadActivityLogs = async () => {
    try {
      if (!user?.id) return

      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error

      const logs: ActivityLog[] = (data || []).map(log => ({
        id: log.id,
        action: log.action || '',
        description: log.description || '',
        timestamp: log.created_at,
        ip_address: log.ip_address
      }))

      setActivityLogs(logs)
    } catch (error) {
      console.error('Error loading activity logs:', error)
    }
  }

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true)
      if (!user?.id) return

      const { error } = await supabase
        .from('profiles')
        .update({
          name,
          phone,
          store_name: storeName,
          notification_preferences: {
            email: notificationEmail,
            push: notificationPush,
            sms: notificationSms
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      toast({
        title: 'Perfil atualizado',
        description: 'Suas informações foram salvas com sucesso.'
      })

      loadProfile()
    } catch (error) {
      console.error('Error saving profile:', error)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as alterações.',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
    if (password.length === 0) return { score: 0, label: '', color: '' }
    
    let score = 0
    
    // Comprimento
    if (password.length >= 8) score += 1
    if (password.length >= 12) score += 1
    
    // Possui letras minúsculas e maiúsculas
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
    
    // Possui números
    if (/\d/.test(password)) score += 1
    
    // Possui caracteres especiais
    if (/[^A-Za-z0-9]/.test(password)) score += 1
    
    const levels = [
      { score: 1, label: 'Muito Fraca', color: 'text-red-500' },
      { score: 2, label: 'Fraca', color: 'text-orange-500' },
      { score: 3, label: 'Média', color: 'text-yellow-500' },
      { score: 4, label: 'Forte', color: 'text-blue-500' },
      { score: 5, label: 'Muito Forte', color: 'text-green-500' }
    ]
    
    return levels[Math.min(score, 5) - 1] || levels[0]
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Senhas não coincidem',
        description: 'A nova senha e a confirmação devem ser iguais.',
        variant: 'destructive'
      })
      return
    }

    if (newPassword.length < 8) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter no mínimo 8 caracteres.',
        variant: 'destructive'
      })
      return
    }

    const strength = getPasswordStrength(newPassword)
    if (strength.score < 3) {
      toast({
        title: 'Senha fraca',
        description: 'Use uma senha mais forte com letras maiúsculas, minúsculas, números e caracteres especiais.',
        variant: 'destructive'
      })
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      toast({
        title: 'Senha alterada',
        description: 'Sua senha foi atualizada com sucesso.'
      })

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      console.error('Error changing password:', error)
      toast({
        title: 'Erro ao alterar senha',
        description: 'Não foi possível alterar a senha.',
        variant: 'destructive'
      })
    }
  }

  const handleToggleTwoFactor = async () => {
    try {
      const newValue = !twoFactorEnabled

      const { error } = await supabase
        .from('profiles')
        .update({
          two_factor_enabled: newValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id)

      if (error) throw error

      setTwoFactorEnabled(newValue)

      toast({
        title: newValue ? 'Autenticação 2FA ativada' : 'Autenticação 2FA desativada',
        description: newValue 
          ? 'Sua conta agora está protegida com autenticação de dois fatores.' 
          : 'A autenticação de dois fatores foi desativada.'
      })
    } catch (error) {
      console.error('Error toggling 2FA:', error)
      toast({
        title: 'Erro ao alterar 2FA',
        description: 'Não foi possível alterar a configuração de autenticação.',
        variant: 'destructive'
      })
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user?.id) return

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)

      if (updateError) throw updateError

      toast({
        title: 'Avatar atualizado',
        description: 'Sua foto de perfil foi atualizada com sucesso.'
      })

      loadProfile()
    } catch (error) {
      console.error('Error uploading avatar:', error)
      toast({
        title: 'Erro ao enviar foto',
        description: 'Não foi possível atualizar sua foto de perfil.',
        variant: 'destructive'
      })
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/admin')}
          className="mb-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Admin
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Meu Perfil</h1>
            <p className="text-muted-foreground">
              Gerencie suas informações pessoais e preferências
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadProfile()
                loadActivityLogs()
                toast({
                  title: 'Dados atualizados',
                  description: 'Seu perfil foi recarregado',
                })
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            <Badge variant={profile?.role === 'admin' ? 'default' : 'secondary'}>
              {profile?.role === 'admin' ? 'Administrador' : 'Usuário'}
            </Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="personal">
            <User className="h-4 w-4 mr-2" />
            Pessoal
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Segurança
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Monitor className="h-4 w-4 mr-2" />
            Sessões
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="h-4 w-4 mr-2" />
            Atividades
          </TabsTrigger>
        </TabsList>

        {/* Personal Tab */}
        <TabsContent value="personal" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações Pessoais</CardTitle>
              <CardDescription>
                Atualize suas informações básicas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profile?.avatar_url} alt={profile?.name} />
                  <AvatarFallback>{getInitials(profile?.name || 'U')}</AvatarFallback>
                </Avatar>
                <div>
                  <Label htmlFor="avatar-upload" className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild>
                      <span>
                        <Camera className="h-4 w-4 mr-2" />
                        Alterar Foto
                      </span>
                    </Button>
                  </Label>
                  <Input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG ou GIF (max. 2MB)
                  </p>
                </div>
              </div>

              <Separator />

              {/* Form Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">
                    <User className="h-4 w-4 inline mr-2" />
                    Nome Completo
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div>
                  <Label htmlFor="email">
                    <Mail className="h-4 w-4 inline mr-2" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {profile?.email_verified ? (
                      <span className="text-green-600 flex items-center">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Email verificado
                      </span>
                    ) : (
                      <span className="text-orange-600 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Email não verificado
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <Label htmlFor="phone">
                    <Phone className="h-4 w-4 inline mr-2" />
                    Telefone
                  </Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <Label htmlFor="store">
                    <Building className="h-4 w-4 inline mr-2" />
                    Nome da Loja
                  </Label>
                  <Input
                    id="store"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Nome da sua loja"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <div className="text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 inline mr-1" />
                  Membro desde {profile?.created_at && format(new Date(profile.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                </div>
                <Button onClick={handleSaveProfile} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Autenticação de Dois Fatores</CardTitle>
              <CardDescription>
                Adicione uma camada extra de segurança à sua conta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Autenticação 2FA</p>
                  <p className="text-sm text-muted-foreground">
                    {twoFactorEnabled 
                      ? 'A autenticação de dois fatores está ativa' 
                      : 'Proteja sua conta com autenticação de dois fatores'}
                  </p>
                </div>
                <Switch
                  checked={twoFactorEnabled}
                  onCheckedChange={handleToggleTwoFactor}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alterar Senha</CardTitle>
              <CardDescription>
                Mantenha sua conta segura com uma senha forte
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="current-password">Senha Atual</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Digite sua senha atual"
                />
              </div>
              <div>
                <Label htmlFor="new-password">Nova Senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite sua nova senha"
                />
                {newPassword && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            getPasswordStrength(newPassword).score === 1 ? 'bg-red-500 w-1/5' :
                            getPasswordStrength(newPassword).score === 2 ? 'bg-orange-500 w-2/5' :
                            getPasswordStrength(newPassword).score === 3 ? 'bg-yellow-500 w-3/5' :
                            getPasswordStrength(newPassword).score === 4 ? 'bg-blue-500 w-4/5' :
                            'bg-green-500 w-full'
                          }`}
                        />
                      </div>
                      <span className={`text-xs font-medium ${getPasswordStrength(newPassword).color}`}>
                        {getPasswordStrength(newPassword).label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Use pelo menos 8 caracteres com letras maiúsculas, minúsculas, números e símbolos
                    </p>
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme sua nova senha"
                />
              </div>
              <Button onClick={handleChangePassword} disabled={!currentPassword || !newPassword || !confirmPassword}>
                <Key className="h-4 w-4 mr-2" />
                Alterar Senha
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-6">
          <SessionManagementTab userId={profile?.id || ''} />
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preferências de Notificação</CardTitle>
              <CardDescription>
                Escolha como deseja receber notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Notificações por Email</p>
                  <p className="text-sm text-muted-foreground">
                    Receba atualizações importantes por email
                  </p>
                </div>
                <Switch
                  checked={notificationEmail}
                  onCheckedChange={setNotificationEmail}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Notificações Push</p>
                  <p className="text-sm text-muted-foreground">
                    Receba notificações em tempo real no navegador
                  </p>
                </div>
                <Switch
                  checked={notificationPush}
                  onCheckedChange={setNotificationPush}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Notificações por SMS</p>
                  <p className="text-sm text-muted-foreground">
                    Receba alertas críticos por mensagem de texto
                  </p>
                </div>
                <Switch
                  checked={notificationSms}
                  onCheckedChange={setNotificationSms}
                />
              </div>
              <div className="pt-4">
                <Button onClick={handleSaveProfile} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Preferências
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Atividades Recentes</CardTitle>
              <CardDescription>
                Histórico das suas últimas 20 ações no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activityLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma atividade recente encontrada
                  </p>
                ) : (
                  activityLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-4 p-4 rounded-lg border">
                      <div className="flex-1">
                        <p className="font-medium">{log.action}</p>
                        <p className="text-sm text-muted-foreground">{log.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {format(new Date(log.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                          {log.ip_address && (
                            <span>IP: {log.ip_address}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
