import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, FileText, User, Settings, Shield, Mail, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Json } from "@/integrations/supabase/types";

interface ActivityLog {
  id: string;
  action: string;
  details: Json;
  created_at: string;
  ip_address?: string;
}

interface ActivityHistoryProps {
  userId: string;
}

const getActivityIcon = (action: string) => {
  if (action.includes('login') || action.includes('auth')) return <Shield className="h-4 w-4" />;
  if (action.includes('profile') || action.includes('user')) return <User className="h-4 w-4" />;
  if (action.includes('order')) return <FileText className="h-4 w-4" />;
  if (action.includes('notification') || action.includes('email') || action.includes('whatsapp')) return <Mail className="h-4 w-4" />;
  if (action.includes('setting') || action.includes('config')) return <Settings className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
};

const getActivityDescription = (action: string, details: Record<string, unknown> | string | null) => {
  const actionMap: Record<string, string> = {
    'user_login': 'Login realizado',
    'user_logout': 'Logout realizado',
    'profile_updated': 'Perfil atualizado',
    'password_changed': 'Senha alterada',
    'order_created': 'Pedido criado',
    'order_updated': 'Pedido atualizado',
    'order_deleted': 'Pedido removido',
    'notification_sent': 'Notificação enviada',
    'settings_updated': 'Configurações atualizadas',
    'avatar_uploaded': 'Avatar atualizado',
    'avatar_removed': 'Avatar removido',
  };

  return actionMap[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export const ActivityHistory = ({ userId }: ActivityHistoryProps) => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadActivities = async () => {
      try {
        const { data, error } = await supabase
          .from('logs')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setActivities(data || []);
      } catch (error) {
        console.error('Error loading activities:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      loadActivities();
    }
  }, [userId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Histórico de Atividades
          </CardTitle>
          <CardDescription>
            Carregando suas atividades recentes...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-8 w-8 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
                <div className="h-3 bg-muted rounded w-16"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Histórico de Atividades
        </CardTitle>
        <CardDescription>
          Suas últimas 50 atividades na plataforma
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma atividade registrada ainda</p>
              <p className="text-sm">Suas ações serão exibidas aqui</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 pb-4 border-b border-border/50 last:border-0">
                  <div className="p-2 bg-muted rounded-full">
                    {getActivityIcon(activity.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {getActivityDescription(activity.action, activity.details)}
                    </p>
                    {activity.details && Object.keys(activity.details).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {JSON.stringify(activity.details)}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {activity.action.replace(/_/g, ' ')}
                      </Badge>
                      {activity.ip_address && (
                        <span className="text-xs text-muted-foreground">
                          IP: {activity.ip_address}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(activity.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};