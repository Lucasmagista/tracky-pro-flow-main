import React, { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, GripVertical, Settings, Trash2, BarChart3, TrendingUp, PieChart, Table } from 'lucide-react'
import { AnalyticsService } from '@/services/analytics'
import { useToast } from '@/hooks/use-toast'
import { Json } from '@/integrations/supabase/types'

interface LocalDashboardWidget {
  id: string
  user_id: string
  title: string
  widget_type: string
  config: Json
  position: Json
  is_visible: boolean
  created_at: string
  updated_at: string
}

interface CustomizableDashboardProps {
  userId: string
}

interface WidgetData {
  id: string
  title: string
  type: 'metric' | 'chart' | 'table' | 'comparison'
  config: Record<string, unknown>
  position: { x: number; y: number; width: number; height: number }
  isVisible: boolean
}

const SortableWidget: React.FC<{
  widget: WidgetData
  onEdit: (widget: WidgetData) => void
  onDelete: (id: string) => void
  children: React.ReactNode
}> = ({ widget, onEdit, onDelete, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded p-1">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab hover:bg-muted rounded p-1"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit(widget)}
            className="h-6 w-6 p-0"
          >
            <Settings className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(widget.id)}
            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {children}
    </div>
  )
}

const WidgetCard: React.FC<{ widget: WidgetData; data?: Record<string, unknown> }> = ({ widget, data }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'metric': return <TrendingUp className="h-4 w-4" />
      case 'chart': return <BarChart3 className="h-4 w-4" />
      case 'table': return <Table className="h-4 w-4" />
      case 'comparison': return <PieChart className="h-4 w-4" />
      default: return <BarChart3 className="h-4 w-4" />
    }
  }

  const renderWidgetContent = () => {
    if (!data) {
      return <div className="text-muted-foreground">Carregando...</div>
    }

    switch (widget.type) {
      case 'metric':
        return (
          <div className="text-center">
            <div className="text-2xl font-bold">{String(data.value || 0)}</div>
            <div className="text-sm text-muted-foreground">{String(widget.config?.label || widget.title)}</div>
          </div>
        )
      case 'chart':
        return <div className="text-muted-foreground">Gráfico em desenvolvimento</div>
      case 'table':
        return <div className="text-muted-foreground">Tabela em desenvolvimento</div>
      case 'comparison':
        return <div className="text-muted-foreground">Comparativo em desenvolvimento</div>
      default:
        return <div className="text-muted-foreground">Widget não suportado</div>
    }
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {getIcon(widget.type)}
          {widget.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {renderWidgetContent()}
      </CardContent>
    </Card>
  )
}

export const CustomizableDashboard: React.FC<CustomizableDashboardProps> = ({ userId }) => {
  const [widgets, setWidgets] = useState<WidgetData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingWidget, setEditingWidget] = useState<WidgetData | null>(null)
  const [newWidget, setNewWidget] = useState({
    title: '',
    type: 'metric' as WidgetData['type'],
    config: {}
  })
  const { toast } = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const loadWidgets = useCallback(async () => {
    try {
      const dashboardWidgets = await AnalyticsService.getDashboardWidgets(userId)
      const formattedWidgets: WidgetData[] = dashboardWidgets.map((w: LocalDashboardWidget) => ({
        id: w.id,
        title: w.title,
        type: w.widget_type as WidgetData['type'],
        config: w.config as Record<string, unknown>,
        position: w.position as { x: number; y: number; width: number; height: number },
        isVisible: w.is_visible || false
      }))
      setWidgets(formattedWidgets)
    } catch (error) {
      console.error('Erro ao carregar widgets:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os widgets do dashboard.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }, [userId, toast])

  useEffect(() => {
    loadWidgets()
  }, [loadWidgets])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setWidgets((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)

        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleAddWidget = async () => {
    if (!newWidget.title.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Digite um título para o widget.',
        variant: 'destructive'
      })
      return
    }

    try {
      const widgetData = {
        title: newWidget.title,
        widget_type: newWidget.type,
        config: newWidget.config as Json,
        position: { x: 0, y: widgets.length, width: 6, height: 4 },
        is_visible: true
      }

      await AnalyticsService.saveDashboardWidget(userId, widgetData)
      await loadWidgets()

      setNewWidget({ title: '', type: 'metric', config: {} })
      setIsAddDialogOpen(false)

      toast({
        title: 'Widget adicionado',
        description: 'O widget foi adicionado ao dashboard.',
      })
    } catch (error) {
      console.error('Erro ao adicionar widget:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar o widget.',
        variant: 'destructive'
      })
    }
  }

  const handleEditWidget = async (widget: WidgetData) => {
    try {
      const widgetData = {
        title: widget.title,
        widget_type: widget.type,
        config: widget.config,
        position: widget.position,
        is_visible: widget.isVisible
      }

      await AnalyticsService.saveDashboardWidget(userId, widgetData)
      await loadWidgets()

      setEditingWidget(null)
      toast({
        title: 'Widget atualizado',
        description: 'O widget foi atualizado com sucesso.',
      })
    } catch (error) {
      console.error('Erro ao editar widget:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o widget.',
        variant: 'destructive'
      })
    }
  }

  const handleDeleteWidget = async (widgetId: string) => {
    try {
      await AnalyticsService.deleteDashboardWidget(widgetId)
      setWidgets(widgets.filter(w => w.id !== widgetId))
      toast({
        title: 'Widget removido',
        description: 'O widget foi removido do dashboard.',
      })
    } catch (error) {
      console.error('Erro ao remover widget:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o widget.',
        variant: 'destructive'
      })
    }
  }

  const widgetTypes = [
    { value: 'metric', label: 'Métrica', icon: TrendingUp, description: 'Exibe um valor numérico' },
    { value: 'chart', label: 'Gráfico', icon: BarChart3, description: 'Visualização em gráfico' },
    { value: 'table', label: 'Tabela', icon: Table, description: 'Dados em formato tabular' },
    { value: 'comparison', label: 'Comparativo', icon: PieChart, description: 'Comparação de períodos' }
  ]

  if (isLoading) {
    return (
      <EmptyState
        variant="info"
        title="Carregando dashboard..."
        description="Estamos preparando seu dashboard personalizado com os widgets configurados."
        badge={{ text: "Carregando", variant: "secondary" }}
        tips={[
          "Aguarde enquanto carregamos seus dados",
          "Widgets são salvos automaticamente",
          "Você pode personalizar tudo depois"
        ]}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard Personalizado</h2>
          <p className="text-muted-foreground">Organize e personalize seus widgets de análise</p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Widget
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Widget</DialogTitle>
              <DialogDescription>
                Configure um novo widget para seu dashboard
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="widget-title">Título</Label>
                <Input
                  id="widget-title"
                  value={newWidget.title}
                  onChange={(e) => setNewWidget(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Total de Pedidos"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="widget-type">Tipo</Label>
                <Select
                  value={newWidget.type}
                  onValueChange={(value) => setNewWidget(prev => ({ ...prev, type: value as WidgetData['type'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {widgetTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{type.label}</div>
                            <div className="text-sm text-muted-foreground">{type.description}</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleAddWidget} className="w-full">
                Adicionar Widget
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={widgets.map(w => w.id)} strategy={verticalListSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {widgets.map((widget) => (
              <SortableWidget
                key={widget.id}
                widget={widget}
                onEdit={setEditingWidget}
                onDelete={handleDeleteWidget}
              >
                <WidgetCard widget={widget} />
              </SortableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {widgets.length === 0 && (
        <EmptyState
          variant="advanced"
          title="Dashboard vazio"
          description="Personalize seu dashboard adicionando widgets para visualizar métricas importantes, gráficos de performance e dados relevantes para sua operação logística."
          actions={[
            {
              label: "Adicionar Primeiro Widget",
              onClick: () => setIsAddDialogOpen(true),
              variant: "hero",
              icon: Plus
            }
          ]}
          badge={{ text: "Dashboard", variant: "secondary" }}
          metrics={[
            { label: "Widgets Disponíveis", value: "4", icon: BarChart3 },
            { label: "Personalização", value: "100%", icon: Settings },
            { label: "Arrastar e Soltar", value: "Sim", icon: GripVertical }
          ]}
          tips={[
            "Arraste widgets para reordenar o dashboard",
            "Configure widgets para mostrar dados específicos",
            "Widgets são salvos automaticamente"
          ]}
        />
      )}

      {/* Dialog de edição de widget */}
      {editingWidget && (
        <Dialog open={!!editingWidget} onOpenChange={() => setEditingWidget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Widget</DialogTitle>
              <DialogDescription>
                Modifique as configurações do widget
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Título</Label>
                <Input
                  id="edit-title"
                  value={editingWidget.title}
                  onChange={(e) => setEditingWidget(prev => prev ? { ...prev, title: e.target.value } : null)}
                />
              </div>

              <Button onClick={() => editingWidget && handleEditWidget(editingWidget)} className="w-full">
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}