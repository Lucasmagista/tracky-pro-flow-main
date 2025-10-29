const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';

export interface EmailData {
  to: string;
  from?: string;
  subject: string;
  html: string;
}

export async function sendEmail(data: EmailData) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: data.from || 'Tracky Pro <noreply@trackypro.com>',
      to: data.to,
      subject: data.subject,
      html: data.html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao enviar email: ${error}`);
  }

  return await response.json();
}

// Templates de Email
export const emailTemplates = {
  welcome: (userName: string, planName: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Bem-vindo ao Tracky Pro!</h1>
          </div>
          <div class="content">
            <p>Olá <strong>${userName}</strong>,</p>
            <p>Parabéns! Sua assinatura do plano <strong>${planName}</strong> foi ativada com sucesso.</p>
            <p>Agora você tem acesso a todos os recursos premium para gerenciar seus pedidos de forma profissional.</p>
            <a href="https://trackypro.com/dashboard" class="button">Acessar Dashboard</a>
            <p>Se tiver alguma dúvida, nossa equipe está sempre pronta para ajudar!</p>
          </div>
          <div class="footer">
            <p>Tracky Pro - Gestão Inteligente de Pedidos</p>
          </div>
        </div>
      </body>
    </html>
  `,

  paymentConfirmation: (userName: string, amount: number, invoiceUrl: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; }
          .amount { font-size: 32px; font-weight: bold; color: #10b981; text-align: center; margin: 20px 0; }
          .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Pagamento Confirmado</h1>
          </div>
          <div class="content">
            <p>Olá <strong>${userName}</strong>,</p>
            <p>Recebemos seu pagamento com sucesso!</p>
            <div class="amount">R$ ${amount.toFixed(2)}</div>
            <p>Sua assinatura está ativa e você pode continuar usando todos os recursos.</p>
            <a href="${invoiceUrl}" class="button">📄 Baixar Fatura</a>
          </div>
          <div class="footer">
            <p>Tracky Pro - Gestão Inteligente de Pedidos</p>
          </div>
        </div>
      </body>
    </html>
  `,

  paymentReminder: (userName: string, amount: number, dueDate: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; }
          .amount { font-size: 28px; font-weight: bold; color: #f59e0b; text-align: center; margin: 20px 0; }
          .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Lembrete de Pagamento</h1>
          </div>
          <div class="content">
            <p>Olá <strong>${userName}</strong>,</p>
            <p>Sua próxima cobrança está chegando!</p>
            <div class="amount">R$ ${amount.toFixed(2)}</div>
            <p><strong>Data de vencimento:</strong> ${dueDate}</p>
            <p>Certifique-se de que seu método de pagamento está atualizado para evitar interrupções no serviço.</p>
            <a href="https://trackypro.com/subscription" class="button">Atualizar Pagamento</a>
          </div>
          <div class="footer">
            <p>Tracky Pro - Gestão Inteligente de Pedidos</p>
          </div>
        </div>
      </body>
    </html>
  `,

  usageAlert: (userName: string, metric: string, percentage: number) => `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ef4444; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; }
          .percentage { font-size: 36px; font-weight: bold; color: #ef4444; text-align: center; margin: 20px 0; }
          .button { display: inline-block; background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Alerta de Uso</h1>
          </div>
          <div class="content">
            <p>Olá <strong>${userName}</strong>,</p>
            <p>Você está próximo do limite de <strong>${metric}</strong>!</p>
            <div class="percentage">${percentage}% usado</div>
            <p>Considere fazer upgrade do seu plano para continuar sem interrupções.</p>
            <a href="https://trackypro.com/subscription" class="button">Ver Planos</a>
          </div>
          <div class="footer">
            <p>Tracky Pro - Gestão Inteligente de Pedidos</p>
          </div>
        </div>
      </body>
    </html>
  `,

  cancellation: (userName: string, endDate: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6b7280; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>😢 Cancelamento Confirmado</h1>
          </div>
          <div class="content">
            <p>Olá <strong>${userName}</strong>,</p>
            <p>Confirmamos o cancelamento da sua assinatura.</p>
            <p><strong>Acesso até:</strong> ${endDate}</p>
            <p>Você pode continuar usando todos os recursos até esta data. Depois disso, seu plano será suspenso.</p>
            <p>Sentiremos sua falta! Se mudar de ideia, você pode reativar a qualquer momento.</p>
            <a href="https://trackypro.com/subscription" class="button">Reativar Assinatura</a>
          </div>
          <div class="footer">
            <p>Tracky Pro - Gestão Inteligente de Pedidos</p>
          </div>
        </div>
      </body>
    </html>
  `,
};
