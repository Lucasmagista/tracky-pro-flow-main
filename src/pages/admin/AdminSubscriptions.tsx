import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { DataTable, type Column, type Action } from '@/components/admin/DataTable'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { AdminService } from '@/services/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Textarea } from '@/components/ui/textarea'
import { 
  Eye, 
  Edit, 
  Ban, 
  CheckCircle,
  DollarSign,
  TrendingUp,
  Users,
  AlertCircle
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/hooks/use-toast'

interface ProfileData {
  name?: string
  email?: string
}

interface Subscription extends Record<string, unknown> {
  id: string
  user_id: string
  plan_id: string
  status: string
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  stripe_subscription_id?: string
  profile?: ProfileData
  user?: {
    name?: string
    email: string
    store_name?: string
  }
  plan?: {
    name: string
    price_monthly?: number
  }
}

export default function AdminSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [migrateDialogOpen, setMigrateDialogOpen] = useState(false)
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false)
  const [cancelImmediately, setCancelImmediately] = useState(false)
  const [editPlanId, setEditPlanId] = useState('')
  const [selectedNewPlan, setSelectedNewPlan] = useState<{ id: string; name: string; price: number } | null>(null)
  const [editProrationPreview, setEditProrationPreview] = useState<{
    currentPrice: number
    newPrice: number
    proratedAmount: number
    nextBillingDate: string
    savingsOrIncrease: number
  } | null>(null)
  const [migratePlanId, setMigratePlanId] = useState('')
  const [migrateReason, setMigrateReason] = useState('')
  const [migratePreview, setMigratePreview] = useState<{
    fromPlan: string
    toPlan: string
    priceChange: number
    effectiveDate: string
  } | null>(null)
  const [discountPercent, setDiscountPercent] = useState('')
  const [discountDuration, setDiscountDuration] = useState('')
  const [plans, setPlans] = useState<Array<{ id: string; name: string; price: number }>>([])
  const [blockReason, setBlockReason] = useState('')
  const [inactivateDialogOpen, setInactivateDialogOpen] = useState(false)
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false)
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [unblockDialogOpen, setUnblockDialogOpen] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadSubscriptions()
    loadPlans()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, statusFilter])

  const loadPlans = async () => {
    try {
      const plansData = await AdminService.getAllPlans()
      setPlans(plansData as Array<{ id: string; name: string; price: number }>)
    } catch (error) {
      console.error('Error loading plans:', error)
    }
  }

  const loadSubscriptions = async () => {
    try {
      setIsLoading(true)
      const filters = statusFilter !== 'all' ? { status: statusFilter } : undefined
      const { subscriptions: subsData, total: totalData } = await AdminService.getAllSubscriptions(
        page,
        pageSize,
        filters
      )
      setSubscriptions(subsData as unknown as Subscription[])
      setTotal(totalData)
    } catch (error) {
      console.error('Error loading subscriptions:', error)
      toast({
        title: 'Erro ao carregar assinaturas',
        description: 'Não foi possível carregar as assinaturas.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewSubscription = (subscription: Subscription) => {
    setSelectedSubscription(subscription)
    setViewDialogOpen(true)
  }

  const handleEditSubscription = (subscription: Subscription) => {
    setSelectedSubscription(subscription)
    setEditPlanId(subscription.plan_id)
    setEditProrationPreview(null)
    setSelectedNewPlan(null)
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedSubscription) return

    try {
      await AdminService.updateSubscription(selectedSubscription.id, {
        plan_id: editPlanId
      })

      toast({
        title: 'Assinatura atualizada',
        description: 'O plano foi alterado com sucesso.'
      })

      setEditDialogOpen(false)
      setSelectedSubscription(null)
      loadSubscriptions()
    } catch (error) {
      console.error('Error updating subscription:', error)
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar a assinatura.',
        variant: 'destructive'
      })
    }
  }

  const handleCancelSubscription = async () => {
    if (!selectedSubscription) return

    try {
      await AdminService.cancelSubscription(
        selectedSubscription.id,
        cancelImmediately
      )

      toast({
        title: 'Assinatura cancelada',
        description: cancelImmediately 
          ? 'A assinatura foi cancelada imediatamente.'
          : 'A assinatura será cancelada no fim do período.'
      })

      setCancelDialogOpen(false)
      setSelectedSubscription(null)
      setCancelImmediately(false)
      loadSubscriptions()
    } catch (error) {
      console.error('Error canceling subscription:', error)
      toast({
        title: 'Erro ao cancelar',
        description: 'Não foi possível cancelar a assinatura.',
        variant: 'destructive'
      })
    }
  }

  const handleMigratePlan = async () => {
    if (!selectedSubscription || !migratePlanId) return

    try {
      await AdminService.migrateUserPlan(
        selectedSubscription.user_id,
        migratePlanId,
        migrateReason
      )

      toast({
        title: 'Plano migrado',
        description: 'O usuário foi migrado para o novo plano com sucesso.'
      })

      setMigrateDialogOpen(false)
      setSelectedSubscription(null)
      setMigratePlanId('')
      setMigrateReason('')
      setMigratePreview(null)
      loadSubscriptions()
    } catch (error) {
      console.error('Error migrating plan:', error)
      toast({
        title: 'Erro na migração',
        description: 'Não foi possível migrar o plano.',
        variant: 'destructive'
      })
    }
  }

  const handleApplyDiscount = async () => {
    if (!selectedSubscription || !discountPercent) return

    try {
      await AdminService.applyDiscount(
        selectedSubscription.id,
        parseFloat(discountPercent),
        discountDuration ? parseInt(discountDuration) : undefined
      )

      toast({
        title: 'Desconto aplicado',
        description: `Desconto de ${discountPercent}% aplicado com sucesso.`
      })

      setDiscountDialogOpen(false)
      setSelectedSubscription(null)
      setDiscountPercent('')
      setDiscountDuration('')
      loadSubscriptions()
    } catch (error) {
      console.error('Error applying discount:', error)
      toast({
        title: 'Erro ao aplicar desconto',
        description: 'Não foi possível aplicar o desconto.',
        variant: 'destructive'
      })
    }
  }

  const handleReactivate = async () => {
    try {
      if (!selectedSubscription) return

      await AdminService.updateSubscription(selectedSubscription.id, {
        cancel_at_period_end: false,
        status: 'active'
      })

      toast({
        title: 'Assinatura reativada',
        description: 'A assinatura foi reativada com sucesso.'
      })

      loadSubscriptions()
    } catch (error) {
      console.error('Error reactivating subscription:', error)
      toast({
        title: 'Erro ao reativar',
        description: 'Não foi possível reativar a assinatura.',
        variant: 'destructive'
      })
    }
  }

  const handleInactivate = async () => {
    try {
      if (!selectedSubscription) return

      await AdminService.inactivateUser(selectedSubscription.user_id)

      toast({
        title: 'Usuário inativado',
        description: 'O usuário foi inativado temporariamente.'
      })

      setInactivateDialogOpen(false)
      loadSubscriptions()
    } catch (error) {
      console.error('Error inactivating user:', error)
      toast({
        title: 'Erro ao inativar',
        description: 'Não foi possível inativar o usuário.',
        variant: 'destructive'
      })
    }
  }

  const handleReactivateUser = async () => {
    try {
      if (!selectedSubscription) return

      await AdminService.reactivateUser(selectedSubscription.user_id)

      toast({
        title: 'Usuário reativado',
        description: 'O usuário foi reativado com sucesso.'
      })

      setReactivateDialogOpen(false)
      loadSubscriptions()
    } catch (error) {
      console.error('Error reactivating user:', error)
      toast({
        title: 'Erro ao reativar',
        description: 'Não foi possível reativar o usuário.',
        variant: 'destructive'
      })
    }
  }

  const handleBlock = async () => {
    try {
      if (!selectedSubscription) return

      await AdminService.blockUser(selectedSubscription.user_id, blockReason)

      toast({
        title: 'Usuário bloqueado',
        description: 'O usuário foi bloqueado com sucesso.'
      })

      setBlockDialogOpen(false)
      setBlockReason('')
      loadSubscriptions()
    } catch (error) {
      console.error('Error blocking user:', error)
      toast({
        title: 'Erro ao bloquear',
        description: 'Não foi possível bloquear o usuário.',
        variant: 'destructive'
      })
    }
  }

  const handleUnblock = async () => {
    try {
      if (!selectedSubscription) return

      await AdminService.unblockUser(selectedSubscription.user_id)

      toast({
        title: 'Usuário desbloqueado',
        description: 'O usuário foi desbloqueado com sucesso.'
      })

      setUnblockDialogOpen(false)
      loadSubscriptions()
    } catch (error) {
      console.error('Error unblocking user:', error)
      toast({
        title: 'Erro ao desbloquear',
        description: 'Não foi possível desbloquear o usuário.',
        variant: 'destructive'
      })
    }
  }

  // Calculate proration preview when plan changes
  const calculateEditProration = (newPlanId: string) => {
    if (!selectedSubscription) return

    const currentPlan = plans.find(p => p.id === selectedSubscription.plan_id)
    const newPlan = plans.find(p => p.id === newPlanId)

    if (!currentPlan || !newPlan) return

    const currentPrice = currentPlan.price || 0
    const newPrice = newPlan.price || 0
    const periodEnd = new Date(selectedSubscription.current_period_end)
    const now = new Date()
    const daysLeft = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const totalDaysInPeriod = 30 // Assuming monthly billing
    const proratedAmount = (newPrice - currentPrice) * (daysLeft / totalDaysInPeriod)
    const savingsOrIncrease = newPrice - currentPrice

    setSelectedNewPlan(newPlan)
    setEditProrationPreview({
      currentPrice,
      newPrice,
      proratedAmount: Math.max(0, proratedAmount),
      nextBillingDate: format(periodEnd, 'dd/MM/yyyy', { locale: ptBR }),
      savingsOrIncrease
    })
  }

  // Calculate migration preview
  const calculateMigratePreview = (newPlanId: string) => {
    if (!selectedSubscription) return

    const currentPlan = plans.find(p => p.id === selectedSubscription.plan_id)
    const newPlan = plans.find(p => p.id === newPlanId)

    if (!currentPlan || !newPlan) return

    const priceChange = newPlan.price - currentPlan.price
    const effectiveDate = new Date(selectedSubscription.current_period_end)

    setMigratePreview({
      fromPlan: currentPlan.name,
      toPlan: newPlan.name,
      priceChange,
      effectiveDate: format(effectiveDate, 'dd/MM/yyyy', { locale: ptBR })
    })
  }

  const handleExport = async () => {
    try {
      const csv = await AdminService.exportToCSV('subscriptions')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `assinaturas_${new Date().toISOString()}.csv`
      a.click()

      toast({
        title: 'Exportação concluída',
        description: 'As assinaturas foram exportadas com sucesso.'
      })
    } catch (error) {
      console.error('Error exporting subscriptions:', error)
      toast({
        title: 'Erro na exportação',
        description: 'Não foi possível exportar as assinaturas.',
        variant: 'destructive'
      })
    }
  }

  const getStatusBadge = (status: string, cancelAtPeriodEnd: boolean) => {
    if (cancelAtPeriodEnd) {
      return <Badge variant="secondary">Cancelando</Badge>
    }

    const variants = {
      active: { variant: 'default' as const, label: 'Ativa' },
      canceled: { variant: 'destructive' as const, label: 'Cancelada' },
      past_due: { variant: 'secondary' as const, label: 'Vencida' },
      trialing: { variant: 'outline' as const, label: 'Trial' },
      incomplete: { variant: 'secondary' as const, label: 'Incompleta' }
    }

    const config = variants[status as keyof typeof variants] || { variant: 'outline' as const, label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const columns: Column<Subscription>[] = [
    {
      key: 'user',
      label: 'Usuário',
      sortable: true,
      render: (sub) => (
        <div className="flex flex-col">
          <span className="font-medium">{sub.user?.name || 'N/A'}</span>
          <span className="text-xs text-muted-foreground">{sub.user?.email}</span>
          {sub.user?.store_name && (
            <span className="text-xs text-muted-foreground">{sub.user.store_name}</span>
          )}
        </div>
      )
    },
    {
      key: 'plan',
      label: 'Plano',
      sortable: true,
      render: (sub) => (
        <div className="flex flex-col">
          <span className="font-medium">{sub.plan?.name || 'N/A'}</span>
          {sub.plan?.price_monthly && (
            <span className="text-xs text-muted-foreground">
              R$ {sub.plan.price_monthly.toFixed(2)}/mês
            </span>
          )}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (sub) => getStatusBadge(sub.status, sub.cancel_at_period_end)
    },
    {
      key: 'current_period_end',
      label: 'Renovação',
      sortable: true,
      render: (sub) => (
        <div className="flex flex-col">
          <span className="text-sm">
            {format(new Date(sub.current_period_end), 'dd/MM/yyyy', { locale: ptBR })}
          </span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(sub.current_period_end), 'HH:mm', { locale: ptBR })}
          </span>
        </div>
      )
    },
    {
      key: 'stripe_subscription_id',
      label: 'Stripe ID',
      className: 'w-[200px]',
      render: (sub) => (
        <span className="text-xs font-mono text-muted-foreground">
          {sub.stripe_subscription_id || 'N/A'}
        </span>
      )
    }
  ]

  const actions: Action<Subscription>[] = [
    {
      label: 'Ver Detalhes',
      onClick: handleViewSubscription,
      icon: <Eye className="h-4 w-4" />
    },
    {
      label: 'Editar Plano',
      onClick: handleEditSubscription,
      icon: <Edit className="h-4 w-4" />,
      show: (sub) => sub.status === 'active'
    },
    {
      label: 'Migrar Plano',
      onClick: (sub) => {
        setSelectedSubscription(sub)
        setMigratePlanId(sub.plan_id)
        setMigrateReason('')
        setMigratePreview(null)
        setMigrateDialogOpen(true)
      },
      icon: <TrendingUp className="h-4 w-4" />,
      show: (sub) => sub.status === 'active'
    },
    {
      label: 'Aplicar Desconto',
      onClick: (sub) => {
        setSelectedSubscription(sub)
        setDiscountDialogOpen(true)
      },
      icon: <DollarSign className="h-4 w-4" />,
      show: (sub) => sub.status === 'active'
    },
    {
      label: 'Inativar Conta',
      onClick: (sub) => {
        setSelectedSubscription(sub)
        setInactivateDialogOpen(true)
      },
      icon: <Ban className="h-4 w-4" />,
      show: (sub) => sub.status === 'active'
    },
    {
      label: 'Reativar Conta',
      onClick: (sub) => {
        setSelectedSubscription(sub)
        setReactivateDialogOpen(true)
      },
      icon: <CheckCircle className="h-4 w-4" />,
      show: (sub) => sub.status === 'canceled' || sub.cancel_at_period_end
    },
    {
      label: 'Bloquear Usuário',
      onClick: (sub) => {
        setSelectedSubscription(sub)
        setBlockReason('')
        setBlockDialogOpen(true)
      },
      icon: <Ban className="h-4 w-4" />,
      variant: 'destructive',
      show: (sub) => sub.status === 'active'
    },
    {
      label: 'Desbloquear Usuário',
      onClick: (sub) => {
        setSelectedSubscription(sub)
        setUnblockDialogOpen(true)
      },
      icon: <CheckCircle className="h-4 w-4" />,
      show: (sub) => sub.status === 'canceled'
    },
    {
      label: 'Reativar',
      onClick: handleReactivate,
      icon: <CheckCircle className="h-4 w-4" />,
      show: (sub) => sub.status === 'canceled' || sub.cancel_at_period_end
    },
    {
      label: 'Cancelar',
      onClick: (sub) => {
        setSelectedSubscription(sub)
        setCancelDialogOpen(true)
      },
      variant: 'destructive',
      icon: <Ban className="h-4 w-4" />,
      show: (sub) => sub.status === 'active' && !sub.cancel_at_period_end
    }
  ]

  const activeCount = subscriptions.filter(s => s.status === 'active' && !s.cancel_at_period_end).length
  const cancelingCount = subscriptions.filter(s => s.cancel_at_period_end).length
  const canceledCount = subscriptions.filter(s => s.status === 'canceled').length
  const totalRevenue = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + (s.plan?.price_monthly || 0), 0)

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gerenciamento de Assinaturas</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie todas as assinaturas e planos dos usuários
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="canceled">Canceladas</SelectItem>
                <SelectItem value="past_due">Vencidas</SelectItem>
                <SelectItem value="trialing">Trial</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={loadSubscriptions}>Atualizar</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assinaturas Ativas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeCount}</div>
              <p className="text-xs text-muted-foreground">Planos ativos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">MRR (Monthly Recurring Revenue)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cancelando</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{cancelingCount}</div>
              <p className="text-xs text-muted-foreground">Cancelam no fim do período</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Canceladas</CardTitle>
              <Ban className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{canceledCount}</div>
              <p className="text-xs text-muted-foreground">Assinaturas encerradas</p>
            </CardContent>
          </Card>
        </div>

        {/* Subscriptions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Assinaturas</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={subscriptions}
              columns={columns}
              actions={actions}
              currentPage={page}
              pageSize={pageSize}
              totalItems={total}
              isLoading={isLoading}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              onExport={handleExport}
              searchPlaceholder="Buscar por usuário, plano..."
            />
          </CardContent>
        </Card>
      </div>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Assinatura</DialogTitle>
            <DialogDescription>
              Informações completas sobre a assinatura
            </DialogDescription>
          </DialogHeader>

          {selectedSubscription && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Usuário</Label>
                  <p className="text-sm">{selectedSubscription.user?.name || 'N/A'}</p>
                  <p className="text-xs text-muted-foreground">{selectedSubscription.user?.email}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Plano</Label>
                  <p className="text-sm font-bold">{selectedSubscription.plan?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    R$ {selectedSubscription.plan?.price_monthly?.toFixed(2)}/mês
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    {getStatusBadge(selectedSubscription.status, selectedSubscription.cancel_at_period_end)}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Stripe ID</Label>
                  <p className="text-xs font-mono">{selectedSubscription.stripe_subscription_id || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Início do Período</Label>
                  <p className="text-sm">
                    {format(new Date(selectedSubscription.current_period_start), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Fim do Período</Label>
                  <p className="text-sm">
                    {format(new Date(selectedSubscription.current_period_end), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Plano da Assinatura</DialogTitle>
            <DialogDescription>
              Altere o plano e veja o impacto da mudança
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border p-3 bg-muted/50">
              <Label className="text-sm font-medium text-muted-foreground">Plano Atual</Label>
              <p className="text-lg font-semibold mt-1">{selectedSubscription?.plan?.name}</p>
              <p className="text-sm text-muted-foreground">
                R$ {selectedSubscription?.plan?.price_monthly?.toFixed(2)}/mês
              </p>
            </div>

            <div>
              <Label htmlFor="new-plan">Novo Plano</Label>
              <Select 
                value={editPlanId} 
                onValueChange={(value) => {
                  setEditPlanId(value)
                  calculateEditProration(value)
                }}
              >
                <SelectTrigger id="new-plan">
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans
                    .filter(p => p.id !== selectedSubscription?.plan_id)
                    .map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - R$ {plan.price?.toFixed(2)}/mês
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Selecione o plano para o qual deseja migrar
              </p>
            </div>

            {editProrationPreview && (
              <div className="rounded-lg border p-4 space-y-3 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h4 className="font-semibold text-sm">Preview da Mudança</h4>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Preço Atual</p>
                    <p className="font-semibold">R$ {editProrationPreview.currentPrice.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Novo Preço</p>
                    <p className="font-semibold">R$ {editProrationPreview.newPrice.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cobrança Proporcional</p>
                    <p className="font-semibold text-blue-600 dark:text-blue-400">
                      R$ {editProrationPreview.proratedAmount.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Próxima Cobrança</p>
                    <p className="font-semibold">{editProrationPreview.nextBillingDate}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-blue-200 dark:border-blue-900">
                  <p className="text-sm">
                    {editProrationPreview.savingsOrIncrease > 0 ? (
                      <span className="text-orange-600 dark:text-orange-400">
                        Aumento de R$ {editProrationPreview.savingsOrIncrease.toFixed(2)}/mês
                      </span>
                    ) : editProrationPreview.savingsOrIncrease < 0 ? (
                      <span className="text-green-600 dark:text-green-400">
                        Economia de R$ {Math.abs(editProrationPreview.savingsOrIncrease).toFixed(2)}/mês
                      </span>
                    ) : (
                      <span>Mesmo valor mensal</span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditDialogOpen(false)
              setEditProrationPreview(null)
              setSelectedNewPlan(null)
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={!editPlanId || editPlanId === selectedSubscription?.plan_id}
            >
              Confirmar Alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Assinatura</DialogTitle>
            <DialogDescription>
              Como você deseja cancelar esta assinatura?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="cancel-period-end"
                checked={!cancelImmediately}
                onChange={() => setCancelImmediately(false)}
                className="h-4 w-4"
              />
              <Label htmlFor="cancel-period-end" className="font-normal">
                Cancelar no fim do período atual
                <p className="text-xs text-muted-foreground">
                  O usuário terá acesso até {selectedSubscription && format(new Date(selectedSubscription.current_period_end), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="cancel-immediately"
                checked={cancelImmediately}
                onChange={() => setCancelImmediately(true)}
                className="h-4 w-4"
              />
              <Label htmlFor="cancel-immediately" className="font-normal">
                Cancelar imediatamente
                <p className="text-xs text-muted-foreground">
                  O acesso será removido agora
                </p>
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleCancelSubscription}>
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Migrate Plan Dialog */}
      <Dialog open={migrateDialogOpen} onOpenChange={setMigrateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Migrar Plano do Usuário</DialogTitle>
            <DialogDescription>
              Migre permanentemente o usuário para um novo plano
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border p-3 bg-muted/50">
              <Label className="text-sm font-medium text-muted-foreground">Usuário</Label>
              <p className="text-sm font-semibold mt-1">
                {selectedSubscription?.user?.name || selectedSubscription?.user?.email}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedSubscription?.user?.email}
              </p>
            </div>

            <div className="rounded-lg border p-3 bg-muted/50">
              <Label className="text-sm font-medium text-muted-foreground">Plano Atual</Label>
              <p className="text-lg font-semibold mt-1">{selectedSubscription?.plan?.name}</p>
              <p className="text-sm text-muted-foreground">
                R$ {selectedSubscription?.plan?.price_monthly?.toFixed(2)}/mês
              </p>
            </div>

            <div>
              <Label htmlFor="migrate-plan">Novo Plano</Label>
              <Select 
                value={migratePlanId} 
                onValueChange={(value) => {
                  setMigratePlanId(value)
                  calculateMigratePreview(value)
                }}
              >
                <SelectTrigger id="migrate-plan">
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans
                    .filter(p => p.id !== selectedSubscription?.plan_id)
                    .map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - R$ {plan.price?.toFixed(2)}/mês
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {migratePreview && (
              <div className="rounded-lg border p-4 space-y-3 bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <h4 className="font-semibold text-sm">Preview da Migração</h4>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">De:</span>
                    <span className="font-semibold">{migratePreview.fromPlan}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Para:</span>
                    <span className="font-semibold">{migratePreview.toPlan}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-purple-200 dark:border-purple-900">
                    <span className="text-muted-foreground">Diferença:</span>
                    <span className={`font-semibold ${migratePreview.priceChange > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {migratePreview.priceChange > 0 ? '+' : ''}R$ {migratePreview.priceChange.toFixed(2)}/mês
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Efetivo em:</span>
                    <span className="font-semibold">{migratePreview.effectiveDate}</span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="migrate-reason">Motivo da Migração *</Label>
              <Input
                id="migrate-reason"
                value={migrateReason}
                onChange={(e) => setMigrateReason(e.target.value)}
                placeholder="Ex: Upgrade solicitado pelo cliente"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Obrigatório para auditoria
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setMigrateDialogOpen(false)
              setMigratePreview(null)
              setMigrateReason('')
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleMigratePlan} 
              disabled={!migratePlanId || !migrateReason || migratePlanId === selectedSubscription?.plan_id}
            >
              Confirmar Migração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Discount Dialog */}
      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar Desconto</DialogTitle>
            <DialogDescription>
              Conceda um desconto para esta assinatura
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Usuário</Label>
              <p className="text-sm font-medium mt-1">
                {selectedSubscription?.user?.name || selectedSubscription?.user?.email}
              </p>
            </div>
            <div>
              <Label>Plano</Label>
              <p className="text-sm font-medium mt-1">
                {selectedSubscription?.plan?.name} - R$ {selectedSubscription?.plan?.price_monthly?.toFixed(2)}/mês
              </p>
            </div>
            <div>
              <Label htmlFor="discount-percent">Percentual de Desconto (%)</Label>
              <Input
                id="discount-percent"
                type="number"
                min="0"
                max="100"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                placeholder="Ex: 20"
              />
              {discountPercent && selectedSubscription?.plan?.price_monthly && (
                <p className="text-xs text-muted-foreground mt-1">
                  Novo valor: R$ {(selectedSubscription.plan.price_monthly * (1 - parseFloat(discountPercent) / 100)).toFixed(2)}/mês
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="discount-duration">Duração (meses) - Opcional</Label>
              <Input
                id="discount-duration"
                type="number"
                min="1"
                value={discountDuration}
                onChange={(e) => setDiscountDuration(e.target.value)}
                placeholder="Deixe vazio para duração ilimitada"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscountDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleApplyDiscount} disabled={!discountPercent}>
              Aplicar Desconto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inactivate User Dialog */}
      <Dialog open={inactivateDialogOpen} onOpenChange={setInactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inativar Conta</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja inativar temporariamente esta conta? O usuário não poderá acessar o sistema até ser reativado.
            </DialogDescription>
          </DialogHeader>
          {selectedSubscription && (
            <div className="space-y-4">
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/20 p-4 border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                      Ação Reversível
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      Esta ação pode ser revertida a qualquer momento reativando a conta.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Usuário</Label>
                <p className="text-sm text-muted-foreground">
                  {(selectedSubscription.profile as ProfileData)?.name} ({(selectedSubscription.profile as ProfileData)?.email})
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInactivateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="secondary" onClick={handleInactivate}>
              Inativar Conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reactivate User Dialog */}
      <Dialog open={reactivateDialogOpen} onOpenChange={setReactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reativar Conta</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja reativar esta conta? O usuário voltará a ter acesso ao sistema.
            </DialogDescription>
          </DialogHeader>
          {selectedSubscription && (
            <div className="space-y-2">
              <Label>Usuário</Label>
              <p className="text-sm text-muted-foreground">
                {(selectedSubscription.profile as ProfileData)?.name} ({(selectedSubscription.profile as ProfileData)?.email})
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReactivateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleReactivateUser}>
              Reativar Conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block User Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear Usuário</DialogTitle>
            <DialogDescription>
              Bloqueie o usuário por inadimplência, violação de termos ou outras razões. O acesso será completamente bloqueado.
            </DialogDescription>
          </DialogHeader>
          {selectedSubscription && (
            <div className="space-y-4">
              <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-4 border border-red-200 dark:border-red-800">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900 dark:text-red-100">
                      Ação Crítica
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      O usuário será completamente bloqueado e não poderá acessar o sistema. Use com cautela.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Usuário</Label>
                <p className="text-sm text-muted-foreground">
                  {(selectedSubscription.profile as ProfileData)?.name} ({(selectedSubscription.profile as ProfileData)?.email})
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="block-reason">Motivo do Bloqueio *</Label>
                <Input
                  id="block-reason"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Ex: Inadimplência há 30 dias, Violação dos termos de uso..."
                />
                <p className="text-xs text-muted-foreground">
                  Este motivo será registrado nos logs do sistema
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleBlock}
              disabled={!blockReason.trim()}
            >
              Bloquear Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unblock User Dialog */}
      <Dialog open={unblockDialogOpen} onOpenChange={setUnblockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desbloquear Usuário</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja desbloquear este usuário? O acesso ao sistema será restaurado.
            </DialogDescription>
          </DialogHeader>
          {selectedSubscription && (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-4 border border-green-200 dark:border-green-800">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      Restaurar Acesso
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      O usuário poderá voltar a acessar normalmente o sistema.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Usuário</Label>
                <p className="text-sm text-muted-foreground">
                  {(selectedSubscription.profile as ProfileData)?.name} ({(selectedSubscription.profile as ProfileData)?.email})
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnblockDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUnblock}>
              Desbloquear Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
