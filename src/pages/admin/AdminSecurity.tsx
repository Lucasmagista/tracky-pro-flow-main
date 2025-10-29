import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { AdminService } from '@/services/admin'
import { IPWhitelistService, type AllowedIP, type BlockedIP } from '@/services/ip-whitelist'
import { IPWhitelistTab } from '@/components/admin/IPWhitelistTab'
import { EnhancedAuditTrail } from '@/components/admin/EnhancedAuditTrail'
import {
  Shield,
  Users,
  Key,
  Lock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Activity,
  Globe,
  Plus,
  Trash2,
  Ban
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface SecurityEvent extends Record<string, unknown> {
  id: string
  user_id?: string
  event_type: string
  severity: string
  description: string
  ip_address?: string
  user_agent?: string
  created_at: string
  metadata?: Record<string, unknown>
}

interface SecurityStats {
  total_events: number
  critical: number
  warnings: number
  active_sessions: number
  failed_logins_today: number
  blocked_ips: number
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-500 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  low: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  info: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
}

const eventTypeLabels: Record<string, string> = {
  login_success: 'Login Bem-sucedido',
  login_failed: 'Falha no Login',
  password_changed: 'Senha Alterada',
  permission_denied: 'Permissão Negada',
  suspicious_activity: 'Atividade Suspeita',
  account_locked: 'Conta Bloqueada',
  ip_blocked: 'IP Bloqueado',
}

export default function AdminSecurity() {
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [stats, setStats] = useState<SecurityStats>({
    total_events: 0,
    critical: 0,
    warnings: 0,
    active_sessions: 0,
    failed_logins_today: 0,
    blocked_ips: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadSecurityEvents()
    loadStats()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSecurityEvents = async () => {
    try {
      setIsLoading(true)
      const { events: eventsData, total: totalData } = await AdminService.getSecurityEvents()
      setEvents(eventsData)
    } catch (error) {
      console.error('Error loading security events:', error)
      toast({
        title: 'Erro ao carregar eventos',
        description: 'Não foi possível carregar os eventos de segurança.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const statsData = await AdminService.getSecurityStats()
      setStats(statsData)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const columns: Column<SecurityEvent>[] = [
    {
      key: 'event_type',
      label: 'Tipo de Evento',
      sortable: true,
      render: (event) => (
        <div className="font-medium">
          {eventTypeLabels[event.event_type] || event.event_type}
        </div>
      )
    },
    {
      key: 'severity',
      label: 'Severidade',
      sortable: true,
      render: (event) => (
        <Badge variant="outline" className={severityColors[event.severity]}>
          {event.severity === 'critical' ? 'Crítico' :
           event.severity === 'high' ? 'Alto' :
           event.severity === 'medium' ? 'Médio' :
           event.severity === 'low' ? 'Baixo' : 'Info'}
        </Badge>
      )
    },
    {
      key: 'description',
      label: 'Descrição',
      render: (event) => (
        <div className="text-sm text-muted-foreground max-w-md truncate">
          {event.description}
        </div>
      )
    },
    {
      key: 'ip_address',
      label: 'IP',
      render: (event) => (
        <div className="font-mono text-sm">{event.ip_address || '-'}</div>
      )
    },
    {
      key: 'created_at',
      label: 'Data',
      sortable: true,
      render: (event) => (
        <div className="text-sm">
          {formatDistanceToNow(new Date(event.created_at), {
            addSuffix: true,
            locale: ptBR
          })}
        </div>
      )
    }
  ]

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Segurança</h1>
          <p className="text-muted-foreground">
            Monitore e gerencie a segurança do sistema
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Eventos Críticos
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.critical}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Requerem atenção imediata
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Avisos
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.warnings}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Atividades suspeitas
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Sessões Ativas
              </CardTitle>
              <Users className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active_sessions}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Usuários conectados
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Falhas de Login
              </CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.failed_logins_today}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Hoje
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                IPs Bloqueados
              </CardTitle>
              <Globe className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.blocked_ips}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Bloqueios ativos
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Eventos
              </CardTitle>
              <Activity className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_events.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Todos os registros
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="events" className="space-y-4">
          <TabsList>
            <TabsTrigger value="events">Eventos de Segurança</TabsTrigger>
            <TabsTrigger value="audit">Audit Trail</TabsTrigger>
            <TabsTrigger value="whitelist">IP Whitelist</TabsTrigger>
            <TabsTrigger value="sessions">Sessões Ativas</TabsTrigger>
            <TabsTrigger value="blocked">IPs Bloqueados</TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Eventos Recentes</CardTitle>
                <CardDescription>
                  Registro de todos os eventos de segurança
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  data={events}
                  columns={columns}
                  isLoading={isLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <EnhancedAuditTrail />
          </TabsContent>

          <TabsContent value="whitelist" className="space-y-4">
            <IPWhitelistTab />
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sessões Ativas</CardTitle>
                <CardDescription>
                  Usuários conectados no momento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>Lista de sessões ativas será exibida aqui</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="blocked" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>IPs Bloqueados</CardTitle>
                <CardDescription>
                  Endereços IP bloqueados por segurança
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Globe className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>Lista de IPs bloqueados será exibida aqui</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Security Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle>Recomendações de Segurança</CardTitle>
            <CardDescription>
              Ações sugeridas para melhorar a segurança
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <div className="font-medium">Autenticação de dois fatores ativada</div>
                  <div className="text-sm text-muted-foreground">
                    Sistema está utilizando 2FA para maior segurança
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <div className="font-medium">Certificado SSL válido</div>
                  <div className="text-sm text-muted-foreground">
                    Conexões estão sendo encriptadas
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div>
                  <div className="font-medium">Revisar logs de acesso</div>
                  <div className="text-sm text-muted-foreground">
                    Existem {stats.warnings} avisos que requerem atenção
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
