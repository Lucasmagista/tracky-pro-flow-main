import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Loader2,
  Store,
  ShoppingCart,
  Globe
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface IntegrationOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  setupRequired: boolean;
  fields?: {
    key: string;
    label: string;
    placeholder: string;
    type: 'text' | 'password' | 'url';
  }[];
}

interface IntegrationSetupProps {
  onComplete: (integrations: Record<string, Record<string, string>>) => void;
  onSkip: () => void;
}

export const IntegrationSetup = ({ onComplete, onSkip }: IntegrationSetupProps) => {
  const { toast } = useToast();
  const [selectedIntegrations, setSelectedIntegrations] = useState<Record<string, boolean>>({});
  const [integrationData, setIntegrationData] = useState<Record<string, Record<string, string>>>({});
  const [connecting, setConnecting] = useState<Record<string, boolean>>({});

  const integrationOptions: IntegrationOption[] = [
    {
      id: 'shopify',
      name: 'Shopify',
      description: 'Conecte sua loja Shopify para sincronização automática de pedidos',
      icon: <Store className="h-6 w-6" />,
      color: 'bg-green-100 text-green-800',
      setupRequired: true,
      fields: [
        { key: 'store_url', label: 'URL da Loja', placeholder: 'minhaloja.myshopify.com', type: 'url' },
        { key: 'api_key', label: 'API Key', placeholder: 'shpka_...', type: 'password' },
        { key: 'api_secret', label: 'API Secret', placeholder: 'shpss_...', type: 'password' }
      ]
    },
    {
      id: 'woocommerce',
      name: 'WooCommerce',
      description: 'Integre com sua loja WooCommerce via REST API',
      icon: <ShoppingCart className="h-6 w-6" />,
      color: 'bg-purple-100 text-purple-800',
      setupRequired: true,
      fields: [
        { key: 'store_url', label: 'URL da Loja', placeholder: 'https://minhaloja.com', type: 'url' },
        { key: 'consumer_key', label: 'Consumer Key', placeholder: 'ck_...', type: 'password' },
        { key: 'consumer_secret', label: 'Consumer Secret', placeholder: 'cs_...', type: 'password' }
      ]
    },
    {
      id: 'mercadolivre',
      name: 'Mercado Livre',
      description: 'Sincronize pedidos automaticamente do Mercado Livre',
      icon: <Globe className="h-6 w-6" />,
      color: 'bg-yellow-100 text-yellow-800',
      setupRequired: true,
      fields: [
        { key: 'app_id', label: 'App ID', placeholder: '123456789', type: 'text' },
        { key: 'client_secret', label: 'Client Secret', placeholder: 'abc123...', type: 'password' },
        { key: 'access_token', label: 'Access Token', placeholder: 'APP_USR-...', type: 'password' }
      ]
    },
    {
      id: 'nuvemshop',
      name: 'Nuvemshop',
      description: 'Importe pedidos automaticamente da sua loja Nuvemshop',
      icon: <Store className="h-6 w-6" />,
      color: 'bg-blue-100 text-blue-800',
      setupRequired: true,
      fields: [
        { key: 'app_id', label: 'App ID', placeholder: '123456', type: 'text' },
        { key: 'app_secret', label: 'App Secret', placeholder: 'secret_...', type: 'password' },
        { key: 'store_url', label: 'URL da Loja', placeholder: 'https://minhaloja.lojaintegrada.com.br', type: 'url' }
      ]
    }
  ];

  const handleIntegrationToggle = (integrationId: string) => {
    setSelectedIntegrations(prev => ({
      ...prev,
      [integrationId]: !prev[integrationId]
    }));
  };

  const handleFieldChange = (integrationId: string, fieldKey: string, value: string) => {
    setIntegrationData(prev => ({
      ...prev,
      [integrationId]: {
        ...prev[integrationId],
        [fieldKey]: value
      }
    }));
  };

  const handleConnect = async (integration: IntegrationOption) => {
    const data = integrationData[integration.id] || {};

    // Validate required fields
    const missingFields = integration.fields?.filter(field => !data[field.key]) || [];
    if (missingFields.length > 0) {
      toast({
        title: "Campos obrigatórios",
        description: `Preencha todos os campos para ${integration.name}`,
        variant: "destructive",
      });
      return;
    }

    setConnecting(prev => ({ ...prev, [integration.id]: true }));

    try {
      // Simulate API connection
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Here you would normally make the actual API call to connect
      // For now, we'll just mark as connected

      toast({
        title: "Integração configurada!",
        description: `${integration.name} foi conectado com sucesso.`,
      });

      setSelectedIntegrations(prev => ({
        ...prev,
        [integration.id]: false // Hide the form after successful connection
      }));

    } catch (error) {
      toast({
        title: "Erro na conexão",
        description: `Não foi possível conectar com ${integration.name}. Verifique suas credenciais.`,
        variant: "destructive",
      });
    } finally {
      setConnecting(prev => ({ ...prev, [integration.id]: false }));
    }
  };

  const handleFinish = () => {
    const configuredIntegrations = Object.keys(selectedIntegrations)
      .filter(id => selectedIntegrations[id])
      .reduce((acc, id) => {
        acc[id] = integrationData[id] || {};
        return acc;
      }, {} as Record<string, Record<string, string>>);

    onComplete(configuredIntegrations);
  };

  const hasSelectedIntegrations = Object.values(selectedIntegrations).some(selected => selected);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Integrações Opcionais</h3>
        <p className="text-muted-foreground">
          Conecte suas plataformas de e-commerce para automatizar o processo de rastreamento
        </p>
      </div>

      <div className="grid gap-4">
        {integrationOptions.map((integration) => (
          <Card key={integration.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${integration.color}`}>
                    {integration.icon}
                  </div>
                  <div>
                    <CardTitle className="text-base">{integration.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {integration.description}
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {connecting[integration.id] && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Conectando...
                    </Badge>
                  )}

                  <Button
                    variant={selectedIntegrations[integration.id] ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleIntegrationToggle(integration.id)}
                    disabled={connecting[integration.id]}
                  >
                    {selectedIntegrations[integration.id] ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Configurar
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Conectar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>

            {selectedIntegrations[integration.id] && (
              <CardContent className="pt-0">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <span>Preencha as credenciais da API para conectar</span>
                  </div>

                  <div className="grid gap-3">
                    {integration.fields?.map((field) => (
                      <div key={field.key} className="space-y-1">
                        <Label htmlFor={`${integration.id}-${field.key}`} className="text-sm">
                          {field.label}
                        </Label>
                        <Input
                          id={`${integration.id}-${field.key}`}
                          type={field.type}
                          placeholder={field.placeholder}
                          value={integrationData[integration.id]?.[field.key] || ''}
                          onChange={(e) => handleFieldChange(integration.id, field.key, e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => handleConnect(integration)}
                      disabled={connecting[integration.id]}
                      className="flex-1"
                    >
                      {connecting[integration.id] ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Conectando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Conectar {integration.name}
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleIntegrationToggle(integration.id)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onSkip} className="flex-1">
          Pular por enquanto
        </Button>
        <Button
          onClick={handleFinish}
          disabled={!hasSelectedIntegrations && Object.keys(selectedIntegrations).length === 0}
          className="flex-1"
        >
          {hasSelectedIntegrations ? 'Finalizar Configuração' : 'Continuar sem integrações'}
        </Button>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        Você pode configurar integrações posteriormente nas configurações da conta
      </div>
    </div>
  );
};