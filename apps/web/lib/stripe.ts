import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-03-31.basil",
});

export async function createCheckoutSession(userId: string, email: string) {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID!,
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXTAUTH_URL}/settings?success=1`,
    cancel_url: `${process.env.NEXTAUTH_URL}/settings?canceled=1`,
    metadata: { userId },
  });
  return session;
}

export async function cancelSubscription(stripeSubscriptionId: string) {
  return stripe.subscriptions.cancel(stripeSubscriptionId);
}
