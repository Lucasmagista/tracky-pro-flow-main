import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard, SkeletonChart, SkeletonList } from "@/components/SkeletonLoaders";
import EmptyState from "@/components/EmptyState";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Package,
  Truck,
  BarChart3,
  Brain,
  Target,
  Zap,
  Star,
  MapPin,
  DollarSign,
  ArrowLeft,
  ArrowRight,
  FileText,
  Calendar,
  Settings,
  Upload,
  Plus,
  Shield,
  LogIn,
  Lightbulb,
  Eye
} from "lucide-react";
import { useAIInsights } from "@/hooks/useAIInsights";
import { useOrders } from "@/hooks/useOrders";
import { ReportGenerator } from "@/components/analytics/ReportGenerator";
import { CustomizableDashboard } from "@/components/analytics/CustomizableDashboard";
import { TemporalAnalysis } from "@/components/analytics/TemporalAnalysis";
import { useAuth } from "@/contexts/AuthContext";

const Analytics = () => {
  const {
    loading,
    patterns,
    qualityScores,
    predictions,
    recommendations,
    metrics,
    chartData
  } = useAIInsights();
  const ordersQuery = useOrders();
  const { user } = useAuth();

  // Dados para distribuição de status
  const statusDistributionData = [
    { name: "Entregue", value: 65, color: "#22c55e" },
    { name: "Em Trânsito", value: 25, color: "#3b82f6" },
    { name: "Atrasado", value: 7, color: "#f59e0b" },
    { name: "Cancelado", value: 3, color: "#ef4444" },
  ];

  // Dados de tendência temporal (últimos 30 dias)
  const trendData = chartData.trendData.map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })
  }));

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div>
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
        </div>

        {/* AI Recommendations Skeleton */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-80" />
            </CardHeader>
            <CardContent>
              <SkeletonList items={3} />
            </CardContent>
          </Card>
        </div>

        {/* Tabs Skeleton */}
        <div className="space-y-6">
          <Skeleton className="h-10 w-full" />
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <SkeletonChart />
            <SkeletonChart />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link to="/dashboard">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold mb-2">Analytics Avançado</h1>
            <p className="text-muted-foreground">
              Insights inteligentes e métricas detalhadas sobre suas entregas
            </p>
          </div>
          </div>
        </div>

          {/* AI Recommendations */}
          <div className="mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Recomendações de IA
                </CardTitle>
                <CardDescription>
                  Sugestões inteligentes baseadas nos dados das suas entregas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recommendations.length === 0 ? (
                  <EmptyState
                    variant="analytics"
                    title="Aguardando dados para análise"
                    description="Assim que você tiver pedidos suficientes, nossa IA começará a gerar recomendações personalizadas para otimizar suas entregas e reduzir custos."
                    actions={[
                      {
                        label: "Importar Pedidos",
                        href: "/dashboard/importar",
                        variant: "default",
                        icon: Upload
                      },
                      {
                        label: "Ver Dashboard",
                        href: "/dashboard",
                        variant: "outline",
                        icon: BarChart3
                      }
                    ]}
                    metrics={[
                      { label: "Pedidos Analisados", value: ordersQuery.data?.length || 0, icon: Package },
                      { label: "Recomendações", value: "0", icon: Lightbulb },
                      { label: "Economia Potencial", value: "R$ 0", icon: DollarSign }
                    ]}
                    tips={[
                      "Adicione pelo menos 10 pedidos para ver primeiras recomendações",
                      "Quanto mais dados, mais precisas são as sugestões da IA",
                      "Recomendações são atualizadas automaticamente conforme novos dados"
                    ]}
                  />
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recommendations.map((rec, index) => (
                      <div key={index} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-2">
                          {rec.type === "carrier_switch" && <Truck className="w-4 h-4 text-blue-600" />}
                          {rec.type === "region_optimization" && <MapPin className="w-4 h-4 text-green-600" />}
                          {rec.type === "timing_adjustment" && <Clock className="w-4 h-4 text-orange-600" />}
                          {rec.type === "bulk_shipping" && <Package className="w-4 h-4 text-purple-600" />}
                          <Badge variant={rec.impact === "high" ? "destructive" : rec.impact === "medium" ? "secondary" : "outline"}>
                            {rec.impact === "high" ? "Alta Prioridade" : rec.impact === "medium" ? "Média" : "Baixa"}
                          </Badge>
                        </div>
                        <h4 className="font-semibold mb-1">{rec.title}</h4>
                        <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Confiança: {rec.confidence}%</span>
                          <span className="font-medium text-green-600">
                            <DollarSign className="w-3 h-3 inline" />
                            R$ {rec.potential_savings}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="carriers">Transportadoras</TabsTrigger>
          <TabsTrigger value="regions">Regiões</TabsTrigger>
          <TabsTrigger value="ai-insights">IA Insights</TabsTrigger>
          <TabsTrigger value="advanced">Avançado</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {ordersQuery.data && ordersQuery.data.length > 0 ? (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                                    <div className="text-2xl font-bold">{ordersQuery.data?.length || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-green-600 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        +12%
                      </span>
                      vs mês passado
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Entregas no Prazo</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics?.on_time_deliveries || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-green-600 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        +2.1%
                      </span>
                      vs mês passado
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics?.average_delivery_time || 0} dias</div>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-red-600 flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" />
                        +0.2 dias
                      </span>
                      vs mês passado
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Precisão da IA</CardTitle>
                    <Brain className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics?.ai_accuracy || 0}%</div>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-green-600 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        +1.2%
                      </span>
                      vs semana passada
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Distribuição de Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={statusDistributionData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {statusDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Tendência de Performance</CardTitle>
                    <CardDescription>Entregas no prazo vs atrasadas nos últimos 30 dias</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="onTime"
                          stackId="1"
                          stroke="#22c55e"
                          fill="#22c55e"
                          fillOpacity={0.6}
                          name="No Prazo"
                        />
                        <Area
                          type="monotone"
                          dataKey="delayed"
                          stackId="1"
                          stroke="#f59e0b"
                          fill="#f59e0b"
                          fillOpacity={0.6}
                          name="Atrasadas"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Potencial de Economia */}
              {metrics?.potential_savings && metrics.potential_savings > 0 && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-800">
                      <DollarSign className="w-5 h-5" />
                      Potencial de Economia Identificado
                    </CardTitle>
                    <CardDescription className="text-green-700">
                      Com base nas recomendações de IA, você pode economizar até R$ {metrics.potential_savings} mensalmente
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">
                      R$ {metrics.potential_savings.toLocaleString('pt-BR')}
                    </div>
                    <p className="text-sm text-green-700 mt-2">
                      Implementando as {recommendations.length} recomendações sugeridas
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <EmptyState
              variant="analytics"
              title="Analytics aguardando dados"
              description="Para ver métricas avançadas, insights de IA e gráficos detalhados, você precisa ter pedidos cadastrados no sistema."
              actions={[
                {
                  label: "Importar Pedidos",
                  href: "/dashboard/importar",
                  variant: "hero",
                  icon: Upload
                },
                {
                  label: "Adicionar Manualmente",
                  href: "/dashboard",
                  variant: "outline",
                  icon: Plus
                }
              ]}
              metrics={[
                { label: "Pedidos Cadastrados", value: "0", icon: Package },
                { label: "Insights Disponíveis", value: "0", icon: Brain },
                { label: "Relatórios", value: "0", icon: FileText }
              ]}
              tips={[
                "Comece importando seus pedidos existentes",
                "Quanto mais dados, mais precisas são as análises",
                "Configure integrações para sincronização automática"
              ]}
            />
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          {ordersQuery.data && ordersQuery.data.length > 0 ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Métricas de Performance Detalhadas</CardTitle>
                  <CardDescription>
                    Análise profunda do desempenho das suas entregas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Taxa de Entrega no Prazo</span>
                        <span className="text-sm text-muted-foreground">
                          {metrics ? Math.round((metrics.on_time_deliveries / metrics.total_orders) * 100) : 0}%
                        </span>
                      </div>
                      <Progress
                        value={metrics ? (metrics.on_time_deliveries / metrics.total_orders) * 100 : 0}
                        className="h-2"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Score Médio das Transportadoras</span>
                        <span className="text-sm text-muted-foreground">
                          {qualityScores.length > 0
                            ? Math.round(qualityScores.reduce((sum, score) => sum + score.overall_score, 0) / qualityScores.length)
                            : 0}/100
                        </span>
                      </div>
                      <Progress
                        value={qualityScores.length > 0
                          ? qualityScores.reduce((sum, score) => sum + score.overall_score, 0) / qualityScores.length
                          : 0}
                        className="h-2"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Precisão das Previsões de IA</span>
                        <span className="text-sm text-muted-foreground">{metrics?.ai_accuracy || 0}%</span>
                      </div>
                      <Progress value={metrics?.ai_accuracy || 0} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Previsões de Entrega em Risco</CardTitle>
                  <CardDescription>
                    Pedidos que podem sofrer atrasos baseados na análise de IA
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {predictions.filter(p => p.confidence_level < 75).map((prediction) => (
                      <div key={prediction.order_id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="w-5 h-5 text-orange-600" />
                          <div>
                            <p className="font-medium">Pedido #{prediction.order_id.slice(-8)}</p>
                            <p className="text-sm text-muted-foreground">
                              {prediction.carrier} • {prediction.estimated_days} dias previstos
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={prediction.confidence_level < 60 ? "destructive" : "secondary"}>
                            {prediction.confidence_level}% confiança
                          </Badge>
                          {prediction.risk_factors.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {prediction.risk_factors[0]}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    {predictions.filter(p => p.confidence_level < 75).length === 0 && (
                      <EmptyState
                        variant="success"
                        title="Nenhuma entrega em risco"
                        description="Excelente! Todas as suas entregas estão dentro dos parâmetros normais de tempo e não há previsões de atrasos baseados na análise de IA."
                        badge={{ text: "Tudo OK", variant: "success" }}
                        metrics={[
                          { label: "Entregas no Prazo", value: "100%", icon: CheckCircle },
                          { label: "Riscos Identificados", value: "0", icon: Shield },
                          { label: "Performance Geral", value: "Excelente", icon: TrendingUp }
                        ]}
                        tips={[
                          "Continue monitorando para manter a performance",
                          "Configure alertas para ser notificado de mudanças",
                          "A análise de IA previne atrasos automaticamente"
                        ]}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <EmptyState
              variant="analytics"
              title="Performance aguardando dados"
              description="Para ver métricas detalhadas de performance, previsões de risco e análises profundas, você precisa ter pedidos cadastrados."
              actions={[
                {
                  label: "Importar Pedidos",
                  href: "/dashboard/importar",
                  variant: "hero",
                  icon: Upload
                }
              ]}
              badge={{ text: "Performance", variant: "default" }}
              tips={[
                "Adicione pedidos para ver taxas de entrega no prazo",
                "Acompanhe o desempenho de cada transportadora",
                "Receba alertas sobre entregas em risco"
              ]}
            />
          )}
        </TabsContent>

        <TabsContent value="carriers" className="space-y-6">
          {qualityScores.length > 0 ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Comparativo de Transportadoras</CardTitle>
                  <CardDescription>
                    Performance e eficiência de cada transportadora baseada em dados reais
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData.carrierPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="carrier" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="score" fill="#3b82f6" name="Score Geral" />
                      <Bar dataKey="timeliness" fill="#22c55e" name="Pontualidade" />
                      <Bar dataKey="reliability" fill="#f59e0b" name="Confiabilidade" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {qualityScores.map((score) => (
                  <Card key={score.carrier}>
                    <CardHeader>
                      <CardTitle className="capitalize flex items-center justify-between">
                        {score.carrier.replace("_", " ")}
                        <Badge variant={
                          score.overall_score >= 80 ? "default" :
                          score.overall_score >= 60 ? "secondary" : "destructive"
                        }>
                          {score.overall_score}/100
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Pontualidade</span>
                          <span className="font-semibold">{score.timeliness_score}%</span>
                        </div>
                        <Progress value={score.timeliness_score} className="h-1" />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Confiabilidade</span>
                          <span className="font-semibold">{score.reliability_score}%</span>
                        </div>
                        <Progress value={score.reliability_score} className="h-1" />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Satisfação</span>
                          <span className="font-semibold">{score.customer_satisfaction}%</span>
                        </div>
                        <Progress value={score.customer_satisfaction} className="h-1" />
                      </div>

                      <div className="pt-2 border-t">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Tendência:</span>
                          <Badge variant={
                            score.trend === 'improving' ? 'default' :
                            score.trend === 'stable' ? 'secondary' : 'destructive'
                          }>
                            {score.trend === 'improving' ? 'Melhorando' :
                             score.trend === 'stable' ? 'Estável' : 'Declinando'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              variant="data"
              title="Dados de transportadoras indisponíveis"
              description="Para ver comparações detalhadas entre transportadoras, scores de performance e tendências, você precisa ter pedidos processados por diferentes transportadoras."
              actions={[
                {
                  label: "Importar Pedidos",
                  href: "/dashboard/importar",
                  variant: "hero",
                  icon: Upload
                }
              ]}
              badge={{ text: "Transportadoras", variant: "secondary" }}
              metrics={[
                { label: "Transportadoras Avaliadas", value: "0", icon: Truck },
                { label: "Pedidos Analisados", value: "0", icon: Package },
                { label: "Score Médio", value: "0/100", icon: Star }
              ]}
              tips={[
                "Importe pedidos de diferentes transportadoras",
                "Quanto mais dados por transportadora, melhor a avaliação",
                "Acompanhe tendências de performance ao longo do tempo"
              ]}
            />
          )}
        </TabsContent>

        <TabsContent value="regions" className="space-y-6">
          {patterns.length > 0 ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Performance por Região</CardTitle>
                  <CardDescription>
                    Análise de entrega por região de destino
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData.regionPatterns}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="region" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="on_time_percentage" fill="#22c55e" name="No Prazo (%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-6">
                {patterns.map((pattern) => (
                  <Card key={`${pattern.carrier}-${pattern.region}`}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{pattern.region}</span>
                        <Badge variant="outline">{pattern.carrier}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {pattern.on_time_percentage}%
                          </div>
                          <p className="text-xs text-muted-foreground">No Prazo</p>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold">
                            {pattern.average_delivery_time}
                          </div>
                          <p className="text-xs text-muted-foreground">Dias Médios</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Total de Entregas</span>
                          <span className="font-semibold">{pattern.total_deliveries}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Taxa de Sucesso</span>
                          <span className="font-semibold">{pattern.success_rate}%</span>
                        </div>
                        {pattern.delay_average_days > 0 && (
                          <div className="flex justify-between text-sm">
                            <span>Atraso Médio</span>
                            <span className="font-semibold text-orange-600">
                              {pattern.delay_average_days} dias
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              variant="data"
              title="Dados regionais indisponíveis"
              description="Para ver análises de performance por região, padrões de entrega e otimização geográfica, você precisa ter pedidos com destinos em diferentes regiões."
              actions={[
                {
                  label: "Importar Pedidos",
                  href: "/dashboard/importar",
                  variant: "hero",
                  icon: Upload
                }
              ]}
              badge={{ text: "Regional", variant: "info" }}
              metrics={[
                { label: "Regiões Analisadas", value: "0", icon: MapPin },
                { label: "Padrões Identificados", value: "0", icon: Target },
                { label: "Otimização Possível", value: "0%", icon: TrendingUp }
              ]}
              tips={[
                "Importe pedidos com diferentes destinos",
                "Quanto mais regiões, melhor a análise geográfica",
                "Identifique regiões com melhor performance"
              ]}
            />
          )}
        </TabsContent>        <TabsContent value="ai-insights" className="space-y-6">
          {recommendations.length > 0 ? (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendations.map((recommendation, index) => (
                  <Card key={index} className="relative overflow-hidden">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-purple-600" />
                        {recommendation.title}
                      </CardTitle>
                      <Badge variant={recommendation.impact === 'high' ? 'destructive' : recommendation.impact === 'medium' ? 'default' : 'secondary'}>
                        {recommendation.impact === 'high' ? 'Alta' : recommendation.impact === 'medium' ? 'Média' : 'Baixa'}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        {recommendation.description}
                      </p>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Impacto Estimado</span>
                          <span className="font-semibold text-green-600">
                            R$ {recommendation.potential_savings}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Confiança</span>
                          <span className="font-semibold">{recommendation.confidence}%</span>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-1" />
                          Ver Detalhes
                        </Button>
                        <Button size="sm" variant="outline">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Aplicar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recomendações de Otimização</CardTitle>
                  <CardDescription>
                    Sugestões baseadas em IA para melhorar sua operação logística
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recommendations.slice(0, 3).map((recommendation, index) => (
                      <div key={index} className="flex items-start gap-4 p-4 border rounded-lg">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                            <Lightbulb className="h-4 w-4 text-purple-600" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold">{recommendation.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {recommendation.description}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            <Badge variant="outline" className="text-xs">
                              Impacto: R$ {recommendation.potential_savings}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Confiança: {recommendation.confidence}%
                            </Badge>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <EmptyState
              variant="ai"
              title="Insights de IA indisponíveis"
              description="Para receber recomendações inteligentes, otimização automática e previsões baseadas em IA, você precisa ter dados históricos de pedidos e entregas."
              actions={[
                {
                  label: "Importar Dados Históricos",
                  href: "/dashboard/importar",
                  variant: "hero",
                  icon: Upload
                },
                {
                  label: "Configurar Integrações",
                  href: "/dashboard/configuracoes",
                  variant: "outline",
                  icon: Settings
                }
              ]}
              badge={{ text: "IA", variant: "secondary" }}
              metrics={[
                { label: "Insights Gerados", value: "0", icon: Brain },
                { label: "Otimização Possível", value: "0%", icon: TrendingUp },
                { label: "Previsões Disponíveis", value: "0", icon: Eye }
              ]}
              tips={[
                "Quanto mais dados históricos, melhores os insights",
                "Configure integrações para dados em tempo real",
                "A IA aprende com seus padrões de entrega"
              ]}
            />
          )}
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          {ordersQuery.data && ordersQuery.data.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Dashboards Customizáveis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">∞</div>
                    <p className="text-xs text-muted-foreground">
                      Widgets ilimitados
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Relatórios Exportáveis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">PDF/Excel</div>
                    <p className="text-xs text-muted-foreground">
                      Exportação profissional
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Análise Temporal
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">Histórica</div>
                    <p className="text-xs text-muted-foreground">
                      Tendências ao longo do tempo
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="dashboard" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="dashboard" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Dashboard
                  </TabsTrigger>
                  <TabsTrigger value="temporal" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Temporal
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Relatórios
                  </TabsTrigger>
                </TabsList>

                <div className="mt-6">
                  <TabsContent value="dashboard" className="space-y-4">
                    {user?.id ? (
                      <CustomizableDashboard userId={user.id} />
                    ) : (
                      <EmptyState
                        variant="error"
                        title="Acesso não autorizado"
                        description="Você precisa estar logado para acessar os dashboards personalizados e análises avançadas."
                        actions={[
                          {
                            label: "Fazer Login",
                            href: "/login",
                            variant: "hero",
                            icon: LogIn
                          }
                        ]}
                        badge={{ text: "Autenticação", variant: "destructive" }}
                        tips={[
                          "Faça login para acessar suas análises",
                          "Seus dados são mantidos seguros e privados",
                          "Acesse de qualquer dispositivo após o login"
                        ]}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="temporal" className="space-y-4">
                    {user?.id ? (
                      <TemporalAnalysis userId={user.id} />
                    ) : (
                      <EmptyState
                        variant="error"
                        title="Acesso não autorizado"
                        description="Você precisa estar logado para visualizar análises temporais e tendências históricas dos seus dados."
                        actions={[
                          {
                            label: "Fazer Login",
                            href: "/login",
                            variant: "hero",
                            icon: LogIn
                          }
                        ]}
                        badge={{ text: "Autenticação", variant: "destructive" }}
                        tips={[
                          "Faça login para acessar suas análises",
                          "Seus dados são mantidos seguros e privados",
                          "Acesse de qualquer dispositivo após o login"
                        ]}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="reports" className="space-y-4">
                    {user?.id ? (
                      <ReportGenerator userId={user.id} />
                    ) : (
                      <EmptyState
                        variant="error"
                        title="Acesso não autorizado"
                        description="Você precisa estar logado para gerar relatórios personalizados e exportar dados analíticos."
                        actions={[
                          {
                            label: "Fazer Login",
                            href: "/login",
                            variant: "hero",
                            icon: LogIn
                          }
                        ]}
                        badge={{ text: "Autenticação", variant: "destructive" }}
                        tips={[
                          "Faça login para acessar suas análises",
                          "Seus dados são mantidos seguros e privados",
                          "Acesse de qualquer dispositivo após o login"
                        ]}
                      />
                    )}
                  </TabsContent>
                </div>
              </Tabs>
            </>
          ) : (
            <EmptyState
              variant="advanced"
              title="Análises avançadas indisponíveis"
              description="Para acessar dashboards customizáveis, relatórios exportáveis e análises temporais profundas, você precisa ter dados históricos de pedidos."
              actions={[
                {
                  label: "Importar Dados Históricos",
                  href: "/dashboard/importar",
                  variant: "hero",
                  icon: Upload
                },
                {
                  label: "Criar Primeiro Relatório",
                  href: "/dashboard/relatorios",
                  variant: "outline",
                  icon: FileText
                }
              ]}
              badge={{ text: "Avançado", variant: "outline" }}
              metrics={[
                { label: "Dashboards Criados", value: "0", icon: BarChart3 },
                { label: "Relatórios Gerados", value: "0", icon: FileText },
                { label: "Análises Temporais", value: "0", icon: Calendar }
              ]}
              tips={[
                "Importe dados históricos para análises profundas",
                "Crie dashboards personalizados para seu negócio",
                "Exporte relatórios profissionais em PDF/Excel"
              ]}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;