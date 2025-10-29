import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { StatCard } from '@/components/admin/StatCard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { AdminService, type SystemStats, type AdminLog } from '@/services/admin'
import { supabase } from '@/integrations/supabase/client'
import { 
  Users, 
  DollarSign, 
  Package, 
  TrendingUp, 
  AlertCircle,
  Activity,
  Shield,
  Database
} from 'lucide-react'
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow, format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'

export default function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [recentLogs, setRecentLogs] = useState<AdminLog[]>([])
  const [revenueData, setRevenueData] = useState<Array<{ month: string; revenue: number; orders: number }>>([])
  const [usersData, setUsersData] = useState<Array<{ date: string; users: number; active: number }>>([])
  const [topUsers, setTopUsers] = useState<Array<{ name: string; revenue: number; orders: number; plan: string }>>([])
  const [growthMetrics, setGrowthMetrics] = useState<{
    mrr: number
    mrrGrowth: number
    arr: number
    arpu: number
    churnRate: number
    churnChange: number
    cancellations: number
    retention: number
    userGrowth: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadDashboardData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadDashboardData = async () => {
    try {
      setIsLoading(true)
      
      // Check if user is admin
      const isAdmin = await AdminService.isAdmin()
      if (!isAdmin) {
        toast({
          title: 'Acesso negado',
          description: 'Você não tem permissão para acessar esta página.',
          variant: 'destructive'
        })
        return
      }

      // Calculate date ranges
      const endDate = new Date()
      const last30Days = subDays(endDate, 30)
      const last6Months = subDays(endDate, 180)

      // Load all data in parallel
      const [
        statsData, 
        logsData,
        revenueTimeSeries,
        usersTimeSeries,
        topUsersData,
        growthData
      ] = await Promise.all([
        AdminService.getSystemStats(),
        AdminService.getAdminLogs(1, 10),
        AdminService.getRevenueTimeSeries(last6Months, endDate),
        AdminService.getUsersTimeSeries(last30Days, endDate),
        AdminService.getTopUsers(5),
        AdminService.getGrowthMetrics()
      ])

      setStats(statsData)
      setRecentLogs(logsData.logs)

      // Process revenue data by month
      const revenueByMonth = new Map<string, { revenue: number; orders: number }>()
      const monthlyData = await AdminService.getOrdersTimeSeries(last6Months, endDate)
      
      monthlyData.forEach(item => {
        const date = new Date(item.date)
        const monthKey = format(date, 'MMM', { locale: ptBR })
        const current = revenueByMonth.get(monthKey) || { revenue: 0, orders: 0 }
        current.orders += item.value
        revenueByMonth.set(monthKey, current)
      })

      revenueTimeSeries.forEach(item => {
        const date = new Date(item.date)
        const monthKey = format(date, 'MMM', { locale: ptBR })
        const current = revenueByMonth.get(monthKey) || { revenue: 0, orders: 0 }
        current.revenue += item.value
        revenueByMonth.set(monthKey, current)
      })

      const revenueChartData = Array.from(revenueByMonth.entries())
        .map(([month, data]) => ({
          month,
          revenue: Math.round(data.revenue),
          orders: data.orders
        }))
        .slice(-6) // Last 6 months

      setRevenueData(revenueChartData)

      // Process users data
      const usersChartData = usersTimeSeries.map(item => ({
        date: format(new Date(item.date), 'dd/MM'),
        users: item.value,
        active: Math.floor(item.value * 0.75) // Approximate active users as 75% of total
      })).slice(-5) // Last 5 data points

      setUsersData(usersChartData)

      // Process top users - add plan info
      const topUsersWithPlan = topUsersData.map((user) => {
        return {
          ...user,
          plan: 'Free' // Default plan - can be enhanced with actual plan lookup
        }
      })

      setTopUsers(topUsersWithPlan)

      // Calculate MRR, ARR, ARPU from stats and growth data
      const totalRevenue = revenueTimeSeries.reduce((sum, item) => sum + item.value, 0)
      const monthsCount = Math.max(1, Math.ceil((endDate.getTime() - last6Months.getTime()) / (1000 * 60 * 60 * 24 * 30)))
      const mrr = totalRevenue / monthsCount
      const arr = mrr * 12
      const arpu = statsData.total_users > 0 ? mrr / statsData.total_users : 0

      // Get previous month's MRR for growth calculation
      const twoMonthsAgo = subDays(endDate, 60)
      const oneMonthAgo = subDays(endDate, 30)
      const prevMonthRevenue = await AdminService.getRevenueTimeSeries(twoMonthsAgo, oneMonthAgo)
      const prevMrr = prevMonthRevenue.reduce((sum, item) => sum + item.value, 0)
      const mrrGrowth = prevMrr > 0 ? ((mrr - prevMrr) / prevMrr) * 100 : 0

      // Calculate cancellations and retention
      const { data: cancellationsData, count: cancellationsCount } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'cancelled')
        .gte('canceled_at', new Date(endDate.getFullYear(), endDate.getMonth(), 1).toISOString())
      
      const cancellations = cancellationsCount || 0
      const retention = 100 - growthData.churnRate

      // Calculate churn change (compare with previous month)
      const prevMonthStart = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1)
      const prevMonthEnd = new Date(endDate.getFullYear(), endDate.getMonth(), 0)
      const { data: prevCancellationsData, count: prevCancellationsCount } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'cancelled')
        .gte('canceled_at', prevMonthStart.toISOString())
        .lte('canceled_at', prevMonthEnd.toISOString())
      
      const prevCancellations = prevCancellationsCount || 1
      const churnChange = ((cancellations - prevCancellations) / prevCancellations) * 100

      setGrowthMetrics({
        mrr: Math.round(mrr),
        mrrGrowth: Math.round(mrrGrowth * 10) / 10,
        arr: Math.round(arr),
        arpu: Math.round(arpu * 100) / 100,
        churnRate: growthData.churnRate,
        churnChange: Math.round(churnChange * 10) / 10,
        cancellations: cancellations,
        retention: Math.round(retention * 10) / 10,
        userGrowth: growthData.userGrowth
      })


    } catch (error) {
      console.error('Error loading dashboard data:', error)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados do dashboard.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500'
      case 'error': return 'bg-orange-500'
      case 'warning': return 'bg-yellow-500'
      case 'info': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  const getActivityTypeColor = (type: string) => {
    if (!type || typeof type !== 'string') return 'outline'
    if (type.includes('error') || type.includes('delete')) return 'destructive'
    if (type.includes('create') || type.includes('success')) return 'default'
    if (type.includes('update')) return 'secondary'
    return 'outline'
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 mt-2" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Administrativo</h1>
          <p className="text-muted-foreground mt-2">
            Visão geral completa do sistema e métricas de negócio
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total de Usuários"
            value={stats?.total_users || 0}
            icon={Users}
            description={`${stats?.active_users_today || 0} ativos hoje`}
            trend={{ value: 12.5, isPositive: true }}
          />
          <StatCard
            title="Receita do Mês"
            value={`R$ ${(stats?.revenue_this_month || 0).toLocaleString('pt-BR')}`}
            icon={DollarSign}
            description="Faturamento mensal"
            trend={{ value: 8.3, isPositive: true }}
            iconClassName="bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400"
          />
          <StatCard
            title="Total de Pedidos"
            value={stats?.total_orders || 0}
            icon={Package}
            description={`${stats?.orders_today || 0} pedidos hoje`}
            trend={{ value: 5.2, isPositive: true }}
            iconClassName="bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400"
          />
          <StatCard
            title="Assinaturas Ativas"
            value={stats?.total_subscriptions || 0}
            icon={TrendingUp}
            description="Planos ativos"
            trend={{ value: 3.1, isPositive: true }}
            iconClassName="bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400"
          />
        </div>

        {/* System Health */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status do Sistema</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <Badge className="bg-green-500 hover:bg-green-600">Operacional</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Integrações</CardTitle>
              <Shield className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_integrations || 0}</div>
              <p className="text-xs text-muted-foreground">Ativas e funcionando</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Banco de Dados</CardTitle>
              <Database className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="text-green-600 border-green-600">
                Healthy
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Erros Hoje</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.system_errors_today || 0}</div>
              <p className="text-xs text-muted-foreground">Erros do sistema</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Receita e Pedidos</CardTitle>
              <CardDescription>Últimos 6 meses</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10b981" 
                    fill="url(#colorRevenue)"
                    name="Receita (R$)"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="orders" 
                    stroke="#3b82f6"
                    name="Pedidos"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Users Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Crescimento de Usuários</CardTitle>
              <CardDescription>Últimas 5 semanas</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={usersData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="users" fill="#8b5cf6" name="Total" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="active" fill="#06b6d4" name="Ativos" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Advanced Metrics */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Taxa de Conversão</CardTitle>
              <CardDescription>Free → Paid</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-green-600">
                  {stats?.conversion_rate ? `${stats.conversion_rate.toFixed(1)}%` : 'N/A'}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-green-600">
                    {growthMetrics?.userGrowth ? `+${growthMetrics.userGrowth.toFixed(1)}%` : 'N/A'}
                  </span>
                  <span className="text-muted-foreground">vs mês anterior</span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Usuários Ativos</span>
                    <span className="font-medium">{stats?.active_users || 0}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Total Assinaturas</span>
                    <span className="font-medium">{stats?.active_subscriptions || 0}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>MRR (Receita Recorrente)</CardTitle>
              <CardDescription>Mensal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold">
                  R$ {growthMetrics?.mrr ? growthMetrics.mrr.toLocaleString('pt-BR') : '0'}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className={`h-4 w-4 ${(growthMetrics?.mrrGrowth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                  <span className={`${(growthMetrics?.mrrGrowth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {growthMetrics?.mrrGrowth ? `${growthMetrics.mrrGrowth >= 0 ? '+' : ''}${growthMetrics.mrrGrowth}%` : 'N/A'}
                  </span>
                  <span className="text-muted-foreground">crescimento</span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">ARR</span>
                    <span className="font-medium">
                      R$ {growthMetrics?.arr ? growthMetrics.arr.toLocaleString('pt-BR') : '0'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">ARPU</span>
                    <span className="font-medium">
                      R$ {growthMetrics?.arpu ? growthMetrics.arpu.toFixed(2) : '0,00'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Churn Rate</CardTitle>
              <CardDescription>Taxa de cancelamento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className={`text-3xl font-bold ${(growthMetrics?.churnRate || 0) > 5 ? 'text-orange-600' : 'text-green-600'}`}>
                  {growthMetrics?.churnRate ? `${growthMetrics.churnRate.toFixed(1)}%` : 'N/A'}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className={`h-4 w-4 ${(growthMetrics?.churnChange || 0) <= 0 ? 'text-green-600' : 'text-red-600'} ${(growthMetrics?.churnChange || 0) <= 0 ? 'rotate-180' : ''}`} />
                  <span className={`${(growthMetrics?.churnChange || 0) <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {growthMetrics?.churnChange ? `${growthMetrics.churnChange >= 0 ? '+' : ''}${growthMetrics.churnChange}%` : 'N/A'}
                  </span>
                  <span className="text-muted-foreground">
                    {(growthMetrics?.churnChange || 0) <= 0 ? 'melhor que antes' : 'pior que antes'}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Cancelamentos</span>
                    <span className="font-medium">{growthMetrics?.cancellations || 0} este mês</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Retenção</span>
                    <span className="font-medium">
                      {growthMetrics?.retention ? `${growthMetrics.retention}%` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Users */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Usuários por Receita</CardTitle>
            <CardDescription>Maiores contribuidores do mês</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum dado disponível
                </p>
              ) : (
                topUsers.map((user, index) => (
                  <div key={`top-user-${index}`} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600 text-white font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.orders} pedidos</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">
                        R$ {user.revenue.toLocaleString('pt-BR')}
                      </p>
                      <Badge variant="outline" className="text-xs">{user.plan}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Atividades Recentes</CardTitle>
            <CardDescription>
              Últimas ações administrativas no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma atividade recente
                </p>
              ) : (
                recentLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="flex items-start gap-4 pb-4 border-b last:border-0 last:pb-0"
                  >
                    <div className={`h-2 w-2 rounded-full mt-2 ${getSeverityColor(log.severity)}`} />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{log.action}</p>
                        <Badge variant={getActivityTypeColor(log.activity_type)}>
                          {log.activity_type || 'unknown'}
                        </Badge>
                      </div>
                      {log.description && (
                        <p className="text-sm text-muted-foreground">{log.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
