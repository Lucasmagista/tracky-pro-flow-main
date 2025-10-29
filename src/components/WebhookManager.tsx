/**
 * Componente de Gerenciamento de Webhooks e Sincronização
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Webhook,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Zap,
  Shield,
  Activity,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { useWebhooks } from '@/hooks/useWebhooks';
import { useBidirectionalSync } from '@/hooks/useBidirectionalSync';
import { useMarketplaceIntegrations } from '@/hooks/useIntegrations';

export function WebhookManager() {
  const { webhooks, isLoading, testWebhook, removeWebhook } = useWebhooks();
  const { toggleAutoSync } = useBidirectionalSync();
  const { integrations } = useMarketplaceIntegrations();
  const [autoSyncStatus, setAutoSyncStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Carregar status de sincronização automática
    const status: Record<string, boolean> = {};
    integrations.forEach((integration) => {
      status[integration.platform] = integration.settings?.enable_bidirectional_sync !== false;
    });
    setAutoSyncStatus(status);
  }, [integrations]);

  const handleToggleAutoSync = async (platform: string, enabled: boolean) => {
    const success = await toggleAutoSync(platform, enabled);
    if (success) {
      setAutoSyncStatus((prev) => ({ ...prev, [platform]: enabled }));
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    await testWebhook(webhookId);
  };

  const handleRemoveWebhook = async (
    webhookId: string,
    platform: string
  ) => {
    const integration = integrations.find((i) => i.platform === platform);
    if (integration?.credentials) {
      await removeWebhook(webhookId, platform, integration.credentials);
    }
  };

  const getStatusColor = (webhook: { is_active: boolean; last_triggered?: string }) => {
    if (!webhook.is_active) return 'text-gray-500';
    if (!webhook.last_triggered) return 'text-yellow-500';
    
    const lastTriggered = new Date(webhook.last_triggered);
    const hoursSinceLastTrigger = (Date.now() - lastTriggered.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLastTrigger > 48) return 'text-orange-500';
    return 'text-green-500';
  };

  const getStatusIcon = (webhook: { is_active: boolean; last_triggered?: string }) => {
    if (!webhook.is_active) return <XCircle className="h-4 w-4" />;
    if (!webhook.last_triggered) return <AlertTriangle className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            <CardTitle>Webhooks & Sincronização Automática</CardTitle>
          </div>
          <CardDescription>
            Gerencie webhooks para importação automática e sincronização bidirecional com marketplaces
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Webhooks Ativos</span>
              </div>
              <div className="text-2xl font-bold">
                {webhooks.filter((w) => w.is_active).length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                de {webhooks.length} configurados
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Sincronização Ativa</span>
              </div>
              <div className="text-2xl font-bold">
                {Object.values(autoSyncStatus).filter(Boolean).length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                plataformas sincronizando
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Integrações</span>
              </div>
              <div className="text-2xl font-bold">
                {integrations.filter((i) => i.is_connected).length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                marketplaces conectados
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhooks List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhooks Registrados
          </CardTitle>
          <CardDescription>
            Webhooks recebem notificações automáticas dos marketplaces quando há novos pedidos ou atualizações
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : webhooks.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Nenhum webhook configurado. Conecte um marketplace para configurar webhooks automáticos.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className={getStatusColor(webhook)}>
                      {getStatusIcon(webhook)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold capitalize">
                          {webhook.platform}
                        </h4>
                        {webhook.is_active ? (
                          <Badge variant="default" className="text-xs">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Inativo
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {webhook.webhook_url}
                      </p>

                      <div className="flex items-center gap-4 mt-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Última ativação:{' '}
                          {webhook.last_triggered
                            ? new Date(webhook.last_triggered).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Nunca'}
                        </div>

                        <Badge variant="outline" className="text-xs">
                          {webhook.events.length} eventos
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestWebhook(webhook.id!)}
                    >
                      <Shield className="h-3 w-3 mr-1" />
                      Testar
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleRemoveWebhook(webhook.webhook_secret, webhook.platform)
                      }
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bidirectional Sync Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sincronização Bidirecional
          </CardTitle>
          <CardDescription>
            Quando ativada, alterações feitas no Tracky são enviadas automaticamente de volta para os marketplaces
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {integrations
            .filter((i) => i.is_connected)
            .map((integration) => (
              <div key={integration.id}>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold capitalize">
                        {integration.platform}
                      </h4>
                      {autoSyncStatus[integration.platform] && (
                        <Badge variant="default" className="text-xs">
                          <Zap className="h-3 w-3 mr-1" />
                          Sincronizando
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Sincroniza códigos de rastreio, status e notificações
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Label htmlFor={`auto-sync-${integration.platform}`}>
                      {autoSyncStatus[integration.platform] ? 'Ativado' : 'Desativado'}
                    </Label>
                    <Switch
                      id={`auto-sync-${integration.platform}`}
                      checked={autoSyncStatus[integration.platform] || false}
                      onCheckedChange={(enabled) =>
                        handleToggleAutoSync(integration.platform, enabled)
                      }
                    />
                  </div>
                </div>

                {autoSyncStatus[integration.platform] && (
                  <Alert className="mt-2 bg-blue-50 border-blue-200">
                    <Activity className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-900">
                      <strong>Sincronização ativa:</strong> Alterações de status e códigos de
                      rastreio serão enviados automaticamente para {integration.platform}.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ))}

          {integrations.filter((i) => i.is_connected).length === 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Conecte um marketplace para habilitar a sincronização bidirecional.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-lg">Como funciona?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              Webhooks (Importação Automática)
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1 ml-6">
              <li>• Novos pedidos são importados automaticamente</li>
              <li>• Atualizações de status são sincronizadas em tempo real</li>
              <li>• Códigos de rastreio são capturados automaticamente</li>
              <li>• Não é necessário importar manualmente</li>
            </ul>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Sincronização Bidirecional
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1 ml-6">
              <li>• Código de rastreio enviado de volta para o marketplace</li>
              <li>• Status do pedido atualizado na loja original</li>
              <li>• Notificações registradas no histórico do pedido</li>
              <li>• Cliente vê atualizações em ambas as plataformas</li>
            </ul>
          </div>

          <Separator />

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Segurança:</strong> Todos os webhooks são validados com assinaturas HMAC
              e apenas requisições autênticas são processadas.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
