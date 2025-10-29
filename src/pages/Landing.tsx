import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Check, Package, Bell, BarChart3, Brain, Clock, TrendingUp, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-tracking.jpg";
import featureNotifications from "@/assets/feature-notifications.jpg";
import featureAnalytics from "@/assets/feature-analytics.jpg";
import featureAi from "@/assets/feature-ai.jpg";

const Landing = () => {
  const features = [
    {
      icon: Package,
      title: "Rastreamento Automático",
      description: "Busca automática de status por API. Identificação da transportadora pelo código.",
      image: heroImage,
    },
    {
      icon: Bell,
      title: "Notificações Inteligentes",
      description: "Notifique clientes via WhatsApp, SMS ou e-mail a cada etapa da entrega.",
      image: featureNotifications,
    },
    {
      icon: BarChart3,
      title: "Análise de Desempenho",
      description: "Relatórios completos de desempenho por transportadora e tempo médio de entrega.",
      image: featureAnalytics,
    },
    {
      icon: Brain,
      title: "IA Logística",
      description: "Detecção preditiva de atrasos baseada em histórico e análise de rotas.",
      image: featureAi,
    },
  ];

  const benefits = [
    {
      icon: Clock,
      title: "Economize Tempo",
      description: "Automatize o acompanhamento de todos os seus pedidos em um só lugar",
    },
    {
      icon: TrendingUp,
      title: "Aumente as Vendas",
      description: "Clientes satisfeitos com transparência voltam a comprar mais",
    },
    {
      icon: Shield,
      title: "Reduza Reclamações",
      description: "Identifique problemas antes que o cliente precise entrar em contato",
    },
  ];

  const plans = [
    {
      name: "Gratuito",
      price: "R$ 0",
      period: "/mês",
      description: "Ideal para testar o sistema",
      features: [
        "Até 30 pedidos/mês",
        "Rastreamento básico",
        "Notificações por e-mail",
        "Suporte por e-mail",
      ],
      cta: "Começar Grátis",
      variant: "outline" as const,
    },
    {
      name: "Básico",
      price: "R$ 29",
      period: "/mês",
      description: "Para pequenas lojas",
      features: [
        "Até 300 pedidos/mês",
        "Rastreamento completo",
        "WhatsApp + SMS + E-mail",
        "Relatórios básicos",
        "Suporte prioritário",
      ],
      cta: "Começar Agora",
      variant: "default" as const,
    },
    {
      name: "Profissional",
      price: "R$ 79",
      period: "/mês",
      description: "Para lojas em crescimento",
      features: [
        "Até 1.000 pedidos/mês",
        "Rastreamento completo",
        "Todas as notificações",
        "Relatórios avançados",
        "IA de previsão básica",
        "Suporte 24/7",
      ],
      cta: "Começar Agora",
      variant: "hero" as const,
      popular: true,
    },
    {
      name: "Corporativo",
      price: "R$ 199",
      period: "/mês",
      description: "Para grandes operações",
      features: [
        "Pedidos ilimitados",
        "Rastreamento completo",
        "Todas as notificações",
        "Relatórios customizados",
        "IA de previsão avançada",
        "Gerente de conta dedicado",
        "API privada",
      ],
      cta: "Falar com Vendas",
      variant: "secondary" as const,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-24 pb-12 md:pt-32 md:pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-background -z-10" />
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-block">
                <span className="px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  Rastreamento Inteligente de Pedidos
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                Nunca mais perca um pedido de vista
              </h1>
              <p className="text-lg text-muted-foreground">
                Centralize o rastreamento de todos os seus pedidos, notifique clientes automaticamente 
                e identifique problemas antes que eles aconteçam.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/dashboard">
                  <Button variant="hero" size="xl">
                    Começar Grátis
                  </Button>
                </Link>
                <Button variant="outline" size="xl">
                  Ver Demonstração
                </Button>
              </div>
              <div className="flex items-center gap-8 pt-4">
                <div>
                  <p className="text-2xl font-bold">99%</p>
                  <p className="text-sm text-muted-foreground">Satisfação</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">10k+</p>
                  <p className="text-sm text-muted-foreground">Pedidos/dia</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">500+</p>
                  <p className="text-sm text-muted-foreground">Lojas</p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 blur-3xl -z-10" />
              <img 
                src={heroImage} 
                alt="Rastreamento de Pedidos" 
                className="rounded-2xl shadow-2xl w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <Card key={index} className="text-center">
                <CardHeader>
                  <div className="mx-auto p-4 rounded-full bg-primary/10 w-fit mb-4">
                    <benefit.icon className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="funcionalidades" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Tudo que você precisa para gerenciar entregas
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Funcionalidades completas para automatizar o rastreamento e melhorar a experiência dos seus clientes
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-12">
            {features.map((feature, index) => (
              <Card key={index} className="overflow-hidden hover:shadow-lg transition-smooth">
                <img 
                  src={feature.image} 
                  alt={feature.title}
                  className="w-full h-48 object-cover"
                />
                <CardHeader>
                  <div className="p-3 rounded-lg bg-primary/10 w-fit mb-2">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planos" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Planos para todos os tamanhos de negócio
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Comece gratuitamente e escale conforme seu negócio cresce
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, index) => (
              <Card key={index} className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 rounded-full gradient-hero text-primary-foreground text-xs font-semibold shadow-glow">
                      Mais Popular
                    </span>
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link to="/dashboard" className="w-full">
                    <Button variant={plan.variant} className="w-full">
                      {plan.cta}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <Card className="gradient-hero text-primary-foreground overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
            <CardHeader className="relative z-10 text-center pb-8">
              <CardTitle className="text-3xl md:text-4xl mb-4">
                Pronto para revolucionar suas entregas?
              </CardTitle>
              <CardDescription className="text-primary-foreground/90 text-lg">
                Comece gratuitamente e veja seus clientes mais satisfeitos em minutos
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 flex justify-center pb-12">
              <Link to="/dashboard">
                <Button variant="secondary" size="xl" className="shadow-lg">
                  Criar Conta Grátis
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Landing;
