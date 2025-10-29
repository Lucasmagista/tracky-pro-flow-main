import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Check,
  Crown,
  Zap,
  Users,
  Package,
  Bell,
  Settings,
  CreditCard,
  Calendar,
  AlertTriangle,
  TrendingUp,
  FileText,
  CheckCircle,
  DollarSign,
  ArrowLeft,
  Download,
  Mail,
  Info,
  XCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  HelpCircle,
  Shield,
  Sparkles,
  Clock,
  BarChart3,
  Activity,
  Percent,
  RefreshCw,
  ExternalLink,
  Gift
} from "lucide-react";
import { usePlans, useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { useUsageHistory } from "@/hooks/useUsageHistory";
import EmptyState from "@/components/EmptyState";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { UsageChart } from "@/components/subscription/UsageChart";
import { PlanComparison } from "@/components/subscription/PlanComparison";
import { AnalyticsDashboard } from "@/components/subscription/AnalyticsDashboard";

interface BillingHistory {
  id: string;
  date: Date;
  amount: number;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  invoiceUrl?: string;
  description: string;
}

interface PaymentMethod {
  id: string;
  type: 'credit_card' | 'debit_card' | 'pix' | 'boleto';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

const Subscription = () => {
  const { plans, isLoading: plansLoading } = usePlans();
  const {
    subscription,
    isLoading: subscriptionLoading,
    upgradePlan,
    cancelSubscription,
    reactivateSubscription,
    getUsagePercentage,
    isNearLimit,
    isOverLimit,
    isUpgrading,
    isCanceling,
    isReactivating
  } = useSubscription();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  
  // Buscar userId
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
    };
    getUser();
  }, []);

  // Buscar histórico de uso
  const { data: usageHistory } = useUsageHistory(userId, 30);
  
  // Dialog states
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [downgradeDialogOpen, setDowngradeDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  
  // Form states
  const [cancelReason, setCancelReason] = useState("");
  const [cancelFeedback, setCancelFeedback] = useState("");
  const [newPlanId, setNewPlanId] = useState<string | null>(null);
  
  // Payment method states
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [paymentType, setPaymentType] = useState<'credit_card' | 'pix' | 'boleto'>('credit_card');
  
  // Data states
  const [billingHistory, setBillingHistory] = useState<BillingHistory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoadingBilling, setIsLoadingBilling] = useState(true);
  const [isLoadingPayment, setIsLoadingPayment] = useState(true);
  
  // Fetch billing history
  useEffect(() => {
    const fetchBillingHistory = async () => {
      setIsLoadingBilling(true);
      try {
        if (!subscription) {
          setBillingHistory([]);
          setIsLoadingBilling(false);
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('billing_history')
          .select('*')
          .eq('subscription_id', subscription.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Erro ao carregar histórico de faturamento:', error);
          toast({
            title: "Erro ao carregar histórico",
            description: "Não foi possível carregar o histórico de faturamento.",
            variant: "destructive",
          });
          setBillingHistory([]);
        } else {
          setBillingHistory((data || []).map(bill => ({
            id: bill.id,
            date: new Date(bill.created_at),
            amount: Number(bill.amount),
            status: bill.status as BillingHistory['status'],
            invoiceUrl: bill.invoice_url || undefined,
            description: bill.description,
          })));
        }
      } catch (error) {
        console.error('Erro ao carregar histórico de faturamento:', error);
        toast({
          title: "Erro ao carregar histórico",
          description: "Não foi possível carregar o histórico de faturamento.",
          variant: "destructive",
        });
        setBillingHistory([]);
      } finally {
        setIsLoadingBilling(false);
      }
    };

    fetchBillingHistory();
  }, [subscription, toast]);

  // Fetch payment methods
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      setIsLoadingPayment(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setPaymentMethods([]);
          setIsLoadingPayment(false);
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('payment_methods')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('is_default', { ascending: false });

        if (error) {
          console.error('Erro ao carregar métodos de pagamento:', error);
          toast({
            title: "Erro ao carregar pagamentos",
            description: "Não foi possível carregar os métodos de pagamento.",
            variant: "destructive",
          });
          setPaymentMethods([]);
        } else {
          setPaymentMethods((data || []).map(method => ({
            id: method.id,
            type: method.type as PaymentMethod['type'],
            last4: method.card_last4 || undefined,
            brand: method.card_brand || undefined,
            expiryMonth: method.card_exp_month || undefined,
            expiryYear: method.card_exp_year || undefined,
            isDefault: method.is_default,
          })));
        }
      } catch (error) {
        console.error('Erro ao carregar métodos de pagamento:', error);
        toast({
          title: "Erro ao carregar pagamentos",
          description: "Não foi possível carregar os métodos de pagamento.",
          variant: "destructive",
        });
        setPaymentMethods([]);
      } finally {
        setIsLoadingPayment(false);
      }
    };

    fetchPaymentMethods();
  }, [toast]);

  const handleUpgrade = async (planId: string) => {
    const selectedPlanData = plans.find(p => p.id === planId);
    const currentPlanData = plans.find(p => p.id === subscription?.planId);
    
    if (!selectedPlanData || !currentPlanData) return;
    
    // Verificar se é upgrade ou downgrade
    if (selectedPlanData.price > currentPlanData.price) {
      setNewPlanId(planId);
      setUpgradeDialogOpen(true);
    } else if (selectedPlanData.price < currentPlanData.price) {
      setNewPlanId(planId);
      setDowngradeDialogOpen(true);
    } else {
      toast({
        title: "Plano atual",
        description: "Este já é o seu plano atual.",
        variant: "default",
      });
    }
  };

  const confirmUpgrade = async () => {
    if (!newPlanId) return;
    
    try {
      setSelectedPlan(newPlanId);
      await upgradePlan(newPlanId);
      
      toast({
        title: "✨ Plano atualizado!",
        description: "Seu upgrade foi realizado com sucesso. Aproveite os novos recursos!",
      });
      setUpgradeDialogOpen(false);
    } catch (error) {
      console.error('Erro ao fazer upgrade:', error);
      toast({
        title: "Erro ao fazer upgrade",
        description: error instanceof Error ? error.message : "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setSelectedPlan(null);
      setNewPlanId(null);
    }
  };

  const confirmDowngrade = async () => {
    if (!newPlanId) return;
    
    try {
      setSelectedPlan(newPlanId);
      await upgradePlan(newPlanId);
      
      toast({
        title: "Plano alterado",
        description: "O downgrade será aplicado no final do período atual. Você continuará com acesso total até lá.",
      });
      setDowngradeDialogOpen(false);
    } catch (error) {
      console.error('Erro ao fazer downgrade:', error);
      toast({
        title: "Erro ao fazer downgrade",
        description: error instanceof Error ? error.message : "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setSelectedPlan(null);
      setNewPlanId(null);
    }
  };

  const handleCancel = async () => {
    try {
      if (!cancelReason) {
        toast({
          title: "Motivo obrigatório",
          description: "Por favor, selecione o motivo do cancelamento.",
          variant: "destructive",
        });
        return;
      }
      
      await cancelSubscription(cancelReason, cancelFeedback);
      
      toast({
        title: "😢 Assinatura cancelada",
        description: "Sua assinatura será cancelada no final do período atual. Esperamos vê-lo novamente em breve!",
      });
      setCancelDialogOpen(false);
      setCancelReason("");
      setCancelFeedback("");
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      toast({
        title: "Erro ao cancelar",
        description: error instanceof Error ? error.message : "Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  };

  const handleUpdatePayment = async () => {
    try {
      if (paymentType === 'credit_card') {
        if (!cardNumber || !cardExpiry || !cardCvv || !cardName) {
          toast({
            title: "Dados incompletos",
            description: "Preencha todos os campos do cartão.",
            variant: "destructive",
          });
          return;
        }
        
        // Validar número do cartão (Luhn algorithm)
        if (!validateCardNumber(cardNumber.replace(/\s/g, ''))) {
          toast({
            title: "Cartão inválido",
            description: "O número do cartão informado não é válido.",
            variant: "destructive",
          });
          return;
        }
        
        // Validar data de expiração
        if (!validateExpiry(cardExpiry)) {
          toast({
            title: "Data inválida",
            description: "A data de expiração é inválida ou está no passado.",
            variant: "destructive",
          });
          return;
        }
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Usuário não autenticado.",
          variant: "destructive",
        });
        return;
      }

      // Salvar método de pagamento no banco
      const [month, year] = cardExpiry.split('/').map(v => parseInt(v, 10));
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('payment_methods').insert({
        user_id: user.id,
        type: paymentType,
        card_brand: paymentType === 'credit_card' ? getCardBrand(cardNumber.replace(/\s/g, '')) : null,
        card_last4: paymentType === 'credit_card' ? cardNumber.replace(/\s/g, '').slice(-4) : null,
        card_exp_month: paymentType === 'credit_card' ? month : null,
        card_exp_year: paymentType === 'credit_card' ? (year + 2000) : null,
        holder_name: cardName || null,
        is_default: paymentMethods.length === 0, // Primeiro método é padrão
        is_active: true,
      });

      if (error) {
        console.error('Erro ao salvar método de pagamento:', error);
        toast({
          title: "Erro ao salvar",
          description: "Não foi possível salvar o método de pagamento.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "✅ Pagamento adicionado",
        description: "Método de pagamento adicionado com sucesso!",
      });
      setPaymentDialogOpen(false);
      setCardNumber("");
      setCardExpiry("");
      setCardCvv("");
      setCardName("");
      
      // Recarregar métodos de pagamento
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('payment_methods')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (data) {
        setPaymentMethods(data.map(method => ({
          id: method.id,
          type: method.type as PaymentMethod['type'],
          last4: method.card_last4 || undefined,
          brand: method.card_brand || undefined,
          expiryMonth: method.card_exp_month || undefined,
          expiryYear: method.card_exp_year || undefined,
          isDefault: method.is_default,
        })));
      }
    } catch (error) {
      console.error('Erro ao atualizar pagamento:', error);
      toast({
        title: "Erro ao atualizar",
        description: error instanceof Error ? error.message : "Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  };

  const validateCardNumber = (number: string): boolean => {
    // Luhn algorithm
    let sum = 0;
    let isEven = false;
    
    for (let i = number.length - 1; i >= 0; i--) {
      let digit = parseInt(number[i], 10);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  };

  const validateExpiry = (expiry: string): boolean => {
    const [month, year] = expiry.split('/').map(v => parseInt(v, 10));
    if (!month || !year) return false;
    
    const now = new Date();
    const currentYear = now.getFullYear() % 100;
    const currentMonth = now.getMonth() + 1;
    
    if (month < 1 || month > 12) return false;
    if (year < currentYear) return false;
    if (year === currentYear && month < currentMonth) return false;
    
    return true;
  };

  const downloadInvoice = async (invoice: BillingHistory) => {
    try {
      if (!invoice.invoiceUrl) {
        toast({
          title: "Fatura indisponível",
          description: "Esta fatura ainda não está disponível para download.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "📄 Baixando fatura",
        description: `Fatura ${invoice.id.substring(0, 8)} será baixada em instantes.`,
      });
      
      window.open(invoice.invoiceUrl, '_blank');
    } catch (error) {
      console.error('Erro ao baixar fatura:', error);
      toast({
        title: "Erro ao baixar",
        description: "Não foi possível baixar a fatura.",
        variant: "destructive",
      });
    }
  };

  const removePaymentMethod = async (methodId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('payment_methods')
        .update({ is_active: false })
        .eq('id', methodId);

      if (error) throw error;

      setPaymentMethods(methods => methods.filter(m => m.id !== methodId));
      
      toast({
        title: "Método removido",
        description: "Método de pagamento removido com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao remover método:', error);
      toast({
        title: "Erro ao remover",
        description: "Não foi possível remover o método de pagamento.",
        variant: "destructive",
      });
    }
  };

  const setDefaultPaymentMethod = async (methodId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Remover padrão de todos
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('payment_methods')
        .update({ is_default: false })
        .eq('user_id', user.id);

      // Definir novo padrão
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('payment_methods')
        .update({ is_default: true })
        .eq('id', methodId);

      if (error) throw error;

      setPaymentMethods(methods => 
        methods.map(m => ({ ...m, isDefault: m.id === methodId }))
      );
      
      toast({
        title: "Método padrão atualizado",
        description: "Este método agora é o padrão para pagamentos.",
      });
    } catch (error) {
      console.error('Erro ao definir método padrão:', error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível definir o método como padrão.",
        variant: "destructive",
      });
    }
  };

  const formatCardNumber = (value: string): string => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };

  const formatExpiry = (value: string): string => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.slice(0, 2) + '/' + v.slice(2, 4);
    }
    return v;
  };

  const getCardBrand = (number: string): string => {
    const firstDigit = number[0];
    if (firstDigit === '4') return 'Visa';
    if (firstDigit === '5') return 'Mastercard';
    if (firstDigit === '3') return 'Amex';
    if (firstDigit === '6') return 'Discover';
    return 'Cartão';
  };

  const getStatusColor = (status: BillingHistory['status']) => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'failed':
        return 'destructive';
      case 'refunded':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: BillingHistory['status']) => {
    switch (status) {
      case 'paid':
        return 'Pago';
      case 'pending':
        return 'Pendente';
      case 'failed':
        return 'Falhou';
      case 'refunded':
        return 'Reembolsado';
      default:
        return status;
    }
  };

  if (plansLoading || subscriptionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const currentPlan = plans.find(p => p.id === subscription?.planId);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1 pt-20 pb-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <Link to="/dashboard">
                <Button variant="outline" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold mb-2">💳 Planos e Assinatura</h1>
                <p className="text-muted-foreground">
                  Gerencie seu plano, monitore uso e controle faturamento
                </p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="current" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="current">
                <Shield className="w-4 h-4 mr-2" />
                Plano Atual
              </TabsTrigger>
              <TabsTrigger value="plans">
                <Sparkles className="w-4 h-4 mr-2" />
                Todos os Planos
              </TabsTrigger>
              <TabsTrigger value="billing">
                <CreditCard className="w-4 h-4 mr-2" />
                Faturamento
              </TabsTrigger>
              <TabsTrigger value="usage">
                <TrendingUp className="w-4 h-4 mr-2" />
                Uso Detalhado
              </TabsTrigger>
            </TabsList>

        <TabsContent value="current" className="space-y-6">
          {!subscription ? (
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-green-600" />
                  Plano Gratuito Ativo
                </CardTitle>
                <CardDescription>
                  Você está no plano gratuito. Faça upgrade para desbloquear recursos avançados e aumentar seus limites!
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Recursos do Plano Gratuito */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      Recursos Incluídos
                    </h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        Até 50 pedidos/mês
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        100 notificações WhatsApp/mês
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        1 integração marketplace
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        Rastreamento básico
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        Relatórios simples
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        Suporte por email
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      Desbloqueie com Upgrade
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <Crown className="w-4 h-4" />
                        Até 1.000 pedidos/mês
                      </li>
                      <li className="flex items-center gap-2">
                        <Crown className="w-4 h-4" />
                        5.000 notificações/mês
                      </li>
                      <li className="flex items-center gap-2">
                        <Crown className="w-4 h-4" />
                        Integrações ilimitadas
                      </li>
                      <li className="flex items-center gap-2">
                        <Crown className="w-4 h-4" />
                        Analytics avançado
                      </li>
                      <li className="flex items-center gap-2">
                        <Crown className="w-4 h-4" />
                        API completa
                      </li>
                      <li className="flex items-center gap-2">
                        <Crown className="w-4 h-4" />
                        Suporte prioritário
                      </li>
                    </ul>
                  </div>
                </div>

                <Alert className="border-purple-200 bg-purple-50">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <AlertTitle>Pronto para crescer?</AlertTitle>
                  <AlertDescription>
                    Faça upgrade agora e ganhe 20% de desconto no primeiro mês com o código <strong>UPGRADE20</strong>
                  </AlertDescription>
                </Alert>

                {/* Cards de Planos para Upgrade */}
                <div className="grid md:grid-cols-3 gap-4">
                  {plans.filter(plan => plan.id !== 'free').slice(0, 3).map((plan) => (
                    <Card key={plan.id} className={plan.popular ? "border-primary" : ""}>
                      {plan.popular && (
                        <div className="bg-primary text-primary-foreground text-xs font-semibold py-1 text-center">
                          MAIS POPULAR
                        </div>
                      )}
                      <CardHeader className="text-center pb-4">
                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                        <div className="mt-2">
                          <span className="text-2xl font-bold">R$ {plan.price}</span>
                          <span className="text-sm text-muted-foreground">/mês</span>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Button 
                          className="w-full" 
                          variant={plan.popular ? "default" : "outline"}
                          onClick={() => {
                            setSelectedPlan(plan.id);
                            setNewPlanId(plan.id);
                            setUpgradeDialogOpen(true);
                          }}
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          Fazer Upgrade
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : currentPlan ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {currentPlan.name === "Professional" && <Crown className="w-5 h-5 text-yellow-500" />}
                      {currentPlan.name === "Enterprise" && <Zap className="w-5 h-5 text-purple-500" />}
                      {currentPlan.name}
                    </CardTitle>
                    <CardDescription>{currentPlan.description}</CardDescription>
                  </div>
                  <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                    {subscription.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-4">Uso Atual</h4>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm flex items-center gap-2">
                            <Package className="w-4 h-4" />
                            Pedidos
                          </span>
                          <span className="text-sm">
                            {subscription.usage.orders} / {currentPlan.limits.orders === -1 ? "∞" : currentPlan.limits.orders}
                          </span>
                        </div>
                        <Progress
                          value={getUsagePercentage("orders")}
                          className={`h-2 ${isOverLimit("orders") ? "bg-red-100" : isNearLimit("orders") ? "bg-orange-100" : ""}`}
                        />
                        {isNearLimit("orders") && (
                          <p className="text-xs text-orange-600 mt-1">
                            <AlertTriangle className="w-3 h-3 inline mr-1" />
                            Aproximando do limite
                          </p>
                        )}
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm flex items-center gap-2">
                            <Bell className="w-4 h-4" />
                            Notificações
                          </span>
                          <span className="text-sm">
                            {subscription.usage.notifications} / {currentPlan.limits.notifications === -1 ? "∞" : currentPlan.limits.notifications}
                          </span>
                        </div>
                        <Progress
                          value={getUsagePercentage("notifications")}
                          className={`h-2 ${isOverLimit("notifications") ? "bg-red-100" : isNearLimit("notifications") ? "bg-orange-100" : ""}`}
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm flex items-center gap-2">
                            <Settings className="w-4 h-4" />
                            Integrações
                          </span>
                          <span className="text-sm">
                            {subscription.usage.integrations} / {currentPlan.limits.integrations === -1 ? "∞" : currentPlan.limits.integrations}
                          </span>
                        </div>
                        <Progress
                          value={getUsagePercentage("integrations")}
                          className={`h-2 ${isOverLimit("integrations") ? "bg-red-100" : isNearLimit("integrations") ? "bg-orange-100" : ""}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-4">Detalhes da Assinatura</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Valor mensal</span>
                        <span className="font-semibold">
                          R$ {currentPlan.price.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Próxima cobrança</span>
                        <span className="text-sm">
                          {subscription.currentPeriodEnd.toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Badge variant={subscription.cancelAtPeriodEnd ? "destructive" : "default"}>
                          {subscription.cancelAtPeriodEnd ? "Cancelando" : "Ativo"}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-6 space-y-2">
                      {!subscription.cancelAtPeriodEnd && (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setCancelDialogOpen(true)}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Cancelar Assinatura
                        </Button>
                      )}
                      {subscription.cancelAtPeriodEnd && (
                        <Button
                          variant="default"
                          className="w-full"
                          onClick={async () => {
                            try {
                              await reactivateSubscription();
                              toast({
                                title: "✅ Assinatura reativada",
                                description: "Sua assinatura foi reativada com sucesso!",
                              });
                            } catch (error) {
                              console.error('Erro ao reativar:', error);
                              toast({
                                title: "Erro ao reativar",
                                description: "Não foi possível reativar a assinatura.",
                                variant: "destructive",
                              });
                            }
                          }}
                          disabled={isReactivating}
                        >
                          <RefreshCw className={`w-4 h-4 mr-2 ${isReactivating ? 'animate-spin' : ''}`} />
                          {isReactivating ? 'Reativando...' : 'Reativar Assinatura'}
                        </Button>
                      )}
                      <Button 
                        className="w-full"
                        onClick={() => setPaymentDialogOpen(true)}
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Atualizar Método de Pagamento
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Erro ao Carregar Plano
                </CardTitle>
                <CardDescription>
                  Não foi possível carregar as informações do seu plano atual.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Plano não encontrado</AlertTitle>
                  <AlertDescription>
                    O plano associado à sua assinatura não foi encontrado. Entre em contato com o suporte.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          {/* Analytics Dashboard */}
          <AnalyticsDashboard />

          {/* Grade de Planos */}
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative ${plan.popular ? "border-primary shadow-lg" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      Mais Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center">
                  <CardTitle className="flex items-center justify-center gap-2">
                    {plan.name === "Starter" && <Package className="w-5 h-5" />}
                    {plan.name === "Professional" && <Crown className="w-5 h-5 text-yellow-500" />}
                    {plan.name === "Enterprise" && <Zap className="w-5 h-5 text-purple-500" />}
                    {plan.name}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-3xl font-bold">R$ {plan.price}</span>
                    <span className="text-muted-foreground">/{plan.interval === "month" ? "mês" : "ano"}</span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="pt-4 border-t">
                    <div className="grid grid-cols-2 gap-4 text-center text-sm">
                      <div>
                        <div className="font-semibold">
                          {plan.limits.orders === -1 ? "∞" : plan.limits.orders}
                        </div>
                        <div className="text-muted-foreground">Pedidos</div>
                      </div>
                      <div>
                        <div className="font-semibold">
                          {plan.limits.users === -1 ? "∞" : plan.limits.users}
                        </div>
                        <div className="text-muted-foreground">Usuários</div>
                      </div>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    variant={plan.id === subscription?.planId ? "outline" : plan.popular ? "default" : "outline"}
                    disabled={plan.id === subscription?.planId || selectedPlan === plan.id || isUpgrading}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    {plan.id === subscription?.planId ? "Plano Atual" :
                     selectedPlan === plan.id || isUpgrading ? "Processando..." : "Escolher Plano"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Comparação Detalhada de Planos */}
          <PlanComparison />
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Histórico de Faturamento
              </CardTitle>
              <CardDescription>
                Visualize suas faturas e histórico de pagamentos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingBilling ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3 flex-1">
                        <Skeleton className="h-10 w-10 rounded" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : billingHistory.length === 0 ? (
                <EmptyState
                  variant="data"
                  title="Nenhum histórico de faturamento"
                  description="Quando você tiver pagamentos processados, o histórico aparecerá aqui com detalhes sobre faturas, datas de vencimento e status de pagamento."
                  actions={[
                    {
                      label: "Ver Planos",
                      onClick: () => {
                        const element = document.querySelector('[value="plans"]');
                        if (element instanceof HTMLElement) {
                          element.click();
                        }
                      },
                      variant: "outline",
                      icon: CreditCard
                    }
                  ]}
                  badge={{ text: "Faturamento", variant: "secondary" }}
                  metrics={[
                    { label: "Faturas Emitidas", value: "0", icon: FileText },
                    { label: "Pagamentos Realizados", value: "0", icon: CheckCircle },
                    { label: "Valor Total Pago", value: "R$ 0,00", icon: DollarSign }
                  ]}
                  tips={[
                    "Faturas são geradas automaticamente no vencimento",
                    "Configure notificações para lembretes de pagamento",
                    "Mantenha os dados de cobrança atualizados"
                  ]}
                />
              ) : (
                <div className="space-y-4">
                  {billingHistory.map((bill) => (
                    <div key={bill.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{bill.description}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            {bill.date.toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold">R$ {bill.amount.toFixed(2)}</p>
                          <Badge variant={getStatusColor(bill.status)}>
                            {getStatusLabel(bill.status)}
                          </Badge>
                        </div>
                        {bill.invoiceUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => downloadInvoice(bill)}
                            title="Baixar fatura"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Métodos de Pagamento</CardTitle>
              <CardDescription>
                Gerencie suas informações de cobrança
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPayment ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3 flex-1">
                        <Skeleton className="h-8 w-8 rounded" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-9 w-20" />
                    </div>
                  ))}
                </div>
              ) : paymentMethods.length === 0 ? (
                <EmptyState
                  variant="default"
                  title="Nenhum método de pagamento"
                  description="Adicione um cartão de crédito, PIX ou boleto para gerenciar seus pagamentos de forma automática."
                  actions={[
                    {
                      label: "Adicionar Método",
                      onClick: () => setPaymentDialogOpen(true),
                      variant: "default",
                      icon: CreditCard
                    }
                  ]}
                  badge={{ text: "Pagamento", variant: "secondary" }}
                />
              ) : (
                <div className="space-y-4">
                  {paymentMethods.map((method) => (
                    <div key={method.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-accent flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            {method.brand} •••• {method.last4}
                            {method.isDefault && (
                              <Badge variant="secondary" className="text-xs">Padrão</Badge>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Expira em {method.expiryMonth?.toString().padStart(2, '0')}/{method.expiryYear?.toString().slice(-2)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => removePaymentMethod(method.id)}
                        >
                          Remover
                        </Button>
                        {!method.isDefault && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setDefaultPaymentMethod(method.id)}
                          >
                            Tornar Padrão
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setPaymentDialogOpen(true)}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Adicionar Novo Método
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Card */}
          {billingHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Resumo Financeiro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <DollarSign className="w-4 h-4" />
                      Total Pago
                    </div>
                    <div className="text-2xl font-bold">
                      R$ {billingHistory
                        .filter(b => b.status === 'paid')
                        .reduce((sum, b) => sum + b.amount, 0)
                        .toFixed(2)}
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <CheckCircle className="w-4 h-4" />
                      Faturas Pagas
                    </div>
                    <div className="text-2xl font-bold">
                      {billingHistory.filter(b => b.status === 'paid').length}
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      Pendentes
                    </div>
                    <div className="text-2xl font-bold">
                      {billingHistory.filter(b => b.status === 'pending').length}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="usage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Uso Detalhado dos Recursos</CardTitle>
              <CardDescription>
                Acompanhe o consumo mensal de cada recurso do seu plano
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {subscription && currentPlan && (
                  <>
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Seu plano renova em {subscription.currentPeriodEnd.toLocaleDateString("pt-BR")}. 
                        Os limites serão resetados nesta data.
                      </AlertDescription>
                    </Alert>

                    <div className="grid md:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Package className="w-4 h-4" />
                            Pedidos Processados
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {subscription.usage.orders}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            de {currentPlan.limits.orders === -1 ? "ilimitados" : currentPlan.limits.orders}
                          </p>
                          <Progress 
                            value={getUsagePercentage("orders")} 
                            className={`mt-2 ${
                              isOverLimit("orders") 
                                ? "[&>div]:bg-red-600" 
                                : isNearLimit("orders") 
                                ? "[&>div]:bg-orange-500" 
                                : "[&>div]:bg-primary"
                            }`} 
                          />
                          {isOverLimit("orders") && (
                            <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Limite excedido
                            </p>
                          )}
                          {!isOverLimit("orders") && isNearLimit("orders") && (
                            <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Aproximando do limite
                            </p>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Bell className="w-4 h-4" />
                            Notificações Enviadas
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {subscription.usage.notifications}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            de {currentPlan.limits.notifications === -1 ? "ilimitadas" : currentPlan.limits.notifications}
                          </p>
                          <Progress 
                            value={getUsagePercentage("notifications")} 
                            className={`mt-2 ${
                              isOverLimit("notifications") 
                                ? "[&>div]:bg-red-600" 
                                : isNearLimit("notifications") 
                                ? "[&>div]:bg-orange-500" 
                                : "[&>div]:bg-primary"
                            }`} 
                          />
                          {isOverLimit("notifications") && (
                            <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Limite excedido
                            </p>
                          )}
                          {!isOverLimit("notifications") && isNearLimit("notifications") && (
                            <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Aproximando do limite
                            </p>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Settings className="w-4 h-4" />
                            Integrações Ativas
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {subscription.usage.integrations}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            de {currentPlan.limits.integrations === -1 ? "ilimitadas" : currentPlan.limits.integrations}
                          </p>
                          <Progress 
                            value={getUsagePercentage("integrations")} 
                            className={`mt-2 ${
                              isOverLimit("integrations") 
                                ? "[&>div]:bg-red-600" 
                                : isNearLimit("integrations") 
                                ? "[&>div]:bg-orange-500" 
                                : "[&>div]:bg-primary"
                            }`} 
                          />
                          {isOverLimit("integrations") && (
                            <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Limite excedido
                            </p>
                          )}
                          {!isOverLimit("integrations") && isNearLimit("integrations") && (
                            <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Aproximando do limite
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Usage Warnings */}
                    {(isOverLimit("orders") || isOverLimit("notifications") || isOverLimit("integrations")) && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Limite Excedido</AlertTitle>
                        <AlertDescription>
                          Você excedeu o limite de alguns recursos. Considere fazer upgrade do seu plano para continuar usando todos os recursos sem interrupção.
                        </AlertDescription>
                      </Alert>
                    )}

                    {!isOverLimit("orders") && !isOverLimit("notifications") && !isOverLimit("integrations") &&
                     (isNearLimit("orders") || isNearLimit("notifications") || isNearLimit("integrations")) && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Aproximando do Limite</AlertTitle>
                        <AlertDescription>
                          Você está próximo do limite de alguns recursos. Considere fazer upgrade para evitar interrupções no serviço.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Usage History Chart */}
                    {usageHistory && usageHistory.length > 0 ? (
                      <UsageChart data={usageHistory} />
                    ) : (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Activity className="w-4 h-4" />
                            Histórico de Uso (Últimos 30 dias)
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <EmptyState
                            variant="data"
                            title="Nenhum dado de uso ainda"
                            description="Comece a usar o sistema e seus dados de uso aparecerão aqui em um gráfico interativo."
                            badge={{ text: "Aguardando dados", variant: "secondary" }}
                            icon={BarChart3}
                          />
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      
      {/* Upgrade Dialog */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5 text-green-600" />
              Fazer Upgrade de Plano
            </DialogTitle>
            <DialogDescription>
              Confirme o upgrade para desbloquear recursos avançados
            </DialogDescription>
          </DialogHeader>
          {newPlanId && (
            <div className="space-y-4">
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertDescription>
                  Você terá acesso imediato aos novos recursos. A cobrança será proporcional ao tempo restante no período atual.
                </AlertDescription>
              </Alert>
              
              <Separator />
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Plano Novo</span>
                  <span className="font-medium">{plans.find(p => p.id === newPlanId)?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Valor Mensal</span>
                  <span className="font-medium">R$ {plans.find(p => p.id === newPlanId)?.price.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeDialogOpen(false)} disabled={isUpgrading}>
              Cancelar
            </Button>
            <Button onClick={confirmUpgrade} disabled={isUpgrading}>
              {isUpgrading ? 'Processando...' : 'Confirmar Upgrade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Downgrade Dialog */}
      <Dialog open={downgradeDialogOpen} onOpenChange={setDowngradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownCircle className="w-5 h-5 text-orange-600" />
              Fazer Downgrade de Plano
            </DialogTitle>
            <DialogDescription>
              Atenção: você perderá acesso a alguns recursos
            </DialogDescription>
          </DialogHeader>
          {newPlanId && (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  O downgrade será aplicado no final do período atual. Você continuará com acesso total até lá.
                </AlertDescription>
              </Alert>
              
              <Separator />
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Plano Novo</span>
                  <span className="font-medium">{plans.find(p => p.id === newPlanId)?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Valor Mensal</span>
                  <span className="font-medium">R$ {plans.find(p => p.id === newPlanId)?.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Economia</span>
                  <span className="font-medium text-green-600">
                    R$ {((currentPlan?.price || 0) - (plans.find(p => p.id === newPlanId)?.price || 0)).toFixed(2)}/mês
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDowngradeDialogOpen(false)} disabled={isUpgrading}>
              Manter Plano Atual
            </Button>
            <Button variant="destructive" onClick={confirmDowngrade} disabled={isUpgrading}>
              {isUpgrading ? 'Processando...' : 'Confirmar Downgrade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Subscription Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              Cancelar Assinatura
            </DialogTitle>
            <DialogDescription>
              Lamentamos que você esteja saindo. Conte-nos o motivo para podermos melhorar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cancelReason">Motivo do Cancelamento *</Label>
              <Select value={cancelReason} onValueChange={setCancelReason}>
                <SelectTrigger id="cancelReason">
                  <SelectValue placeholder="Selecione um motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expensive">💰 Muito caro</SelectItem>
                  <SelectItem value="not_using">😴 Não estou usando</SelectItem>
                  <SelectItem value="missing_features">🔧 Faltam recursos</SelectItem>
                  <SelectItem value="switching">🔄 Migrando para outro serviço</SelectItem>
                  <SelectItem value="temporary">⏸️ Pausa temporária</SelectItem>
                  <SelectItem value="technical">⚙️ Problemas técnicos</SelectItem>
                  <SelectItem value="support">🤝 Insatisfeito com suporte</SelectItem>
                  <SelectItem value="other">📝 Outro motivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cancelFeedback">
                Feedback (Opcional)
                <span className="text-xs text-muted-foreground ml-2">
                  Seu feedback é muito valioso
                </span>
              </Label>
              <Textarea
                id="cancelFeedback"
                placeholder="Como podemos melhorar? O que faria você voltar?"
                value={cancelFeedback}
                onChange={(e) => setCancelFeedback(e.target.value)}
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">
                {cancelFeedback.length}/500
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>O que acontece depois?</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>• Sua assinatura permanecerá ativa até {subscription?.currentPeriodEnd.toLocaleDateString("pt-BR")}</p>
                <p>• Você pode reativar a qualquer momento antes desta data</p>
                <p>• Seus dados serão mantidos por 30 dias após o cancelamento</p>
              </AlertDescription>
            </Alert>

            {cancelReason === 'expensive' && (
              <Alert>
                <DollarSign className="h-4 w-4" />
                <AlertTitle>💡 Considere um plano mais econômico</AlertTitle>
                <AlertDescription>
                  Temos planos mais acessíveis que podem atender suas necessidades. 
                  <Button 
                    variant="link" 
                    className="p-0 h-auto ml-1"
                    onClick={() => {
                      setCancelDialogOpen(false);
                      const element = document.querySelector('[value="plans"]');
                      if (element instanceof HTMLElement) {
                        element.click();
                      }
                    }}
                  >
                    Ver outros planos
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setCancelDialogOpen(false);
                setCancelReason("");
                setCancelFeedback("");
              }}
              disabled={isCanceling}
            >
              Manter Assinatura
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancel}
              disabled={!cancelReason || isCanceling}
            >
              {isCanceling ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Method Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Adicionar Método de Pagamento
            </DialogTitle>
            <DialogDescription>
              Escolha como você deseja pagar sua assinatura
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Pagamento</Label>
              <Select value={paymentType} onValueChange={(value: 'credit_card' | 'pix' | 'boleto') => setPaymentType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit_card">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Cartão de Crédito
                    </div>
                  </SelectItem>
                  <SelectItem value="pix">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      PIX
                    </div>
                  </SelectItem>
                  <SelectItem value="boleto">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Boleto Bancário
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentType === 'credit_card' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="cardName">Nome no Cartão *</Label>
                  <Input
                    id="cardName"
                    placeholder="João da Silva"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cardNumber">Número do Cartão *</Label>
                  <Input
                    id="cardNumber"
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    maxLength={19}
                  />
                  {cardNumber.length >= 4 && (
                    <p className="text-xs text-muted-foreground">
                      {getCardBrand(cardNumber.replace(/\s/g, ''))}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cardExpiry">Validade *</Label>
                    <Input
                      id="cardExpiry"
                      placeholder="MM/AA"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                      maxLength={5}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cardCvv">CVV *</Label>
                    <Input
                      id="cardCvv"
                      type="password"
                      placeholder="123"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      maxLength={4}
                    />
                  </div>
                </div>

                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    Seus dados são criptografados e protegidos. Nunca armazenamos informações completas do cartão.
                  </AlertDescription>
                </Alert>
              </>
            )}

            {paymentType === 'pix' && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Pagamento via PIX</AlertTitle>
                <AlertDescription>
                  Após confirmar, você receberá um QR Code para pagamento instantâneo via PIX. 
                  O pagamento será confirmado automaticamente.
                </AlertDescription>
              </Alert>
            )}

            {paymentType === 'boleto' && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Pagamento via Boleto</AlertTitle>
                <AlertDescription>
                  O boleto será gerado e enviado para seu e-mail. O prazo de compensação é de até 3 dias úteis.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setPaymentDialogOpen(false);
              setCardNumber("");
              setCardExpiry("");
              setCardCvv("");
              setCardName("");
              setPaymentType('credit_card');
            }}>
              Cancelar
            </Button>
            <Button onClick={handleUpdatePayment}>
              {paymentType === 'credit_card' ? 'Salvar Cartão' : 
               paymentType === 'pix' ? 'Gerar QR Code' : 'Gerar Boleto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      </main>
    </div>
  );
};

export default Subscription;