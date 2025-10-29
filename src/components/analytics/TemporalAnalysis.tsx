import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, TrendingUp, TrendingDown, BarChart3, LineChart, Upload } from 'lucide-react'
import EmptyState from '@/components/EmptyState'
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  Area,
  AreaChart as RechartsAreaChart
} from 'recharts'
import { AnalyticsService } from '@/services/analytics'
import { useToast } from '@/hooks/use-toast'
import { format, subDays, subWeeks, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface TemporalAnalysisProps {
  userId: string
}

interface TimeSeriesData {
  date: string
  value: number
  label?: string
}

type ChartType = 'line' | 'bar' | 'area'
type TimeRange = '7d' | '30d' | '90d' | '1y'

export const TemporalAnalysis: React.FC<TemporalAnalysisProps> = ({ userId }) => {
  const [metricType, setMetricType] = useState<string>('orders')
  const [metricName, setMetricName] = useState<string>('total_orders')
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [chartType, setChartType] = useState<ChartType>('line')
  const [data, setData] = useState<TimeSeriesData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [comparisonData, setComparisonData] = useState<{
    current: number
    previous: number
    change: number
    changePercent: number
  } | null>(null)
  const { toast } = useToast()

  const metricOptions = [
    {
      type: 'orders',
      name: 'total_orders',
      label: 'Total de Pedidos',
      description: 'Número total de pedidos'
    },
    {
      type: 'orders',
      name: 'delivered_orders',
      label: 'Pedidos Entregues',
      description: 'Pedidos finalizados com sucesso'
    },
    {
      type: 'revenue',
      name: 'total_revenue',
      label: 'Receita Total',
      description: 'Valor total em vendas'
    },
    {
      type: 'tracking',
      name: 'active_trackings',
      label: 'Rastreamentos Ativos',
      description: 'Pedidos sendo rastreados'
    },
    {
      type: 'performance',
      name: 'success_rate',
      label: 'Taxa de Sucesso',
      description: 'Percentual de entregas bem-sucedidas'
    }
  ]

  const timeRangeOptions = useMemo(() => [
    { value: '7d', label: 'Últimos 7 dias', days: 7 },
    { value: '30d', label: 'Últimos 30 dias', days: 30 },
    { value: '90d', label: 'Últimos 90 dias', days: 90 },
    { value: '1y', label: 'Último ano', days: 365 }
  ], [])

  const chartTypeOptions = useMemo(() => [
    { value: 'line', label: 'Linha', icon: LineChart },
    { value: 'bar', label: 'Barras', icon: BarChart3 },
    { value: 'area', label: 'Área', icon: TrendingUp }
  ], [])

  const loadData = useCallback(async () => {
    const getDateRange = (range: TimeRange) => {
      const now = new Date()
      const days = timeRangeOptions.find(opt => opt.value === range)?.days || 30
      const startDate = subDays(now, days)
      return {
        start: startDate.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0]
      }
    }

    setIsLoading(true)
    try {
      const dateRange = getDateRange(timeRange)

      // Carregar dados da série temporal
      const timeSeriesData = await AnalyticsService.getTimeSeriesData(
        userId,
        metricType as 'orders' | 'revenue' | 'tracking' | 'integrations' | 'users' | 'performance',
        metricName,
        dateRange,
        'day'
      )

      setData(timeSeriesData)

      // Carregar dados de comparação
      const now = new Date()
      const currentPeriod = dateRange
      const previousPeriod = {
        start: subDays(new Date(dateRange.start), timeRangeOptions.find(opt => opt.value === timeRange)?.days || 30).toISOString().split('T')[0],
        end: subDays(new Date(dateRange.start), 1).toISOString().split('T')[0]
      }

      const comparison = await AnalyticsService.getComparisonData(
        userId,
        metricType as 'orders' | 'revenue' | 'tracking' | 'integrations' | 'users' | 'performance',
        metricName,
        currentPeriod,
        previousPeriod
      )

      setComparisonData({
        current: comparison.current,
        previous: comparison.previous,
        change: comparison.change,
        changePercent: comparison.changePercent
      })

    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados de análise.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }, [userId, metricType, metricName, timeRange, toast, timeRangeOptions])

  useEffect(() => {
    loadData()
  }, [loadData])

  const renderChart = () => {
    if (data.length === 0) {
      return (
        <EmptyState
          variant="analytics"
          title="Nenhum dado temporal disponível"
          description="Para visualizar tendências e análises temporais, você precisa ter dados históricos de pedidos. Quanto mais dados você importar, mais precisas serão as análises de performance ao longo do tempo."
          actions={[
            {
              label: "Importar Pedidos",
              href: "/dashboard/importar",
              variant: "hero",
              icon: Upload
            },
            {
              label: "Ver Dashboard",
              href: "/dashboard",
              variant: "outline",
              icon: BarChart3
            }
          ]}
          badge={{ text: "Análise Temporal", variant: "secondary" }}
          metrics={[
            { label: "Pontos de Dados", value: "0", icon: TrendingUp },
            { label: "Períodos Analisados", value: "0", icon: Calendar },
            { label: "Tendências Identificadas", value: "0", icon: TrendingDown }
          ]}
          tips={[
            "Importe dados históricos para ver tendências",
            "Quanto mais períodos, melhor a análise temporal",
            "Configure alertas para mudanças significativas"
          ]}
        />
      )
    }

    const chartProps = {
      data,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    }

    switch (chartType) {
      case 'bar':
        return (
          <RechartsBarChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: ptBR })}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(value) => format(new Date(value), 'dd/MM/yyyy', { locale: ptBR })}
              formatter={(value: number) => [value.toLocaleString('pt-BR'), 'Valor']}
            />
            <Bar dataKey="value" fill="#3b82f6" />
          </RechartsBarChart>
        )
      case 'area':
        return (
          <RechartsAreaChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: ptBR })}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(value) => format(new Date(value), 'dd/MM/yyyy', { locale: ptBR })}
              formatter={(value: number) => [value.toLocaleString('pt-BR'), 'Valor']}
            />
            <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
          </RechartsAreaChart>
        )
      default:
        return (
          <RechartsLineChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: ptBR })}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(value) => format(new Date(value), 'dd/MM/yyyy', { locale: ptBR })}
              formatter={(value: number) => [value.toLocaleString('pt-BR'), 'Valor']}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </RechartsLineChart>
        )
    }
  }

  const selectedMetric = metricOptions.find(m => m.type === metricType && m.name === metricName)
  const selectedTimeRange = timeRangeOptions.find(tr => tr.value === timeRange)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Análise Temporal
          </CardTitle>
          <CardDescription>
            Visualize tendências e padrões ao longo do tempo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Métrica</label>
              <Select value={`${metricType}:${metricName}`} onValueChange={(value) => {
                const [type, name] = value.split(':')
                setMetricType(type)
                setMetricName(name)
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {metricOptions.map((metric) => (
                    <SelectItem key={`${metric.type}:${metric.name}`} value={`${metric.type}:${metric.name}`}>
                      <div>
                        <div className="font-medium">{metric.label}</div>
                        <div className="text-sm text-muted-foreground">{metric.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeRangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Gráfico</label>
              <Select value={chartType} onValueChange={(value) => setChartType(value as ChartType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {chartTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ações</label>
              <Button onClick={loadData} disabled={isLoading} variant="outline" className="w-full">
                {isLoading ? 'Carregando...' : 'Atualizar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {comparisonData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{comparisonData.current.toLocaleString('pt-BR')}</div>
              <p className="text-xs text-muted-foreground">Período Atual</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{comparisonData.previous.toLocaleString('pt-BR')}</div>
              <p className="text-xs text-muted-foreground">Período Anterior</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className={`text-2xl font-bold flex items-center gap-1 ${
                comparisonData.change >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {comparisonData.change >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {Math.abs(comparisonData.change).toLocaleString('pt-BR')}
              </div>
              <p className="text-xs text-muted-foreground">Diferença</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className={`text-2xl font-bold flex items-center gap-1 ${
                comparisonData.changePercent >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {comparisonData.changePercent >= 0 ? '+' : ''}
                {comparisonData.changePercent.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">Variação</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {selectedMetric?.label} - {selectedTimeRange?.label}
            </span>
            <Badge variant="secondary">
              {data.length} pontos de dados
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}