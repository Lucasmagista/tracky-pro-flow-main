import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { DataTable, type Column, type Action } from '@/components/admin/DataTable'
import { SessionManagementService, type AdminSession, type TrustedDevice } from '@/services/session-management'
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  Chrome, 
  Globe, 
  Clock, 
  Shield,
  Trash2,
  LogOut,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface SessionManagementTabProps {
  userId: string
}

export function SessionManagementTab({ userId }: SessionManagementTabProps) {
  const { toast } = useToast()
  const [sessions, setSessions] = useState<AdminSession[]>([])
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const [revokeAllDialogOpen, setRevokeAllDialogOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<AdminSession | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState<string>('')

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [sessionsData, devicesData] = await Promise.all([
        SessionManagementService.getUserSessions(userId),
        SessionManagementService.getTrustedDevices(userId),
      ])
      
      setSessions(sessionsData)
      setTrustedDevices(devicesData)

      // Try to identify current session (simplified)
      if (sessionsData.length > 0) {
        const currentUA = navigator.userAgent
        const currentSession = sessionsData.find(s => s.user_agent === currentUA)
        if (currentSession) {
          setCurrentSessionId(currentSession.id)
        }
      }
    } catch (error) {
      console.error('Error loading session data:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados de sessão',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRevokeSession = async () => {
    if (!selectedSession) return

    try {
      setIsLoading(true)

      await SessionManagementService.revokeSession(
        selectedSession.id,
        'Sessão revogada manualmente pelo usuário'
      )

      toast({
        title: 'Sessão Revogada',
        description: 'A sessão foi encerrada com sucesso',
      })

      setRevokeDialogOpen(false)
      setSelectedSession(null)
      await loadData()
    } catch (error) {
      console.error('Error revoking session:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível revogar a sessão',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRevokeAllSessions = async () => {
    try {
      setIsLoading(true)

      const count = await SessionManagementService.revokeAllOtherSessions(
        currentSessionId,
        'Todas as outras sessões foram revogadas'
      )

      toast({
        title: 'Sessões Revogadas',
        description: `${count} sessão(ões) foram encerradas`,
      })

      setRevokeAllDialogOpen(false)
      await loadData()
    } catch (error) {
      console.error('Error revoking all sessions:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível revogar as sessões',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveTrustedDevice = async (deviceId: string) => {
    try {
      await SessionManagementService.removeTrustedDevice(deviceId)

      toast({
        title: 'Dispositivo Removido',
        description: 'O dispositivo foi removido da lista de confiáveis',
      })

      await loadData()
    } catch (error) {
      console.error('Error removing trusted device:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o dispositivo',
        variant: 'destructive',
      })
    }
  }

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="h-5 w-5" />
      case 'tablet':
        return <Tablet className="h-5 w-5" />
      default:
        return <Monitor className="h-5 w-5" />
    }
  }

  // Columns for Sessions table
  const sessionColumns: Column<AdminSession>[] = [
    {
      key: 'device_name',
      label: 'Dispositivo',
      render: (session) => (
        <div className="flex items-center gap-3">
          {getDeviceIcon(session.device_type)}
          <div>
            <div className="font-medium">
              {session.device_name || 'Dispositivo Desconhecido'}
            </div>
            <div className="text-sm text-muted-foreground">
              {session.browser_name} {session.browser_version && `v${session.browser_version}`}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'os_name',
      label: 'Sistema',
      render: (session) => (
        <div>
          <div>{session.os_name || 'Unknown OS'}</div>
          {session.os_version && (
            <div className="text-sm text-muted-foreground">v{session.os_version}</div>
          )}
        </div>
      ),
    },
    {
      key: 'ip_address',
      label: 'Localização',
      render: (session) => (
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <div>
            {session.city && session.country ? (
              <div>{session.city}, {session.country}</div>
            ) : (
              <div className="text-muted-foreground">Localização desconhecida</div>
            )}
            {session.ip_address && (
              <div className="text-xs text-muted-foreground font-mono">{session.ip_address}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'last_activity_at',
      label: 'Última Atividade',
      render: (session) => (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div>
            <div>{formatDistanceToNow(new Date(session.last_activity_at), { 
              addSuffix: true,
              locale: ptBR 
            })}</div>
            <div className="text-xs text-muted-foreground">
              {format(new Date(session.last_activity_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'mfa_verified',
      label: 'Status',
      render: (session) => (
        <div className="flex flex-col gap-1">
          {session.id === currentSessionId && (
            <Badge variant="default">Atual</Badge>
          )}
          {session.trusted_device && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Confiável
            </Badge>
          )}
          {session.mfa_verified && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              MFA
            </Badge>
          )}
        </div>
      ),
    },
  ]

  const sessionActions: Action<AdminSession>[] = [
    {
      label: 'Revogar Sessão',
      onClick: (session) => {
        setSelectedSession(session)
        setRevokeDialogOpen(true)
      },
      icon: <LogOut className="h-4 w-4" />,
      variant: 'destructive',
      show: (session) => session.id !== currentSessionId,
    },
  ]

  // Columns for Trusted Devices table
  const deviceColumns: Column<TrustedDevice>[] = [
    {
      key: 'device_name',
      label: 'Dispositivo',
      render: (device) => (
        <div className="flex items-center gap-3">
          {getDeviceIcon(device.device_type)}
          <div>
            <div className="font-medium">{device.device_name || 'Dispositivo Desconhecido'}</div>
            <div className="text-sm text-muted-foreground">
              {device.device_type || 'desktop'}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'trusted_at',
      label: 'Confiável Desde',
      render: (device) => (
        <div>
          {format(new Date(device.trusted_at), 'dd/MM/yyyy', { locale: ptBR })}
        </div>
      ),
    },
    {
      key: 'last_used_at',
      label: 'Último Uso',
      render: (device) => (
        <div>
          {formatDistanceToNow(new Date(device.last_used_at), { 
            addSuffix: true,
            locale: ptBR 
          })}
        </div>
      ),
    },
    {
      key: 'expires_at',
      label: 'Expira',
      render: (device) => (
        device.expires_at ? (
          <div>{format(new Date(device.expires_at), 'dd/MM/yyyy', { locale: ptBR })}</div>
        ) : (
          <div className="text-muted-foreground">Nunca</div>
        )
      ),
    },
  ]

  const deviceActions: Action<TrustedDevice>[] = [
    {
      label: 'Remover',
      onClick: (device) => handleRemoveTrustedDevice(device.id),
      icon: <Trash2 className="h-4 w-4" />,
      variant: 'destructive',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stats Card */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessões Ativas</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessions.length}</div>
            <p className="text-xs text-muted-foreground">
              {sessions.filter(s => s.trusted_device).length} em dispositivos confiáveis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dispositivos Confiáveis</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trustedDevices.length}</div>
            <p className="text-xs text-muted-foreground">
              Reconhecidos automaticamente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Último Acesso</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sessions[0] ? formatDistanceToNow(new Date(sessions[0].last_activity_at), { locale: ptBR }) : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              Atividade mais recente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Sessions Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sessões Ativas</CardTitle>
              <CardDescription>
                Gerenciar dispositivos conectados à sua conta
              </CardDescription>
            </div>
            {sessions.length > 1 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setRevokeAllDialogOpen(true)}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Encerrar Todas as Outras
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Monitor className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma sessão ativa encontrada</p>
            </div>
          ) : (
            <>
              <Alert className="mb-4">
                <Shield className="h-4 w-4" />
                <AlertTitle>Sessão Atual</AlertTitle>
                <AlertDescription>
                  A sessão marcada como "Atual" é esta que você está usando agora e não pode ser revogada.
                </AlertDescription>
              </Alert>

              <DataTable
                data={sessions}
                columns={sessionColumns}
                actions={sessionActions}
                isLoading={isLoading}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Trusted Devices Card */}
      <Card>
        <CardHeader>
          <CardTitle>Dispositivos Confiáveis</CardTitle>
          <CardDescription>
            Dispositivos que você marcou como confiáveis para pular verificações extras
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trustedDevices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum dispositivo confiável configurado</p>
              <p className="text-sm mt-2">
                Dispositivos confiáveis pulam verificações de MFA adicionais
              </p>
            </div>
          ) : (
            <DataTable
              data={trustedDevices}
              columns={deviceColumns}
              actions={deviceActions}
              isLoading={isLoading}
            />
          )}
        </CardContent>
      </Card>

      {/* Revoke Session Dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revogar Sessão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja encerrar esta sessão? O dispositivo precisará fazer login novamente.
            </DialogDescription>
          </DialogHeader>

          {selectedSession && (
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {getDeviceIcon(selectedSession.device_type)}
                    <strong>{selectedSession.device_name}</strong>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedSession.browser_name} em {selectedSession.os_name}
                  </div>
                  {selectedSession.ip_address && (
                    <div className="text-sm text-muted-foreground font-mono">
                      IP: {selectedSession.ip_address}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeSession}
              disabled={isLoading}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Revogar Sessão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke All Sessions Dialog */}
      <Dialog open={revokeAllDialogOpen} onOpenChange={setRevokeAllDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar Todas as Outras Sessões</DialogTitle>
            <DialogDescription>
              Isso encerrará todas as sessões ativas exceto a atual. Outros dispositivos precisarão fazer login novamente.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção</AlertTitle>
            <AlertDescription>
              Esta ação encerrará {sessions.length - 1} sessão(ões) ativa(s).
              Use isto se suspeitar de acesso não autorizado.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeAllDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeAllSessions}
              disabled={isLoading}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Encerrar Todas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
