/**
 * Componente de Configuração Smartenvios
 * Interface para conectar, configurar e gerenciar rastreamentos Smartenvios
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Truck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Package,
  TestTube,
  Shield,
} from 'lucide-react'
import { useSmartenviosIntegration } from '@/hooks/useSmartenviosIntegration'
import { toast } from 'sonner'

export const SmartenviosConfig = () => {
  const {
    isConnected,
    isLoading,
    connect,
    disconnect,
    validateTrackingCode,
  } = useSmartenviosIntegration()

  const [apiKey, setApiKey] = useState('')
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('production')
  const [testCode, setTestCode] = useState('')
  const [isTestingConnection, setIsTestingConnection] = useState(false)

  const handleConnect = async () => {
    if (!apiKey) {
      toast.error('Preencha a API Key')
      return
    }

    if (apiKey.length < 10) {
      toast.error('API Key inválida. Verifique e tente novamente.')
      return
    }

    await connect(apiKey, environment)
  }

  const handleDisconnect = async () => {
    if (confirm('Tem certeza que deseja desconectar o Smartenvios?')) {
      await disconnect()
      setApiKey('')
    }
  }

  const handleTestConnection = async () => {
    if (!testCode) {
      toast.error('Digite um código de rastreamento para testar')
      return
    }

    setIsTestingConnection(true)

    try {
      const validation = validateTrackingCode(testCode)

      if (!validation.is_valid) {
        const errorMessage = validation.errors?.join(', ') || 'Formato inválido'
        toast.error(`Código inválido: ${errorMessage}`)
        return
      }

      toast.success('Código válido! O formato está correto.')
    } catch (error) {
      toast.error('Erro ao validar código')
    } finally {
      setIsTestingConnection(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <Truck className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <CardTitle>Smartenvios</CardTitle>
              <CardDescription>
                Rastreie e gerencie seus envios com Smartenvios
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
                Para conectar o Smartenvios, você precisa de uma API Key.
                <a
                  href="https://smartenvios.com/dashboard/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center ml-1 text-orange-600 hover:underline"
                >
                  Obter API Key
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              {/* Environment Selection */}
              <div className="space-y-3">
                <Label>Ambiente</Label>
                <RadioGroup
                  value={environment}
                  onValueChange={(value) => setEnvironment(value as 'sandbox' | 'production')}
                  disabled={isLoading}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="production" id="production" />
                    <Label htmlFor="production" className="font-normal cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-green-600" />
                        <div>
                          <div className="font-medium">Produção</div>
                          <div className="text-xs text-muted-foreground">
                            Usar em ambiente real
                          </div>
                        </div>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sandbox" id="sandbox" />
                    <Label htmlFor="sandbox" className="font-normal cursor-pointer">
                      <div className="flex items-center gap-2">
                        <TestTube className="h-4 w-4 text-blue-600" />
                        <div>
                          <div className="font-medium">Sandbox</div>
                          <div className="text-xs text-muted-foreground">
                            Para testes e desenvolvimento
                          </div>
                        </div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              {/* API Key Input */}
              <div className="space-y-2">
                <Label htmlFor="api-key">
                  API Key <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="sk_live_••••••••••••••••"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Sua API Key do Smartenvios (mínimo 10 caracteres)
                </p>
              </div>

              <Button
                onClick={handleConnect}
                disabled={isLoading || !apiKey}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Truck className="h-4 w-4 mr-2" />
                    Conectar Smartenvios
                  </>
                )}
              </Button>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Como configurar:</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Acesse o Dashboard do Smartenvios</li>
                <li>Vá em Configurações → API</li>
                <li>Crie ou copie sua API Key</li>
                <li>Selecione o ambiente (Produção ou Sandbox)</li>
                <li>Cole a API Key acima e clique em Conectar</li>
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
                  <span>Ambiente:</span>
                  <Badge variant="secondary">
                    {environment === 'production' ? 'Produção' : 'Sandbox'}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* Test Connection */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">Testar Rastreamento</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Teste a validação de códigos de rastreamento Smartenvios
                </p>

                <div className="flex gap-2">
                  <Input
                    placeholder="Digite um código de rastreamento"
                    value={testCode}
                    onChange={(e) => setTestCode(e.target.value)}
                    disabled={isTestingConnection}
                  />
                  <Button
                    onClick={handleTestConnection}
                    disabled={isTestingConnection || !testCode}
                    variant="outline"
                  >
                    {isTestingConnection ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Validar'
                    )}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  Formatos aceitos: SE + 10-15 caracteres ou SM + 12-16 dígitos
                </p>
              </div>

              <Alert>
                <Package className="h-4 w-4" />
                <AlertDescription>
                  Códigos de rastreamento são detectados automaticamente ao cadastrar pedidos.
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
                    <span className="text-muted-foreground">Ambiente</span>
                    <Badge variant="secondary">
                      {environment === 'production' ? (
                        <Shield className="h-3 w-3 mr-1" />
                      ) : (
                        <TestTube className="h-3 w-3 mr-1" />
                      )}
                      {environment === 'production' ? 'Produção' : 'Sandbox'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Webhooks</span>
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Ativos
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Auto-detecção</span>
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Habilitada
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Features List */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">Recursos Disponíveis</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Rastreamento em tempo real</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Rastreamento em lote</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Notificações automáticas</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Cache inteligente</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Webhooks para atualizações</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Documentation Link */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50">
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-900">
                  Documentação da API
                </span>
              </div>
              <Button variant="link" size="sm" asChild>
                <a
                  href="https://api.smartenvios.com/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600"
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
