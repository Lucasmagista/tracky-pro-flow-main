import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { 
  FileText, 
  Download, 
  Filter, 
  X, 
  AlertCircle, 
  Clock,
  User,
  Database,
  Eye,
  TrendingUp,
  Activity
} from "lucide-react";
import {
  getAuditLogs,
  getAuditLogStatistics,
  getEntityChangeHistory,
  exportAuditLogsCSV,
  exportAuditLogsJSON,
  getAvailableActionTypes,
  getAvailableEntityTypes,
  getAvailableAdmins,
  calculateDiff,
  formatLogValue,
  downloadFile,
  type AuditLogWithChanges,
  type AuditLogFilters,
  type AuditLogStatistics,
  type EntityChangeHistory,
} from "@/services/audit-trail";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";

export function EnhancedAuditTrail() {
  const [logs, setLogs] = useState<AuditLogWithChanges[]>([]);
  const [stats, setStats] = useState<AuditLogStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter options
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [admins, setAdmins] = useState<Array<{ id: string; name: string; email: string }>>([]);
  
  // Dialog states
  const [selectedLog, setSelectedLog] = useState<AuditLogWithChanges | null>(null);
  const [showDiffDialog, setShowDiffDialog] = useState(false);
  const [entityHistory, setEntityHistory] = useState<EntityChangeHistory[]>([]);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  useEffect(() => {
    loadFilterOptions();
    loadLogs();
    loadStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  const loadFilterOptions = async () => {
    const [types, entities, adminsList] = await Promise.all([
      getAvailableActionTypes(),
      getAvailableEntityTypes(),
      getAvailableAdmins(),
    ]);
    setActionTypes(types);
    setEntityTypes(entities);
    setAdmins(adminsList);
  };

  const loadLogs = async () => {
    setLoading(true);
    const result = await getAuditLogs(filters, page, 50);
    setLogs(result.logs);
    setTotalLogs(result.total);
    setLoading(false);
  };

  const loadStatistics = async () => {
    const statistics = await getAuditLogStatistics(
      filters.startDate,
      filters.endDate
    );
    setStats(statistics);
  };

  const handleExportCSV = async () => {
    const result = await exportAuditLogsCSV({
      startDate: filters.startDate,
      endDate: filters.endDate,
      actionTypes: filters.actionTypes,
      resourceTypes: filters.entityTypes || filters.resourceTypes,
    });

    if (result.success && result.csv) {
      const filename = `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
      downloadFile(result.csv, filename, "text/csv");
    }
  };

  const handleExportJSON = async () => {
    const result = await exportAuditLogsJSON(filters);

    if (result.success && result.json) {
      const filename = `audit-logs-${format(new Date(), "yyyy-MM-dd")}.json`;
      downloadFile(result.json, filename, "application/json");
    }
  };

  const handleViewDiff = (log: AuditLogWithChanges) => {
    setSelectedLog(log);
    setShowDiffDialog(true);
  };

  const handleViewHistory = async (log: AuditLogWithChanges) => {
    if (!log.entity_type || !log.entity_id) return;
    
    const history = await getEntityChangeHistory(
      log.entity_type,
      log.entity_id,
      50
    );
    setEntityHistory(history);
    setSelectedLog(log);
    setShowHistoryDialog(true);
  };

  const clearFilters = () => {
    setFilters({});
    setPage(1);
  };

  const columns: Column<AuditLogWithChanges>[] = [
    {
      key: 'created_at',
      label: 'Data/Hora',
      render: (log) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(log.created_at), { 
              addSuffix: true,
              locale: ptBR 
            })}
          </span>
        </div>
      ),
    },
    {
      key: 'admin_name',
      label: 'Admin',
      render: (log) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{log.admin_name || "Unknown"}</span>
          <span className="text-xs text-muted-foreground">{log.admin_email}</span>
        </div>
      ),
    },
    {
      key: 'action_type',
      label: 'Ação',
      render: (log) => (
        <Badge variant={
          log.action_type?.includes("delete") ? "destructive" :
          log.action_type?.includes("create") ? "default" :
          "secondary"
        }>
          {log.action_type}
        </Badge>
      ),
    },
    {
      key: 'entity_type',
      label: 'Entidade',
      render: (log) => log.entity_type || "-",
    },
    {
      key: 'description',
      label: 'Descrição',
      render: (log) => (
        <div className="max-w-md truncate" title={log.description}>
          {log.description}
        </div>
      ),
    },
    {
      key: 'tags',
      label: 'Tags',
      render: (log) => (
        <div className="flex gap-1 flex-wrap">
          {log.tags?.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'status_code',
      label: 'Status',
      render: (log) => {
        const status = log.status_code;
        if (!status) return "-";
        
        const variant = 
          status >= 200 && status < 300 ? "default" :
          status >= 400 && status < 500 ? "secondary" :
          "destructive";
        
        return <Badge variant={variant}>{status}</Badge>;
      },
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (log) => (
        <div className="flex gap-2">
          {(log.data_before || log.data_after) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewDiff(log)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          {log.entity_type && log.entity_id && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewHistory(log)}
            >
              <Clock className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Logs</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_logs.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Erro</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.error_rate.toFixed(2)}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avg_duration_ms.toFixed(0)}ms</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admins Ativos</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.top_admins?.length || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Filtros Avançados</CardTitle>
              <CardDescription>Refine sua busca nos logs de auditoria</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-2 h-4 w-4" />
              {showFilters ? "Ocultar" : "Mostrar"} Filtros
            </Button>
          </div>
        </CardHeader>
        
        {showFilters && (
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={filters.startDate || ""}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={filters.endDate || ""}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Ação</Label>
                <Select
                  value={filters.actionTypes?.[0] || ""}
                  onValueChange={(value) => 
                    setFilters({ ...filters, actionTypes: value ? [value] : undefined })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {actionTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Entidade</Label>
                <Select
                  value={filters.entityTypes?.[0] || ""}
                  onValueChange={(value) => 
                    setFilters({ ...filters, entityTypes: value ? [value] : undefined })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {entityTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Admin</Label>
                <Select
                  value={filters.adminIds?.[0] || ""}
                  onValueChange={(value) => 
                    setFilters({ ...filters, adminIds: value ? [value] : undefined })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {admins.map((admin) => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>IP Address</Label>
                <Input
                  placeholder="192.168.1.1"
                  value={filters.ipAddress || ""}
                  onChange={(e) => setFilters({ ...filters, ipAddress: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Buscar</Label>
                <Input
                  placeholder="Buscar em descrição..."
                  value={filters.searchText || ""}
                  onChange={(e) => setFilters({ ...filters, searchText: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={filters.hasErrors === undefined ? "" : filters.hasErrors.toString()}
                  onValueChange={(value) => 
                    setFilters({ 
                      ...filters, 
                      hasErrors: value === "" ? undefined : value === "true" 
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    <SelectItem value="false">Sucesso</SelectItem>
                    <SelectItem value="true">Com Erros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => { setPage(1); loadLogs(); loadStatistics(); }}>
                Aplicar Filtros
              </Button>
              <Button variant="outline" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" />
                Limpar
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Export Buttons */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Logs de Auditoria</CardTitle>
              <CardDescription>
                Exibindo {logs.length} de {totalLogs} logs
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportJSON}>
                <Download className="mr-2 h-4 w-4" />
                JSON
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={logs}
            isLoading={loading}
          />
        </CardContent>
      </Card>

      {/* Diff Dialog */}
      <Dialog open={showDiffDialog} onOpenChange={setShowDiffDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visualização de Alterações</DialogTitle>
            <DialogDescription>
              Comparação Before/After para {selectedLog?.entity_type} #{selectedLog?.entity_id}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{selectedLog.action_type}</strong> por {selectedLog.admin_name} em{" "}
                  {format(new Date(selectedLog.created_at), "dd/MM/yyyy 'às' HH:mm")}
                </AlertDescription>
              </Alert>

              {selectedLog.data_before && selectedLog.data_after ? (
                <div className="border rounded-lg overflow-hidden">
                  <ReactDiffViewer
                    oldValue={JSON.stringify(selectedLog.data_before, null, 2)}
                    newValue={JSON.stringify(selectedLog.data_after, null, 2)}
                    splitView={true}
                    useDarkTheme={false}
                    leftTitle="Antes"
                    rightTitle="Depois"
                    compareMethod={DiffMethod.WORDS}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedLog.data_before && (
                    <div>
                      <h4 className="font-semibold mb-2">Dados Anteriores:</h4>
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                        {JSON.stringify(selectedLog.data_before, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedLog.data_after && (
                    <div>
                      <h4 className="font-semibold mb-2">Dados Posteriores:</h4>
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                        {JSON.stringify(selectedLog.data_after, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {selectedLog.changed_fields && Object.keys(selectedLog.changed_fields).length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Campos Alterados:</h4>
                  <div className="space-y-2">
                    {Object.entries(selectedLog.changed_fields).map(([key, values]) => {
                      const diff = calculateDiff(
                        { [key]: values.old_value },
                        { [key]: values.new_value }
                      );
                      const fieldDiff = diff[key];

                      return (
                        <div key={key} className="border rounded p-3">
                          <div className="font-medium mb-2">{key}</div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground mb-1">Antes:</div>
                              <div className="bg-red-50 p-2 rounded">
                                {formatLogValue(fieldDiff.old)}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground mb-1">Depois:</div>
                              <div className="bg-green-50 p-2 rounded">
                                {formatLogValue(fieldDiff.new)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Alterações</DialogTitle>
            <DialogDescription>
              Histórico completo de {selectedLog?.entity_type} #{selectedLog?.entity_id}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {entityHistory.map((entry) => (
              <Card key={entry.log_id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">
                        <Badge>{entry.action_type}</Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        por {entry.admin_name} ({entry.admin_email})
                        {entry.ip_address && ` • IP: ${entry.ip_address}`}
                      </CardDescription>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm")}
                    </div>
                  </div>
                </CardHeader>
                {entry.changed_fields && Object.keys(entry.changed_fields).length > 0 && (
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(entry.changed_fields).map(([field, change]) => (
                        <div key={field} className="text-sm">
                          <span className="font-medium">{field}:</span>{" "}
                          <span className="text-red-600">{formatLogValue(change.old)}</span>
                          {" → "}
                          <span className="text-green-600">{formatLogValue(change.new)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}

            {entityHistory.length === 0 && (
              <Alert>
                <AlertDescription>
                  Nenhum histórico de alterações encontrado para esta entidade.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
