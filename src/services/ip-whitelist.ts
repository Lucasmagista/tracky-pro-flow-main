import { supabase } from '@/integrations/supabase/client'

export interface AllowedIP {
  id: string
  ip_address: string | null
  ip_range: string | null
  description: string | null
  added_by: string | null
  is_active: boolean
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface BlockedIP {
  id: string
  ip_address: string
  block_reason: string
  blocked_by: string | null
  failed_attempts: number
  last_attempt_at: string | null
  blocked_until: string | null
  is_permanent: boolean
  created_at: string
  updated_at: string
}

export interface IPAccessLog {
  id: string
  user_id: string
  ip_address: string
  access_granted: boolean
  blocked_reason: string | null
  user_agent: string | null
  endpoint: string | null
  created_at: string
}

export interface IPAccessStats {
  totalAttempts: number
  successfulAttempts: number
  blockedAttempts: number
  uniqueIPs: number
  topBlockedReasons: { reason: string; count: number }[]
}

export class IPWhitelistService {
  /**
   * Get current user's IP address (client-side approximation)
   * In production, get this from server-side headers
   */
  static async getCurrentIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      return data.ip
    } catch (error) {
      console.error('Error getting current IP:', error)
      return 'Unknown'
    }
  }

  /**
   * Check if an IP is allowed
   */
  static async isIPAllowed(ipAddress: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('is_ip_allowed', { check_ip: ipAddress })

      if (error) throw error

      return data === true
    } catch (error) {
      console.error('Error checking IP:', error)
      return false
    }
  }

  /**
   * Add IP to whitelist
   */
  static async addAllowedIP(
    ipAddress: string,
    description: string,
    expiresAt?: Date
  ): Promise<AllowedIP> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('admin_allowed_ips')
        .insert({
          ip_address: ipAddress,
          description,
          added_by: user.id,
          expires_at: expiresAt?.toISOString() || null,
          is_active: true,
        })
        .select()
        .single()

      if (error) throw error

      // Log action
      await supabase.from('admin_logs').insert({
        user_id: user.id,
        action: 'add_allowed_ip',
        entity_type: 'security',
        entity_id: data.id,
        description: `Added IP ${ipAddress} to whitelist: ${description}`,
      })

      return data
    } catch (error) {
      console.error('Error adding allowed IP:', error)
      throw new Error('Failed to add IP to whitelist')
    }
  }

  /**
   * Add IP range to whitelist (CIDR notation)
   */
  static async addAllowedIPRange(
    ipRange: string,
    description: string,
    expiresAt?: Date
  ): Promise<AllowedIP> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Validate CIDR notation (basic check)
      if (!ipRange.includes('/')) {
        throw new Error('Invalid CIDR notation. Use format: 192.168.1.0/24')
      }

      const { data, error } = await supabase
        .from('admin_allowed_ips')
        .insert({
          ip_range: ipRange,
          description,
          added_by: user.id,
          expires_at: expiresAt?.toISOString() || null,
          is_active: true,
        })
        .select()
        .single()

      if (error) throw error

      // Log action
      await supabase.from('admin_logs').insert({
        user_id: user.id,
        action: 'add_allowed_ip_range',
        entity_type: 'security',
        entity_id: data.id,
        description: `Added IP range ${ipRange} to whitelist: ${description}`,
      })

      return data
    } catch (error) {
      console.error('Error adding allowed IP range:', error)
      throw new Error('Failed to add IP range to whitelist')
    }
  }

  /**
   * Get all allowed IPs
   */
  static async getAllowedIPs(): Promise<AllowedIP[]> {
    try {
      const { data, error } = await supabase
        .from('admin_allowed_ips')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error getting allowed IPs:', error)
      return []
    }
  }

  /**
   * Toggle IP active status
   */
  static async toggleIPStatus(ipId: string, isActive: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('admin_allowed_ips')
        .update({ is_active: isActive })
        .eq('id', ipId)

      if (error) throw error

      // Log action
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('admin_logs').insert({
          user_id: user.id,
          action: isActive ? 'activate_allowed_ip' : 'deactivate_allowed_ip',
          entity_type: 'security',
          entity_id: ipId,
          description: `${isActive ? 'Activated' : 'Deactivated'} allowed IP`,
        })
      }
    } catch (error) {
      console.error('Error toggling IP status:', error)
      throw new Error('Failed to update IP status')
    }
  }

  /**
   * Remove IP from whitelist
   */
  static async removeAllowedIP(ipId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('admin_allowed_ips')
        .delete()
        .eq('id', ipId)

      if (error) throw error

      // Log action
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('admin_logs').insert({
          user_id: user.id,
          action: 'remove_allowed_ip',
          entity_type: 'security',
          entity_id: ipId,
          description: 'Removed IP from whitelist',
        })
      }
    } catch (error) {
      console.error('Error removing allowed IP:', error)
      throw new Error('Failed to remove IP from whitelist')
    }
  }

  /**
   * Get blocked IPs
   */
  static async getBlockedIPs(): Promise<BlockedIP[]> {
    try {
      const { data, error } = await supabase
        .from('admin_blocked_ips')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error getting blocked IPs:', error)
      return []
    }
  }

  /**
   * Block an IP address manually
   */
  static async blockIP(
    ipAddress: string,
    reason: string,
    isPermanent: boolean = false,
    blockDuration?: number // hours
  ): Promise<BlockedIP> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const blockedUntil = !isPermanent && blockDuration
        ? new Date(Date.now() + blockDuration * 60 * 60 * 1000).toISOString()
        : null

      const { data, error } = await supabase
        .from('admin_blocked_ips')
        .insert({
          ip_address: ipAddress,
          block_reason: reason,
          blocked_by: user.id,
          is_permanent: isPermanent,
          blocked_until: blockedUntil,
        })
        .select()
        .single()

      if (error) throw error

      // Log action
      await supabase.from('admin_logs').insert({
        user_id: user.id,
        action: 'block_ip',
        entity_type: 'security',
        entity_id: data.id,
        description: `Blocked IP ${ipAddress}: ${reason}`,
      })

      return data
    } catch (error) {
      console.error('Error blocking IP:', error)
      throw new Error('Failed to block IP')
    }
  }

  /**
   * Unblock an IP address
   */
  static async unblockIP(ipId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('admin_blocked_ips')
        .delete()
        .eq('id', ipId)

      if (error) throw error

      // Log action
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('admin_logs').insert({
          user_id: user.id,
          action: 'unblock_ip',
          entity_type: 'security',
          entity_id: ipId,
          description: 'Unblocked IP address',
        })
      }
    } catch (error) {
      console.error('Error unblocking IP:', error)
      throw new Error('Failed to unblock IP')
    }
  }

  /**
   * Get IP access logs
   */
  static async getIPAccessLogs(
    limit: number = 100,
    userId?: string
  ): Promise<IPAccessLog[]> {
    try {
      let query = supabase
        .from('admin_ip_access_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (userId) {
        query = query.eq('user_id', userId)
      }

      const { data, error } = await query

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error getting IP access logs:', error)
      return []
    }
  }

  /**
   * Get IP access statistics
   */
  static async getIPAccessStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<IPAccessStats> {
    try {
      let query = supabase
        .from('admin_ip_access_log')
        .select('*')

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString())
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      const logs = data || []

      // Calculate statistics
      const totalAttempts = logs.length
      const successfulAttempts = logs.filter(log => log.access_granted).length
      const blockedAttempts = logs.filter(log => !log.access_granted).length
      const uniqueIPs = new Set(logs.map(log => log.ip_address)).size

      // Top blocked reasons
      const reasonCounts: Record<string, number> = {}
      logs
        .filter(log => !log.access_granted && log.blocked_reason)
        .forEach(log => {
          const reason = log.blocked_reason || 'Unknown'
          reasonCounts[reason] = (reasonCounts[reason] || 0) + 1
        })

      const topBlockedReasons = Object.entries(reasonCounts)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      return {
        totalAttempts,
        successfulAttempts,
        blockedAttempts,
        uniqueIPs,
        topBlockedReasons,
      }
    } catch (error) {
      console.error('Error getting IP access stats:', error)
      return {
        totalAttempts: 0,
        successfulAttempts: 0,
        blockedAttempts: 0,
        uniqueIPs: 0,
        topBlockedReasons: [],
      }
    }
  }

  /**
   * Log an IP access attempt
   * (This would typically be called from server-side/middleware)
   */
  static async logIPAccess(
    userId: string,
    ipAddress: string,
    accessGranted: boolean,
    blockedReason?: string,
    endpoint?: string
  ): Promise<void> {
    try {
      await supabase.rpc('log_ip_access', {
        p_user_id: userId,
        p_ip_address: ipAddress,
        p_access_granted: accessGranted,
        p_blocked_reason: blockedReason || null,
        p_user_agent: navigator.userAgent,
        p_endpoint: endpoint || null,
      })
    } catch (error) {
      console.error('Error logging IP access:', error)
    }
  }

  /**
   * Cleanup expired blocks and old logs
   */
  static async cleanupExpiredData(): Promise<void> {
    try {
      // Cleanup expired blocks
      await supabase.rpc('cleanup_expired_ip_blocks')

      // Cleanup old access logs
      await supabase.rpc('cleanup_old_ip_access_logs')
    } catch (error) {
      console.error('Error cleaning up expired data:', error)
    }
  }
}
