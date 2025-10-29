import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: "month" | "year";
  features: string[];
  limits: {
    orders: number;
    notifications: number;
    integrations: number;
    users: number;
    storage?: number;
    api_calls?: number;
  };
  popular?: boolean;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: "active" | "canceled" | "past_due" | "incomplete" | "trialing" | "paused";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  usage: {
    orders: number;
    notifications: number;
    integrations: number;
    users?: number;
    storage?: number;
    api_calls?: number;
  };
  metadata?: Record<string, unknown>;
}

interface DatabasePlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  interval: string;
  is_active: boolean;
  is_popular: boolean;
  features: string[];
  limits: {
    orders: number;
    notifications: number;
    integrations: number;
    users: number;
    storage?: number;
    api_calls?: number;
  };
  metadata: Record<string, unknown> | null;
}

interface DatabaseSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_start: string | null;
  trial_end: string | null;
  metadata: Record<string, unknown> | null;
}

interface DatabaseUsage {
  metric: string;
  value: number;
}

export const usePlans = () => {
  const { data: plans, isLoading, error, refetch } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (error) {
        console.error("Error fetching plans:", error);
        throw error;
      }

      return ((data || []) as DatabasePlan[]).map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description || "",
        price: Number(plan.price),
        currency: plan.currency,
        interval: plan.interval as "month" | "year",
        features: plan.features || [],
        limits: plan.limits || {
          orders: 0,
          notifications: 0,
          integrations: 0,
          users: 0,
        },
        popular: plan.is_popular,
        is_active: plan.is_active,
        metadata: plan.metadata || undefined,
      })) as Plan[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  return {
    plans: plans || [],
    isLoading,
    error,
    refetch,
  };
};


export const useSubscription = () => {
  const queryClient = useQueryClient();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { plans } = usePlans();

  // Fetch subscription from database
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setSubscription(null);
          setIsLoading(false);
          return;
        }

        // Buscar assinatura do usuário
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: subData, error: subError } = await (supabase as any)
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (subError) {
          if (subError.code === 'PGRST116') {
            // Nenhuma assinatura encontrada
            setSubscription(null);
          } else {
            console.error("Error fetching subscription:", subError);
          }
          setIsLoading(false);
          return;
        }

        const dbSub = subData as DatabaseSubscription;

        // Buscar uso atual do período
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: usageData, error: usageError } = await (supabase as any)
          .from("subscription_usage")
          .select("metric, value")
          .eq("subscription_id", dbSub.id)
          .eq("period_start", dbSub.current_period_start);

        if (usageError) {
          console.error("Error fetching usage:", usageError);
        }

        // Converter uso para objeto
        const usage = (usageData as DatabaseUsage[] || []).reduce((acc, item) => {
          acc[item.metric as keyof Subscription["usage"]] = item.value;
          return acc;
        }, {
          orders: 0,
          notifications: 0,
          integrations: 0,
          users: 0,
          storage: 0,
          api_calls: 0,
        });

        setSubscription({
          id: dbSub.id,
          userId: dbSub.user_id,
          planId: dbSub.plan_id,
          status: dbSub.status as Subscription["status"],
          currentPeriodStart: new Date(dbSub.current_period_start),
          currentPeriodEnd: new Date(dbSub.current_period_end),
          cancelAtPeriodEnd: dbSub.cancel_at_period_end,
          canceledAt: dbSub.canceled_at ? new Date(dbSub.canceled_at) : undefined,
          trialStart: dbSub.trial_start ? new Date(dbSub.trial_start) : undefined,
          trialEnd: dbSub.trial_end ? new Date(dbSub.trial_end) : undefined,
          usage,
          metadata: dbSub.metadata || undefined,
        });

      } catch (error) {
        console.error("Error in fetchSubscription:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscription();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('subscription-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
        },
        () => {
          fetchSubscription();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // Mutation para upgrade/downgrade de plano
  const upgradePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      if (!subscription) throw new Error("Nenhuma assinatura ativa");

      const newPlan = plans.find(p => p.id === planId);
      const currentPlan = plans.find(p => p.id === subscription.planId);

      if (!newPlan) throw new Error("Plano não encontrado");
      if (!currentPlan) throw new Error("Plano atual não encontrado");

      // Registrar mudança de plano
      const changeType = newPlan.price > currentPlan.price ? 'upgrade' : 
                        newPlan.price < currentPlan.price ? 'downgrade' : 'change';

      const effectiveDate = changeType === 'upgrade' ? new Date() : subscription.currentPeriodEnd;

      // Inserir histórico de mudança
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("subscription_plan_changes").insert({
        subscription_id: subscription.id,
        user_id: user.id,
        from_plan_id: subscription.planId,
        to_plan_id: planId,
        change_type: changeType,
        effective_date: effectiveDate.toISOString(),
      });

      // Atualizar assinatura
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("subscriptions")
        .update({
          plan_id: planId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);

      if (error) throw error;

      return { planId, changeType };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });

  // Mutation para cancelar assinatura
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async ({ reason, feedback }: { reason?: string; feedback?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      if (!subscription) throw new Error("Nenhuma assinatura ativa");

      // Salvar feedback de cancelamento
      if (reason) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("subscription_cancellation_feedback").insert({
          subscription_id: subscription.id,
          user_id: user.id,
          reason,
          feedback: feedback || null,
        });
      }

      // Atualizar assinatura para cancelar no fim do período
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("subscriptions")
        .update({
          cancel_at_period_end: true,
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });

  // Mutation para reativar assinatura
  const reactivateSubscriptionMutation = useMutation({
    mutationFn: async () => {
      if (!subscription) throw new Error("Nenhuma assinatura ativa");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("subscriptions")
        .update({
          cancel_at_period_end: false,
          canceled_at: null,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });

  const upgradePlan = async (planId: string) => {
    return upgradePlanMutation.mutateAsync(planId);
  };

  const cancelSubscription = async (reason?: string, feedback?: string) => {
    return cancelSubscriptionMutation.mutateAsync({ reason, feedback });
  };

  const reactivateSubscription = async () => {
    return reactivateSubscriptionMutation.mutateAsync();
  };

  const getUsagePercentage = (metric: keyof Subscription["usage"]) => {
    if (!subscription) return 0;

    const currentPlan = plans.find(p => p.id === subscription.planId);
    if (!currentPlan) return 0;

    const limit = currentPlan.limits[metric === "orders" ? "orders" :
                                    metric === "notifications" ? "notifications" : 
                                    metric === "integrations" ? "integrations" :
                                    metric === "users" ? "users" :
                                    metric === "storage" ? "storage" : "api_calls"];

    if (limit === -1 || !limit) return 0; // unlimited

    const usage = subscription.usage[metric] || 0;
    return (usage / limit) * 100;
  };

  const isNearLimit = (metric: keyof Subscription["usage"]) => {
    const percentage = getUsagePercentage(metric);
    return percentage > 80 && percentage <= 100;
  };

  const isOverLimit = (metric: keyof Subscription["usage"]) => {
    return getUsagePercentage(metric) > 100;
  };

  return {
    subscription,
    isLoading,
    upgradePlan,
    cancelSubscription,
    reactivateSubscription,
    getUsagePercentage,
    isNearLimit,
    isOverLimit,
    isUpgrading: upgradePlanMutation.isPending,
    isCanceling: cancelSubscriptionMutation.isPending,
    isReactivating: reactivateSubscriptionMutation.isPending,
  };
};