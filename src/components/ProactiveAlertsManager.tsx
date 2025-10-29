import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Bell,
  TrendingUp,
  Package,
  XCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ProactiveAlert {
  id: string;
  order_id: string;
  alert_type: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  is_resolved: boolean;
  created_at: string;
  resolved_at?: string;
}

interface AlertStats {
  total: number;
  unread: number;
  urgent: number;
  high: number;
  normal: number;
  resolved: number;
  by_type: Record<string, number>;
}

export function ProactiveAlertsManager() {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);
  const [stats, setStats] = useState<AlertStats>({
    total: 0,
    unread: 0,
    urgent: 0,
    high: 0,
    normal: 0,
    resolved: 0,
    by_type: {},
  });
  const [selectedAlert, setSelectedAlert] = useState<ProactiveAlert | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent'>('all');
  const [loading, setLoading] = useState(true);

  // Carregar alertas
  const loadAlerts = async () => {
    try {
      setLoading(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('proactive_alerts')
        .select('*')
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (filter === 'unread') {
        query = query.eq('is_read', false);
      } else if (filter === 'urgent') {
        query = query.eq('priority', 'urgent');
      }

      const { data, error } = await query;

      if (error) throw error;

      setAlerts(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Error loading alerts:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os alertas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Calcular estatísticas
  const calculateStats = (alertsList: ProactiveAlert[]) => {
    const newStats: AlertStats = {
      total: alertsList.length,
      unread: 0,
      urgent: 0,
      high: 0,
      normal: 0,
      resolved: 0,
      by_type: {},
    };

    alertsList.forEach((alert) => {
      if (!alert.is_read) newStats.unread++;
      if (alert.is_resolved) newStats.resolved++;

      switch (alert.priority) {
        case 'urgent':
          newStats.urgent++;
          break;
        case 'high':
          newStats.high++;
          break;
        case 'normal':
          newStats.normal++;
          break;
      }

      newStats.by_type[alert.alert_type] = (newStats.by_type[alert.alert_type] || 0) + 1;
    });

    setStats(newStats);
  };

  // Marcar como lido
  const markAsRead = async (alertId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('proactive_alerts')
        .update({ is_read: true })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId ? { ...alert, is_read: true } : alert
        )
      );

      toast({
        title: 'Alerta marcado como lido',
      });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  // Resolver alerta
  const resolveAlert = async (alertId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('proactive_alerts')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId
            ? { ...alert, is_resolved: true, resolved_at: new Date().toISOString() }
            : alert
        )
      );

      toast({
        title: 'Alerta resolvido',
        description: 'O alerta foi marcado como resolvido.',
      });

      setSelectedAlert(null);
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível resolver o alerta.',
        variant: 'destructive',
      });
    }
  };

  // Deletar alerta
  const deleteAlert = async (alertId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('proactive_alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;

      setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));

      toast({
        title: 'Alerta excluído',
      });

      setSelectedAlert(null);
    } catch (error) {
      console.error('Error deleting alert:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o alerta.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    loadAlerts();

    // Configurar real-time subscription
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (supabase as any)
      .channel('proactive_alerts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'proactive_alerts',
        },
        () => {
          loadAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // Ícones por tipo
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'delay_warning':
        return <Clock className="h-5 w-5" />;
      case 'delivery_reminder':
        return <Package className="h-5 w-5" />;
      case 'exception_alert':
        return <XCircle className="h-5 w-5" />;
      case 'status_change':
        return <TrendingUp className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  // Badges por prioridade
  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      urgent: 'destructive',
      high: 'destructive',
      normal: 'secondary',
      low: 'outline',
    };

    return (
      <Badge variant={variants[priority] || 'default'}>
        {priority === 'urgent' && '🔴'} {priority.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Alertas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Não Lidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.unread}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Urgentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.urgent}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Alta Prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.high}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Resolvidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="all">Todos ({stats.total})</TabsTrigger>
          <TabsTrigger value="unread">Não Lidos ({stats.unread})</TabsTrigger>
          <TabsTrigger value="urgent">Urgentes ({stats.urgent})</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          {loading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Carregando alertas...</p>
              </CardContent>
            </Card>
          ) : alerts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-semibold mb-2">Nenhum alerta encontrado</h3>
                <p className="text-muted-foreground">
                  Tudo está funcionando perfeitamente!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <Card
                  key={alert.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    !alert.is_read ? 'border-l-4 border-l-blue-500' : ''
                  } ${alert.is_resolved ? 'opacity-60' : ''}`}
                  onClick={() => setSelectedAlert(alert)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div
                          className={`p-2 rounded-lg ${
                            alert.priority === 'urgent'
                              ? 'bg-red-100 text-red-600'
                              : alert.priority === 'high'
                              ? 'bg-orange-100 text-orange-600'
                              : 'bg-blue-100 text-blue-600'
                          }`}
                        >
                          {getAlertIcon(alert.alert_type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-base">{alert.title}</CardTitle>
                            {!alert.is_read && (
                              <Badge variant="secondary" className="text-xs">
                                Novo
                              </Badge>
                            )}
                            {alert.is_resolved && (
                              <Badge variant="outline" className="text-xs">
                                Resolvido
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="text-sm">
                            {alert.message}
                          </CardDescription>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <span>
                              {new Date(alert.created_at).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getPriorityBadge(alert.priority)}
                        {!alert.is_read && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(alert.id);
                            }}
                          >
                            Marcar como lido
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog de detalhes */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="max-w-2xl">
          {selectedAlert && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`p-2 rounded-lg ${
                      selectedAlert.priority === 'urgent'
                        ? 'bg-red-100 text-red-600'
                        : selectedAlert.priority === 'high'
                        ? 'bg-orange-100 text-orange-600'
                        : 'bg-blue-100 text-blue-600'
                    }`}
                  >
                    {getAlertIcon(selectedAlert.alert_type)}
                  </div>
                  <div>
                    <DialogTitle>{selectedAlert.title}</DialogTitle>
                    <DialogDescription>
                      {new Date(selectedAlert.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Mensagem</h4>
                  <p className="text-sm text-muted-foreground">{selectedAlert.message}</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Detalhes</h4>
                  <div className="bg-muted p-3 rounded-lg">
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(selectedAlert.metadata, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="flex gap-2">
                  {!selectedAlert.is_resolved && (
                    <Button
                      onClick={() => resolveAlert(selectedAlert.id)}
                      className="flex-1"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Marcar como Resolvido
                    </Button>
                  )}
                  <Button
                    onClick={() => deleteAlert(selectedAlert.id)}
                    variant="destructive"
                    className="flex-1"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Excluir Alerta
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
