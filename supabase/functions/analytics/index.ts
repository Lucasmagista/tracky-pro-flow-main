import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { supabaseAdmin } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, timeRange = '30d' } = await req.json();

    // 1. Calcular MRR (Monthly Recurring Revenue)
    const mrr = await calculateMRR();

    // 2. Calcular Churn Rate
    const churnRate = await calculateChurnRate(timeRange);

    // 3. Calcular LTV (Lifetime Value)
    const ltv = await calculateLTV();

    // 4. Métricas de assinaturas
    const subscriptionMetrics = await getSubscriptionMetrics();

    // 5. Revenue por plano
    const revenueByPlan = await getRevenueByPlan(timeRange);

    // 6. Histórico de crescimento
    const growthHistory = await getGrowthHistory(timeRange);

    return new Response(
      JSON.stringify({
        mrr,
        churnRate,
        ltv,
        subscriptionMetrics,
        revenueByPlan,
        growthHistory,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

async function calculateMRR() {
  const { data: activeSubscriptions } = await supabaseAdmin
    .from('subscriptions')
    .select('plans(price, interval)')
    .eq('status', 'active');

  if (!activeSubscriptions) return 0;

  let totalMRR = 0;
  for (const sub of activeSubscriptions) {
    if (sub.plans) {
      const price = sub.plans.price;
      const interval = sub.plans.interval;
      
      // Normalizar para mensal
      const monthlyPrice = interval === 'year' ? price / 12 : price;
      totalMRR += monthlyPrice;
    }
  }

  return Math.round(totalMRR * 100) / 100;
}

async function calculateChurnRate(timeRange: string) {
  const days = parseInt(timeRange.replace('d', ''));
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Subscriptions no início do período
  const { count: initialCount } = await supabaseAdmin
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .lte('created_at', startDate.toISOString());

  // Subscriptions canceladas no período
  const { count: canceledCount } = await supabaseAdmin
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'canceled')
    .gte('canceled_at', startDate.toISOString());

  if (!initialCount || initialCount === 0) return 0;

  const churnRate = ((canceledCount || 0) / initialCount) * 100;
  return Math.round(churnRate * 100) / 100;
}

async function calculateLTV() {
  // LTV = (Revenue por cliente) / Churn Rate
  const mrr = await calculateMRR();
  const churnRate = await calculateChurnRate('30d');

  if (churnRate === 0) return 0;

  const { count: totalCustomers } = await supabaseAdmin
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  if (!totalCustomers || totalCustomers === 0) return 0;

  const avgRevenuePerCustomer = mrr / totalCustomers;
  const monthlyChurnRate = churnRate / 100;

  const ltv = avgRevenuePerCustomer / monthlyChurnRate;
  return Math.round(ltv * 100) / 100;
}

async function getSubscriptionMetrics() {
  const { count: total } = await supabaseAdmin
    .from('subscriptions')
    .select('*', { count: 'exact', head: true });

  const { count: active } = await supabaseAdmin
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  const { count: trialing } = await supabaseAdmin
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'trialing');

  const { count: pastDue } = await supabaseAdmin
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'past_due');

  const { count: canceled } = await supabaseAdmin
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'canceled');

  return {
    total: total || 0,
    active: active || 0,
    trialing: trialing || 0,
    pastDue: pastDue || 0,
    canceled: canceled || 0,
  };
}

async function getRevenueByPlan(timeRange: string) {
  const days = parseInt(timeRange.replace('d', ''));
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: revenue } = await supabaseAdmin
    .from('billing_history')
    .select('amount, subscriptions(plans(name))')
    .eq('status', 'paid')
    .gte('created_at', startDate.toISOString());

  if (!revenue) return [];

  const revenueMap = new Map();
  
  for (const item of revenue) {
    const planName = item.subscriptions?.plans?.name || 'Desconhecido';
    const current = revenueMap.get(planName) || 0;
    revenueMap.set(planName, current + item.amount);
  }

  return Array.from(revenueMap.entries()).map(([plan, amount]) => ({
    plan,
    revenue: Math.round(amount * 100) / 100,
  }));
}

async function getGrowthHistory(timeRange: string) {
  const days = parseInt(timeRange.replace('d', ''));
  const history = [];

  for (let i = days; i >= 0; i -= Math.ceil(days / 12)) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    const { count } = await supabaseAdmin
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .lte('created_at', date.toISOString());

    history.push({
      date: date.toISOString().split('T')[0],
      count: count || 0,
    });
  }

  return history;
}
