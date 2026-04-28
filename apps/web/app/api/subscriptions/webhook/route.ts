import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";

export const config = { api: { bodyParser: false } };

const STATUS_MAP: Record<string, "active" | "canceled" | "suspended" | "trialing"> = {
  active: "active",
  trialing: "trialing",
  canceled: "canceled",
  past_due: "suspended",
  unpaid: "suspended",
  incomplete: "suspended",
  incomplete_expired: "canceled",
  paused: "suspended",
};

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const sub = event.data.object as Stripe.Subscription;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (!userId || !session.subscription) break;

      const stripeSub = await stripe.subscriptions.retrieve(
        session.subscription as string
      );
      await prisma.$transaction([
        prisma.subscription.upsert({
          where: { userId },
          create: {
            userId,
            stripeSubscriptionId: stripeSub.id,
            stripeCustomerId: session.customer as string,
            status: "active",
            currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          },
          update: {
            stripeSubscriptionId: stripeSub.id,
            status: "active",
            currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          },
        }),
        prisma.user.update({
          where: { id: userId },
          data: { subscriptionStatus: "active" },
        }),
      ]);
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const dbSub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: sub.id },
      });
      if (!dbSub) break;

      const newStatus = STATUS_MAP[sub.status] ?? "suspended";
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: dbSub.id },
          data: {
            status: newStatus,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          },
        }),
        prisma.user.update({
          where: { id: dbSub.userId },
          data: { subscriptionStatus: newStatus },
        }),
      ]);
      break;
    }
  }

  return new Response("ok");
}
