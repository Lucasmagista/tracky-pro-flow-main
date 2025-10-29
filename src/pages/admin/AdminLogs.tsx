import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { AdminService, type AdminLog, type ActivityType, type LogLevel } from '@/services/admin'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { CalendarIcon, Download, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function AdminLogs() {
  const [logs, setLogs] = useState<AdminLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [isLoading, setIsLoading] = useState(true)
  const [activityTypeFilter, setActivityTypeFilter] = useState<ActivityType | 'all'>('all')
  const [severityFilter, setSeverityFilter] = useState<LogLevel | 'all'>('all')
  const [dateFrom, setDateFrom] = useState<Date>()
  const [dateTo, setDateTo] = useState<Date>()
  const { toast } = useToast()

  useEffect(() => {
    loadLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, activityTypeFilter, severityFilter, dateFrom, dateTo])

  const loadLogs = async () => {
    try {
      setIsLoading(true)
      
      const filters: {
        activity_type?: ActivityType
        severity?: LogLevel
        date_from?: string
        date_to?: string
      } = {}

      if (activityTypeFilter !== 'all') {
        filters.activity_type = activityTypeFilter as ActivityType
      }
      if (severityFilter !== 'all') {
        filters.severity = severityFilter as LogLevel
      }
      if (dateFrom) {
        filters.date_from = dateFrom.toISOString()
      }
      if (dateTo) {
        filters.date_to = dateTo.toISOString()
      }

      const { logs: logsData, total: totalData } = await AdminService.getAdminLogs(
        page,
        pageSize,
        filters
      )
      
      setLogs(logsData)
      setTotal(totalData)
    } catch (error) {
      console.error('Error loading logs:', error)
      toast({
        title: 'Erro ao carregar logs',
        description: 'Não foi possível carregar os logs do sistema.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const csv = await AdminService.exportToCSV('admin_logs')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `logs_${new Date().toISOString()}.csv`
      a.click()
      
      toast({
        title: 'Exportação concluída',
        description: 'Os logs foram exportados com sucesso.'
      })
    } catch (error) {
      console.error('Error exporting logs:', error)
      toast({
        title: 'Erro na exportação',
        description: 'Não foi possível exportar os logs.',
        variant: 'destructive'
      })
    }
  }

  const getSeverityBadge = (severity: LogLevel) => {
    const variants = {
      critical: { variant: 'destructive' as const, label: 'Crítico' },
      error: { variant: 'destructive' as const, label: 'Erro' },
      warning: { variant: 'secondary' as const, label: 'Aviso' },
      info: { variant: 'default' as const, label: 'Info' },
      debug: { variant: 'outline' as const, label: 'Debug' }
    }
    
    const config = variants[severity] || variants.info
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getActivityTypeBadge = (type: ActivityType) => {
    if (!type || typeof type !== 'string') {
      return <Badge variant="outline">unknown</Badge>
    }
    if (type.includes('error') || type.includes('delete')) {
      return <Badge variant="destructive">{type}</Badge>
    }
    if (type.includes('create') || type.includes('success')) {
      return <Badge variant="default">{type}</Badge>
    }
    if (type.includes('update')) {
      return <Badge variant="secondary">{type}</Badge>
    }
    return <Badge variant="outline">{type}</Badge>
  }

  const columns: Column<AdminLog>[] = [
    {
      key: 'created_at',
      label: 'Data/Hora',
      sortable: true,
      className: 'w-[180px]',
      render: (log) => (
        <span className="text-sm font-mono">
          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
        </span>
      )
    },
    {
      key: 'severity',
      label: 'Gravidade',
      className: 'w-[100px]',
      render: (log) => getSeverityBadge(log.severity)
    },
    {
      key: 'activity_type',
      label: 'Tipo',
      className: 'w-[150px]',
      render: (log) => getActivityTypeBadge(log.activity_type)
    },
    {
      key: 'action',
      label: 'Ação',
      sortable: true,
      render: (log) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-sm">{log.action}</span>
          {log.description && (
            <span className="text-xs text-muted-foreground line-clamp-2">
              {log.description}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'admin_id',
      label: 'Admin ID',
      className: 'w-[200px]',
      render: (log) => (
        <span className="text-xs font-mono text-muted-foreground">
          {log.admin_id || 'Sistema'}
        </span>
      )
    },
    {
      key: 'ip_address',
      label: 'IP',
      className: 'w-[130px]',
      render: (log) => (
        <span className="text-xs font-mono">
          {log.ip_address || 'N/A'}
        </span>
      )
    }
  ]

  const clearFilters = () => {
    setActivityTypeFilter('all')
    setSeverityFilter('all')
    setDateFrom(undefined)
    setDateTo(undefined)
  }

  const errorCount = logs.filter(l => l.severity === 'error' || l.severity === 'critical').length
  const warningCount = logs.filter(l => l.severity === 'warning').length

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Logs & Auditoria</h1>
            <p className="text-muted-foreground mt-2">
              Visualize todas as atividades e eventos do sistema
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={clearFilters}>
              Limpar Filtros
            </Button>
            <Button onClick={loadLogs}>
              Atualizar
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{total}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Erros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{errorCount}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avisos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{warningCount}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {total - errorCount - warningCount}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros Avançados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {/* Activity Type Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Tipo de Atividade</label>
                <Select
                  value={activityTypeFilter}
                  onValueChange={(value) => setActivityTypeFilter(value as ActivityType | 'all')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="user_login">Login</SelectItem>
                    <SelectItem value="user_logout">Logout</SelectItem>
                    <SelectItem value="user_register">Registro</SelectItem>
                    <SelectItem value="user_update">Atualização Usuário</SelectItem>
                    <SelectItem value="user_delete">Exclusão Usuário</SelectItem>
                    <SelectItem value="admin_action">Ação Admin</SelectItem>
                    <SelectItem value="security_event">Evento Segurança</SelectItem>
                    <SelectItem value="error">Erro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Severity Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Gravidade</label>
                <Select
                  value={severityFilter}
                  onValueChange={(value) => setSeverityFilter(value as LogLevel | 'all')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="critical">Crítico</SelectItem>
                    <SelectItem value="error">Erro</SelectItem>
                    <SelectItem value="warning">Aviso</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="debug">Debug</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date From */}
              <div>
                <label className="text-sm font-medium mb-2 block">Data Início</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "PPP", { locale: ptBR }) : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date To */}
              <div>
                <label className="text-sm font-medium mb-2 block">Data Fim</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "PPP", { locale: ptBR }) : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Registro de Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={logs}
              columns={columns}
              currentPage={page}
              pageSize={pageSize}
              totalItems={total}
              isLoading={isLoading}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              onExport={handleExport}
              searchPlaceholder="Buscar em logs..."
              emptyMessage="Nenhum log encontrado com os filtros aplicados"
            />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
