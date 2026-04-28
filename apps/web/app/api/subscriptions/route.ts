import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession } from "@/lib/stripe";
import { apiError } from "@/types/api";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "ログインが必要です", 401);

  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });

  return Response.json({
    status: sub?.status ?? session.user.subscriptionStatus,
    trialEndDate: sub?.trialEndDate?.toISOString() ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
    planId: sub?.planId ?? null,
  });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "ログインが必要です", 401);

  const checkoutSession = await createCheckoutSession(
    session.user.id,
    session.user.email
  );

  return Response.json({ url: checkoutSession.url });
}
