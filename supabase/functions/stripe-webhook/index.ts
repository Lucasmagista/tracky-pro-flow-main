import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { stripe, verifyStripeSignature } from '../_shared/stripe.ts';
import { supabaseAdmin } from '../_shared/supabase.ts';
import { sendEmail, emailTemplates } from '../_shared/resend.ts';

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  
  if (!signature) {
    return new Response('No signature', { status: 400 });
  }

  try {
    const body = await req.text();
    const event = await verifyStripeSignature(body, signature);

    console.log('Webhook event:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as any;
        await handleInvoicePaid(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        await handlePaymentFailed(invoice);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        await handleSubscriptionCanceled(subscription);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

async function handleCheckoutCompleted(session: any) {
  const userId = session.metadata.user_id;
  const planId = session.metadata.plan_id;
  const subscriptionId = session.subscription;

  // Buscar subscription do Stripe
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Criar subscription no banco
  const { data: subscription, error } = await supabaseAdmin
    .from('subscriptions')
    .insert({
      user_id: userId,
      plan_id: planId,
      stripe_subscription_id: subscriptionId,
      status: 'active',
      current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating subscription:', error);
    return;
  }

  // Buscar dados do usuário e plano
  const { data: user } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  const { data: plan } = await supabaseAdmin
    .from('plans')
    .select('*')
    .eq('id', planId)
    .single();

  // Enviar email de boas-vindas
  if (user && plan) {
    await sendEmail({
      to: user.store_email,
      subject: '🎉 Bem-vindo ao Tracky Pro!',
      html: emailTemplates.welcome(user.name, plan.name),
    });
  }
}

async function handleInvoicePaid(invoice: any) {
  const subscriptionId = invoice.subscription;
  
  // Buscar subscription no banco
  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('*, profiles(*), plans(*)')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!subscription) return;

  // Criar registro de billing history
  const { data: billing } = await supabaseAdmin
    .from('billing_history')
    .insert({
      subscription_id: subscription.id,
      user_id: subscription.user_id,
      amount: invoice.amount_paid / 100,
      currency: invoice.currency.toUpperCase(),
      status: 'paid',
      stripe_invoice_id: invoice.id,
      invoice_url: invoice.hosted_invoice_url,
      description: `Pagamento ${subscription.plans.name}`,
    })
    .select()
    .single();

  // Atualizar status da subscription
  await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'active' })
    .eq('id', subscription.id);

  // Enviar email de confirmação
  if (subscription.profiles && billing) {
    await sendEmail({
      to: subscription.profiles.store_email,
      subject: '✅ Pagamento Confirmado - Tracky Pro',
      html: emailTemplates.paymentConfirmation(
        subscription.profiles.name,
        billing.amount,
        billing.invoice_url
      ),
    });
  }
}

async function handlePaymentFailed(invoice: any) {
  const subscriptionId = invoice.subscription;
  
  // Buscar subscription no banco
  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('*, profiles(*)')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!subscription) return;

  // Criar registro de pagamento falho
  await supabaseAdmin
    .from('billing_history')
    .insert({
      subscription_id: subscription.id,
      user_id: subscription.user_id,
      amount: invoice.amount_due / 100,
      currency: invoice.currency.toUpperCase(),
      status: 'failed',
      stripe_invoice_id: invoice.id,
      description: `Pagamento falhou - ${subscription.plans?.name || 'Plano'}`,
    });

  // Atualizar status
  await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('id', subscription.id);

  // TODO: Enviar email de pagamento falhou
}

async function handleSubscriptionUpdated(stripeSubscription: any) {
  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('stripe_subscription_id', stripeSubscription.id)
    .single();

  if (!subscription) return;

  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: stripeSubscription.status,
      current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: stripeSubscription.cancel_at_period_end,
    })
    .eq('id', subscription.id);
}

async function handleSubscriptionCanceled(stripeSubscription: any) {
  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('*, profiles(*)')
    .eq('stripe_subscription_id', stripeSubscription.id)
    .single();

  if (!subscription) return;

  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('id', subscription.id);

  // Enviar email de cancelamento
  if (subscription.profiles) {
    await sendEmail({
      to: subscription.profiles.store_email,
      subject: '😢 Cancelamento Confirmado - Tracky Pro',
      html: emailTemplates.cancellation(
        subscription.profiles.name,
        new Date(subscription.current_period_end).toLocaleDateString('pt-BR')
      ),
    });
  }
}
