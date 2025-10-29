/**
 * Widget de Pedidos Nuvemshop para Dashboard
 * Exibe resumo de pedidos recentes da Nuvemshop com ações rápidas
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Store,
  RefreshCw,
  ExternalLink,
  Package,
  ShoppingCart,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { useNuvemshopIntegration } from '@/hooks/useNuvemshopIntegration'
import { Skeleton } from '@/components/ui/skeleton'
import { Link } from 'react-router-dom'

interface NuvemshopOrdersWidgetProps {
  className?: string
}

export const NuvemshopOrdersWidget = ({ className }: NuvemshopOrdersWidgetProps) => {
  const { isConnected, isLoading, syncOrders, lastSync, getOrders } = useNuvemshopIntegration()
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    completed: 0,
    pending: 0,
  })

  // Load recent orders
  useEffect(() => {
    if (isConnected && !isLoading) {
      loadRecentOrders()
    }
  }, [isConnected])

  const loadRecentOrders = async () => {
    try {
      const orders = await getOrders({ status: 'open' })
      setRecentOrders(orders.slice(0, 5)) // Only show 5 most recent

      // Calculate stats
      setStats({
        total: orders.length,
        open: orders.filter((o) => o.status === 'open').length,
        completed: orders.filter((o) => o.status === 'closed').length,
        pending: orders.filter((o) => o.payment_status === 'pending').length,
      })
    } catch (error) {
      console.error('Error loading orders:', error)
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await syncOrders()
      await loadRecentOrders()
    } finally {
      setIsSyncing(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  if (!isConnected) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Store className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Nuvemshop</CardTitle>
              <CardDescription>Pedidos da sua loja</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              Conecte sua loja Nuvemshop para ver pedidos aqui
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/settings">
                Conectar Nuvemshop
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Store className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Nuvemshop</CardTitle>
              <CardDescription>
                {lastSync ? `Sincronizado ${formatDate(lastSync)}` : 'Nunca sincronizado'}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Abertos</p>
                <p className="text-2xl font-bold text-blue-900">{stats.open}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-blue-400" />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-green-50 border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 font-medium">Concluídos</p>
                <p className="text-2xl font-bold text-green-900">{stats.completed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
          </div>
        </div>

        <Separator />

        {/* Recent Orders List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Pedidos Recentes</h4>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/orders">
                Ver todos
                <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </div>

          {recentOrders.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              Nenhum pedido recente
            </div>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium truncate">
                          #{order.number || order.id}
                        </p>
                        <Badge
                          variant={order.status === 'open' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {order.status === 'open' ? 'Aberto' : 'Fechado'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {order.customer?.name || 'Cliente não informado'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {formatCurrency(parseFloat(order.total))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(order.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleSync}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Sincronizar
          </Button>
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link to="/settings">
              Configurar
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
