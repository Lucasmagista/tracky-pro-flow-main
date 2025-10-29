import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'

export interface AnalyticsMetric {
  id: string
  user_id: string
  metric_type: 'orders' | 'revenue' | 'tracking' | 'integrations' | 'users' | 'performance'
  metric_name: string
  value: number
  metadata: Json
  date: string
  created_at: string
}

export interface AnalyticsReport {
  id: string
  user_id: string
  report_type: 'daily' | 'weekly' | 'monthly' | 'custom'
  title: string
  description?: string
  date_range: {
    start: string
    end: string
  }
  metrics: AnalyticsMetric[]
  summary: Json
  generated_at: string
  expires_at?: string
}

export interface DashboardWidget {
  id: string
  user_id: string
  widget_type: 'chart' | 'metric' | 'table' | 'comparison'
  title: string
  config: Json
  position: {
    x: number
    y: number
    width: number
    height: number
  }
  is_visible: boolean
  created_at: string
  updated_at: string
}

export interface TimeSeriesData {
  date: string
  value: number
  label?: string
  metadata?: Record<string, unknown>
}

export interface ComparisonData {
  period: string
  current: number
  previous: number
  change: number
  changePercent: number
}

export interface AnalyticsFilters {
  dateRange?: {
    start: string
    end: string
  }
  metricTypes?: string[]
  carriers?: string[]
  statuses?: string[]
  marketplaces?: string[]
}

export class AnalyticsService {
  // Record metrics
  static async recordMetric(
    userId: string,
    metricType: AnalyticsMetric['metric_type'],
    metricName: string,
    value: number,
    metadata: Record<string, unknown> = {},
    date?: string
  ): Promise<void> {
    const metricData = {
      user_id: userId,
      metric_type: metricType,
      metric_name: metricName,
      value,
      metadata: metadata as Json,
      date: date || new Date().toISOString().split('T')[0]
    }

    const { error } = await supabase
      .from('analytics_metrics')
      .insert(metricData)

    if (error) throw error
  }

  // Get metrics for date range
  static async getMetrics(
    userId: string,
    filters: AnalyticsFilters = {},
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<AnalyticsMetric[]> {
    let query = supabase
      .from('analytics_metrics')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true })

    if (filters.dateRange) {
      query = query
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end)
    }

    if (filters.metricTypes?.length) {
      query = query.in('metric_type', filters.metricTypes)
    }

    const { data, error } = await query
    if (error) throw error

    return data
  }

  // Get time series data
  static async getTimeSeriesData(
    userId: string,
    metricType: AnalyticsMetric['metric_type'],
    metricName: string,
    dateRange: { start: string; end: string },
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<TimeSeriesData[]> {
    const { data, error } = await supabase
      .from('analytics_metrics')
      .select('date, value, metadata')
      .eq('user_id', userId)
      .eq('metric_type', metricType)
      .eq('metric_name', metricName)
      .gte('date', dateRange.start)
      .lte('date', dateRange.end)
      .order('date', { ascending: true })

    if (error) throw error

    // Group by period if needed
    const grouped = data.reduce((acc, metric) => {
      const date = new Date(metric.date)
      let key: string

      switch (groupBy) {
        case 'week': {
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          key = weekStart.toISOString().split('T')[0]
          break
        }
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
          break
        default:
          key = metric.date
      }

      if (!acc[key]) {
        acc[key] = { date: key, value: 0, count: 0 }
      }

      acc[key].value += metric.value
      acc[key].count += 1

      return acc
    }, {} as Record<string, { date: string; value: number; count: number }>)

    return Object.values(grouped).map(item => ({
      date: item.date,
      value: item.value,
      label: `${item.value} (${item.count} registros)`
    }))
  }

  // Get comparison data
  static async getComparisonData(
    userId: string,
    metricType: AnalyticsMetric['metric_type'],
    metricName: string,
    currentPeriod: { start: string; end: string },
    previousPeriod: { start: string; end: string }
  ): Promise<ComparisonData> {
    const [currentData, previousData] = await Promise.all([
      this.getMetrics(userId, {
        dateRange: currentPeriod,
        metricTypes: [metricType]
      }),
      this.getMetrics(userId, {
        dateRange: previousPeriod,
        metricTypes: [metricType]
      })
    ])

    const currentValue = currentData
      .filter(m => m.metric_name === metricName)
      .reduce((sum, m) => sum + m.value, 0)

    const previousValue = previousData
      .filter(m => m.metric_name === metricName)
      .reduce((sum, m) => sum + m.value, 0)

    const change = currentValue - previousValue
    const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0

    return {
      period: `${currentPeriod.start} - ${currentPeriod.end}`,
      current: currentValue,
      previous: previousValue,
      change,
      changePercent
    }
  }

  // Get dashboard summary
  static async getDashboardSummary(userId: string): Promise<{
    totalOrders: number
    totalRevenue: number
    activeTrackings: number
    successRate: number
    topCarriers: Array<{ carrier: string; count: number }>
    recentActivity: AnalyticsMetric[]
  }> {
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(today.getDate() - 30)

    const dateRange = {
      start: thirtyDaysAgo.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    }

    const metrics = await this.getMetrics(userId, { dateRange })

    const totalOrders = metrics
      .filter(m => m.metric_type === 'orders' && m.metric_name === 'total_orders')
      .reduce((sum, m) => sum + m.value, 0)

    const totalRevenue = metrics
      .filter(m => m.metric_type === 'revenue' && m.metric_name === 'total_revenue')
      .reduce((sum, m) => sum + m.value, 0)

    const activeTrackings = metrics
      .filter(m => m.metric_type === 'tracking' && m.metric_name === 'active_trackings')
      .reduce((sum, m) => sum + m.value, 0)

    const deliveredOrders = metrics
      .filter(m => m.metric_type === 'orders' && m.metric_name === 'delivered_orders')
      .reduce((sum, m) => sum + m.value, 0)

    const successRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0

    // Top carriers
    const carrierMetrics = metrics.filter(m => m.metric_type === 'tracking' && m.metric_name === 'carrier_usage')
    const carrierCounts = carrierMetrics.reduce((acc, m) => {
      const carrier = m.metadata?.carrier as string || 'Unknown'
      acc[carrier] = (acc[carrier] || 0) + m.value
      return acc
    }, {} as Record<string, number>)

    const topCarriers = Object.entries(carrierCounts)
      .map(([carrier, count]) => ({ carrier, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Recent activity (last 10 metrics)
    const recentActivity = metrics
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)

    return {
      totalOrders,
      totalRevenue,
      activeTrackings,
      successRate,
      topCarriers,
      recentActivity
    }
  }

  // Generate analytics report
  static async generateReport(
    userId: string,
    reportType: AnalyticsReport['report_type'],
    title: string,
    dateRange: { start: string; end: string },
    description?: string
  ): Promise<AnalyticsReport> {
    const metrics = await this.getMetrics(userId, { dateRange })

    // Calculate summary
    const summary = this.calculateReportSummary(metrics)

    const report: Omit<AnalyticsReport, 'id' | 'generated_at'> = {
      user_id: userId,
      report_type: reportType,
      title,
      description,
      date_range: dateRange,
      metrics,
      summary: summary as Json
    }

    const { data, error } = await supabase
      .from('analytics_reports')
      .insert({
        ...report,
        generated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      })
      .select()
      .single()

    if (error) throw error
    return data as AnalyticsReport
  }

  // Calculate report summary
  private static calculateReportSummary(metrics: AnalyticsMetric[]): Record<string, unknown> {
    const summary = {
      totalMetrics: metrics.length,
      dateRange: {
        start: metrics.length > 0 ? metrics[0].date : null,
        end: metrics.length > 0 ? metrics[metrics.length - 1].date : null
      },
      metricsByType: {} as Record<string, number>,
      topMetrics: [] as Array<{ name: string; value: number; type: string }>
    }

    // Group by type
    metrics.forEach(metric => {
      summary.metricsByType[metric.metric_type] =
        (summary.metricsByType[metric.metric_type] || 0) + metric.value
    })

    // Top metrics
    const metricTotals = metrics.reduce((acc, metric) => {
      const key = `${metric.metric_type}:${metric.metric_name}`
      acc[key] = {
        name: metric.metric_name,
        type: metric.metric_type,
        value: (acc[key]?.value || 0) + metric.value
      }
      return acc
    }, {} as Record<string, { name: string; type: string; value: number }>)

    summary.topMetrics = Object.values(metricTotals)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)

    return summary
  }

  // Get user reports
  static async getUserReports(userId: string): Promise<AnalyticsReport[]> {
    const { data, error } = await supabase
      .from('analytics_reports')
      .select('*')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })

    if (error) throw error
    return data as AnalyticsReport[]
  }

  // Delete report
  static async deleteReport(reportId: string): Promise<void> {
    const { error } = await supabase
      .from('analytics_reports')
      .delete()
      .eq('id', reportId)

    if (error) throw error
  }

  // Dashboard widgets management
  static async getDashboardWidgets(userId: string): Promise<DashboardWidget[]> {
    const { data, error } = await supabase
      .from('dashboard_widgets')
      .select('*')
      .eq('user_id', userId)
      .eq('is_visible', true)
      .order('position')

    if (error) throw error
    return data as DashboardWidget[]
  }

  static async saveDashboardWidget(
    userId: string,
    widget: Omit<DashboardWidget, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<DashboardWidget> {
    const widgetData = {
      ...widget,
      user_id: userId,
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('dashboard_widgets')
      .upsert(widgetData, {
        onConflict: 'user_id,id'
      })
      .select()
      .single()

    if (error) throw error
    return data as DashboardWidget
  }

  static async deleteDashboardWidget(widgetId: string): Promise<void> {
    const { error } = await supabase
      .from('dashboard_widgets')
      .delete()
      .eq('id', widgetId)

    if (error) throw error
  }

  // Initialize default dashboard widgets
  static async initializeDefaultDashboard(userId: string): Promise<void> {
    const defaultWidgets = [
      {
        widget_type: 'metric' as const,
        title: 'Total de Pedidos',
        config: {
          metricType: 'orders',
          metricName: 'total_orders',
          displayType: 'number',
          color: 'blue'
        } as Json,
        position: { x: 0, y: 0, width: 3, height: 2 },
        is_visible: true
      },
      {
        widget_type: 'chart' as const,
        title: 'Pedidos por Dia',
        config: {
          chartType: 'line',
          metricType: 'orders',
          metricName: 'daily_orders',
          timeRange: '30d'
        } as Json,
        position: { x: 3, y: 0, width: 6, height: 4 },
        is_visible: true
      },
      {
        widget_type: 'metric' as const,
        title: 'Taxa de Sucesso',
        config: {
          metricType: 'performance',
          metricName: 'success_rate',
          displayType: 'percentage',
          color: 'green'
        } as Json,
        position: { x: 9, y: 0, width: 3, height: 2 },
        is_visible: true
      },
      {
        widget_type: 'table' as const,
        title: 'Top Transportadoras',
        config: {
          dataSource: 'carrier_usage',
          limit: 5,
          sortBy: 'count',
          sortOrder: 'desc'
        } as Json,
        position: { x: 0, y: 2, width: 6, height: 3 },
        is_visible: true
      },
      {
        widget_type: 'comparison' as const,
        title: 'Comparativo Mensal',
        config: {
          metricType: 'orders',
          metricName: 'total_orders',
          comparisonType: 'month_over_month'
        } as Json,
        position: { x: 6, y: 2, width: 6, height: 3 },
        is_visible: true
      }
    ]

    for (const widget of defaultWidgets) {
      await this.saveDashboardWidget(userId, widget)
    }
  }
}