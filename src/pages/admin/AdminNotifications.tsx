import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { AdminService } from '@/services/admin'
import {
  Bell,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  Mail,
  MessageSquare,
  Filter
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Notification extends Record<string, unknown> {
  id: string
  user_id?: string
  type: string
  title: string
  message: string
  status: string
  sent_at?: string
  read_at?: string
  created_at: string
  metadata?: Record<string, unknown>
}

interface NotificationStats {
  total: number
  sent: number
  pending: number
  failed: number
  read: number
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  sent: 'bg-green-500/10 text-green-500 border-green-500/20',
  failed: 'bg-red-500/10 text-red-500 border-red-500/20',
  read: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
}

const typeIcons: Record<string, typeof Bell> = {
  email: Mail,
  push: Bell,
  sms: MessageSquare,
  system: AlertCircle,
}

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    sent: 0,
    pending: 0,
    failed: 0,
    read: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const { toast } = useToast()

  useEffect(() => {
    loadNotifications()
    loadStats()
  }, [statusFilter, typeFilter])

  const loadNotifications = async () => {
    try {
      setIsLoading(true)
      const { notifications: notificationsData, total: totalData } = await AdminService.getNotifications({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined
      })
      setNotifications(notificationsData)
    } catch (error) {
      console.error('Error loading notifications:', error)
      toast({
        title: 'Erro ao carregar notificações',
        description: 'Não foi possível carregar as notificações.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const statsData = await AdminService.getNotificationStats()
      setStats(statsData)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleViewNotification = (notification: Notification) => {
    setSelectedNotification(notification)
    setViewDialogOpen(true)
  }

  const columns: Column<Notification>[] = [
    {
      key: 'type',
      label: 'Tipo',
      render: (notification) => {
        const Icon = typeIcons[notification.type] || Bell
        return (
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="capitalize">{notification.type}</span>
          </div>
        )
      }
    },
    {
      key: 'title',
      label: 'Título',
      sortable: true,
      render: (notification) => (
        <div className="font-medium">{notification.title}</div>
      )
    },
    {
      key: 'message',
      label: 'Mensagem',
      render: (notification) => (
        <div className="text-sm text-muted-foreground truncate max-w-md">
          {notification.message}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (notification) => (
        <Badge variant="outline" className={statusColors[notification.status]}>
          {notification.status === 'sent' ? 'Enviada' :
           notification.status === 'pending' ? 'Pendente' :
           notification.status === 'failed' ? 'Falhou' : 'Lida'}
        </Badge>
      )
    },
    {
      key: 'created_at',
      label: 'Criada em',
      sortable: true,
      render: (notification) => (
        <div className="text-sm">
          {formatDistanceToNow(new Date(notification.created_at), {
            addSuffix: true,
            locale: ptBR
          })}
        </div>
      )
    }
  ]

  const filteredNotifications = notifications.filter(notification => {
    const matchesStatus = statusFilter === 'all' || notification.status === statusFilter
    const matchesType = typeFilter === 'all' || notification.type === typeFilter
    return matchesStatus && matchesType
  })

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notificações</h1>
          <p className="text-muted-foreground">
            Gerencie e monitore todas as notificações do sistema
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Enviadas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.sent.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Falhadas</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.failed.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lidas</CardTitle>
              <Mail className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.read.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Notificações Enviadas</CardTitle>
                <CardDescription>
                  Histórico de todas as notificações do sistema
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="sent">Enviadas</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="failed">Falhadas</SelectItem>
                    <SelectItem value="read">Lidas</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="push">Push</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="system">Sistema</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              data={filteredNotifications}
              columns={columns}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>

        {/* View Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalhes da Notificação</DialogTitle>
              <DialogDescription>
                Informações completas sobre a notificação
              </DialogDescription>
            </DialogHeader>
            
            {selectedNotification && (
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Tipo</Label>
                  <div className="font-medium capitalize">{selectedNotification.type}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Título</Label>
                  <div className="font-medium">{selectedNotification.title}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Mensagem</Label>
                  <div className="text-sm">{selectedNotification.message}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div>
                    <Badge variant="outline" className={statusColors[selectedNotification.status]}>
                      {selectedNotification.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Enviada em</Label>
                  <div className="text-sm">
                    {selectedNotification.sent_at
                      ? new Date(selectedNotification.sent_at).toLocaleString('pt-BR')
                      : '-'
                    }
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}
