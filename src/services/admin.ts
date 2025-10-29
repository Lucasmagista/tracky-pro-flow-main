/**
 * Admin Service
 * Complete admin panel service for managing users, subscriptions, logs, and system settings
 */

import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type AdminRole = 'super_admin' | 'admin' | 'moderator' | 'support'
export type ActivityType = 
  | 'user_login' | 'user_logout' | 'user_register' | 'user_update' | 'user_delete'
  | 'subscription_create' | 'subscription_update' | 'subscription_cancel'
  | 'order_create' | 'order_update' | 'order_delete'
  | 'payment_success' | 'payment_failed'
  | 'integration_connect' | 'integration_disconnect'
  | 'settings_update' | 'system_config'
  | 'admin_action' | 'security_event' | 'error'

export type LogLevel = 'info' | 'warning' | 'error' | 'critical' | 'debug'
export type SystemStatus = 'operational' | 'degraded' | 'maintenance' | 'offline'

export interface AdminPermission {
  id: string
  user_id: string
  role: AdminRole
  permissions: string[]
  granted_by?: string
  granted_at: string
  expires_at?: string
  is_active: boolean
  notes?: string
  created_at: string
  updated_at: string
}

export interface AdminLog {
  id: string
  admin_id?: string
  action: string
  activity_type: ActivityType
  description?: string
  target_user_id?: string
  target_entity_type?: string
  target_entity_id?: string
  ip_address?: string
  user_agent?: string
  metadata: Record<string, unknown>
  severity: LogLevel
  created_at: string
}

export interface UserActivity {
  id: string
  user_id: string
  activity_type: ActivityType
  action: string
  description?: string
  entity_type?: string
  entity_id?: string
  ip_address?: string
  user_agent?: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface SystemSetting {
  id: string
  key: string
  value: Json
  category: 'general' | 'security' | 'features' | 'limits' | 'integrations'
  description?: string
  data_type: 'string' | 'number' | 'boolean' | 'json' | 'array'
  is_public: boolean
  is_editable: boolean
  requires_restart: boolean
  validation_rules?: Json
  updated_by?: string
  created_at: string
  updated_at: string
}

export interface SystemHealth {
  id: string
  status: SystemStatus
  component: string
  message?: string
  response_time_ms?: number
  cpu_usage?: number
  memory_usage?: number
  disk_usage?: number
  active_connections?: number
  error_rate?: number
  metadata: Record<string, unknown>
  checked_at: string
}

export interface FeatureFlag extends Record<string, unknown> {
  id: string
  name: string
  description?: string
  is_enabled: boolean
  enabled_for_users?: string[]
  enabled_for_plans?: string[]
  rollout_percentage: number
  metadata: Record<string, unknown>
  created_by?: string
  updated_by?: string
  created_at: string
  updated_at: string
}

export interface SystemStats {
  total_users: number
  active_users: number
  active_users_today: number
  total_orders: number
  orders_today: number
  total_subscriptions: number
  active_subscriptions: number
  revenue_this_month: number
  total_integrations: number
  system_errors_today: number
  conversion_rate: number
}

export interface UserWithDetails {
  id: string
  email: string
  name?: string
  store_name?: string
  is_admin: boolean
  admin_role?: AdminRole
  created_at: string
  subscription?: {
    id: string
    plan_name: string
    status: string
    current_period_end: string
  }
  stats: {
    total_orders: number
    total_spent: number
    last_login: string
  }
}

// ============================================================================
// ADMIN SERVICE CLASS
// ============================================================================

export class AdminService {
  // ========================================
  // AUTHENTICATION & PERMISSIONS
  // ========================================

  /**
   * Check if current user is admin
   */
  static async isAdmin(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    return data?.is_admin ?? false
  }

  /**
   * Get current admin role
   */
  static async getAdminRole(): Promise<AdminRole | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabase
      .from('profiles')
      .select('admin_role')
      .eq('id', user.id)
      .single()

    return data?.admin_role ?? null
  }

  /**
   * Check if user has specific admin role
   */
  static async hasAdminRole(requiredRole: AdminRole): Promise<boolean> {
    const role = await this.getAdminRole()
    if (!role) return false
    
    // Super admin has all permissions
    if (role === 'super_admin') return true
    
    return role === requiredRole
  }

  /**
   * Grant admin permissions to user
   */
  static async grantAdminPermissions(
    userId: string,
    role: AdminRole,
    permissions: string[] = [],
    notes?: string
  ): Promise<AdminPermission> {
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data, error } = await supabase
      .from('admin_permissions')
      .insert({
        user_id: userId,
        role,
        permissions,
        granted_by: user?.id,
        notes,
        is_active: true
      })
      .select()
      .single()

    if (error) throw error

    // Update profile
    await supabase
      .from('profiles')
      .update({
        is_admin: true,
        admin_role: role,
        admin_since: new Date().toISOString()
      })
      .eq('id', userId)

    await this.logAdminAction(
      'GRANT_ADMIN_PERMISSIONS',
      'admin_action',
      `Granted ${role} permissions to user`,
      userId
    )

    return data as AdminPermission
  }

  /**
   * Revoke admin permissions
   */
  static async revokeAdminPermissions(userId: string): Promise<void> {
    const { error } = await supabase
      .from('admin_permissions')
      .update({ is_active: false })
      .eq('user_id', userId)

    if (error) throw error

    await supabase
      .from('profiles')
      .update({
        is_admin: false,
        admin_role: null
      })
      .eq('id', userId)

    await this.logAdminAction(
      'REVOKE_ADMIN_PERMISSIONS',
      'admin_action',
      'Revoked admin permissions from user',
      userId
    )
  }

  // ========================================
  // USER MANAGEMENT
  // ========================================

  /**
   * Get all users with details
   */
  static async getAllUsers(
    page: number = 1,
    limit: number = 50,
    search?: string,
    filters?: {
      is_admin?: boolean
      has_subscription?: boolean
      created_after?: string
      created_before?: string
    }
  ): Promise<{ users: UserWithDetails[], total: number }> {
    let query = supabase
      .from('profiles')
      .select(`
        *,
        subscriptions (
          id,
          status,
          current_period_end,
          plan:plans (
            name
          )
        )
      `, { count: 'exact' })

    // Apply search
    if (search) {
      query = query.or(`name.ilike.%${search}%,store_name.ilike.%${search}%`)
    }

    // Apply filters
    if (filters?.is_admin !== undefined) {
      query = query.eq('is_admin', filters.is_admin)
    }
    if (filters?.created_after) {
      query = query.gte('created_at', filters.created_after)
    }
    if (filters?.created_before) {
      query = query.lte('created_at', filters.created_before)
    }

    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Get additional stats for each user
    const usersWithStats = await Promise.all(
      (data || []).map(async (user) => {
        const [ordersCount, totalSpent, lastActivity] = await Promise.all([
          this.getUserOrdersCount(user.id),
          this.getUserTotalSpent(user.id),
          this.getUserLastActivity(user.id)
        ])

        return {
          ...user,
          subscription: user.subscriptions?.[0] ? {
            id: user.subscriptions[0].id,
            plan_name: user.subscriptions[0].plan?.name || 'N/A',
            status: user.subscriptions[0].status,
            current_period_end: user.subscriptions[0].current_period_end
          } : undefined,
          stats: {
            total_orders: ordersCount,
            total_spent: totalSpent,
            last_login: lastActivity
          }
        }
      })
    )

    return {
      users: usersWithStats as UserWithDetails[],
      total: count || 0
    }
  }

  /**
   * Get user details by ID
   */
  static async getUserDetails(userId: string): Promise<UserWithDetails> {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        subscriptions (
          *,
          plan:plans (*)
        )
      `)
      .eq('id', userId)
      .single()

    if (error) throw error

    const [ordersCount, totalSpent, lastActivity] = await Promise.all([
      this.getUserOrdersCount(userId),
      this.getUserTotalSpent(userId),
      this.getUserLastActivity(userId)
    ])

    return {
      ...data,
      subscription: data.subscriptions?.[0] ? {
        id: data.subscriptions[0].id,
        plan_name: data.subscriptions[0].plan?.name || 'N/A',
        status: data.subscriptions[0].status,
        current_period_end: data.subscriptions[0].current_period_end
      } : undefined,
      stats: {
        total_orders: ordersCount,
        total_spent: totalSpent,
        last_login: lastActivity
      }
    } as UserWithDetails
  }

  /**
   * Update user details
   */
  static async updateUser(
    userId: string,
    updates: {
      name?: string
      store_name?: string
      store_email?: string
      store_phone?: string
      is_admin?: boolean
      admin_role?: AdminRole | null
    }
  ): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (error) throw error

    await this.logAdminAction(
      'UPDATE_USER',
      'user_update',
      `Updated user details`,
      userId,
      updates
    )
  }

  /**
   * Suspend user account
   */
  static async suspendUser(userId: string, reason: string, duration?: number): Promise<void> {
    const suspendedUntil = duration 
      ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString()
      : null

    // Update user profile
    const { error } = await supabase
      .from('profiles')
      .update({
        is_suspended: true,
        suspended_until: suspendedUntil,
        suspension_reason: reason
      })
      .eq('id', userId)

    if (error) throw error

    await this.logAdminAction(
      'SUSPEND_USER',
      'security_event',
      `User account suspended. Reason: ${reason}${duration ? ` for ${duration} days` : ''}`,
      userId,
      { reason, duration, suspended_until: suspendedUntil }
    )
  }

  /**
   * Unsuspend user account
   */
  static async unsuspendUser(userId: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({
        is_suspended: false,
        suspended_until: null,
        suspension_reason: null
      })
      .eq('id', userId)

    if (error) throw error

    await this.logAdminAction(
      'UNSUSPEND_USER',
      'admin_action',
      'User account unsuspended',
      userId
    )
  }

  /**
   * Reset user password (send reset email)
   */
  static async resetUserPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })

    if (error) throw error

    await this.logAdminAction(
      'RESET_PASSWORD',
      'admin_action',
      `Password reset email sent to ${email}`,
      undefined,
      { email }
    )
  }

  /**
   * Add tags to user
   */
  static async addUserTags(userId: string, tags: string[]): Promise<void> {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tags')
      .eq('id', userId)
      .single()

    const currentTags = (profile?.tags as string[]) || []
    const newTags = Array.from(new Set([...currentTags, ...tags]))

    const { error } = await supabase
      .from('profiles')
      .update({ tags: newTags })
      .eq('id', userId)

    if (error) throw error

    await this.logAdminAction(
      'ADD_USER_TAGS',
      'admin_action',
      `Added tags: ${tags.join(', ')}`,
      userId,
      { tags }
    )
  }

  /**
   * Remove tags from user
   */
  static async removeUserTags(userId: string, tags: string[]): Promise<void> {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tags')
      .eq('id', userId)
      .single()

    const currentTags = (profile?.tags as string[]) || []
    const newTags = currentTags.filter(tag => !tags.includes(tag))

    const { error } = await supabase
      .from('profiles')
      .update({ tags: newTags })
      .eq('id', userId)

    if (error) throw error

    await this.logAdminAction(
      'REMOVE_USER_TAGS',
      'admin_action',
      `Removed tags: ${tags.join(', ')}`,
      userId,
      { tags }
    )
  }

  /**
   * Add internal note to user
   */
  static async addUserNote(userId: string, note: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('internal_notes')
      .eq('id', userId)
      .single()

    const currentNotes = (profile?.internal_notes as unknown as Array<{
      note: string
      created_at: string
      created_by: string
    }>) || []

    currentNotes.push({
      note,
      created_at: new Date().toISOString(),
      created_by: user?.id || ''
    })

    const { error } = await supabase
      .from('profiles')
      .update({ internal_notes: currentNotes as never })
      .eq('id', userId)

    if (error) throw error

    await this.logAdminAction(
      'ADD_USER_NOTE',
      'admin_action',
      'Added internal note to user',
      userId,
      { note_preview: note.substring(0, 100) }
    )
  }

  /**
   * Export users to CSV
   */
  static async exportUsers(filters?: {
    search?: string
    status?: string
    is_admin?: boolean
    date_from?: string
    date_to?: string
  }): Promise<Blob> {
    // Get filtered users
    const { data } = await supabase
      .from('profiles')
      .select(`
        *,
        subscription:subscriptions(plan_id, status, current_period_end)
      `)
      
    if (!data) throw new Error('No data to export')

    // Convert to CSV
    const headers = ['ID', 'Name', 'Email', 'Store Name', 'Is Admin', 'Subscription Status', 'Created At']
    const rows = data.map(user => [
      user.id,
      user.name || '',
      user.email || '',
      user.store_name || '',
      user.is_admin ? 'Yes' : 'No',
      user.subscription?.status || 'None',
      user.created_at
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    return new Blob([csv], { type: 'text/csv' })
  }

  /**
   * Delete user account
   */
  static async deleteUser(userId: string, reason: string): Promise<void> {
    await this.logAdminAction(
      'DELETE_USER',
      'user_delete',
      `User account deleted. Reason: ${reason}`,
      userId,
      { reason }
    )

    // Delete user data (cascade will handle related records)
    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) throw error
  }

  // ========================================
  // PERMISSIONS MANAGEMENT
  // ========================================

  /**
   * Get all admin permissions
   */
  static async getAdminPermissions(): Promise<unknown[]> {
    const { data, error } = await supabase
      .from('admin_permissions')
      .select(`
        *,
        user:profiles!admin_permissions_user_id_fkey(id, name, email),
        granted_by_user:profiles!admin_permissions_granted_by_fkey(name, email)
      `)
      .eq('is_active', true)
      .order('granted_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  // ========================================
  // SUBSCRIPTION MANAGEMENT
  // ========================================

  /**
   * Get all subscriptions
   */
  static async getAllSubscriptions(
    page: number = 1,
    limit: number = 50,
    filters?: {
      status?: string
      plan_id?: string
    }
  ) {
    let query = supabase
      .from('subscriptions')
      .select(`
        *,
        user:profiles (*),
        plan:plans (*)
      `, { count: 'exact' })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.plan_id) {
      query = query.eq('plan_id', filters.plan_id)
    }

    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false })

    if (error) throw error

    return { subscriptions: data, total: count || 0 }
  }

  /**
   * Update subscription
   */
  static async updateSubscription(
    subscriptionId: string,
    updates: {
      status?: string
      plan_id?: string
      cancel_at_period_end?: boolean
    }
  ): Promise<void> {
    const { error } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', subscriptionId)

    if (error) throw error

    await this.logAdminAction(
      'UPDATE_SUBSCRIPTION',
      'subscription_update',
      'Updated subscription',
      undefined,
      { subscription_id: subscriptionId, ...updates }
    )
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(
    subscriptionId: string,
    immediately: boolean = false
  ): Promise<void> {
    const updates = immediately
      ? { status: 'canceled', canceled_at: new Date().toISOString() }
      : { cancel_at_period_end: true }

    const { error } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', subscriptionId)

    if (error) throw error

    await this.logAdminAction(
      'CANCEL_SUBSCRIPTION',
      'subscription_cancel',
      immediately ? 'Subscription canceled immediately' : 'Subscription set to cancel at period end',
      undefined,
      { subscription_id: subscriptionId, immediately }
    )
  }

  /**
   * Get all plans
   */
  static async getAllPlans(): Promise<unknown[]> {
    const { data, error } = await supabase
      .from('plans')
      .select('id, name, price_monthly')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true })

    if (error) {
      console.error('Error fetching plans:', error)
      throw error
    }
    
    // Mapear para formato esperado com price ao invés de price_monthly
    return (data || []).map(plan => ({
      id: plan.id,
      name: plan.name,
      price: plan.price_monthly
    }))
  }

  /**
   * Inativar usuário (desativa assinatura temporariamente)
   */
  static async inactivateUser(userId: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (error) throw error
  }

  /**
   * Reativar usuário (reativa assinatura)
   */
  static async reactivateUser(userId: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ 
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (error) throw error
  }

  /**
   * Bloquear usuário (bloqueia acesso por inadimplência ou violação)
   */
  static async blockUser(userId: string, reason?: string): Promise<void> {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        is_blocked: true,
        block_reason: reason || 'Bloqueado pelo administrador',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (profileError) throw profileError

    // Registrar log
    await supabase.from('admin_logs').insert({
      admin_id: (await supabase.auth.getUser()).data.user?.id,
      action: 'block_user',
      target_user_id: userId,
      details: { reason }
    })
  }

  /**
   * Desbloquear usuário
   */
  static async unblockUser(userId: string): Promise<void> {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        is_blocked: false,
        block_reason: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (profileError) throw profileError

    // Registrar log
    await supabase.from('admin_logs').insert({
      admin_id: (await supabase.auth.getUser()).data.user?.id,
      action: 'unblock_user',
      target_user_id: userId
    })
  }

  /**
   * Migrate user to different plan
   */
  static async migrateUserPlan(
    userId: string,
    newPlanId: string,
    reason?: string
  ): Promise<void> {
    // Get current subscription
    const { data: currentSub, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    if (fetchError) throw fetchError

    if (currentSub) {
      // Update existing subscription
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({ plan_id: newPlanId })
        .eq('id', currentSub.id)

      if (updateError) throw updateError
    } else {
      // Create new subscription
      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          plan_id: newPlanId,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })

      if (insertError) throw insertError
    }

    await this.logAdminAction(
      'MIGRATE_PLAN',
      'subscription_update',
      `User migrated to new plan. Reason: ${reason || 'N/A'}`,
      userId,
      { new_plan_id: newPlanId, old_subscription_id: currentSub?.id, reason }
    )
  }

  /**
   * Apply discount to subscription
   */
  static async applyDiscount(
    subscriptionId: string,
    discountPercent: number,
    durationMonths?: number
  ): Promise<void> {
    const metadata = {
      discount_percent: discountPercent,
      duration_months: durationMonths,
      applied_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('subscriptions')
      .update({ metadata })
      .eq('id', subscriptionId)

    if (error) throw error

    await this.logAdminAction(
      'APPLY_DISCOUNT',
      'subscription_update',
      `Applied ${discountPercent}% discount`,
      undefined,
      { subscription_id: subscriptionId, ...metadata }
    )
  }

  /**
   * Extend trial period
   */
  static async extendTrial(
    userId: string,
    additionalDays: number
  ): Promise<void> {
    // Get current subscription
    const { data: subscription, error: fetchError } = await supabase
      .from('subscriptions')
      .select('trial_ends_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (fetchError) throw fetchError

    const currentTrialEnd = subscription?.trial_ends_at 
      ? new Date(subscription.trial_ends_at) 
      : new Date()
    
    const newTrialEnd = new Date(currentTrialEnd.getTime() + additionalDays * 24 * 60 * 60 * 1000)

    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({ trial_ends_at: newTrialEnd.toISOString() })
      .eq('user_id', userId)

    if (updateError) throw updateError

    await this.logAdminAction(
      'EXTEND_TRIAL',
      'admin_action',
      `Extended trial by ${additionalDays} days`,
      userId,
      { additional_days: additionalDays, new_trial_end: newTrialEnd.toISOString() }
    )
  }

  /**
   * Get subscription history for user
   */
  static async getSubscriptionHistory(userId: string): Promise<unknown[]> {
    const { data: logs, error } = await supabase
      .from('admin_logs')
      .select('*')
      .eq('target_user_id', userId)
      .in('activity_type', ['subscription_create', 'subscription_update', 'subscription_cancel'])
      .order('created_at', { ascending: false })

    if (error) throw error
    return logs || []
  }

  // ========================================
  // LOGS & MONITORING
  // ========================================

  /**
   * Log admin action
   */
  static async logAdminAction(
    action: string,
    activityType: ActivityType,
    description?: string,
    targetUserId?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('admin_logs').insert({
      admin_id: user?.id,
      action,
      activity_type: activityType,
      description,
      target_user_id: targetUserId,
      metadata: metadata as never, // Cast to satisfy TypeScript
      severity: 'info'
    })
  }

  /**
   * Get admin logs
   */
  static async getAdminLogs(
    page: number = 1,
    limit: number = 100,
    filters?: {
      admin_id?: string
      activity_type?: ActivityType
      severity?: LogLevel
      date_from?: string
      date_to?: string
      search?: string
    }
  ): Promise<{ logs: AdminLog[], total: number }> {
    let query = supabase
      .from('admin_logs')
      .select('*', { count: 'exact' })

    if (filters?.admin_id) {
      query = query.eq('admin_id', filters.admin_id)
    }
    if (filters?.activity_type) {
      query = query.eq('activity_type', filters.activity_type)
    }
    if (filters?.severity) {
      query = query.eq('severity', filters.severity)
    }
    if (filters?.date_from) {
      query = query.gte('created_at', filters.date_from)
    }
    if (filters?.date_to) {
      query = query.lte('created_at', filters.date_to)
    }
    if (filters?.search) {
      query = query.or(`action.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }

    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false })

    if (error) throw error

    return { logs: data as AdminLog[], total: count || 0 }
  }

  /**
   * Get user activities
   */
  static async getUserActivities(
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ activities: UserActivity[], total: number }> {
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await supabase
      .from('user_activities')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .range(from, to)
      .order('created_at', { ascending: false })

    if (error) throw error

    return { activities: data as UserActivity[], total: count || 0 }
  }

  // ========================================
  // SYSTEM SETTINGS
  // ========================================

  /**
   * Get all system settings
   */
  static async getSystemSettings(category?: string): Promise<SystemSetting[]> {
    let query = supabase.from('system_settings').select('*')

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query.order('category').order('key')

    if (error) throw error

    return data as SystemSetting[]
  }

  /**
   * Get specific setting
   */
  static async getSetting(key: string): Promise<Json> {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .single()

    if (error) throw error

    return data?.value
  }

  /**
   * Update system setting
   */
  static async updateSetting(key: string, value: Json): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('system_settings')
      .update({
        value,
        updated_by: user?.id
      })
      .eq('key', key)

    if (error) throw error

    await this.logAdminAction(
      'UPDATE_SETTING',
      'settings_update',
      `Updated setting: ${key}`,
      undefined,
      { key, value }
    )
  }

  /**
   * Bulk update settings
   */
  static async updateSettings(settings: Record<string, Json>): Promise<void> {
    const updates = Object.entries(settings).map(([key, value]) => 
      this.updateSetting(key, value)
    )

    await Promise.all(updates)
  }

  /**
   * Update system settings (for admin settings page)
   */
  static async updateSystemSettings(settings: Record<string, unknown>): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()

    // Convert settings to the format expected by the database
    const updates = Object.entries(settings).map(([key, value]) => ({
      key,
      value: value as never,
      data_type: typeof value,
      updated_by: user?.id,
      category: 'system'
    }))

    // Upsert all settings
    const { error } = await supabase
      .from('system_settings')
      .upsert(updates, { onConflict: 'key' })

    if (error) throw error

    await this.logAdminAction(
      'UPDATE_SYSTEM_SETTINGS',
      'settings_update',
      'Updated system settings',
      undefined,
      { settings: Object.keys(settings) }
    )
  }

  // ========================================
  // SYSTEM HEALTH & MONITORING
  // ========================================

  /**
   * Get system statistics
   */
  static async getSystemStats(): Promise<SystemStats> {
    const { data, error } = await supabase.rpc('get_system_stats')

    if (error) throw error

    return data as unknown as SystemStats
  }

  /**
   * Get system health
   */
  static async getSystemHealth(): Promise<SystemHealth[]> {
    const { data, error } = await supabase
      .from('system_health')
      .select('*')
      .order('checked_at', { ascending: false })
      .limit(10)

    if (error) throw error

    return data as SystemHealth[]
  }

  /**
   * Record system health check
   */
  static async recordHealthCheck(
    component: string,
    status: SystemStatus,
    metrics?: {
      response_time_ms?: number
      cpu_usage?: number
      memory_usage?: number
      error_rate?: number
    }
  ): Promise<void> {
    await supabase.from('system_health').insert({
      component,
      status,
      ...metrics
    })
  }

  // ========================================
  // FEATURE FLAGS
  // ========================================

  /**
   * Get all feature flags
   */
  static async getFeatureFlags(): Promise<FeatureFlag[]> {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('name')

    if (error) throw error

    return data as FeatureFlag[]
  }

  /**
   * Toggle feature flag
   */
  static async toggleFeatureFlag(
    flagId: string,
    enabled: boolean
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('feature_flags')
      .update({
        is_enabled: enabled,
        updated_by: user?.id
      })
      .eq('id', flagId)

    if (error) throw error

    await this.logAdminAction(
      'TOGGLE_FEATURE_FLAG',
      'system_config',
      `Feature flag ${enabled ? 'enabled' : 'disabled'}`,
      undefined,
      { flag_id: flagId, enabled }
    )
  }

  /**
   * Check if feature is enabled for user
   */
  static async isFeatureEnabled(
    featureName: string,
    userId?: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('name', featureName)
      .single()

    if (error || !data) return false

    const flag = data as FeatureFlag

    if (!flag.is_enabled) return false

    // Check user-specific access
    if (userId && flag.enabled_for_users?.includes(userId)) return true

    // Check plan-specific access
    if (userId && flag.enabled_for_plans?.length) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan:plans(name)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      if (subscription?.plan?.name && flag.enabled_for_plans.includes(subscription.plan.name)) {
        return true
      }
    }

    // Check rollout percentage
    if (flag.rollout_percentage === 100) return true
    if (flag.rollout_percentage === 0) return false

    // Random rollout based on percentage
    return Math.random() * 100 < flag.rollout_percentage
  }

  // ========================================
  // HELPER METHODS
  // ========================================

  private static async getUserOrdersCount(userId: string): Promise<number> {
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    return count || 0
  }

  private static async getUserTotalSpent(userId: string): Promise<number> {
    const { data } = await supabase
      .from('billing_history')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'paid')

    return data?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0
  }

  private static async getUserLastActivity(userId: string): Promise<string> {
    const { data } = await supabase
      .from('user_activities')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return data?.created_at || 'Never'
  }

  /**
   * Export data to CSV
   */
  static async exportToCSV(
    table: string,
    filters?: Record<string, unknown>
  ): Promise<string> {
    // Use type assertion to bypass TypeScript strict checks for dynamic table names
    const query = supabase.from(table as never).select('*')

    const { data, error } = await query

    if (error) throw error
    if (!data || data.length === 0) return ''

    // Convert to CSV
    const headers = Object.keys(data[0]).join(',')
    const rows = data.map(row => 
      Object.values(row).map(val => 
        typeof val === 'string' ? `"${val}"` : val
      ).join(',')
    )

    return [headers, ...rows].join('\n')
  }

  // ========================================
  // ORDERS MANAGEMENT
  // ========================================

  /**
   * Get all orders with pagination and filters
   */
  static async getAllOrders(
    page: number = 1,
    limit: number = 25,
    filters?: {
      status?: string
      carrier?: string
      search?: string
    }
  ): Promise<{ orders: unknown[], total: number }> {
    let query = supabase
      .from('orders')
      .select(`
        *,
        user:profiles(id, name, email, store_name)
      `, { count: 'exact' })

    // Apply filters
    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }
    if (filters?.carrier && filters.carrier !== 'all') {
      query = query.eq('carrier', filters.carrier)
    }
    if (filters?.search) {
      query = query.or(`tracking_code.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%`)
    }

    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false })

    if (error) throw error

    return {
      orders: data || [],
      total: count || 0
    }
  }

  /**
   * Get order statistics
   */
  static async getOrderStats(): Promise<{
    total: number
    pending: number
    in_transit: number
    delivered: number
    failed: number
    today: number
    growth: number
  }> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const [
      totalResult,
      pendingResult,
      inTransitResult,
      deliveredResult,
      failedResult,
      todayResult,
      yesterdayResult
    ] = await Promise.all([
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'in_transit'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'delivered'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabase.from('orders').select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString())
        .lt('created_at', today.toISOString())
    ])

    const todayCount = todayResult.count || 0
    const yesterdayCount = yesterdayResult.count || 0
    const growth = yesterdayCount > 0 ? ((todayCount - yesterdayCount) / yesterdayCount) * 100 : 0

    return {
      total: totalResult.count || 0,
      pending: pendingResult.count || 0,
      in_transit: inTransitResult.count || 0,
      delivered: deliveredResult.count || 0,
      failed: failedResult.count || 0,
      today: todayCount,
      growth: Math.round(growth * 10) / 10
    }
  }

  /**
   * Update order status
   */
  static async updateOrderStatus(orderId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)

    if (error) throw error

    await this.logAdminAction(
      'UPDATE_ORDER_STATUS',
      'order_update',
      `Order status updated to ${status}`,
      undefined,
      { order_id: orderId, new_status: status }
    )
  }

  /**
   * Add notes to order
   */
  static async addOrderNotes(orderId: string, notes: string): Promise<void> {
    // Get current metadata
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('metadata')
      .eq('id', orderId)
      .single()

    if (fetchError) throw fetchError

    const metadata = (order?.metadata || {}) as Record<string, unknown>
    const adminNotes = (metadata.admin_notes as unknown[] || []) as Array<{
      note: string
      created_at: string
      created_by?: string
    }>
    
    adminNotes.push({
      note: notes,
      created_at: new Date().toISOString(),
      created_by: (await supabase.auth.getUser()).data.user?.id
    })

    const { error } = await supabase
      .from('orders')
      .update({ 
        metadata: { ...metadata, admin_notes: adminNotes } as never
      })
      .eq('id', orderId)

    if (error) throw error

    await this.logAdminAction(
      'ADD_ORDER_NOTES',
      'admin_action',
      'Admin notes added to order',
      undefined,
      { order_id: orderId }
    )
  }

  /**
   * Bulk update orders
   */
  static async bulkUpdateOrders(
    orderIds: string[],
    updates: { status?: string }
  ): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .in('id', orderIds)

    if (error) throw error

    await this.logAdminAction(
      'BULK_UPDATE_ORDERS',
      'admin_action',
      `Bulk updated ${orderIds.length} orders`,
      undefined,
      { order_ids: orderIds, updates }
    )
  }

  // ========================================
  // DATABASE MANAGEMENT
  // ========================================

  /**
   * Get database statistics
   */
  static async getDatabaseStats(): Promise<{
    total_size: string
    total_tables: number
    total_rows: number
    cache_hit_ratio: number
    active_connections: number
    max_connections: number
  }> {
    try {
      // Query database stats from pg_stat_database
      const { data: dbStats } = await supabase.rpc('get_database_stats')
      
      return (dbStats as never) || {
        total_size: '0 MB',
        total_tables: 0,
        total_rows: 0,
        cache_hit_ratio: 0,
        active_connections: 0,
        max_connections: 100
      }
    } catch (error) {
      console.error('Error getting database stats:', error)
      return {
        total_size: '0 MB',
        total_tables: 0,
        total_rows: 0,
        cache_hit_ratio: 0,
        active_connections: 0,
        max_connections: 100
      }
    }
  }

  /**
   * Get table information
   */
  static async getTableInfo(): Promise<Array<{
    name: string
    rows: number
    size: string
    last_vacuum?: string
  }>> {
    try {
      const { data } = await supabase.rpc('get_table_info')
      return data || []
    } catch (error) {
      console.error('Error getting table info:', error)
      return []
    }
  }

  /**
   * Create database backup
   */
  static async createBackup(): Promise<{ success: boolean; backup_id?: string }> {
    try {
      const { data, error } = await supabase.rpc('create_database_backup')
      
      if (error) throw error
      
      await this.logAdminAction(
        'CREATE_DATABASE_BACKUP',
        'admin_action',
        'Database backup created',
        undefined
      )

      return { success: true, backup_id: data }
    } catch (error) {
      console.error('Error creating backup:', error)
      return { success: false }
    }
  }

  /**
   * Optimize table (VACUUM)
   */
  static async optimizeTable(tableName: string): Promise<boolean> {
    try {
      await supabase.rpc('optimize_table', { table_name: tableName })
      
      await this.logAdminAction(
        'OPTIMIZE_TABLE',
        'admin_action',
        `Table ${tableName} optimized`,
        undefined
      )

      return true
    } catch (error) {
      console.error('Error optimizing table:', error)
      return false
    }
  }

  // ========================================
  // FEATURE FLAGS (EXTENDED)
  // ========================================

  /**
   * Create feature flag
   */
  static async createFeatureFlag(data: {
    name: string
    description?: string
    is_enabled: boolean
    rollout_percentage: number
    enabled_for_plans?: string[]
  }): Promise<FeatureFlag> {
    const { data: { user } } = await supabase.auth.getUser()

    const { data: flag, error } = await supabase
      .from('feature_flags')
      .insert({
        name: data.name,
        description: data.description,
        is_enabled: data.is_enabled,
        rollout_percentage: data.rollout_percentage,
        enabled_for_plans: data.enabled_for_plans || [],
        created_by: user?.id,
        metadata: {}
      })
      .select()
      .single()

    if (error) throw error

    await this.logAdminAction(
      'CREATE_FEATURE_FLAG',
      'admin_action',
      `Feature flag ${data.name} created`,
      undefined
    )

    return flag as FeatureFlag
  }

  /**
   * Update feature flag
   */
  static async updateFeatureFlag(
    id: string,
    data: Partial<FeatureFlag>
  ): Promise<FeatureFlag> {
    const { data: { user } } = await supabase.auth.getUser()

    const updateData = {
      ...data,
      metadata: data.metadata as never,
      updated_by: user?.id,
      updated_at: new Date().toISOString()
    }

    const { data: flag, error } = await supabase
      .from('feature_flags')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    await this.logAdminAction(
      'UPDATE_FEATURE_FLAG',
      'admin_action',
      `Feature flag ${id} updated`,
      undefined
    )

    return flag as FeatureFlag
  }

  /**
   * Delete feature flag
   */
  static async deleteFeatureFlag(id: string): Promise<void> {
    const { error } = await supabase
      .from('feature_flags')
      .delete()
      .eq('id', id)

    if (error) throw error

    await this.logAdminAction(
      'DELETE_FEATURE_FLAG',
      'admin_action',
      `Feature flag ${id} deleted`,
      undefined
    )
  }

  // ========================================
  // NOTIFICATIONS MANAGEMENT
  // ========================================

  /**
   * Get all notifications with filters
   */
  static async getNotifications(filters?: {
    status?: string
    type?: string
    page?: number
    limit?: number
  }): Promise<{ notifications: unknown[], total: number }> {
    let query = supabase
      .from('notification_queue')
      .select('*', { count: 'exact' })

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status as never)
    }
    if (filters?.type && filters.type !== 'all') {
      query = query.eq('notification_type', filters.type as never)
    }

    const page = filters?.page || 1
    const limit = filters?.limit || 25
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false })

    if (error) throw error

    return {
      notifications: data || [],
      total: count || 0
    }
  }

  /**
   * Get notification statistics
   */
  static async getNotificationStats(): Promise<{
    total: number
    sent: number
    pending: number
    failed: number
    read: number
  }> {
    const [
      totalResult,
      sentResult,
      pendingResult,
      failedResult,
      readResult
    ] = await Promise.all([
      supabase.from('notification_queue').select('*', { count: 'exact', head: true }),
      supabase.from('notification_queue').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
      supabase.from('notification_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('notification_queue').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('user_notifications').select('*', { count: 'exact', head: true }).not('read_at', 'is', null)
    ])

    return {
      total: totalResult.count || 0,
      sent: sentResult.count || 0,
      pending: pendingResult.count || 0,
      failed: failedResult.count || 0,
      read: readResult.count || 0
    }
  }

  // ========================================
  // SECURITY MANAGEMENT
  // ========================================

  /**
   * Get security events
   */
  static async getSecurityEvents(filters?: {
    severity?: string
    page?: number
    limit?: number
  }): Promise<{ events: unknown[], total: number }> {
    let query = supabase
      .from('admin_logs')
      .select('*', { count: 'exact' })
      .eq('activity_type', 'security_event')

    if (filters?.severity && filters.severity !== 'all') {
      query = query.eq('severity', filters.severity as never)
    }

    const page = filters?.page || 1
    const limit = filters?.limit || 25
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false })

    if (error) throw error

    return {
      events: data || [],
      total: count || 0
    }
  }

  /**
   * Get security statistics
   */
  static async getSecurityStats(): Promise<{
    total_events: number
    critical: number
    warnings: number
    active_sessions: number
    failed_logins_today: number
    blocked_ips: number
  }> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      totalResult,
      criticalResult,
      warningsResult,
      failedLoginsResult
    ] = await Promise.all([
      supabase.from('admin_logs').select('*', { count: 'exact', head: true })
        .eq('activity_type', 'security_event'),
      supabase.from('admin_logs').select('*', { count: 'exact', head: true })
        .eq('activity_type', 'security_event')
        .eq('severity', 'critical'),
      supabase.from('admin_logs').select('*', { count: 'exact', head: true })
        .eq('activity_type', 'security_event')
        .eq('severity', 'warning'),
      supabase.from('user_activities').select('*', { count: 'exact', head: true })
        .eq('activity_type', 'user_login')
        .gte('created_at', today.toISOString())
        .like('description', '%failed%')
    ])

    return {
      total_events: totalResult.count || 0,
      critical: criticalResult.count || 0,
      warnings: warningsResult.count || 0,
      active_sessions: 0, // TODO: Implement session tracking
      failed_logins_today: failedLoginsResult.count || 0,
      blocked_ips: 0 // TODO: Implement IP blocking
    }
  }

  // ========================================
  // ANALYTICS & REPORTING
  // ========================================

  /**
   * Get revenue time series data
   */
  static async getRevenueTimeSeries(
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ date: string; value: number }>> {
    const { data, error } = await supabase
      .from('orders')
      .select('created_at, total_amount')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .eq('status', 'completed')

    if (error) throw error

    // Group by date and sum amounts
    const grouped = new Map<string, number>()
    data.forEach(order => {
      const date = new Date(order.created_at).toISOString().split('T')[0]
      grouped.set(date, (grouped.get(date) || 0) + (order.total_amount || 0))
    })

    return Array.from(grouped.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * Get users growth time series data
   */
  static async getUsersTimeSeries(
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ date: string; value: number }>> {
    const { data, error } = await supabase
      .from('profiles')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (error) throw error

    // Count users by date
    const grouped = new Map<string, number>()
    data.forEach(user => {
      const date = new Date(user.created_at).toISOString().split('T')[0]
      grouped.set(date, (grouped.get(date) || 0) + 1)
    })

    // Convert to cumulative count
    let cumulative = 0
    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => {
        cumulative += count
        return { date, value: cumulative }
      })
  }

  /**
   * Get orders time series data
   */
  static async getOrdersTimeSeries(
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ date: string; value: number }>> {
    const { data, error } = await supabase
      .from('orders')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (error) throw error

    // Count orders by date
    const grouped = new Map<string, number>()
    data.forEach(order => {
      const date = new Date(order.created_at).toISOString().split('T')[0]
      grouped.set(date, (grouped.get(date) || 0) + 1)
    })

    return Array.from(grouped.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * Get plan distribution
   */
  static async getPlanDistribution(): Promise<Array<{ name: string; value: number }>> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        plan:plans(name),
        status
      `)
      .eq('status', 'active')

    if (error) throw error

    // Count by plan name
    const grouped = new Map<string, number>()
    data.forEach(sub => {
      const planName = (sub.plan as { name?: string })?.name || 'Unknown'
      grouped.set(planName, (grouped.get(planName) || 0) + 1)
    })

    return Array.from(grouped.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }

  /**
   * Get top users by orders and revenue
   */
  static async getTopUsers(limit = 5): Promise<Array<{
    name: string
    email: string
    orders: number
    revenue: number
  }>> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        user_id,
        total_amount,
        status,
        profiles!orders_user_id_fkey(name, email)
      `)
      .eq('status', 'completed')

    if (error) throw error

    // Group by user
    const userStats = new Map<string, {
      name: string
      email: string
      orders: number
      revenue: number
    }>()

    data.forEach(order => {
      const profile = order.profiles as { name?: string; email?: string }
      const userId = order.user_id
      if (!userId || !profile) return

      const current = userStats.get(userId) || {
        name: profile.name || 'Unknown',
        email: profile.email || 'unknown@example.com',
        orders: 0,
        revenue: 0
      }

      current.orders += 1
      current.revenue += order.total_amount || 0
      userStats.set(userId, current)
    })

    return Array.from(userStats.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit)
  }

  /**
   * Get growth metrics (MoM growth rates)
   */
  static async getGrowthMetrics(): Promise<{
    revenueGrowth: number
    userGrowth: number
    orderGrowth: number
    churnRate: number
  }> {
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

    // Revenue growth
    const [thisMonthRevenue, lastMonthRevenue] = await Promise.all([
      supabase
        .from('orders')
        .select('total_amount')
        .eq('status', 'completed')
        .gte('created_at', thisMonthStart.toISOString()),
      supabase
        .from('orders')
        .select('total_amount')
        .eq('status', 'completed')
        .gte('created_at', lastMonthStart.toISOString())
        .lte('created_at', lastMonthEnd.toISOString())
    ])

    const thisRevenue = thisMonthRevenue.data?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0
    const lastRevenue = lastMonthRevenue.data?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 1
    const revenueGrowth = ((thisRevenue - lastRevenue) / lastRevenue) * 100

    // User growth
    const [thisMonthUsers, lastMonthUsers] = await Promise.all([
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thisMonthStart.toISOString()),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', lastMonthStart.toISOString())
        .lte('created_at', lastMonthEnd.toISOString())
    ])

    const thisUsers = thisMonthUsers.count || 0
    const lastUsers = lastMonthUsers.count || 1
    const userGrowth = ((thisUsers - lastUsers) / lastUsers) * 100

    // Order growth
    const [thisMonthOrders, lastMonthOrders] = await Promise.all([
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thisMonthStart.toISOString()),
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', lastMonthStart.toISOString())
        .lte('created_at', lastMonthEnd.toISOString())
    ])

    const thisOrders = thisMonthOrders.count || 0
    const lastOrders = lastMonthOrders.count || 1
    const orderGrowth = ((thisOrders - lastOrders) / lastOrders) * 100

    // Churn rate (cancelled subscriptions / total active last month)
    const [cancelledSubs, totalSubs] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'cancelled')
        .gte('cancelled_at', thisMonthStart.toISOString()),
      supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .gte('created_at', lastMonthStart.toISOString())
        .lte('created_at', lastMonthEnd.toISOString())
    ])

    const cancelled = cancelledSubs.count || 0
    const total = totalSubs.count || 1
    const churnRate = (cancelled / total) * 100

    return {
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
      userGrowth: Math.round(userGrowth * 10) / 10,
      orderGrowth: Math.round(orderGrowth * 10) / 10,
      churnRate: Math.round(churnRate * 10) / 10
    }
  }

  /**
   * Export analytics data to CSV
   */
  static async exportAnalyticsCSV(
    startDate: Date,
    endDate: Date
  ): Promise<string> {
    const [revenue, users, orders, plans, topUsers] = await Promise.all([
      this.getRevenueTimeSeries(startDate, endDate),
      this.getUsersTimeSeries(startDate, endDate),
      this.getOrdersTimeSeries(startDate, endDate),
      this.getPlanDistribution(),
      this.getTopUsers(10)
    ])

    // Create CSV content
    let csv = 'Analytics Export\n\n'

    csv += 'Revenue by Date\n'
    csv += 'Date,Revenue\n'
    revenue.forEach(r => csv += `${r.date},${r.value}\n`)
    csv += '\n'

    csv += 'Users Growth\n'
    csv += 'Date,Total Users\n'
    users.forEach(u => csv += `${u.date},${u.value}\n`)
    csv += '\n'

    csv += 'Orders by Date\n'
    csv += 'Date,Orders\n'
    orders.forEach(o => csv += `${o.date},${o.value}\n`)
    csv += '\n'

    csv += 'Plan Distribution\n'
    csv += 'Plan,Users\n'
    plans.forEach(p => csv += `${p.name},${p.value}\n`)
    csv += '\n'

    csv += 'Top Users\n'
    csv += 'Name,Email,Orders,Revenue\n'
    topUsers.forEach(u => csv += `${u.name},${u.email},${u.orders},${u.revenue}\n`)

    return csv
  }
}
