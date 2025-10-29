/**
 * Componente de Configuração Nuvemshop
 * Interface para conectar, configurar e sincronizar pedidos da Nuvemshop
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Store,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Download,
  Settings,
} from 'lucide-react'
import { useNuvemshopIntegration } from '@/hooks/useNuvemshopIntegration'
import { toast } from 'sonner'

export const NuvemshopConfig = () => {
  const {
    isConnected,
    isLoading,
    connect,
    disconnect,
    syncOrders,
    lastSync,
  } = useNuvemshopIntegration()

  const [appId, setAppId] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [storeUrl, setStoreUrl] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)

  // Format last sync date
  const formatLastSync = (date: string | null) => {
    if (!date) return 'Nunca'
    const syncDate = new Date(date)
    return syncDate.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleConnect = async () => {
    if (!appId || !appSecret || !storeUrl) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    await connect(appId, appSecret, storeUrl)
  }

  const handleDisconnect = async () => {
    if (confirm('Tem certeza que deseja desconectar a Nuvemshop?')) {
      await disconnect()
      // Clear form
      setAppId('')
      setAppSecret('')
      setStoreUrl('')
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await syncOrders()
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Store className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle>Nuvemshop</CardTitle>
              <CardDescription>
                Sincronize pedidos automaticamente da sua loja Nuvemshop
              </CardDescription>
            </div>
          </div>
          {isConnected && (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Conectado
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {!isConnected ? (
          <>
            {/* Connection Form */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Para conectar sua loja Nuvemshop, você precisa criar um App OAuth.
                <a
                  href="https://partners.nuvemshop.com.br/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center ml-1 text-blue-600 hover:underline"
                >
                  Criar App
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="app-id">
                  App ID <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="app-id"
                  type="text"
                  placeholder="123456"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  ID do seu aplicativo Nuvemshop
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="app-secret">
                  App Secret <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="app-secret"
                  type="password"
                  placeholder="••••••••••••••••"
                  value={appSecret}
                  onChange={(e) => setAppSecret(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Secret do seu aplicativo Nuvemshop
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="store-url">
                  URL da Loja <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="store-url"
                  type="url"
                  placeholder="https://minhaloja.lojaintegrada.com.br"
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  URL completa da sua loja Nuvemshop
                </p>
              </div>

              <Button
                onClick={handleConnect}
                disabled={isLoading || !appId || !appSecret || !storeUrl}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Store className="h-4 w-4 mr-2" />
                    Conectar Nuvemshop
                  </>
                )}
              </Button>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Como configurar:</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Acesse o Painel de Parceiros da Nuvemshop</li>
                <li>Crie um novo aplicativo OAuth</li>
                <li>Configure a URL de redirecionamento</li>
                <li>Copie o App ID e App Secret</li>
                <li>Cole as credenciais acima e clique em Conectar</li>
              </ol>
            </div>
          </>
        ) : (
          <>
            {/* Connected State */}
            <div className="rounded-lg border bg-green-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-900">
                    Integração ativa
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={isLoading}
                >
                  Desconectar
                </Button>
              </div>

              <div className="text-sm text-green-800">
                <div className="flex items-center justify-between">
                  <span>Última sincronização:</span>
                  <span className="font-medium">{formatLastSync(lastSync)}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Sync Controls */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">Sincronização</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Importe pedidos recentes da sua loja Nuvemshop
                </p>
                <Button
                  onClick={handleSync}
                  disabled={isSyncing}
                  variant="outline"
                  className="w-full"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sincronizar Pedidos
                    </>
                  )}
                </Button>
              </div>

              <Alert>
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  A sincronização automática ocorre a cada 15 minutos via webhooks.
                  Use a sincronização manual apenas quando necessário.
                </AlertDescription>
              </Alert>
            </div>

            <Separator />

            {/* Settings */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">Configurações</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">URL da Loja</span>
                    <span className="font-mono text-xs">{storeUrl}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Webhooks</span>
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Ativos
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Documentation Link */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50">
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  Documentação da API
                </span>
              </div>
              <Button variant="link" size="sm" asChild>
                <a
                  href="https://tiendanube.github.io/api-documentation/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600"
                >
                  Acessar
                </a>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
