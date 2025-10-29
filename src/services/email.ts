import { supabase } from '@/integrations/supabase/client'

export interface EmailConfig {
  to: string
  subject: string
  html: string
  from?: string
}

export interface EmailResponse {
  success: boolean
  messageId?: string
  message?: string
  error?: string
}

export class EmailService {
  static async sendEmail(config: EmailConfig): Promise<EmailResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('email-service', {
        body: config
      })

      if (error) {
        console.error('Email service error:', error)
        return {
          success: false,
          error: error.message || 'Failed to send email'
        }
      }

      return data as EmailResponse
    } catch (error) {
      console.error('Email service exception:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  static async sendTemplateEmail(
    to: string,
    templateId: string,
    variables: Record<string, string> = {}
  ): Promise<EmailResponse> {
    try {
      // Get template from database
      const { data: template, error: templateError } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('id', templateId)
        .eq('type', 'email')
        .single()

      if (templateError || !template) {
        return {
          success: false,
          error: 'Template not found'
        }
      }

      // Replace variables in template
      let subject = template.subject || ''
      let html = template.content

      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g')
        subject = subject.replace(regex, value)
        html = html.replace(regex, value)
      })

      return await this.sendEmail({
        to,
        subject,
        html
      })
    } catch (error) {
      console.error('Template email error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send template email'
      }
    }
  }

  static async sendPasswordResetEmail(email: string, resetLink: string): Promise<EmailResponse> {
    return await this.sendTemplateEmail(
      email,
      'default-recuperacao-de-senha',
      {
        reset_link: resetLink
      }
    );
  }
}