/**
 * Widget de Rastreamento Smartenvios para Dashboard
 * Exibe resumo de rastreamentos ativos com estatísticas
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import {
  Truck,
  Package,
  ExternalLink,
  Search,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  TrendingUp,
} from 'lucide-react'
import { useSmartenviosIntegration } from '@/hooks/useSmartenviosIntegration'
import { Skeleton } from '@/components/ui/skeleton'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { trackingCodeSchema } from '@/schemas/tracking.schema'
import { sanitizeTrackingCode } from '@/lib/sanitize'

interface SmartenviosTrackingWidgetProps {
  className?: string
}

export const SmartenviosTrackingWidget = ({ className }: SmartenviosTrackingWidgetProps) => {
  const { isConnected, isLoading, trackOrder } = useSmartenviosIntegration()
  const [quickTrackCode, setQuickTrackCode] = useState('')
  const [isTracking, setIsTracking] = useState(false)
  const [stats, setStats] = useState({
    inTransit: 0,
    delivered: 0,
    pending: 0,
    delayed: 0,
  })

  // Mock stats - in production, fetch from database
  useEffect(() => {
    if (isConnected) {
      // TODO: Fetch actual stats from database
      setStats({
        inTransit: 12,
        delivered: 45,
        pending: 3,
        delayed: 1,
      })
    }
  }, [isConnected])

  const handleQuickTrack = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!quickTrackCode.trim()) {
      toast.error('Digite um código de rastreamento')
      return
    }

    // Sanitizar e validar código com Zod
    const sanitized = sanitizeTrackingCode(quickTrackCode)
    const validation = trackingCodeSchema.safeParse(sanitized)

    if (!validation.success) {
      toast.error('Código de rastreamento inválido', {
        description: validation.error.errors[0].message,
      })
      return
    }

    setIsTracking(true)
    try {
      const result = await trackOrder(validation.data)
      if (result) {
        toast.success('Rastreamento encontrado!')
        // TODO: Navigate to order details or show modal
      }
    } catch (error) {
      toast.error('Erro ao rastrear pedido')
    } finally {
      setIsTracking(false)
      setQuickTrackCode('')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-500'
      case 'in_transit':
        return 'bg-blue-500'
      case 'pending':
        return 'bg-yellow-500'
      case 'delayed':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  if (!isConnected) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <Truck className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Smartenvios</CardTitle>
              <CardDescription>Rastreamento em tempo real</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              Conecte o Smartenvios para rastreamento inteligente
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/settings">
                Conectar Smartenvios
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
            <Skeleton className="h-10 w-full" />
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
            <div className="p-2 rounded-lg bg-orange-100">
              <Truck className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Smartenvios</CardTitle>
              <CardDescription>Rastreamento ativo</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="bg-green-50 text-green-700">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Conectado
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Em Trânsito</p>
                <p className="text-2xl font-bold text-blue-900">{stats.inTransit}</p>
              </div>
              <Truck className="h-8 w-8 text-blue-400" />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-green-50 border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 font-medium">Entregues</p>
                <p className="text-2xl font-bold text-green-900">{stats.delivered}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-yellow-600 font-medium">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-900">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-400" />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-red-50 border border-red-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-600 font-medium">Atrasados</p>
                <p className="text-2xl font-bold text-red-900">{stats.delayed}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
          </div>
        </div>

        <Separator />

        {/* Quick Track */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Rastreamento Rápido</h4>
          <form onSubmit={handleQuickTrack} className="flex gap-2">
            <Input
              placeholder="Digite o código de rastreamento"
              value={quickTrackCode}
              onChange={(e) => setQuickTrackCode(e.target.value)}
              disabled={isTracking}
              className="flex-1"
            />
            <Button type="submit" disabled={isTracking} size="sm">
              {isTracking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Formatos: SE + 10-15 chars ou SM + 12-16 dígitos
          </p>
        </div>

        <Separator />

        {/* Status Distribution */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Distribuição de Status</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getStatusColor('in_transit')}`} />
                <span className="text-muted-foreground">Em Trânsito</span>
              </div>
              <span className="font-medium">{stats.inTransit}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getStatusColor('delivered')}`} />
                <span className="text-muted-foreground">Entregues</span>
              </div>
              <span className="font-medium">{stats.delivered}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getStatusColor('pending')}`} />
                <span className="text-muted-foreground">Pendentes</span>
              </div>
              <span className="font-medium">{stats.pending}</span>
            </div>
            {stats.delayed > 0 && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor('delayed')}`} />
                  <span className="text-muted-foreground">Atrasados</span>
                </div>
                <span className="font-medium text-red-600">{stats.delayed}</span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link to="/orders">
              <Package className="h-3 w-3 mr-1" />
              Ver Pedidos
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link to="/settings">
              Configurar
            </Link>
          </Button>
        </div>

        {/* Performance Indicator */}
        <div className="p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-900">Taxa de Entrega</span>
            </div>
            <span className="text-sm font-bold text-green-700">
              {stats.delivered > 0
                ? `${Math.round((stats.delivered / (stats.inTransit + stats.delivered + stats.pending)) * 100)}%`
                : '0%'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
