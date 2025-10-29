import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Flag, Plus, Edit, Trash2, Users, DollarSign, Percent } from 'lucide-react'
import { DataTable, type Column, type Action } from '@/components/admin/DataTable'
import { AdminService, type FeatureFlag } from '@/services/admin'

export default function AdminFeatureFlags() {
  const [features, setFeatures] = useState<FeatureFlag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingFeature, setEditingFeature] = useState<FeatureFlag | null>(null)
  const { toast } = useToast()

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_enabled: false,
    rollout_percentage: 100,
    enabled_for_plans: [] as string[],
  })

  useEffect(() => {
    loadFeatures()
  }, [])

  const loadFeatures = async () => {
    try {
      setIsLoading(true)
      const data = await AdminService.getFeatureFlags()
      setFeatures(data)
    } catch (error) {
      console.error('Error loading features:', error)
      toast({
        title: 'Erro ao carregar feature flags',
        description: 'Não foi possível carregar as feature flags.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleFeature = async (feature: FeatureFlag) => {
    try {
      await AdminService.toggleFeatureFlag(feature.id, !feature.is_enabled)
      await loadFeatures()
      toast({
        title: 'Feature atualizada',
        description: `Feature ${feature.name} ${!feature.is_enabled ? 'ativada' : 'desativada'} com sucesso.`
      })
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a feature.',
        variant: 'destructive'
      })
    }
  }

  const handleCreateFeature = async () => {
    try {
      if (editingFeature) {
        await AdminService.updateFeatureFlag(editingFeature.id, formData)
      } else {
        await AdminService.createFeatureFlag(formData)
      }
      await loadFeatures()
      setDialogOpen(false)
      resetForm()
      toast({
        title: editingFeature ? 'Feature atualizada' : 'Feature criada',
        description: `Feature flag ${editingFeature ? 'atualizada' : 'criada'} com sucesso.`
      })
    } catch (error) {
      toast({
        title: 'Erro',
        description: `Não foi possível ${editingFeature ? 'atualizar' : 'criar'} a feature.`,
        variant: 'destructive'
      })
    }
  }

  const handleEditFeature = (feature: FeatureFlag) => {
    setEditingFeature(feature)
    setFormData({
      name: feature.name,
      description: feature.description || '',
      is_enabled: feature.is_enabled,
      rollout_percentage: feature.rollout_percentage,
      enabled_for_plans: feature.enabled_for_plans || [],
    })
    setDialogOpen(true)
  }

  const handleDeleteFeature = async (feature: FeatureFlag) => {
    if (!confirm(`Tem certeza que deseja deletar a feature "${feature.name}"?`)) return

    try {
      await AdminService.deleteFeatureFlag(feature.id)
      await loadFeatures()
      toast({
        title: 'Feature deletada',
        description: 'Feature flag deletada com sucesso.'
      })
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível deletar a feature.',
        variant: 'destructive'
      })
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      is_enabled: false,
      rollout_percentage: 100,
      enabled_for_plans: [],
    })
    setEditingFeature(null)
  }

  const columns: Column<FeatureFlag>[] = [
    {
      key: 'name',
      label: 'Nome',
      sortable: true,
      render: (feature) => (
        <div className="font-medium">{feature.name}</div>
      )
    },
    {
      key: 'description',
      label: 'Descrição',
      render: (feature) => (
        <div className="text-sm text-muted-foreground max-w-md truncate">
          {feature.description || '-'}
        </div>
      )
    },
    {
      key: 'is_enabled',
      label: 'Status',
      sortable: true,
      render: (feature) => (
        <Badge variant={feature.is_enabled ? 'default' : 'secondary'}>
          {feature.is_enabled ? 'Ativo' : 'Inativo'}
        </Badge>
      )
    },
    {
      key: 'rollout_percentage',
      label: 'Rollout',
      sortable: true,
      render: (feature) => (
        <div className="flex items-center gap-2">
          <Percent className="h-4 w-4 text-muted-foreground" />
          <span>{feature.rollout_percentage}%</span>
        </div>
      )
    },
    {
      key: 'enabled_for_plans',
      label: 'Planos',
      render: (feature) => (
        <div className="text-sm">
          {feature.enabled_for_plans && feature.enabled_for_plans.length > 0
            ? `${feature.enabled_for_plans.length} planos`
            : 'Todos'
          }
        </div>
      )
    }
  ]

  const actions: Action<FeatureFlag>[] = [
    {
      label: 'Editar',
      onClick: handleEditFeature
    },
    {
      label: 'Deletar',
      onClick: handleDeleteFeature,
      variant: 'destructive'
    }
  ]

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Feature Flags</h1>
            <p className="text-muted-foreground">
              Gerencie recursos e experimentos do sistema
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Feature
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Features
              </CardTitle>
              <Flag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{features.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Features Ativas
              </CardTitle>
              <Flag className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {features.filter(f => f.is_enabled).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Em Rollout
              </CardTitle>
              <Percent className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {features.filter(f => f.rollout_percentage < 100).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Features Table */}
        <Card>
          <CardHeader>
            <CardTitle>Features Disponíveis</CardTitle>
            <CardDescription>
              Lista de todas as feature flags do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              data={features}
              columns={columns}
              actions={actions}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingFeature ? 'Editar Feature Flag' : 'Nova Feature Flag'}
              </DialogTitle>
              <DialogDescription>
                Configure as opções da feature flag
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  placeholder="ex: new_dashboard"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Descreva o propósito desta feature..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Feature Ativa</Label>
                  <div className="text-sm text-muted-foreground">
                    Ativar esta feature para os usuários
                  </div>
                </div>
                <Switch
                  checked={formData.is_enabled}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, is_enabled: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rollout">Porcentagem de Rollout (%)</Label>
                <Input
                  id="rollout"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.rollout_percentage}
                  onChange={(e) => 
                    setFormData({ ...formData, rollout_percentage: parseInt(e.target.value) || 0 })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Porcentagem de usuários que terão acesso a esta feature
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="plans">Planos com Acesso</Label>
                <Select
                  value={formData.enabled_for_plans[0] || 'all'}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      enabled_for_plans: value === 'all' ? [] : [value]
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione os planos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Planos</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateFeature}>
                {editingFeature ? 'Salvar' : 'Criar Feature'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
            <CardDescription>
              Controle rápido de features comuns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {features.slice(0, 5).map((feature) => (
                <div key={feature.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{feature.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {feature.description}
                    </div>
                  </div>
                  <Switch
                    checked={feature.is_enabled}
                    onCheckedChange={() => handleToggleFeature(feature)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
