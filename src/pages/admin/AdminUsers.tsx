import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { DataTable, type Column, type Action } from '@/components/admin/DataTable'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { AdminService, type UserWithDetails } from '@/services/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Eye, 
  Edit, 
  Ban, 
  Trash2,
  UserCheck,
  CreditCard,
  Activity
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function AdminUsers() {
  const [users, setUsers] = useState<UserWithDetails[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [adminFilter, setAdminFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<{ from?: string; to?: string }>({})
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editFormData, setEditFormData] = useState({
    name: '',
    store_name: '',
    store_email: '',
    store_phone: '',
    is_admin: false,
    admin_role: '' as 'super_admin' | 'admin' | 'moderator' | 'support' | ''
  })
  const [userActivities, setUserActivities] = useState<Array<{
    id: string
    action: string
    description?: string
    activity_type?: string
    ip_address?: string
    created_at: string
    metadata: unknown
  }>>([])
  const [loadingActivities, setLoadingActivities] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, searchQuery, statusFilter, adminFilter, dateFilter])

  const loadUsers = async () => {
    try {
      setIsLoading(true)
      
      // Build filters
      const filters: {
        is_admin?: boolean
        has_subscription?: boolean
        created_after?: string
        created_before?: string
      } = {}

      if (adminFilter === 'admin') {
        filters.is_admin = true
      } else if (adminFilter === 'user') {
        filters.is_admin = false
      }

      if (dateFilter.from) {
        filters.created_after = dateFilter.from
      }
      if (dateFilter.to) {
        filters.created_before = dateFilter.to
      }

      const { users: usersData, total: totalData } = await AdminService.getAllUsers(
        page,
        pageSize,
        searchQuery || undefined,
        filters
      )
      setUsers(usersData)
      setTotal(totalData)
    } catch (error) {
      console.error('Error loading users:', error)
      toast({
        title: 'Erro ao carregar usuários',
        description: 'Não foi possível carregar a lista de usuários.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewUser = async (user: UserWithDetails) => {
    setSelectedUser(user)
    setViewDialogOpen(true)
    await loadUserActivities(user.id)
  }

  const loadUserActivities = async (userId: string) => {
    try {
      setLoadingActivities(true)
      const { activities } = await AdminService.getUserActivities(userId, 1, 50)
      setUserActivities(activities as Array<{
        id: string
        action: string
        description?: string
        activity_type?: string
        ip_address?: string
        created_at: string
        metadata: unknown
      }>)
    } catch (error) {
      console.error('Error loading user activities:', error)
    } finally {
      setLoadingActivities(false)
    }
  }

  const handleEditUser = (user: UserWithDetails) => {
    setSelectedUser(user)
    setEditFormData({
      name: user.name || '',
      store_name: user.store_name || '',
      store_email: '',
      store_phone: '',
      is_admin: user.is_admin || false,
      admin_role: user.admin_role || ''
    })
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedUser) return

    try {
      const updates: Record<string, unknown> = {
        name: editFormData.name || null,
        store_name: editFormData.store_name || null,
        is_admin: editFormData.is_admin,
        admin_role: editFormData.is_admin && editFormData.admin_role ? editFormData.admin_role : null
      }

      await AdminService.updateUser(selectedUser.id, updates)
      
      toast({
        title: 'Usuário atualizado',
        description: 'As informações do usuário foram atualizadas com sucesso.'
      })
      
      setEditDialogOpen(false)
      setSelectedUser(null)
      loadUsers()
    } catch (error) {
      console.error('Error updating user:', error)
      toast({
        title: 'Erro ao atualizar usuário',
        description: 'Não foi possível atualizar as informações do usuário.',
        variant: 'destructive'
      })
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return

    try {
      await AdminService.deleteUser(
        selectedUser.id,
        'Removido pelo administrador'
      )
      
      toast({
        title: 'Usuário removido',
        description: 'O usuário foi removido com sucesso.'
      })
      
      setDeleteDialogOpen(false)
      setSelectedUser(null)
      loadUsers()
    } catch (error) {
      console.error('Error deleting user:', error)
      toast({
        title: 'Erro ao remover usuário',
        description: 'Não foi possível remover o usuário.',
        variant: 'destructive'
      })
    }
  }

  const handleSuspendUser = async (user: UserWithDetails) => {
    try {
      await AdminService.suspendUser(user.id, 'Suspenso pelo administrador')
      
      toast({
        title: 'Usuário suspenso',
        description: 'O usuário foi suspenso com sucesso.'
      })
      
      loadUsers()
    } catch (error) {
      console.error('Error suspending user:', error)
      toast({
        title: 'Erro ao suspender usuário',
        description: 'Não foi possível suspender o usuário.',
        variant: 'destructive'
      })
    }
  }

  const handleExport = async () => {
    try {
      const csv = await AdminService.exportToCSV('profiles')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `usuarios_${new Date().toISOString()}.csv`
      a.click()
      
      toast({
        title: 'Exportação concluída',
        description: 'Os dados foram exportados com sucesso.'
      })
    } catch (error) {
      console.error('Error exporting users:', error)
      toast({
        title: 'Erro na exportação',
        description: 'Não foi possível exportar os dados.',
        variant: 'destructive'
      })
    }
  }

  const columns: Column<UserWithDetails>[] = [
    {
      key: 'name',
      label: 'Nome',
      sortable: true,
      render: (user) => (
        <div className="flex flex-col">
          <span className="font-medium">{user.name || 'N/A'}</span>
          <span className="text-xs text-muted-foreground">{user.email}</span>
        </div>
      )
    },
    {
      key: 'store_name',
      label: 'Loja',
      sortable: true,
      render: (user) => user.store_name || 'N/A'
    },
    {
      key: 'subscription',
      label: 'Plano',
      render: (user) => {
        if (!user.subscription) {
          return <Badge variant="outline">Free</Badge>
        }
        
        const statusColors = {
          active: 'default',
          canceled: 'destructive',
          past_due: 'secondary'
        } as const
        
        return (
          <div className="flex flex-col gap-1">
            <Badge variant={statusColors[user.subscription.status as keyof typeof statusColors] || 'outline'}>
              {user.subscription.plan_name}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {user.subscription.status}
            </span>
          </div>
        )
      }
    },
    {
      key: 'stats',
      label: 'Estatísticas',
      render: (user) => (
        <div className="flex flex-col gap-1 text-sm">
          <span>{user.stats.total_orders} pedidos</span>
          <span className="text-xs text-muted-foreground">
            R$ {user.stats.total_spent.toFixed(2)}
          </span>
        </div>
      )
    },
    {
      key: 'is_admin',
      label: 'Tipo',
      render: (user) => (
        user.is_admin ? (
          <Badge className="bg-purple-500 hover:bg-purple-600">
            Admin
          </Badge>
        ) : (
          <Badge variant="outline">Usuário</Badge>
        )
      )
    },
    {
      key: 'created_at',
      label: 'Cadastrado',
      sortable: true,
      render: (user) => (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(user.created_at), { 
            addSuffix: true, 
            locale: ptBR 
          })}
        </span>
      )
    }
  ]

  const actions: Action<UserWithDetails>[] = [
    {
      label: 'Ver Detalhes',
      onClick: handleViewUser,
      icon: <Eye className="h-4 w-4" />
    },
    {
      label: 'Editar',
      onClick: handleEditUser,
      icon: <Edit className="h-4 w-4" />
    },
    {
      label: 'Suspender',
      onClick: handleSuspendUser,
      icon: <Ban className="h-4 w-4" />
    },
    {
      label: 'Remover',
      onClick: (user) => {
        setSelectedUser(user)
        setDeleteDialogOpen(true)
      },
      variant: 'destructive',
      icon: <Trash2 className="h-4 w-4" />
    }
  ]

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gerenciamento de Usuários</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie todos os usuários do sistema
            </p>
          </div>
          <Button onClick={loadUsers}>
            Atualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{total}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Com Assinatura</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.subscription).length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Administradores</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.is_admin).length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Novos (Hoje)</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => {
                  const today = new Date()
                  const created = new Date(u.created_at)
                  return created.toDateString() === today.toDateString()
                }).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Advanced Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros Avançados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="search">Buscar</Label>
                <Input
                  id="search"
                  placeholder="Nome, email ou loja..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setPage(1) // Reset to first page
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-filter">Tipo de Usuário</Label>
                <Select value={adminFilter} onValueChange={(value) => {
                  setAdminFilter(value)
                  setPage(1)
                }}>
                  <SelectTrigger id="admin-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="admin">Apenas Admins</SelectItem>
                    <SelectItem value="user">Apenas Usuários</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status-filter">Status de Assinatura</Label>
                <Select value={statusFilter} onValueChange={(value) => {
                  setStatusFilter(value)
                  setPage(1)
                }}>
                  <SelectTrigger id="status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Com Assinatura Ativa</SelectItem>
                    <SelectItem value="none">Sem Assinatura</SelectItem>
                    <SelectItem value="canceled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date-from">Data de Cadastro (De)</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFilter.from || ''}
                  onChange={(e) => {
                    setDateFilter({ ...dateFilter, from: e.target.value })
                    setPage(1)
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date-to">Data de Cadastro (Até)</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateFilter.to || ''}
                  onChange={(e) => {
                    setDateFilter({ ...dateFilter, to: e.target.value })
                    setPage(1)
                  }}
                />
              </div>

              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setSearchQuery('')
                    setStatusFilter('all')
                    setAdminFilter('all')
                    setDateFilter({})
                    setPage(1)
                  }}
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={users as unknown as Record<string, unknown>[]}
              columns={columns as unknown as Column<Record<string, unknown>>[]}
              actions={actions as unknown as Action<Record<string, unknown>>[]}
              currentPage={page}
              pageSize={pageSize}
              totalItems={total}
              isLoading={isLoading}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              onExport={handleExport}
            />
          </CardContent>
        </Card>
      </div>

      {/* View User Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Usuário</DialogTitle>
            <DialogDescription>
              Informações completas sobre o usuário
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <Tabs defaultValue="info">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">Informações</TabsTrigger>
                <TabsTrigger value="subscription">Assinatura</TabsTrigger>
                <TabsTrigger value="activity">Atividades</TabsTrigger>
              </TabsList>
              
              <TabsContent value="info" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Nome</p>
                    <p className="text-sm">{selectedUser.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p className="text-sm">{selectedUser.email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Loja</p>
                    <p className="text-sm">{selectedUser.store_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tipo</p>
                    {selectedUser.is_admin ? (
                      <Badge className="bg-purple-500">Admin ({selectedUser.admin_role})</Badge>
                    ) : (
                      <Badge variant="outline">Usuário</Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total de Pedidos</p>
                    <p className="text-sm font-bold">{selectedUser.stats.total_orders}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Gasto</p>
                    <p className="text-sm font-bold">R$ {selectedUser.stats.total_spent.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Cadastrado em</p>
                    <p className="text-sm">{new Date(selectedUser.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Último Login</p>
                    <p className="text-sm">{selectedUser.stats.last_login}</p>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="subscription" className="space-y-4">
                {selectedUser.subscription ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Plano</p>
                      <p className="text-sm font-bold">{selectedUser.subscription.plan_name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Status</p>
                      <Badge>{selectedUser.subscription.status}</Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Fim do Período</p>
                      <p className="text-sm">
                        {new Date(selectedUser.subscription.current_period_end).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Usuário sem assinatura ativa
                  </p>
                )}
              </TabsContent>
              
              <TabsContent value="activity" className="space-y-4">
                {loadingActivities ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : userActivities.length > 0 ? (
                  <div className="space-y-4">
                    <div className="relative">
                      {userActivities.map((activity, index) => (
                        <div key={activity.id} className="flex gap-4 pb-4">
                          <div className="flex flex-col items-center">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                              <Activity className="h-4 w-4 text-primary" />
                            </div>
                            {index < userActivities.length - 1 && (
                              <div className="w-px flex-1 bg-border mt-2" />
                            )}
                          </div>
                          <div className="flex-1 space-y-1 pt-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">{activity.action}</p>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(activity.created_at), {
                                  addSuffix: true,
                                  locale: ptBR
                                })}
                              </span>
                            </div>
                            {activity.description && (
                              <p className="text-sm text-muted-foreground">
                                {activity.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-xs">
                              <Badge variant="outline" className="text-xs">
                                {activity.activity_type}
                              </Badge>
                              {activity.ip_address && (
                                <span className="text-muted-foreground">
                                  IP: {activity.ip_address}
                                </span>
                              )}
                            </div>
                            {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                              <details className="mt-2">
                                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                  Ver detalhes
                                </summary>
                                <pre className="mt-2 rounded-md bg-muted p-2 text-xs overflow-auto">
                                  {JSON.stringify(activity.metadata, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma atividade registrada
                  </p>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações do usuário {selectedUser?.name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="Nome do usuário"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-store-name">Nome da Loja</Label>
                <Input
                  id="edit-store-name"
                  value={editFormData.store_name}
                  onChange={(e) => setEditFormData({ ...editFormData, store_name: e.target.value })}
                  placeholder="Nome da loja"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-store-email">Email da Loja</Label>
                <Input
                  id="edit-store-email"
                  type="email"
                  value={editFormData.store_email}
                  onChange={(e) => setEditFormData({ ...editFormData, store_email: e.target.value })}
                  placeholder="email@loja.com"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-store-phone">Telefone da Loja</Label>
                <Input
                  id="edit-store-phone"
                  value={editFormData.store_phone}
                  onChange={(e) => setEditFormData({ ...editFormData, store_phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium">Permissões Administrativas</h4>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-is-admin"
                  checked={editFormData.is_admin}
                  onChange={(e) => setEditFormData({ 
                    ...editFormData, 
                    is_admin: e.target.checked,
                    admin_role: e.target.checked ? editFormData.admin_role : ''
                  })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="edit-is-admin" className="cursor-pointer">
                  Conceder permissões de administrador
                </Label>
              </div>

              {editFormData.is_admin && (
                <div className="space-y-2">
                  <Label htmlFor="edit-admin-role">Role do Admin</Label>
                  <Select
                    value={editFormData.admin_role}
                    onValueChange={(value: 'super_admin' | 'admin' | 'moderator' | 'support') => 
                      setEditFormData({ ...editFormData, admin_role: value })
                    }
                  >
                    <SelectTrigger id="edit-admin-role">
                      <SelectValue placeholder="Selecione um role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super_admin">Super Admin (Acesso Total)</SelectItem>
                      <SelectItem value="admin">Admin (Administrador)</SelectItem>
                      <SelectItem value="moderator">Moderator (Moderador)</SelectItem>
                      <SelectItem value="support">Support (Suporte)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {editFormData.admin_role === 'super_admin' && 'Acesso completo a todas as funcionalidades'}
                    {editFormData.admin_role === 'admin' && 'Pode gerenciar usuários e configurações'}
                    {editFormData.admin_role === 'moderator' && 'Pode moderar conteúdo e usuários'}
                    {editFormData.admin_role === 'support' && 'Acesso de leitura e suporte'}
                  </p>
                </div>
              )}
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Confirmar exclusão"
        description={`Tem certeza que deseja remover o usuário "${selectedUser?.name || selectedUser?.email}"? Esta ação não pode ser desfeita.`}
        confirmText="Remover"
        onConfirm={handleDeleteUser}
        variant="destructive"
      />
    </AdminLayout>
  )
}
