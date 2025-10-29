import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { supabaseAdmin } from '../_shared/supabase.ts';
import { sendEmail, emailTemplates } from '../_shared/resend.ts';

serve(async () => {
  try {
    console.log('Iniciando cron job de billing...');

    // 1. Resetar uso para assinaturas que renovaram
    await resetUsageForRenewedSubscriptions();

    // 2. Enviar lembretes de pagamento (3 dias antes)
    await sendPaymentReminders();

    // 3. Verificar alertas de uso (80%)
    await checkUsageAlerts();

    // 4. Processar pagamentos pendentes (retry)
    await retryFailedPayments();

    return new Response(
      JSON.stringify({ success: true, message: 'Cron job executado com sucesso' }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    console.error('Erro no cron job:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function resetUsageForRenewedSubscriptions() {
  const { data: subscriptions } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('status', 'active')
    .lte('current_period_end', new Date().toISOString());

  if (!subscriptions || subscriptions.length === 0) return;

  for (const sub of subscriptions) {
    // Deletar uso do período anterior
    await supabaseAdmin
      .from('subscription_usage')
      .delete()
      .eq('subscription_id', sub.id)
      .lt('period_start', sub.current_period_start);

    // Atualizar período
    const newStart = new Date(sub.current_period_end);
    const newEnd = new Date(newStart);
    newEnd.setMonth(newEnd.getMonth() + 1);

    await supabaseAdmin
      .from('subscriptions')
      .update({
        current_period_start: newStart.toISOString(),
        current_period_end: newEnd.toISOString(),
      })
      .eq('id', sub.id);

    console.log(`Período renovado para subscription ${sub.id}`);
  }
}

async function sendPaymentReminders() {
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const { data: subscriptions } = await supabaseAdmin
    .from('subscriptions')
    .select('*, profiles(*), plans(*)')
    .eq('status', 'active')
    .gte('current_period_end', new Date().toISOString())
    .lte('current_period_end', threeDaysFromNow.toISOString());

  if (!subscriptions || subscriptions.length === 0) return;

  for (const sub of subscriptions) {
    if (!sub.profiles || !sub.plans) continue;

    await sendEmail({
      to: sub.profiles.store_email,
      subject: '⏰ Lembrete: Próxima cobrança em 3 dias',
      html: emailTemplates.paymentReminder(
        sub.profiles.name,
        sub.plans.price,
        new Date(sub.current_period_end).toLocaleDateString('pt-BR')
      ),
    });

    console.log(`Lembrete enviado para ${sub.profiles.store_email}`);
  }
}

async function checkUsageAlerts() {
  const { data: subscriptions } = await supabaseAdmin
    .from('subscriptions')
    .select('*, profiles(*), plans(*)')
    .eq('status', 'active');

  if (!subscriptions) return;

  for (const sub of subscriptions) {
    if (!sub.profiles || !sub.plans) continue;

    // Buscar uso atual
    const { data: usage } = await supabaseAdmin
      .from('subscription_usage')
      .select('metric, value')
      .eq('subscription_id', sub.id)
      .eq('period_start', sub.current_period_start);

    if (!usage) continue;

    // Calcular percentuais
    const metrics = ['orders', 'notifications', 'integrations'];
    
    for (const metric of metrics) {
      const currentUsage = usage.find((u: { metric: string }) => u.metric === metric)?.value || 0;
      const limit = sub.plans.limits?.[metric];

      if (limit && limit > 0) {
        const percentage = (currentUsage / limit) * 100;

        // Alerta em 80%
        if (percentage >= 80 && percentage < 85) {
          await sendEmail({
            to: sub.profiles.store_email,
            subject: `⚠️ Alerta: ${percentage.toFixed(0)}% de uso em ${metric}`,
            html: emailTemplates.usageAlert(
              sub.profiles.name,
              metric,
              Math.round(percentage)
            ),
          });

          console.log(`Alerta de uso enviado para ${sub.profiles.store_email}: ${metric} ${percentage}%`);
        }
      }
    }
  }
}

async function retryFailedPayments() {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const { data: failedPayments } = await supabaseAdmin
    .from('billing_history')
    .select('*, subscriptions(*, profiles(*))')
    .eq('status', 'failed')
    .gte('created_at', oneDayAgo.toISOString())
    .limit(10);

  if (!failedPayments || failedPayments.length === 0) return;

  // TODO: Implementar retry real com Stripe
  console.log(`${failedPayments.length} pagamentos falhados para retry`);
}
