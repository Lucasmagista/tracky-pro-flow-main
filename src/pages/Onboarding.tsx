import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Store,
  Package,
  Bell,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Mail,
  MessageSquare,
  ExternalLink,
  PlayCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { IntegrationSetup } from "@/components/IntegrationSetup";
import { AppTour } from "@/components/AppTour";

interface OnboardingData {
  storeName: string;
  storeEmail: string;
  storePhone: string;
  storeAddress: string;
  notifications: {
    whatsapp: boolean;
    email: boolean;
    sms: boolean;
  };
  integrations: Record<string, Record<string, string>>;
  startTour: boolean;
  completed: boolean;
}

const Onboarding = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showTour, setShowTour] = useState(false);

  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    storeName: "",
    storeEmail: "",
    storePhone: "",
    storeAddress: "",
    notifications: {
      whatsapp: true,
      email: false,
      sms: false,
    },
    integrations: {},
    startTour: true,
    completed: false,
  });

  const totalSteps = 6;
  const progress = (currentStep / totalSteps) * 100;

  const checkOnboardingStatus = useCallback(async () => {
    try {
      // First try to get the profile with onboarding_completed column
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        // On error, don't redirect - let them complete onboarding
        return;
      }

      // Check if onboarding_completed property exists
      const onboardingCompleted = (profile as unknown as { onboarding_completed?: boolean })?.onboarding_completed;
      if (onboardingCompleted) {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Error checking onboarding status:", error);
      // On error, don't redirect - let them complete onboarding
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user) {
      checkOnboardingStatus();
    }
  }, [user, checkOnboardingStatus]);

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Salvar dados da loja
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          store_name: onboardingData.storeName,
          store_email: onboardingData.storeEmail,
          store_phone: onboardingData.storePhone,
          store_address: onboardingData.storeAddress,
          onboarding_completed: true,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // TODO: Salvar preferências de notificação quando a tabela for criada
      // TODO: Salvar integrações configuradas

      toast({
        title: "Bem-vindo ao Tracky Pro Flow! 🎉",
        description: "Sua conta foi configurada com sucesso.",
      });

      if (onboardingData.startTour) {
        setShowTour(true);
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Error completing onboarding:", error);
      toast({
        title: "Erro ao salvar",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTourComplete = () => {
    setShowTour(false);
    navigate("/dashboard");
  };

  const handleTourSkip = () => {
    setShowTour(false);
    navigate("/dashboard");
  };

  const tourSteps = [
    {
      id: 'dashboard-header',
      title: 'Bem-vindo ao Dashboard',
      description: 'Este é o centro de controle dos seus pedidos. Aqui você verá um resumo de todas as atividades e poderá acessar todas as funcionalidades principais.',
      target: '[data-tour="dashboard-header"]',
      position: 'bottom' as const,
    },
    {
      id: 'dashboard-actions',
      title: 'Ações Principais',
      description: 'Use estes botões para importar pedidos, exportar relatórios ou adicionar novos pedidos manualmente.',
      target: '[data-tour="dashboard-actions"]',
      position: 'bottom' as const,
    },
    {
      id: 'dashboard-metrics',
      title: 'Métricas de Performance',
      description: 'Acompanhe o desempenho dos seus pedidos com métricas em tempo real: total de pedidos, status de entrega e taxas de sucesso.',
      target: '[data-tour="dashboard-metrics"]',
      position: 'top' as const,
    },
    {
      id: 'dashboard-charts',
      title: 'Análises Visuais',
      description: 'Visualize a distribuição dos status dos pedidos e o volume por transportadora através de gráficos interativos.',
      target: '[data-tour="dashboard-charts"]',
      position: 'top' as const,
    },
    {
      id: 'dashboard-orders',
      title: 'Lista de Pedidos',
      description: 'Veja todos os seus pedidos em uma tabela organizada. Aqui você pode acompanhar o status, buscar pedidos específicos e atualizar rastreamentos.',
      target: '[data-tour="dashboard-orders"]',
      position: 'top' as const,
    },
    {
      id: 'dashboard-filters',
      title: 'Busca e Filtros',
      description: 'Use a barra de busca para encontrar pedidos específicos ou aplique filtros por status para visualizar apenas o que interessa.',
      target: '[data-tour="dashboard-filters"]',
      position: 'left' as const,
    },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Store className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Bem-vindo ao Tracky Pro Flow!</CardTitle>
              <CardDescription className="text-lg">
                Vamos configurar sua conta para começar a rastrear pedidos automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg border">
                  <Package className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <h3 className="font-semibold">Rastreamento</h3>
                  <p className="text-sm text-muted-foreground">Acompanhe pedidos em tempo real</p>
                </div>
                <div className="text-center p-4 rounded-lg border">
                  <Bell className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <h3 className="font-semibold">Notificações</h3>
                  <p className="text-sm text-muted-foreground">Mantenha clientes informados</p>
                </div>
                <div className="text-center p-4 rounded-lg border">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <h3 className="font-semibold">Automação</h3>
                  <p className="text-sm text-muted-foreground">Tudo funcionando automaticamente</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="w-6 h-6" />
                Informações da Loja
              </CardTitle>
              <CardDescription>
                Conte-nos sobre sua loja para personalizar sua experiência
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="storeName">Nome da Loja *</Label>
                  <Input
                    id="storeName"
                    placeholder="Minha Loja Online"
                    value={onboardingData.storeName}
                    onChange={(e) => setOnboardingData({ ...onboardingData, storeName: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storeEmail">Email da Loja</Label>
                  <Input
                    id="storeEmail"
                    type="email"
                    placeholder="contato@minhaloja.com"
                    value={onboardingData.storeEmail}
                    onChange={(e) => setOnboardingData({ ...onboardingData, storeEmail: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storePhone">Telefone</Label>
                  <Input
                    id="storePhone"
                    placeholder="(11) 99999-9999"
                    value={onboardingData.storePhone}
                    onChange={(e) => setOnboardingData({ ...onboardingData, storePhone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="storeAddress">Endereço (Opcional)</Label>
                <Textarea
                  id="storeAddress"
                  placeholder="Rua das Flores, 123 - Centro, São Paulo - SP"
                  value={onboardingData.storeAddress}
                  onChange={(e) => setOnboardingData({ ...onboardingData, storeAddress: e.target.value })}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-6 h-6" />
                Preferências de Notificação
              </CardTitle>
              <CardDescription>
                Escolha como seus clientes serão notificados sobre o status dos pedidos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-8 h-8 text-green-600" />
                    <div>
                      <h3 className="font-semibold">WhatsApp</h3>
                      <p className="text-sm text-muted-foreground">Notificações rápidas e diretas</p>
                    </div>
                  </div>
                  <Badge variant={onboardingData.notifications.whatsapp ? "default" : "secondary"}>
                    {onboardingData.notifications.whatsapp ? "Recomendado" : "Opcional"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="w-8 h-8 text-blue-600" />
                    <div>
                      <h3 className="font-semibold">Email</h3>
                      <p className="text-sm text-muted-foreground">Notificações formais por email</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={onboardingData.notifications.email}
                    onChange={(e) => setOnboardingData({
                      ...onboardingData,
                      notifications: { ...onboardingData.notifications, email: e.target.checked }
                    })}
                    className="w-4 h-4"
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-8 h-8 text-orange-600" />
                    <div>
                      <h3 className="font-semibold">SMS</h3>
                      <p className="text-sm text-muted-foreground">Notificações por mensagem de texto</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={onboardingData.notifications.sms}
                    onChange={(e) => setOnboardingData({
                      ...onboardingData,
                      notifications: { ...onboardingData.notifications, sms: e.target.checked }
                    })}
                    className="w-4 h-4"
                  />
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">💡 Dica</h4>
                <p className="text-sm text-muted-foreground">
                  O WhatsApp é a forma mais eficaz de manter seus clientes informados.
                  As notificações são instantâneas e têm alta taxa de abertura.
                </p>
              </div>
            </CardContent>
          </Card>
        );

      case 4:
        return (
          <div className="max-w-4xl mx-auto">
            <IntegrationSetup
              onComplete={(integrations) => {
                setOnboardingData({ ...onboardingData, integrations });
                handleNext();
              }}
              onSkip={() => handleNext()}
            />
          </div>
        );

      case 5:
        return (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle className="w-6 h-6" />
                Tour Interativo
              </CardTitle>
              <CardDescription>
                Queremos te mostrar as principais funcionalidades da plataforma
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-4">
                <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                  <PlayCircle className="w-10 h-10 text-primary" />
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Tour Guiado da Plataforma</h3>
                  <p className="text-muted-foreground">
                    Em menos de 2 minutos, vamos te mostrar como usar todas as funcionalidades
                    do Tracky Pro Flow para gerenciar seus pedidos de forma eficiente.
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mt-6">
                  <div className="text-center p-4 rounded-lg border">
                    <Package className="w-6 h-6 mx-auto mb-2 text-primary" />
                    <p className="text-sm font-medium">Dashboard</p>
                  </div>
                  <div className="text-center p-4 rounded-lg border">
                    <Bell className="w-6 h-6 mx-auto mb-2 text-primary" />
                    <p className="text-sm font-medium">Rastreamento</p>
                  </div>
                  <div className="text-center p-4 rounded-lg border">
                    <ExternalLink className="w-6 h-6 mx-auto mb-2 text-primary" />
                    <p className="text-sm font-medium">Integrações</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onboardingData.startTour}
                    onChange={(e) => setOnboardingData({
                      ...onboardingData,
                      startTour: e.target.checked
                    })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Iniciar tour após configurar conta</span>
                </label>
              </div>
            </CardContent>
          </Card>
        );

      case 6:
        return (
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Tudo Pronto!</CardTitle>
              <CardDescription className="text-lg">
                Sua conta está configurada e pronta para começar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span>Perfil da loja configurado</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span>Preferências de notificação definidas</span>
                </div>
                {Object.keys(onboardingData.integrations).length > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span>{Object.keys(onboardingData.integrations).length} integração(ões) configurada(s)</span>
                  </div>
                )}
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span>Dashboard pronto para uso</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span>Sistema de rastreamento ativo</span>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">🚀 Próximos Passos</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Importe seus primeiros pedidos</li>
                  <li>• Configure integrações com marketplaces</li>
                  <li>• Personalize templates de notificação</li>
                  <li>• Explore o dashboard e relatórios</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-12">
        {/* Progress Bar */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium">Configuração da Conta</span>
            <span className="text-sm text-muted-foreground">{currentStep} de {totalSteps}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Content */}
        <div className="mb-8">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="max-w-2xl mx-auto flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Anterior
          </Button>

          {currentStep < totalSteps ? (
            <Button
              onClick={handleNext}
              disabled={currentStep === 2 && !onboardingData.storeName.trim()}
            >
              Próximo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90"
            >
              {isLoading ? "Salvando..." : "Começar a Usar"}
              <CheckCircle className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      {/* Tour Component */}
      {showTour && (
        <AppTour
          steps={tourSteps}
          onComplete={handleTourComplete}
          onSkip={handleTourSkip}
        />
      )}
    </div>
  );
};

export default Onboarding;