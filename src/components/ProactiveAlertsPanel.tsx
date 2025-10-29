import React from 'react'
import { useProactiveAlerts, ProactiveAlert } from '@/hooks/useProactiveAlerts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Clock, CheckCircle, XCircle, Bell, BellOff, Upload } from 'lucide-react'
import EmptyState from '@/components/EmptyState'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface ProactiveAlertsPanelProps {
  className?: string
}

const alertIcons = {
  delay_warning: AlertTriangle,
  delivery_reminder: Clock,
  status_change: CheckCircle,
  exception_alert: XCircle
}

const alertColors = {
  delay_warning: 'destructive',
  delivery_reminder: 'default',
  status_change: 'secondary',
  exception_alert: 'destructive'
} as const

const priorityColors = {
  low: 'secondary',
  normal: 'default',
  high: 'destructive',
  urgent: 'destructive'
} as const

export const ProactiveAlertsPanel: React.FC<ProactiveAlertsPanelProps> = ({ className }) => {
  const {
    alerts,
    stats,
    loading,
    markAsRead,
    markAllAsRead,
    takeAction,
    deleteAlert
  } = useProactiveAlerts()

  const handleAction = async (alert: ProactiveAlert, action: string) => {
    switch (action) {
      case 'mark_read':
        await markAsRead(alert.id)
        break
      case 'contact_support':
        await takeAction(alert.id, 'contact_support', { timestamp: new Date().toISOString() })
        // Open support chat or email
        window.open('mailto:support@trackyproflow.com?subject=Alerta: ' + alert.title, '_blank')
        break
      case 'view_order':
        // Navigate to order details
        window.location.href = `/orders/${alert.order_id}`
        break
      case 'dismiss':
        await deleteAlert(alert.id)
        break
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alertas Proativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alertas Proativos
            {stats.unread > 0 && (
              <Badge variant="destructive" className="ml-2">
                {stats.unread} não lido{stats.unread !== 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
          {stats.unread > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="flex items-center gap-2"
            >
              <BellOff className="h-4 w-4" />
              Marcar todos como lidos
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <EmptyState
            variant="success"
            title="Nenhum alerta ativo"
            description="Todos os seus pedidos estão sendo monitorados e não há alertas pendentes. Quando surgirem situações que precisam de atenção, eles aparecerão aqui automaticamente."
            actions={[
              {
                label: "Ver Pedidos",
                href: "/dashboard",
                variant: "outline",
                icon: CheckCircle
              },
              {
                label: "Configurar Alertas",
                href: "/dashboard/configuracoes",
                variant: "outline",
                icon: Bell
              }
            ]}
            badge={{ text: "Monitoramento Ativo", variant: "success" }}
            metrics={[
              { label: "Pedidos Monitorados", value: stats.total?.toString() || "0", icon: CheckCircle },
              { label: "Alertas Totais", value: stats.total?.toString() || "0", icon: CheckCircle },
              { label: "Taxa de Sucesso", value: "100%", icon: CheckCircle }
            ]}
            tips={[
              "Alertas são gerados automaticamente pelo sistema",
              "Configure notificações para receber alertas por WhatsApp",
              "Monitore pedidos em tempo real no dashboard"
            ]}
          />
        ) : (
          <div className="space-y-3">
            {alerts.slice(0, 10).map((alert) => {
              const Icon = alertIcons[alert.alert_type] || Bell
              const alertColor = alertColors[alert.alert_type] || 'default'
              const priorityColor = priorityColors[alert.priority] || 'default'

              return (
                <div
                  key={alert.id}
                  className={`p-4 border rounded-lg transition-colors ${
                    alert.is_read ? 'bg-gray-50' : 'bg-white border-l-4 border-l-blue-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-full ${
                        alertColor === 'destructive' ? 'bg-red-100 text-red-600' :
                        alertColor === 'secondary' ? 'bg-gray-100 text-gray-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{alert.title}</h4>
                          <Badge variant={priorityColor} className="text-xs">
                            {alert.priority === 'urgent' ? 'Urgente' :
                             alert.priority === 'high' ? 'Alta' :
                             alert.priority === 'normal' ? 'Normal' : 'Baixa'}
                          </Badge>
                          {!alert.is_read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {alert.message}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>
                            {formatDistanceToNow(new Date(alert.triggered_at), {
                              addSuffix: true,
                              locale: ptBR
                            })}
                          </span>
                          {alert.action_taken && (
                            <Badge variant="outline" className="text-xs">
                              Ação tomada
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      {!alert.is_read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction(alert, 'mark_read')}
                          className="h-8 px-2"
                        >
                          Marcar como lido
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAction(alert, 'view_order')}
                        className="h-8 px-2"
                      >
                        Ver pedido
                      </Button>
                      {alert.alert_type === 'delay_warning' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction(alert, 'contact_support')}
                          className="h-8 px-2"
                        >
                          Contatar suporte
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAction(alert, 'dismiss')}
                        className="h-8 px-2 text-muted-foreground hover:text-destructive"
                      >
                        Dispensar
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
            {alerts.length > 10 && (
              <div className="text-center pt-4">
                <Button variant="outline" size="sm">
                  Ver todos os alertas ({alerts.length})
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}