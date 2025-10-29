import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'

export interface SubscriptionPlan {
  id: string
  name: string
  description: string
  price_monthly: number
  price_yearly: number
  features: Json
  limits: Json
  is_active: boolean
  is_popular: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface UserSubscription {
  id: string
  user_id: string
  plan_id: string
  status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing'
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  stripe_subscription_id?: string
  stripe_customer_id?: string
  created_at: string
  updated_at: string
  plan?: SubscriptionPlan
}

export interface SubscriptionUsage {
  orders_this_month: number
  integrations_used: number
  users_active: number
  api_calls_this_month: number
  storage_used_gb: number
}

export class SubscriptionService {
  // Get all active subscription plans
  static async getActivePlans(): Promise<SubscriptionPlan[]> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true })

    if (error) throw error
    return data
  }

  // Get user's current subscription
  static async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error
    }

    return data as UserSubscription || null
  }

  // Create or update user subscription
  static async upsertSubscription(
    userId: string,
    planId: string,
    stripeSubscriptionId?: string,
    stripeCustomerId?: string,
    status: UserSubscription['status'] = 'active',
    trialEnd?: string
  ): Promise<UserSubscription> {
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1) // Default to 1 month

    const subscriptionData = {
      user_id: userId,
      plan_id: planId,
      status,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_customer_id: stripeCustomerId
    }

    const { data, error } = await supabase
      .from('user_subscriptions')
      .upsert(subscriptionData, {
        onConflict: 'user_id'
      })
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .single()

    if (error) throw error
    return data as UserSubscription
  }

  // Update subscription status
  static async updateSubscriptionStatus(
    subscriptionId: string,
    status: UserSubscription['status'],
    cancelAtPeriodEnd: boolean = false,
    currentPeriodEnd?: string
  ): Promise<void> {
    const updateData: Partial<UserSubscription> = {
      status,
      cancel_at_period_end: cancelAtPeriodEnd,
      updated_at: new Date().toISOString()
    }

    if (currentPeriodEnd) {
      updateData.current_period_end = currentPeriodEnd
    }

    const { error } = await supabase
      .from('user_subscriptions')
      .update(updateData)
      .eq('id', subscriptionId)

    if (error) throw error
  }

  // Update usage counts
  static async updateUsage(
    userId: string,
    usage: Partial<SubscriptionUsage>
  ): Promise<void> {
    // Note: Usage tracking not implemented in current schema
    // This would require additional tables for usage tracking
    console.log('Usage update requested but not implemented:', userId, usage)
  }

  // Check if user can perform action based on plan limits
  static async checkUsageLimits(
    userId: string,
    action: 'create_order' | 'add_integration' | 'add_user' | 'api_call'
  ): Promise<{ allowed: boolean, message?: string }> {
    const subscription = await this.getUserSubscription(userId)

    if (!subscription) {
      return {
        allowed: false,
        message: 'Usuário não possui assinatura ativa'
      }
    }

    const plan = subscription.plan
    if (!plan) {
      return {
        allowed: false,
        message: 'Plano de assinatura não encontrado'
      }
    }

    const limits = plan.limits as { orders_per_month?: number, marketplaces?: number }

    switch (action) {
      case 'create_order':
        if (limits.orders_per_month && limits.orders_per_month > 0) {
          // Note: Would need usage tracking table to check actual usage
          return { allowed: true } // Allow for now, implement usage tracking later
        }
        break

      case 'add_integration':
        if (limits.marketplaces && limits.marketplaces > 0) {
          // Note: Would need usage tracking table to check actual usage
          return { allowed: true } // Allow for now, implement usage tracking later
        }
        break

      case 'add_user':
        // User limits not implemented in current schema
        return { allowed: true }
        break

      case 'api_call':
        // API call limits not implemented in current schema
        return { allowed: true }
        break
    }

    return { allowed: true }
  }

  // Increment usage counter
  static async incrementUsage(
    userId: string,
    action: 'create_order' | 'add_integration' | 'add_user' | 'api_call'
  ): Promise<void> {
    // Note: Usage tracking not implemented in current schema
    console.log('Usage increment requested but not implemented:', userId, action)
  }

  // Get subscription analytics
  static async getSubscriptionAnalytics(userId: string): Promise<{
    currentPlan: SubscriptionPlan | null
    limits: {
      maxOrders: number
      maxIntegrations: number
    }
  }> {
    const subscription = await this.getUserSubscription(userId)

    if (!subscription || !subscription.plan) {
      return {
        currentPlan: null,
        limits: {
          maxOrders: 0,
          maxIntegrations: 0
        }
      }
    }

    const plan = subscription.plan
    const limits = plan.limits as { orders_per_month?: number, marketplaces?: number }

    return {
      currentPlan: plan,
      limits: {
        maxOrders: limits.orders_per_month || 0,
        maxIntegrations: limits.marketplaces || 0
      }
    }
  }

  // Cancel subscription
  static async cancelSubscription(userId: string, cancelAtPeriodEnd: boolean = true): Promise<void> {
    const subscription = await this.getUserSubscription(userId)
    if (!subscription) {
      throw new Error('Assinatura não encontrada')
    }

    await this.updateSubscriptionStatus(
      subscription.id,
      cancelAtPeriodEnd ? 'active' : 'canceled',
      cancelAtPeriodEnd
    )
  }

  // Reactivate canceled subscription
  static async reactivateSubscription(userId: string): Promise<void> {
    const { data: subscription, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('cancel_at_period_end', true)
      .single()

    if (error || !subscription) {
      throw new Error('Assinatura cancelada não encontrada')
    }

    await this.updateSubscriptionStatus(subscription.id, 'active', false)
  }
}