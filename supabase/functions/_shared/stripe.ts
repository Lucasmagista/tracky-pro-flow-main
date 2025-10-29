import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';

// Inicializar Stripe
export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

// Configurações
export const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
export const STRIPE_PUBLISHABLE_KEY = Deno.env.get('STRIPE_PUBLISHABLE_KEY') || '';

// Helper para criar preços do Stripe
export async function createStripePrice(
  productId: string,
  amount: number,
  currency: string,
  interval: 'month' | 'year'
): Promise<Stripe.Price> {
  return await stripe.prices.create({
    product: productId,
    unit_amount: Math.round(amount * 100), // centavos
    currency: currency.toLowerCase(),
    recurring: {
      interval,
    },
  });
}

// Helper para criar produto do Stripe
export async function createStripeProduct(
  name: string,
  description: string
): Promise<Stripe.Product> {
  return await stripe.products.create({
    name,
    description,
  });
}

// Verificar assinatura do Stripe
export async function verifyStripeSignature(
  body: string,
  signature: string
): Promise<Stripe.Event> {
  return stripe.webhooks.constructEvent(
    body,
    signature,
    STRIPE_WEBHOOK_SECRET
  );
}
