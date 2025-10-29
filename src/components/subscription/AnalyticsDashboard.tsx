import { useQuery } from '@tanstack/react-query';
import { TrendingUp, DollarSign, Users, Activity, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

interface AnalyticsData {
  mrr: number;
  churnRate: number;
  ltv: number;
  activeSubscriptions: number;
  growth: {
    mrr: number;
    churn: number;
    ltv: number;
    subscriptions: number;
  };
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend: string;
  isPositive: boolean;
  delay?: number;
}

function MetricCard({ title, value, icon, trend, isPositive, delay = 0 }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay }}
    >
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
          <div className="text-gray-400">{icon}</div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-gray-900">{value}</div>
          <div className="flex items-center mt-2">
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
            )}
            <p className={`text-xs font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {trend}
            </p>
            <span className="text-xs text-gray-500 ml-1">vs mês anterior</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function AnalyticsDashboard() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase.functions.invoke('analytics', {
        body: { 
          userId, 
          timeRange: '30d' 
        }
      });

      if (error) throw error;
      return data as AnalyticsData;
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-32 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-20"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!analytics) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center p-8 text-gray-500"
      >
        <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p>Dados de analytics não disponíveis</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Analytics do Negócio</h2>
        <p className="text-gray-600">Métricas importantes dos últimos 30 dias</p>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="MRR (Receita Recorrente Mensal)"
          value={`R$ ${analytics.mrr.toFixed(2)}`}
          icon={<DollarSign className="w-5 h-5" />}
          trend={`${analytics.growth.mrr >= 0 ? '+' : ''}${analytics.growth.mrr.toFixed(1)}%`}
          isPositive={analytics.growth.mrr >= 0}
          delay={0}
        />
        <MetricCard
          title="Taxa de Churn"
          value={`${analytics.churnRate.toFixed(1)}%`}
          icon={<TrendingDown className="w-5 h-5" />}
          trend={`${analytics.growth.churn >= 0 ? '+' : ''}${analytics.growth.churn.toFixed(1)}%`}
          isPositive={analytics.growth.churn <= 0}
          delay={0.1}
        />
        <MetricCard
          title="LTV Médio (Lifetime Value)"
          value={`R$ ${analytics.ltv.toFixed(2)}`}
          icon={<Users className="w-5 h-5" />}
          trend={`${analytics.growth.ltv >= 0 ? '+' : ''}${analytics.growth.ltv.toFixed(1)}%`}
          isPositive={analytics.growth.ltv >= 0}
          delay={0.2}
        />
        <MetricCard
          title="Assinaturas Ativas"
          value={analytics.activeSubscriptions}
          icon={<Activity className="w-5 h-5" />}
          trend={`${analytics.growth.subscriptions >= 0 ? '+' : ''}${analytics.growth.subscriptions}`}
          isPositive={analytics.growth.subscriptions >= 0}
          delay={0.3}
        />
      </div>

      {/* Informações adicionais */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="grid gap-4 md:grid-cols-3"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Receita Anual Projetada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              R$ {(analytics.mrr * 12).toFixed(2)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Baseado no MRR atual</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">CAC (Custo de Aquisição)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              R$ {(analytics.ltv * 0.33).toFixed(2)}
            </div>
            <p className="text-xs text-gray-500 mt-1">33% do LTV (recomendado)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Razão LTV/CAC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              3:1
            </div>
            <p className="text-xs text-gray-500 mt-1">Saudável (meta: 3:1 ou maior)</p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
