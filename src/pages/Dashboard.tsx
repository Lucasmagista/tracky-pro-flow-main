import { useState, useMemo } from "react";
import Navbar from "@/components/Navbar";
import MetricCard from "@/components/MetricCard";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { SkeletonCard, SkeletonTable, SkeletonChart } from "@/components/SkeletonLoaders";
import { AdvancedFilters } from "@/components/AdvancedFilters";
import { HighlightedText, SearchResultsHeader } from "@/components/HighlightedText";
import { ExportMenu } from "@/components/ExportMenu";
import { InteractivePieChart } from "@/components/charts/InteractivePieChart";
import { InteractiveBarChart } from "@/components/charts/InteractiveBarChart";
import { InteractiveLineChart } from "@/components/charts/InteractiveLineChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Package, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Search,
  Filter,
  Upload,
  BarChart3,
  ArrowUpRight,
  Inbox,
  Download,
  RefreshCw,
  Plus,
  Timer,
  Wifi,
  Edit,
  Trash2
} from "lucide-react";
import { Link } from "react-router-dom";
import { useOrders, useUpdateOrder, useDeleteOrder } from "@/hooks/useOrders";
import { useDashboardMetrics, usePeriods } from "@/hooks/useDashboardMetrics";
import { useOrderFilters } from "@/hooks/useOrderFilters";
import { MetricsService } from "@/services/metrics";
import { useTracking } from "@/hooks/useTracking";
import { useToast } from "@/hooks/use-toast";
import { useAutoNotifications } from "@/hooks/useNotifications";
import { useOrdersRealtime, useMetricsRealtime } from "@/hooks/useRealtimeSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from "recharts";
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import OrderEditModal from "@/components/OrderEditModal";
import OrderDeleteConfirm from "@/components/OrderDeleteConfirm";

// Tipo para pedido
interface Order {
  id: string;
  tracking_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  carrier: string;
  status: string;
  destination?: string;
  order_date?: string;
  estimated_delivery?: string;
  product_name?: string;
  quantity?: string;
  order_number?: string;
  notes?: string;
  order_value?: string;
  updated_at: string;
}

const statusConfig: Record<string, { label: string }> = {
  pending: { label: "Aguardando" },
  in_transit: { label: "Em Trânsito" },
  out_for_delivery: { label: "Saiu p/ Entrega" },
  delivered: { label: "Entregue" },
  delayed: { label: "Atrasado" },
  failed: { label: "Falha na Entrega" },
  returned: { label: "Devolvido" },
};

const Dashboard = () => {
  const { user } = useAuth();
  
  // Hooks de dados com real-time e caching
  const { data: orders = [], isLoading: ordersLoading } = useOrders({ enableRealtime: true });
  const { periods, selectedPeriod, setSelectedPeriod, currentPeriod } = usePeriods();
  
  // Ativar realtime para orders e metrics
  const { isSubscribed: ordersSubscribed } = useOrdersRealtime(user?.id);
  const { isSubscribed: metricsSubscribed } = useMetricsRealtime(user?.id);
  
  // Hooks para editar/excluir pedidos
  const updateOrderMutation = useUpdateOrder();
  const deleteOrderMutation = useDeleteOrder();
  
  // Estado para modais
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Hook de filtros avançados
  const {
    filters,
    searchHistory,
    filterOptions,
    filteredOrders,
    filterStats,
    hasActiveFilters,
    activeFiltersCount,
    setSearch,
    toggleStatus,
    toggleCarrier,
    setDateRange,
    setDestination,
    clearFilters,
    clearSearchHistory,
    getHighlightedText,
  } = useOrderFilters(orders);
  
  const { 
    metrics, 
    isLoadingMetrics, 
    carrierMetrics,
    timeSeries,
    statusDistribution,
    refetch 
  } = useDashboardMetrics({
    period: currentPeriod,
    enableComparison: true,
    enableRealtime: true,
  });
  
  const { trackOrder, isTracking } = useTracking();
  const { toast } = useToast();

  // Ativa notificações automáticas
  useAutoNotifications();

  // Preparar métricas para exportação
  const exportMetrics = useMemo(() => {
    if (!metrics) return undefined;
    
    return {
      total: metrics.total,
      delivered: metrics.delivered,
      inTransit: metrics.inTransit,
      delayed: metrics.delayed,
      pending: metrics.pending,
      deliveryRate: metrics.deliveryRate,
      averageDeliveryTime: metrics.averageDeliveryTime,
    };
  }, [metrics]);

  // Filtros para exportação
  const exportFilters = useMemo(() => ({
    search: filters.search,
    statuses: filters.status,
    carriers: filters.carriers,
    dateRange: filters.dateRange,
  }), [filters]);

  // Dados para gráficos interativos
  const interactivePieData = useMemo(() => {
    if (!statusDistribution || statusDistribution.length === 0) return [];

    return statusDistribution.map(item => ({
      name: statusConfig[item.status]?.label || item.status,
      value: item.count,
      percentage: item.percentage,
      color: item.status === 'delivered' ? '#10b981' : 
             item.status === 'in_transit' ? '#3b82f6' : 
             item.status === 'out_for_delivery' ? '#8b5cf6' :
             item.status === 'delayed' ? '#f59e0b' : 
             item.status === 'pending' ? '#6b7280' :
             item.status === 'failed' ? '#ef4444' : '#94a3b8'
    }));
  }, [statusDistribution]);

  const interactiveBarData = useMemo(() => {
    if (!carrierMetrics || carrierMetrics.length === 0) return [];

    return carrierMetrics.map(carrier => ({
      carrier: carrier.carrier,
      total: carrier.totalOrders,
      delivered: carrier.deliveredOrders,
      inTransit: carrier.totalOrders - carrier.deliveredOrders - carrier.delayedOrders,
      delayed: carrier.delayedOrders,
      successRate: carrier.successRate,
    }));
  }, [carrierMetrics]);

  const interactiveLineData = useMemo(() => {
    if (!timeSeries || timeSeries.length === 0) return [];

    return timeSeries.map(item => ({
      date: item.date,
      total: item.total,
      delivered: item.delivered,
      inTransit: item.inTransit,
      delayed: item.delayed,
    }));
  }, [timeSeries]);

  // Handlers para interação com gráficos
  const handlePieSegmentClick = (data: { name: string; value: number; percentage: number; color: string }) => {
    // Filtrar por status clicado
    const statusKey = Object.keys(statusConfig).find(
      key => statusConfig[key].label === data.name
    );
    if (statusKey) {
      toggleStatus(statusKey);
    }
  };

  const handleBarClick = (data: { carrier: string; total: number; delivered: number; inTransit: number; delayed: number; successRate: number }) => {
    // Filtrar por transportadora clicada
    toggleCarrier(data.carrier);
  };

  const handleLinePointClick = (data: { date: string; total: number; delivered: number; inTransit: number; delayed: number }) => {
    // Poderia filtrar por data específica
    console.log('Ponto clicado:', data);
  };

  const handleUpdateTracking = async (trackingCode: string) => {
    try {
      await trackOrder.mutateAsync(trackingCode);
      toast({
        title: "Status atualizado!",
        description: `Rastreamento ${trackingCode} foi atualizado com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao atualizar rastreamento:", error);
      toast({
        title: "Erro na atualização",
        description: "Não foi possível atualizar o status do pedido.",
        variant: "destructive",
      });
    }
  };

  // Funções para editar/excluir pedidos
  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setShowEditModal(true);
  };

  const handleDeleteOrder = (order: Order) => {
    setDeletingOrder(order);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteOrder = async () => {
    if (!deletingOrder) return;

    try {
      await deleteOrderMutation.mutateAsync(deletingOrder.id);
      setShowDeleteConfirm(false);
      setDeletingOrder(null);
    } catch (error) {
      console.error("Erro ao excluir pedido:", error);
    }
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingOrder(null);
  };

  const closeDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    setDeletingOrder(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1 pt-20 pb-12 px-4">
        <div className="container mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4" data-tour="dashboard-header">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">Dashboard</h1>
                {(ordersSubscribed || metricsSubscribed) && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
                    <Wifi className="h-3 w-3 animate-pulse" />
                    <span>Tempo Real</span>
                  </div>
                )}
              </div>
              <p className="text-muted-foreground">
                Gerencie e acompanhe todos os seus pedidos em tempo real
              </p>
            </div>
            <div className="flex gap-3 items-center" data-tour="dashboard-actions">
              {/* Seletor de Período */}
              <select
                value={selectedPeriod}
                onChange={(e) => {
                  const value = e.target.value;
                  // Só permite valores válidos
                  if ([
                    "today",
                    "yesterday",
                    "last7Days",
                    "last30Days",
                    "thisMonth",
                    "lastMonth",
                    "thisYear"
                  ].includes(value)) {
                    setSelectedPeriod(value as typeof selectedPeriod);
                  }
                }}
                className="px-4 py-2 rounded-md border bg-background text-sm"
              >
                <option value="today">Hoje</option>
                <option value="yesterday">Ontem</option>
                <option value="last7Days">Últimos 7 dias</option>
                <option value="last30Days">Últimos 30 dias</option>
                <option value="thisMonth">Este mês</option>
                <option value="lastMonth">Mês passado</option>
                <option value="thisYear">Este ano</option>
              </select>

              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => refetch()}
                disabled={isLoadingMetrics}
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingMetrics ? 'animate-spin' : ''}`} />
              </Button>
              
              <Link to="/dashboard/importar">
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Importar
                </Button>
              </Link>
              
              <ExportMenu
                orders={filteredOrders}
                metrics={exportMetrics}
                filters={exportFilters}
                title={`Relatório - ${currentPeriod.label}`}
              />
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-tour="dashboard-metrics">
            {isLoadingMetrics ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              <>
                <MetricCard
                  title="Total de Pedidos"
                  value={metrics?.total || 0}
                  icon={Package}
                  trend={metrics?.totalChange ? { 
                    value: `${Math.abs(metrics.totalChange)}% vs período anterior`, 
                    isPositive: metrics.totalChange > 0 
                  } : undefined}
                  loading={isLoadingMetrics}
                  delay={0}
                />
                <MetricCard
                  title="Em Trânsito"
                  value={metrics?.inTransit || 0}
                  icon={TrendingUp}
                  loading={isLoadingMetrics}
                  delay={0.1}
                />
                <MetricCard
                  title="Entregues"
                  value={metrics?.delivered || 0}
                  icon={CheckCircle2}
                  trend={metrics?.deliveryRate ? { 
                    value: `${metrics.deliveryRate}% taxa de entrega`, 
                    isPositive: true 
                  } : undefined}
                  loading={isLoadingMetrics}
                  delay={0.2}
                />
                <MetricCard
                  title="Atrasados"
                  value={metrics?.delayed || 0}
                  icon={AlertTriangle}
                  trend={metrics?.delayedChange ? { 
                    value: `${Math.abs(metrics.delayedChange)}% vs período anterior`, 
                    isPositive: metrics.delayedChange < 0 
                  } : undefined}
                  loading={isLoadingMetrics}
                  delay={0.3}
                />
              </>
            )}
          </div>

          {/* Additional Metrics Row */}
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Tempo Médio de Entrega
                  </CardTitle>
                  <Timer className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metrics.averageDeliveryTime > 0 
                      ? `${metrics.averageDeliveryTime} dias` 
                      : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Média do período selecionado
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Entrega no Prazo
                  </CardTitle>
                  <Clock className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metrics.onTimeDeliveryRate > 0 
                      ? `${metrics.onTimeDeliveryRate}%` 
                      : 'N/A'}
                  </div>
                  <p className="text-xs text-accent mt-1">
                    Taxa de pontualidade
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Pendentes
                  </CardTitle>
                  <Inbox className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metrics.pending || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Aguardando postagem
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Charts Section */}
          <div className="grid md:grid-cols-2 gap-6" data-tour="dashboard-charts">
            {ordersLoading ? (
              <>
                <SkeletonChart />
                <SkeletonChart />
              </>
            ) : interactivePieData.length === 0 ? (
              <>
                <EmptyState
                  variant="data"
                  title="Sem dados para análise"
                  description="Adicione pedidos para ver estatísticas de status e acompanhar o desempenho das entregas."
                  actions={[
                    {
                      label: "Importar Pedidos",
                      href: "/dashboard/importar",
                      variant: "default",
                      icon: Upload
                    }
                  ]}
                  className="h-80"
                />
                <EmptyState
                  variant="analytics"
                  title="Análises em breve"
                  description="Assim que você tiver pedidos, verá aqui gráficos detalhados sobre performance das transportadoras."
                  actions={[
                    {
                      label: "Ver Analytics",
                      href: "/dashboard/analytics",
                      variant: "outline",
                      icon: BarChart3
                    }
                  ]}
                  className="h-80"
                />
              </>
            ) : (
              <>
                <InteractivePieChart
                  data={interactivePieData}
                  title="Distribuição por Status"
                  onSegmentClick={handlePieSegmentClick}
                />

                <InteractiveBarChart
                  data={interactiveBarData}
                  title="Performance por Transportadora"
                  onBarClick={handleBarClick}
                />
              </>
            )}
          </div>

          {/* Time Series Chart */}
          {interactiveLineData.length > 0 && (
            <InteractiveLineChart
              data={interactiveLineData}
              title={`Evolução Temporal - ${currentPeriod.label}`}
              onPointClick={handleLinePointClick}
            />
          )}

          {/* Fallback antiga */}
          {interactiveLineData.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Evolução Temporal</CardTitle>
                <CardDescription>Não há dados suficientes para exibir o gráfico</CardDescription>
              </CardHeader>
              <CardContent className="h-80 flex items-center justify-center text-gray-500">
                Adicione mais pedidos para visualizar a evolução ao longo do tempo
              </CardContent>
            </Card>
          )}

          {/* Orders Table */}
          <Card data-tour="dashboard-orders">
            <CardHeader>
              <div className="flex flex-col gap-4">
                <div>
                  <CardTitle>Pedidos</CardTitle>
                  <CardDescription>Acompanhe todos os pedidos em tempo real</CardDescription>
                </div>
                
                {/* Filtros Avançados */}
                <AdvancedFilters
                  searchQuery={filters.search}
                  onSearchChange={setSearch}
                  selectedStatuses={filters.status}
                  onStatusToggle={toggleStatus}
                  selectedCarriers={filters.carriers}
                  onCarrierToggle={toggleCarrier}
                  dateRange={filters.dateRange}
                  onDateRangeChange={setDateRange}
                  destination={filters.destination}
                  onDestinationChange={setDestination}
                  availableStatuses={filterOptions.statuses}
                  availableCarriers={filterOptions.carriers}
                  searchHistory={searchHistory}
                  onClearSearchHistory={clearSearchHistory}
                  hasActiveFilters={hasActiveFilters}
                  activeFiltersCount={activeFiltersCount}
                  onClearFilters={clearFilters}
                  totalOrders={orders.length}
                  filteredCount={filteredOrders.length}
                />

                {/* Cabeçalho de Resultados */}
                <SearchResultsHeader
                  totalResults={filteredOrders.length}
                  searchQuery={filters.search}
                  hasFilters={hasActiveFilters}
                />
              </div>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <SkeletonTable rows={8} />
              ) : filteredOrders.length === 0 ? (
                hasActiveFilters ? (
                  // Estado vazio para busca/filtros sem resultados
                  <EmptyState
                    variant="search"
                    title="Nenhum pedido encontrado"
                    description="Não encontramos pedidos que correspondam aos filtros aplicados. Tente ajustar sua busca ou filtros para ver mais resultados."
                    actions={[
                      {
                        label: "Limpar filtros",
                        onClick: clearFilters,
                        variant: "outline",
                        icon: RefreshCw
                      },
                      {
                        label: "Importar pedidos",
                        href: "/dashboard/importar",
                        variant: "default",
                        icon: Upload
                      }
                    ]}
                    tips={[
                      "Verifique se o código de rastreio está correto",
                      "Tente buscar apenas pelo nome do cliente",
                      "Use filtros menos específicos para ver mais resultados"
                    ]}
                  />
                ) : (
                  // Estado vazio inicial (sem pedidos ainda)
                  <EmptyState
                    variant="dashboard"
                    title="Bem-vindo ao seu Dashboard!"
                    description="Você ainda não tem pedidos cadastrados. Comece importando seus primeiros pedidos ou adicionando manualmente para acompanhar o rastreamento em tempo real."
                    actions={[
                      {
                        label: "Importar Pedidos",
                        href: "/dashboard/importar",
                        variant: "hero",
                        icon: Upload
                      },
                      {
                        label: "Adicionar Manualmente",
                        onClick: () => {
                          // Scroll to manual form or open modal
                          document.querySelector('#manual-form')?.scrollIntoView({ behavior: 'smooth' });
                        },
                        variant: "outline",
                        icon: Plus
                      }
                    ]}
                    metrics={[
                      { label: "Pedidos Hoje", value: "0", icon: Package },
                      { label: "Em Trânsito", value: "0", icon: TrendingUp },
                      { label: "Entregues", value: "0", icon: CheckCircle2 }
                    ]}
                    tips={[
                      "Importe pedidos via CSV para adicionar vários de uma vez",
                      "Conecte sua loja virtual para sincronização automática",
                      "Configure notificações para acompanhar atualizações"
                    ]}
                  />
                )
              ) : (
                <>
                  {/* Mobile Cards View */}
                  <div className="block md:hidden space-y-4">
                    {filteredOrders.map((order) => (
                      <Card key={order.id} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <HighlightedText 
                              text={order.tracking_code}
                              highlight={filters.search}
                              className="font-mono text-sm font-medium"
                            />
                            <StatusBadge status={order.status} />
                          </div>
                          <div>
                            <HighlightedText 
                              text={order.customer_name}
                              highlight={filters.search}
                              className="font-medium block"
                            />
                            <HighlightedText 
                              text={order.customer_email}
                              highlight={filters.search}
                              className="text-sm text-muted-foreground block"
                            />
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <HighlightedText 
                              text={order.carrier}
                              highlight={filters.search}
                              className="text-muted-foreground"
                            />
                            <HighlightedText 
                              text={order.destination}
                              highlight={filters.search}
                              className="text-muted-foreground"
                            />
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {new Date(order.updated_at).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <Button variant="ghost" size="sm">
                              <ArrowUpRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">Código</th>
                          <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">Cliente</th>
                          <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">Transportadora</th>
                          <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">Status</th>
                          <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">Destino</th>
                          <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">Última Atualização</th>
                          <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map((order) => (
                          <tr key={order.id} className="border-b hover:bg-muted/50 transition-smooth">
                            <td className="py-4 px-4">
                              <HighlightedText 
                                text={order.tracking_code}
                                highlight={filters.search}
                                className="font-mono text-sm font-medium"
                              />
                            </td>
                            <td className="py-4 px-4">
                              <div>
                                <HighlightedText 
                                  text={order.customer_name}
                                  highlight={filters.search}
                                  className="font-medium block"
                                />
                                <HighlightedText 
                                  text={order.customer_email}
                                  highlight={filters.search}
                                  className="text-sm text-muted-foreground block"
                                />
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <HighlightedText 
                                text={order.carrier}
                                highlight={filters.search}
                                className="text-sm"
                              />
                            </td>
                            <td className="py-4 px-4">
                              <StatusBadge status={order.status} />
                            </td>
                            <td className="py-4 px-4">
                              <HighlightedText 
                                text={order.destination}
                                highlight={filters.search}
                                className="text-sm"
                              />
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm text-muted-foreground">
                                {new Date(order.updated_at).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleUpdateTracking(order.tracking_code)}
                                  disabled={isTracking}
                                  title="Atualizar rastreamento"
                                >
                                  <RefreshCw className={`h-4 w-4 ${isTracking ? 'animate-spin' : ''}`} />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleEditOrder(order)}
                                  title="Editar pedido"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleDeleteOrder(order)}
                                  title="Excluir pedido"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Modais de Edição e Exclusão */}
          <OrderEditModal
            order={editingOrder}
            isOpen={showEditModal}
            onClose={closeEditModal}
          />

          <OrderDeleteConfirm
            isOpen={showDeleteConfirm}
            onClose={closeDeleteConfirm}
            onConfirm={confirmDeleteOrder}
            orderTrackingCode={deletingOrder?.tracking_code || ""}
            isDeleting={deleteOrderMutation.isPending}
          />
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
