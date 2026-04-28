import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { RegisterSchema, apiError } from "@/types/api";
import { sendWelcomeEmail } from "@/lib/sendgrid";

export async function POST(req: Request) {
  const body = await req.json();
  const result = RegisterSchema.safeParse(body);
  if (!result.success) {
    return apiError("VALIDATION_ERROR", "入力値が不正です", 400, result.error.flatten());
  }

  const { email, password, displayName } = result.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return apiError("CONFLICT", "このメールアドレスは既に登録されています", 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 30);

  const user = await prisma.user.create({
    data: {
      email,
      displayName,
      passwordHash,
      subscriptionStatus: "trialing",
      trialEndDate: trialEnd,
      accounts: { create: { provider: "credentials", providerAccountId: email } },
      notificationSetting: { create: {} },
      subscription: {
        create: {
          status: "trialing",
          trialStartDate: new Date(),
          trialEndDate: trialEnd,
        },
      },
    },
  });

  void sendWelcomeEmail(email, displayName).catch(() => {});

  return NextResponse.json({ id: user.id }, { status: 201 });
}
