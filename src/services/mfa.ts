import { supabase } from '@/integrations/supabase/client'
import * as OTPAuth from 'otpauth'

export interface MFAConfig {
  id: string
  user_id: string
  secret: string
  enabled: boolean
  verified: boolean
  backup_codes: string[]
  used_backup_codes: string[]
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export interface MFASetupResponse {
  secret: string
  qrCodeUrl: string
  backupCodes: string[]
  manualEntryCode: string
}

export interface MFAAttempt {
  id: string
  user_id: string
  attempt_type: 'totp' | 'backup_code' | 'recovery'
  success: boolean
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export class MFAService {
  /**
   * Generate MFA setup (TOTP secret, QR code, backup codes)
   */
  static async setupMFA(userId: string, userEmail: string): Promise<MFASetupResponse> {
    try {
      // Generate random secret
      const secret = OTPAuth.Secret.fromLength(20)
      const secretBase32 = secret.base32

      // Create TOTP instance
      const totp = new OTPAuth.TOTP({
        issuer: 'Tracky Pro Flow',
        label: userEmail,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: secret,
      })

      // Generate QR code URL
      const qrCodeUrl = totp.toString()

      // Generate 10 backup codes
      const backupCodes = this.generateBackupCodes(10)

      // Store in database (not enabled until verified)
      const { data, error } = await supabase
        .from('admin_mfa')
        .upsert({
          user_id: userId,
          secret: secretBase32, // In production, encrypt this!
          enabled: false,
          verified: false,
          backup_codes: backupCodes, // In production, hash these!
          used_backup_codes: [],
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single()

      if (error) throw error

      return {
        secret: secretBase32,
        qrCodeUrl,
        backupCodes,
        manualEntryCode: secretBase32,
      }
    } catch (error) {
      console.error('Error setting up MFA:', error)
      throw new Error('Failed to setup MFA')
    }
  }

  /**
   * Verify TOTP token and enable MFA
   */
  static async verifyAndEnableMFA(userId: string, token: string): Promise<boolean> {
    try {
      // Get user's MFA config
      const { data: mfaConfig, error: fetchError } = await supabase
        .from('admin_mfa')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (fetchError || !mfaConfig) {
        throw new Error('MFA not configured')
      }

      // Verify token
      const isValid = this.verifyTOTP(mfaConfig.secret, token)

      if (isValid) {
        // Enable and verify MFA
        const { error: updateError } = await supabase
          .from('admin_mfa')
          .update({
            enabled: true,
            verified: true,
            last_used_at: new Date().toISOString(),
          })
          .eq('user_id', userId)

        if (updateError) throw updateError

        // Log successful setup
        await this.logMFAAttempt(userId, 'totp', true)

        return true
      } else {
        // Log failed attempt
        await this.logMFAAttempt(userId, 'totp', false)
        return false
      }
    } catch (error) {
      console.error('Error verifying MFA:', error)
      throw new Error('Failed to verify MFA')
    }
  }

  /**
   * Verify TOTP token for login
   */
  static async verifyMFAToken(userId: string, token: string): Promise<boolean> {
    try {
      // Get user's MFA config
      const { data: mfaConfig, error } = await supabase
        .from('admin_mfa')
        .select('*')
        .eq('user_id', userId)
        .eq('enabled', true)
        .single()

      if (error || !mfaConfig) {
        throw new Error('MFA not enabled')
      }

      // Verify TOTP
      const isValid = this.verifyTOTP(mfaConfig.secret, token)

      // Log attempt
      await this.logMFAAttempt(userId, 'totp', isValid)

      if (isValid) {
        // Update last used
        await supabase
          .from('admin_mfa')
          .update({ last_used_at: new Date().toISOString() })
          .eq('user_id', userId)
      }

      return isValid
    } catch (error) {
      console.error('Error verifying MFA token:', error)
      return false
    }
  }

  /**
   * Verify backup code
   */
  static async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    try {
      const { data: mfaConfig, error } = await supabase
        .from('admin_mfa')
        .select('*')
        .eq('user_id', userId)
        .eq('enabled', true)
        .single()

      if (error || !mfaConfig) {
        throw new Error('MFA not enabled')
      }

      // Check if code exists and hasn't been used
      const codeIndex = mfaConfig.backup_codes?.indexOf(code)
      const isValid = codeIndex !== -1 && 
                     !mfaConfig.used_backup_codes?.includes(code)

      // Log attempt
      await this.logMFAAttempt(userId, 'backup_code', isValid)

      if (isValid) {
        // Mark code as used
        const usedCodes = [...(mfaConfig.used_backup_codes || []), code]
        
        await supabase
          .from('admin_mfa')
          .update({
            used_backup_codes: usedCodes,
            last_used_at: new Date().toISOString(),
          })
          .eq('user_id', userId)

        return true
      }

      return false
    } catch (error) {
      console.error('Error verifying backup code:', error)
      return false
    }
  }

  /**
   * Disable MFA (requires current password verification)
   */
  static async disableMFA(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('admin_mfa')
        .update({
          enabled: false,
          verified: false,
        })
        .eq('user_id', userId)

      if (error) throw error

      // Log in admin_logs
      await supabase.from('admin_logs').insert({
        user_id: userId,
        action: 'disable_mfa',
        entity_type: 'security',
        entity_id: userId,
        description: 'MFA disabled for admin account',
      })
    } catch (error) {
      console.error('Error disabling MFA:', error)
      throw new Error('Failed to disable MFA')
    }
  }

  /**
   * Get MFA status for user
   */
  static async getMFAStatus(userId: string): Promise<{ enabled: boolean; verified: boolean } | null> {
    try {
      const { data, error } = await supabase
        .from('admin_mfa')
        .select('enabled, verified')
        .eq('user_id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // Not found
        throw error
      }

      return data
    } catch (error) {
      console.error('Error getting MFA status:', error)
      return null
    }
  }

  /**
   * Get unused backup codes
   */
  static async getBackupCodes(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('admin_mfa')
        .select('backup_codes, used_backup_codes')
        .eq('user_id', userId)
        .single()

      if (error) throw error

      const unused = (data.backup_codes || []).filter(
        code => !(data.used_backup_codes || []).includes(code)
      )

      return unused
    } catch (error) {
      console.error('Error getting backup codes:', error)
      return []
    }
  }

  /**
   * Regenerate backup codes
   */
  static async regenerateBackupCodes(userId: string): Promise<string[]> {
    try {
      const newCodes = this.generateBackupCodes(10)

      const { error } = await supabase
        .from('admin_mfa')
        .update({
          backup_codes: newCodes,
          used_backup_codes: [],
        })
        .eq('user_id', userId)

      if (error) throw error

      // Log action
      await supabase.from('admin_logs').insert({
        user_id: userId,
        action: 'regenerate_backup_codes',
        entity_type: 'security',
        entity_id: userId,
        description: 'MFA backup codes regenerated',
      })

      return newCodes
    } catch (error) {
      console.error('Error regenerating backup codes:', error)
      throw new Error('Failed to regenerate backup codes')
    }
  }

  /**
   * Get MFA attempts history
   */
  static async getMFAAttempts(userId: string, limit = 50): Promise<MFAAttempt[]> {
    try {
      const { data, error } = await supabase
        .from('admin_mfa_attempts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error getting MFA attempts:', error)
      return []
    }
  }

  // ===== HELPER METHODS =====

  /**
   * Verify TOTP token
   */
  private static verifyTOTP(secret: string, token: string): boolean {
    try {
      const totp = new OTPAuth.TOTP({
        issuer: 'Tracky Pro Flow',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret),
      })

      // Allow 1 window before/after for clock skew
      const delta = totp.validate({
        token,
        window: 1,
      })

      return delta !== null
    } catch (error) {
      console.error('Error verifying TOTP:', error)
      return false
    }
  }

  /**
   * Generate backup codes
   */
  private static generateBackupCodes(count: number): string[] {
    const codes: string[] = []
    
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = Array.from({ length: 8 }, () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed ambiguous chars
        return chars[Math.floor(Math.random() * chars.length)]
      }).join('')
      
      codes.push(code)
    }
    
    return codes
  }

  /**
   * Log MFA attempt
   */
  private static async logMFAAttempt(
    userId: string,
    attemptType: 'totp' | 'backup_code' | 'recovery',
    success: boolean
  ): Promise<void> {
    try {
      await supabase.from('admin_mfa_attempts').insert({
        user_id: userId,
        attempt_type: attemptType,
        success,
        ip_address: null, // Get from request context in production
        user_agent: navigator.userAgent,
      })
    } catch (error) {
      console.error('Error logging MFA attempt:', error)
    }
  }
}
