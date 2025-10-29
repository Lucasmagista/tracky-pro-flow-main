import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { DataTable, type Column, type Action } from '@/components/admin/DataTable'
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
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { AdminService } from '@/services/admin'
import {
  Package,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Download,
  Filter,
  RefreshCw,
  Search
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { StatCard } from '@/components/admin/StatCard'

interface Order extends Record<string, unknown> {
  id: string
  user_id: string
  tracking_code: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  carrier: string
  status: string
  destination?: string
  estimated_delivery?: string
  actual_delivery?: string
  created_at: string
  updated_at: string
  user?: {
    email: string
    name?: string
  }
}

interface OrderStats {
  total: number
  pending: number
  in_transit: number
  delivered: number
  failed: number
  today: number
  growth: number
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  in_transit: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  delivered: 'bg-green-500/10 text-green-500 border-green-500/20',
  failed: 'bg-red-500/10 text-red-500 border-red-500/20',
  cancelled: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
}

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  in_transit: 'Em Trânsito',
  delivered: 'Entregue',
  failed: 'Falhou',
  cancelled: 'Cancelado',
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    in_transit: 0,
    delivered: 0,
    failed: 0,
    today: 0,
    growth: 0
  })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [notesDialogOpen, setNotesDialogOpen] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [carrierFilter, setCarrierFilter] = useState<string>('all')
  const { toast } = useToast()

  useEffect(() => {
    loadOrders()
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, statusFilter, carrierFilter])

  const loadOrders = async () => {
    try {
      setIsLoading(true)
      const { orders: ordersData, total: totalData } = await AdminService.getAllOrders(
        page,
        pageSize,
        {
          status: statusFilter !== 'all' ? statusFilter : undefined,
          carrier: carrierFilter !== 'all' ? carrierFilter : undefined,
          search: searchTerm || undefined
        }
      )
      setOrders(ordersData as Order[])
      setTotal(totalData)
    } catch (error) {
      console.error('Error loading orders:', error)
      toast({
        title: 'Erro ao carregar pedidos',
        description: 'Não foi possível carregar a lista de pedidos.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const statsData = await AdminService.getOrderStats()
      setStats(statsData)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order)
    setViewDialogOpen(true)
  }

  const handleEditOrder = (order: Order) => {
    setSelectedOrder(order)
    setEditStatus(order.status)
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedOrder) return

    try {
      // Call API to update order status
      await AdminService.updateOrderStatus(selectedOrder.id, editStatus)
      
      toast({
        title: 'Pedido atualizado',
        description: 'O status do pedido foi atualizado com sucesso.'
      })
      
      setEditDialogOpen(false)
      setSelectedOrder(null)
      loadOrders()
    } catch (error) {
      console.error('Error updating order:', error)
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o pedido.',
        variant: 'destructive'
      })
    }
  }

  const handleAddNotes = (order: Order) => {
    setSelectedOrder(order)
    setOrderNotes('')
    setNotesDialogOpen(true)
  }

  const handleSaveNotes = async () => {
    if (!selectedOrder || !orderNotes) return

    try {
      await AdminService.addOrderNotes(selectedOrder.id, orderNotes)
      
      toast({
        title: 'Notas adicionadas',
        description: 'As notas foram adicionadas ao pedido.'
      })
      
      setNotesDialogOpen(false)
      setSelectedOrder(null)
      setOrderNotes('')
    } catch (error) {
      console.error('Error adding notes:', error)
      toast({
        title: 'Erro ao adicionar notas',
        description: 'Não foi possível adicionar as notas.',
        variant: 'destructive'
      })
    }
  }

  const handleBulkAction = async () => {
    if (selectedOrders.length === 0 || !bulkAction) {
      toast({
        title: 'Selecione pedidos',
        description: 'Selecione ao menos um pedido e uma ação.',
        variant: 'destructive'
      })
      return
    }

    try {
      await AdminService.bulkUpdateOrders(selectedOrders, { status: bulkAction })
      
      toast({
        title: 'Ação em lote aplicada',
        description: `${selectedOrders.length} pedido(s) atualizado(s) com sucesso.`
      })
      
      setSelectedOrders([])
      setBulkAction('')
      loadOrders()
    } catch (error) {
      console.error('Error in bulk action:', error)
      toast({
        title: 'Erro na ação em lote',
        description: 'Não foi possível aplicar a ação.',
        variant: 'destructive'
      })
    }
  }

  const handleRefresh = () => {
    loadOrders()
    loadStats()
    toast({
      title: 'Atualizado',
      description: 'Dados dos pedidos atualizados com sucesso.'
    })
  }

  const columns: Column<Order>[] = [
    {
      key: 'tracking_code',
      label: 'Código de Rastreio',
      sortable: true,
      render: (order) => (
        <div className="font-mono font-medium">{order.tracking_code}</div>
      )
    },
    {
      key: 'customer_name',
      label: 'Cliente',
      sortable: true,
      render: (order) => (
        <div>
          <div className="font-medium">{order.customer_name}</div>
          {order.customer_email && (
            <div className="text-xs text-muted-foreground">{order.customer_email}</div>
          )}
        </div>
      )
    },
    {
      key: 'carrier',
      label: 'Transportadora',
      sortable: true
    },
    {
      key: 'destination',
      label: 'Destino',
      sortable: true,
      render: (order) => order.destination || '-'
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (order) => (
        <Badge variant="outline" className={statusColors[order.status]}>
          {statusLabels[order.status] || order.status}
        </Badge>
      )
    },
    {
      key: 'created_at',
      label: 'Criado em',
      sortable: true,
      render: (order) => (
        <div className="text-sm">
          {formatDistanceToNow(new Date(order.created_at), {
            addSuffix: true,
            locale: ptBR
          })}
        </div>
      )
    }
  ]

  const actions: Action<Order>[] = [
    {
      label: 'Ver Detalhes',
      onClick: handleViewOrder,
      icon: <Eye className="h-4 w-4" />
    },
    {
      label: 'Editar Status',
      onClick: handleEditOrder,
      icon: <Package className="h-4 w-4" />
    },
    {
      label: 'Adicionar Notas',
      onClick: handleAddNotes,
      icon: <AlertCircle className="h-4 w-4" />
    },
    {
      label: 'Reprocessar',
      onClick: (order) => {
        toast({
          title: 'Reprocessando pedido',
          description: `Pedido ${order.tracking_code} será reprocessado.`
        })
      },
      icon: <RefreshCw className="h-4 w-4" />
    },
    {
      label: 'Exportar',
      onClick: (order) => {
        toast({
          title: 'Exportando pedido',
          description: `Exportando pedido ${order.tracking_code}...`
        })
      },
      icon: <Download className="h-4 w-4" />
    }
  ]

  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchTerm === '' || 
      order.tracking_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    const matchesCarrier = carrierFilter === 'all' || order.carrier === carrierFilter

    return matchesSearch && matchesStatus && matchesCarrier
  })

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gerenciamento de Pedidos</h1>
          <p className="text-muted-foreground">Gerencie e monitore todos os pedidos do sistema</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total de Pedidos"
            value={stats.total.toLocaleString()}
            icon={Package}
            trend={{ value: stats.growth, isPositive: stats.growth > 0 }}
          />
          <StatCard
            title="Pendentes"
            value={stats.pending.toLocaleString()}
            icon={Clock}
            iconClassName="bg-yellow-50 dark:bg-yellow-950 text-yellow-600 dark:text-yellow-400"
          />
          <StatCard
            title="Em Trânsito"
            value={stats.in_transit.toLocaleString()}
            icon={TrendingUp}
            iconClassName="bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
          />
          <StatCard
            title="Entregues"
            value={stats.delivered.toLocaleString()}
            icon={CheckCircle}
            iconClassName="bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400"
          />
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pedidos</CardTitle>
                <CardDescription>
                  Gerencie e monitore todos os pedidos do sistema
                </CardDescription>
              </div>
              <Button onClick={handleRefresh} variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="search">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Buscar por código ou cliente..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="w-full sm:w-48">
                  <Label htmlFor="status">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="in_transit">Em Trânsito</SelectItem>
                      <SelectItem value="delivered">Entregue</SelectItem>
                      <SelectItem value="failed">Falhou</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-48">
                  <Label htmlFor="carrier">Transportadora</Label>
                  <Select value={carrierFilter} onValueChange={setCarrierFilter}>
                    <SelectTrigger id="carrier">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="Correios">Correios</SelectItem>
                      <SelectItem value="Jadlog">Jadlog</SelectItem>
                      <SelectItem value="Total Express">Total Express</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DataTable
              data={filteredOrders}
              columns={columns}
              actions={actions}
              isLoading={isLoading}
              currentPage={page}
              pageSize={pageSize}
              totalItems={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </CardContent>
        </Card>

        {/* View Order Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes do Pedido</DialogTitle>
              <DialogDescription>
                Informações completas sobre o pedido
              </DialogDescription>
            </DialogHeader>
            
            {selectedOrder && (
              <Tabs defaultValue="info" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="info">Informações</TabsTrigger>
                  <TabsTrigger value="tracking">Rastreamento</TabsTrigger>
                </TabsList>
                
                <TabsContent value="info" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Código de Rastreio</Label>
                      <div className="font-mono font-medium">{selectedOrder.tracking_code}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <div>
                        <Badge variant="outline" className={statusColors[selectedOrder.status]}>
                          {statusLabels[selectedOrder.status]}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Cliente</Label>
                      <div className="font-medium">{selectedOrder.customer_name}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Transportadora</Label>
                      <div>{selectedOrder.carrier}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <div className="text-sm">{selectedOrder.customer_email || '-'}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Telefone</Label>
                      <div className="text-sm">{selectedOrder.customer_phone || '-'}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Destino</Label>
                      <div>{selectedOrder.destination || '-'}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Previsão de Entrega</Label>
                      <div className="text-sm">
                        {selectedOrder.estimated_delivery 
                          ? new Date(selectedOrder.estimated_delivery).toLocaleDateString('pt-BR')
                          : '-'
                        }
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="tracking" className="space-y-4">
                  <div className="text-center text-muted-foreground py-8">
                    <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>Histórico de rastreamento não disponível</p>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Order Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Status do Pedido</DialogTitle>
              <DialogDescription>
                Altere o status do pedido {selectedOrder?.tracking_code}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Status Atual</Label>
                <div className="mt-1">
                  <Badge variant="outline" className={statusColors[selectedOrder?.status || '']}>
                    {statusLabels[selectedOrder?.status || '']}
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-status">Novo Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger id="edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="in_transit">Em Trânsito</SelectItem>
                    <SelectItem value="delivered">Entregue</SelectItem>
                    <SelectItem value="failed">Falhou</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit}>
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Notes Dialog */}
        <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Notas ao Pedido</DialogTitle>
              <DialogDescription>
                Adicione notas internas sobre o pedido {selectedOrder?.tracking_code}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="order-notes">Notas</Label>
                <textarea
                  id="order-notes"
                  className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Digite as notas sobre este pedido..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveNotes} disabled={!orderNotes}>
                Adicionar Notas
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}
