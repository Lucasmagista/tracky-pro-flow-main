import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Mail,
  MessageSquare,
  Smartphone,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  TrendingUp,
  Send,
} from 'lucide-react';

interface NotificationLog {
  id: string;
  notification_id: string;
  channel: 'email' | 'sms' | 'whatsapp';
  recipient: string;
  subject?: string;
  body: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
  error_message?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface Stats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  deliveryRate: number;
}

export function NotificationHistory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    pending: 0,
    deliveryRate: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Filters
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Load notification logs
  const loadLogs = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('notification_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (channelFilter !== 'all') {
        query = query.eq('channel', channelFilter);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (searchQuery) {
        query = query.or(`recipient.ilike.%${searchQuery}%,subject.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      const logsData = (data || []) as NotificationLog[];
      setLogs(logsData);

      // Calculate statistics
      const total = logsData.length;
      const sent = logsData.filter((l) => l.status === 'sent' || l.status === 'delivered').length;
      const delivered = logsData.filter((l) => l.status === 'delivered').length;
      const failed = logsData.filter((l) => l.status === 'failed').length;
      const pending = logsData.filter((l) => l.status === 'pending').length;
      const deliveryRate = total > 0 ? (delivered / total) * 100 : 0;

      setStats({
        total,
        sent,
        delivered,
        failed,
        pending,
        deliveryRate,
      });
    } catch (err) {
      console.error('Error loading notification logs:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o histórico.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast, channelFilter, statusFilter, searchQuery]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Resend notification
  const handleResend = async (log: NotificationLog) => {
    if (!confirm('Deseja reenviar esta notificação?')) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('notification_logs')
        .insert({
          user_id: user?.id,
          notification_id: log.notification_id,
          channel: log.channel,
          recipient: log.recipient,
          subject: log.subject,
          body: log.body,
          status: 'pending',
          metadata: log.metadata,
        });

      if (error) throw error;

      toast({
        title: 'Notificação reenviada',
        description: 'A notificação foi adicionada à fila de envio.',
      });

      loadLogs();
    } catch (err) {
      console.error('Error resending notification:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível reenviar a notificação.',
        variant: 'destructive',
      });
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', icon: React.ReactNode }> = {
      pending: { variant: 'secondary', icon: <Clock className="h-3 w-3 mr-1" /> },
      sent: { variant: 'default', icon: <Send className="h-3 w-3 mr-1" /> },
      delivered: { variant: 'default', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      failed: { variant: 'destructive', icon: <XCircle className="h-3 w-3 mr-1" /> },
      read: { variant: 'default', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
    };

    const statusLabels: Record<string, string> = {
      pending: 'Pendente',
      sent: 'Enviado',
      delivered: 'Entregue',
      failed: 'Falhou',
      read: 'Lido',
    };

    const config = variants[status] || variants.pending;

    return (
      <Badge variant={config.variant} className="flex items-center w-fit">
        {config.icon}
        {statusLabels[status] || status}
      </Badge>
    );
  };

  // Get channel icon
  const getChannelIcon = (channel: string) => {
    const icons = {
      email: <Mail className="h-4 w-4" />,
      sms: <Smartphone className="h-4 w-4" />,
      whatsapp: <MessageSquare className="h-4 w-4" />,
    };
    return icons[channel as keyof typeof icons] || null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Histórico de Notificações</h2>
        <p className="text-muted-foreground">
          Acompanhe todas as notificações enviadas e seus status
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">notificações</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enviadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sent}</div>
            <p className="text-xs text-muted-foreground">com sucesso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregues</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.delivered}</div>
            <p className="text-xs text-muted-foreground">confirmadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Falharam</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failed}</div>
            <p className="text-xs text-muted-foreground">com erro</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Entrega</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.deliveryRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">de sucesso</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Refine sua busca no histórico</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por destinatário ou assunto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os canais</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="delivered">Entregue</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={loadLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Carregando histórico...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhuma notificação encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Assunto/Prévia</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getChannelIcon(log.channel)}
                        <span className="capitalize">{log.channel}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{log.recipient}</TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate">
                        {log.subject ? (
                          <>
                            <strong>{log.subject}</strong>
                            <br />
                            <span className="text-sm text-muted-foreground">
                              {log.body.substring(0, 50)}...
                            </span>
                          </>
                        ) : (
                          <span className="text-sm">{log.body.substring(0, 80)}...</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell>
                      {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedLog(log);
                            setIsDetailOpen(true);
                          }}
                        >
                          Ver Detalhes
                        </Button>
                        {log.status === 'failed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResend(log)}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Notificação</DialogTitle>
            <DialogDescription>
              Informações completas sobre o envio
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Canal</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {getChannelIcon(selectedLog.channel)}
                    <span className="capitalize">{selectedLog.channel}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Destinatário</Label>
                  <p className="mt-1">{selectedLog.recipient}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Criado em</Label>
                  <p className="mt-1">
                    {format(new Date(selectedLog.created_at), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                </div>

                {selectedLog.sent_at && (
                  <div>
                    <Label className="text-sm font-medium">Enviado em</Label>
                    <p className="mt-1">
                      {format(new Date(selectedLog.sent_at), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                )}

                {selectedLog.delivered_at && (
                  <div>
                    <Label className="text-sm font-medium">Entregue em</Label>
                    <p className="mt-1">
                      {format(new Date(selectedLog.delivered_at), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                )}
              </div>

              {selectedLog.subject && (
                <div>
                  <Label className="text-sm font-medium">Assunto</Label>
                  <p className="mt-1">{selectedLog.subject}</p>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium">Mensagem</Label>
                <div className="mt-1 p-4 bg-muted rounded-lg whitespace-pre-wrap">
                  {selectedLog.body}
                </div>
              </div>

              {selectedLog.error_message && (
                <div>
                  <Label className="text-sm font-medium text-red-500">
                    Mensagem de Erro
                  </Label>
                  <p className="mt-1 text-sm text-red-500">
                    {selectedLog.error_message}
                  </p>
                </div>
              )}

              {selectedLog.status === 'failed' && (
                <Button onClick={() => handleResend(selectedLog)} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reenviar Notificação
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={className}>{children}</label>;
}
