import { supabase } from '@/integrations/supabase/client'
import { UAParser } from 'ua-parser-js'

// Utility functions for validation and sanitization
class SessionUtils {
  /**
   * Validate required string parameters
   */
  static validateRequired(param: string, paramName: string): void {
    if (!param || typeof param !== 'string' || param.trim().length === 0) {
      throw new Error(`${paramName} is required and must be a non-empty string`)
    }
  }

  /**
   * Validate UUID format
   */
  static validateUUID(uuid: string, paramName: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(uuid)) {
      throw new Error(`${paramName} must be a valid UUID`)
    }
  }

  /**
   * Sanitize data for logging (remove sensitive information)
   */
  static sanitizeForLogging(data: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!data) return null

    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'cookie']
    const sanitized = { ...data }

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]'
      }
    }

    return sanitized
  }

  /**
   * Check if session is expired
   */
  static isSessionExpired(expiresAt: string | null): boolean {
    if (!expiresAt) return false
    return new Date(expiresAt) <= new Date()
  }

  /**
   * Get current user safely
   */
  static async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw new Error('Authentication error')
    if (!user) throw new Error('User not authenticated')
    return user
  }
}

export interface AdminSession extends Record<string, unknown> {
  id: string
  user_id: string
  session_token: string
  device_name: string | null
  device_type: string | null
  os_name: string | null
  os_version: string | null
  browser_name: string | null
  browser_version: string | null
  ip_address: string | null
  country: string | null
  city: string | null
  timezone: string | null
  user_agent: string | null
  is_active: boolean
  last_activity_at: string
  expires_at: string | null
  mfa_verified: boolean
  trusted_device: boolean
  created_at: string
  updated_at: string
  revoked_at: string | null
  revoked_by: string | null
  revoke_reason: string | null
}

export interface SessionActivity {
  id: string
  session_id: string
  user_id: string
  action: string
  endpoint: string | null
  method: string | null
  resource_type: string | null
  resource_id: string | null
  request_data: Record<string, unknown> | null
  response_status: number | null
  duration_ms: number | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface TrustedDevice extends Record<string, unknown> {
  id: string
  user_id: string
  device_fingerprint: string
  device_name: string | null
  device_type: string | null
  last_used_at: string
  trusted_at: string
  expires_at: string | null
  is_active: boolean
  created_at: string
}

export interface SessionSummary {
  session_count: number
  devices: Array<{
    type: string
    name: string
    browser: string
  }>
  locations: Array<{
    country: string
    city: string
  }>
  last_activity: string
}

export class SessionManagementService {
  /**
   * Parse User Agent to extract device info (server-side only)
   * Note: This should be called from server-side code only
   */
  private static parseUserAgent(userAgent: string) {
    try {
      const parser = new UAParser(userAgent)
      const result = parser.getResult()

      return {
        device_type: result.device.type || 'desktop',
        device_name: result.device.model || result.device.vendor || 'Unknown Device',
        os_name: result.os.name || 'Unknown OS',
        os_version: result.os.version || null,
        browser_name: result.browser.name || 'Unknown Browser',
        browser_version: result.browser.version || null,
      }
    } catch (error) {
      console.warn('Error parsing user agent:', error)
      return {
        device_type: 'desktop',
        device_name: 'Unknown Device',
        os_name: 'Unknown OS',
        os_version: null,
        browser_name: 'Unknown Browser',
        browser_version: null,
      }
    }
  }

  /**
   * Generate device fingerprint (improved implementation)
   * Uses multiple browser characteristics for better uniqueness
   */
  static generateDeviceFingerprint(): string {
    try {
      const components = [
        navigator.language,
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        !!window.sessionStorage,
        !!window.localStorage,
        !!window.indexedDB,
        navigator.hardwareConcurrency || 'unknown',
        navigator.platform,
      ]

      // Canvas fingerprinting (more robust)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.textBaseline = 'top'
        ctx.font = '14px Arial'
        ctx.fillText('fingerprint', 2, 2)
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
        ctx.fillRect(100, 5, 80, 20)
        components.push(canvas.toDataURL())
      }

      // WebGL fingerprinting
      try {
        const canvasGL = document.createElement('canvas')
        const gl = canvasGL.getContext('webgl') || canvasGL.getContext('experimental-webgl')
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
          if (debugInfo) {
            components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL))
            components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
          }
        }
      } catch (e) {
        // WebGL not available
      }

      const fingerprint = components.join('|')

      // Improved hash function (djb2)
      let hash = 5381
      for (let i = 0; i < fingerprint.length; i++) {
        hash = ((hash << 5) + hash) + fingerprint.charCodeAt(i)
      }

      return Math.abs(hash).toString(36)
    } catch (error) {
      console.warn('Error generating device fingerprint:', error)
      // Fallback to simple hash
      return Date.now().toString(36) + Math.random().toString(36).substr(2)
    }
  }

  /**
   * Create a new session (typically called on login)
   */
  static async createSession(
    userId: string,
    sessionToken: string,
    userAgent?: string,
    expiresInHours: number = 24
  ): Promise<AdminSession> {
    try {
      // Validate inputs
      SessionUtils.validateRequired(userId, 'userId')
      SessionUtils.validateRequired(sessionToken, 'sessionToken')
      SessionUtils.validateUUID(userId, 'userId')

      if (expiresInHours <= 0 || expiresInHours > 720) { // Max 30 days
        throw new Error('expiresInHours must be between 1 and 720')
      }

      // Parse device info from user agent (should come from server)
      const deviceInfo = userAgent ? this.parseUserAgent(userAgent) : {
        device_type: 'desktop' as const,
        device_name: 'Unknown Device',
        os_name: 'Unknown OS',
        os_version: null,
        browser_name: 'Unknown Browser',
        browser_version: null,
      }

      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + expiresInHours)

      const { data, error } = await supabase
        .from('admin_sessions')
        .insert({
          user_id: userId,
          session_token: sessionToken,
          ...deviceInfo,
          user_agent: userAgent || null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          expires_at: expiresAt.toISOString(),
          is_active: true,
          last_activity_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) {
        console.error('Database error creating session:', error)
        throw new Error(`Failed to create session: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error('Error creating session:', error)
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to create session')
    }
  }

  /**
   * Get all active sessions for a user with validation
   */
  static async getUserSessions(userId: string): Promise<AdminSession[]> {
    try {
      SessionUtils.validateRequired(userId, 'userId')
      SessionUtils.validateUUID(userId, 'userId')

      const { data, error } = await supabase
        .from('admin_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .not('expires_at', 'lt', new Date().toISOString())
        .order('last_activity_at', { ascending: false })

      if (error) {
        console.error('Database error getting user sessions:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error getting user sessions:', error)
      return []
    }
  }

  /**
   * Get session by token with expiration validation
   */
  static async getSessionByToken(token: string): Promise<AdminSession | null> {
    try {
      SessionUtils.validateRequired(token, 'token')

      const { data, error } = await supabase
        .from('admin_sessions')
        .select('*')
        .eq('session_token', token)
        .eq('is_active', true)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // Not found
        console.error('Database error getting session:', error)
        throw new Error(`Failed to get session: ${error.message}`)
      }

      // Check if session is expired
      if (SessionUtils.isSessionExpired(data.expires_at)) {
        // Auto-deactivate expired session
        await this.deactivateSession(data.id)
        return null
      }

      return data
    } catch (error) {
      console.error('Error getting session by token:', error)
      if (error instanceof Error && error.message.includes('Failed to get session')) {
        throw error
      }
      return null // Return null for unexpected errors to avoid exposing internal details
    }
  }

  /**
   * Deactivate a session (mark as inactive)
   */
  static async deactivateSession(sessionId: string): Promise<void> {
    try {
      SessionUtils.validateRequired(sessionId, 'sessionId')
      SessionUtils.validateUUID(sessionId, 'sessionId')

      const { error } = await supabase
        .from('admin_sessions')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoke_reason: 'Auto-deactivated due to expiration'
        })
        .eq('id', sessionId)

      if (error) {
        console.error('Database error deactivating session:', error)
        throw new Error(`Failed to deactivate session: ${error.message}`)
      }
    } catch (error) {
      console.error('Error deactivating session:', error)
      if (error instanceof Error && error.message.includes('Failed to deactivate session')) {
        throw error
      }
      // Don't throw for deactivation errors to avoid breaking user flow
    }
  }

  /**
   * Update session activity timestamp with expiration check
   */
  static async updateSessionActivity(sessionId: string): Promise<boolean> {
    try {
      SessionUtils.validateRequired(sessionId, 'sessionId')
      SessionUtils.validateUUID(sessionId, 'sessionId')

      // First check if session exists and is active
      const { data: session, error: selectError } = await supabase
        .from('admin_sessions')
        .select('expires_at, is_active')
        .eq('id', sessionId)
        .single()

      if (selectError || !session) {
        console.warn('Session not found for activity update:', sessionId)
        return false
      }

      if (!session.is_active || SessionUtils.isSessionExpired(session.expires_at)) {
        await this.deactivateSession(sessionId)
        return false
      }

      const { error } = await supabase
        .from('admin_sessions')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', sessionId)

      if (error) {
        console.error('Database error updating session activity:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error updating session activity:', error)
      return false
    }
  }

  /**
   * Log session activity with data sanitization
   */
  static async logActivity(
    sessionId: string,
    userId: string,
    action: string,
    details?: {
      endpoint?: string
      method?: string
      resourceType?: string
      resourceId?: string
      requestData?: Record<string, unknown>
      responseStatus?: number
      durationMs?: number
      userAgent?: string
    }
  ): Promise<void> {
    try {
      // Validate inputs
      SessionUtils.validateRequired(sessionId, 'sessionId')
      SessionUtils.validateRequired(userId, 'userId')
      SessionUtils.validateRequired(action, 'action')
      SessionUtils.validateUUID(sessionId, 'sessionId')
      SessionUtils.validateUUID(userId, 'userId')

      // Sanitize request data
      const sanitizedRequestData = SessionUtils.sanitizeForLogging(details?.requestData || null)

      const { error } = await supabase
        .from('admin_session_activities')
        .insert({
          session_id: sessionId,
          user_id: userId,
          action,
          endpoint: details?.endpoint || null,
          method: details?.method || null,
          resource_type: details?.resourceType || null,
          resource_id: details?.resourceId || null,
          request_data: sanitizedRequestData,
          response_status: details?.responseStatus || null,
          duration_ms: details?.durationMs || null,
          user_agent: details?.userAgent || null,
          ip_address: null, // Should be set server-side
        })

      if (error) {
        console.error('Database error logging activity:', error)
        // Don't throw - logging failures shouldn't break the main flow
      }
    } catch (error) {
      console.error('Error logging session activity:', error)
      // Don't throw - logging failures shouldn't break the main flow
    }
  }

  /**
   * Get session activities with pagination
   */
  static async getSessionActivities(
    sessionId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<SessionActivity[]> {
    try {
      SessionUtils.validateRequired(sessionId, 'sessionId')
      SessionUtils.validateUUID(sessionId, 'sessionId')

      if (limit < 1 || limit > 1000) {
        throw new Error('limit must be between 1 and 1000')
      }
      if (offset < 0) {
        throw new Error('offset must be non-negative')
      }

      const { data, error } = await supabase
        .from('admin_session_activities')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        console.error('Database error getting session activities:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error getting session activities:', error)
      return []
    }
  }

  /**
   * Revoke a specific session
   */
  static async revokeSession(
    sessionId: string,
    reason?: string
  ): Promise<void> {
    try {
      SessionUtils.validateRequired(sessionId, 'sessionId')
      SessionUtils.validateUUID(sessionId, 'sessionId')

      const currentUser = await SessionUtils.getCurrentUser()

      // Check if user owns the session or is admin
      const { data: session, error: sessionError } = await supabase
        .from('admin_sessions')
        .select('user_id')
        .eq('id', sessionId)
        .single()

      if (sessionError || !session) {
        throw new Error('Session not found')
      }

      // Allow users to revoke their own sessions or admins to revoke any session
      if (session.user_id !== currentUser.id) {
        // Check if current user is admin (this would need to be implemented based on your user roles)
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', currentUser.id)
          .single()

        if (!profile?.is_admin) {
          throw new Error('Unauthorized to revoke this session')
        }
      }

      const { error } = await supabase
        .from('admin_sessions')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_by: currentUser.id,
          revoke_reason: reason || 'Session revoked by user'
        })
        .eq('id', sessionId)

      if (error) {
        console.error('Database error revoking session:', error)
        throw new Error(`Failed to revoke session: ${error.message}`)
      }
    } catch (error) {
      console.error('Error revoking session:', error)
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to revoke session')
    }
  }

  /**
   * Revoke all sessions except current
   */
  static async revokeAllOtherSessions(
    currentSessionId: string,
    reason?: string
  ): Promise<number> {
    try {
      SessionUtils.validateRequired(currentSessionId, 'currentSessionId')
      SessionUtils.validateUUID(currentSessionId, 'currentSessionId')

      const currentUser = await SessionUtils.getCurrentUser()

      const { data, error } = await supabase
        .from('admin_sessions')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_by: currentUser.id,
          revoke_reason: reason || 'All other sessions revoked by user'
        })
        .eq('user_id', currentUser.id)
        .neq('id', currentSessionId)
        .eq('is_active', true)

      if (error) {
        console.error('Database error revoking sessions:', error)
        throw new Error(`Failed to revoke sessions: ${error.message}`)
      }

      return data?.length || 0
    } catch (error) {
      console.error('Error revoking all sessions:', error)
      if (error instanceof Error && error.message.includes('Failed to revoke sessions')) {
        throw error
      }
      throw new Error('Failed to revoke sessions')
    }
  }

  /**
   * Get session summary for user
   */
  static async getSessionSummary(userId: string): Promise<SessionSummary | null> {
    try {
      SessionUtils.validateRequired(userId, 'userId')
      SessionUtils.validateUUID(userId, 'userId')

      // Get active sessions for the user
      const { data: sessions, error: sessionsError } = await supabase
        .from('admin_sessions')
        .select('device_type, device_name, browser_name, ip_address')
        .eq('user_id', userId)
        .eq('is_active', true)
        .not('expires_at', 'lt', new Date().toISOString())

      if (sessionsError) {
        console.error('Database error getting sessions for summary:', sessionsError)
        return null
      }

      const sessionCount = sessions?.length || 0

      // Aggregate device information
      const devices = sessions?.map(session => ({
        type: session.device_type || 'desktop',
        name: session.device_name || 'Unknown Device',
        browser: session.browser_name || 'Unknown Browser',
      })) || []

      // Aggregate location information (simplified - would need IP geolocation service)
      const locations = sessions?.reduce((acc, session) => {
        if (session.ip_address) {
          // This is a simplified version - in production you'd use a geolocation service
          acc.push({
            country: 'Unknown', // Would need geolocation lookup
            city: 'Unknown',    // Would need geolocation lookup
          })
        }
        return acc
      }, [] as Array<{ country: string; city: string }>) || []

      // Get last activity from the most recent session
      const lastActivity = sessions?.[0]?.created_at || new Date().toISOString()

      return {
        session_count: sessionCount,
        devices,
        locations,
        last_activity: lastActivity,
      }
    } catch (error) {
      console.error('Error getting session summary:', error)
      return null
    }
  }

  /**
   * Add trusted device
   */
  static async addTrustedDevice(
    userId: string,
    deviceFingerprint: string,
    deviceName?: string,
    expiresInDays?: number
  ): Promise<TrustedDevice> {
    try {
      SessionUtils.validateRequired(userId, 'userId')
      SessionUtils.validateRequired(deviceFingerprint, 'deviceFingerprint')
      SessionUtils.validateUUID(userId, 'userId')

      if (expiresInDays !== undefined && (expiresInDays <= 0 || expiresInDays > 365)) {
        throw new Error('expiresInDays must be between 1 and 365')
      }

      // Get device info from current context (limited due to security concerns)
      const deviceInfo = {
        device_type: 'desktop' as const,
        device_name: deviceName || 'Unknown Device',
      }

      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null

      const { data, error } = await supabase
        .from('admin_trusted_devices')
        .upsert({
          user_id: userId,
          device_fingerprint: deviceFingerprint,
          device_name: deviceInfo.device_name,
          device_type: deviceInfo.device_type,
          expires_at: expiresAt,
          is_active: true,
          trusted_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,device_fingerprint'
        })
        .select()
        .single()

      if (error) {
        console.error('Database error adding trusted device:', error)
        throw new Error(`Failed to add trusted device: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error('Error adding trusted device:', error)
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to add trusted device')
    }
  }

  /**
   * Get trusted devices for user
   */
  static async getTrustedDevices(userId: string): Promise<TrustedDevice[]> {
    try {
      SessionUtils.validateRequired(userId, 'userId')
      SessionUtils.validateUUID(userId, 'userId')

      const now = new Date().toISOString()

      const { data, error } = await supabase
        .from('admin_trusted_devices')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('last_used_at', { ascending: false })

      if (error) {
        console.error('Database error getting trusted devices:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error getting trusted devices:', error)
      return []
    }
  }

  /**
   * Remove trusted device
   */
  static async removeTrustedDevice(deviceId: string): Promise<void> {
    try {
      SessionUtils.validateRequired(deviceId, 'deviceId')
      SessionUtils.validateUUID(deviceId, 'deviceId')

      const currentUser = await SessionUtils.getCurrentUser()

      // Check if user owns the trusted device
      const { data: device, error: deviceError } = await supabase
        .from('admin_trusted_devices')
        .select('user_id')
        .eq('id', deviceId)
        .single()

      if (deviceError || !device) {
        throw new Error('Trusted device not found')
      }

      // Allow users to remove their own trusted devices or admins to remove any
      if (device.user_id !== currentUser.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', currentUser.id)
          .single()

        if (!profile?.is_admin) {
          throw new Error('Unauthorized to remove this trusted device')
        }
      }

      const { error } = await supabase
        .from('admin_trusted_devices')
        .update({ is_active: false })
        .eq('id', deviceId)

      if (error) {
        console.error('Database error removing trusted device:', error)
        throw new Error(`Failed to remove trusted device: ${error.message}`)
      }
    } catch (error) {
      console.error('Error removing trusted device:', error)
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to remove trusted device')
    }
  }

  /**
   * Check if device is trusted
   */
  static async isDeviceTrusted(
    userId: string,
    deviceFingerprint: string
  ): Promise<boolean> {
    try {
      SessionUtils.validateRequired(userId, 'userId')
      SessionUtils.validateRequired(deviceFingerprint, 'deviceFingerprint')
      SessionUtils.validateUUID(userId, 'userId')

      const now = new Date().toISOString()

      const { data, error } = await supabase
        .from('admin_trusted_devices')
        .select('id')
        .eq('user_id', userId)
        .eq('device_fingerprint', deviceFingerprint)
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return false
        console.error('Database error checking trusted device:', error)
        return false
      }

      return !!data
    } catch (error) {
      console.error('Error checking trusted device:', error)
      return false
    }
  }

  /**
   * Cleanup expired sessions (should be called periodically)
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const now = new Date().toISOString()

      const { data, error } = await supabase
        .from('admin_sessions')
        .update({
          is_active: false,
          revoked_at: now,
          revoke_reason: 'Auto-cleanup: session expired'
        })
        .lt('expires_at', now)
        .eq('is_active', true)
        .select('id')

      if (error) {
        console.error('Database error cleaning up expired sessions:', error)
        return 0
      }

      const cleanedCount = data?.length || 0
      console.log(`Cleaned up ${cleanedCount} expired sessions`)

      return cleanedCount
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error)
      return 0
    }
  }

  /**
   * Cleanup old session activities (keep last 30 days)
   */
  static async cleanupOldActivities(daysToKeep: number = 30): Promise<number> {
    try {
      if (daysToKeep < 1 || daysToKeep > 365) {
        throw new Error('daysToKeep must be between 1 and 365')
      }

      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
      const cutoffISOString = cutoffDate.toISOString()

      const { data, error } = await supabase
        .from('admin_session_activities')
        .delete()
        .lt('created_at', cutoffISOString)
        .select('id')

      if (error) {
        console.error('Database error cleaning up old activities:', error)
        return 0
      }

      const deletedCount = data?.length || 0
      console.log(`Cleaned up ${deletedCount} old session activities`)

      return deletedCount
    } catch (error) {
      console.error('Error cleaning up old activities:', error)
      return 0
    }
  }
}
