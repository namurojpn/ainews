import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NotificationSettingSchema, apiError } from "@/types/api";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "ログインが必要です", 401);

  const setting = await prisma.notificationSetting.findUnique({
    where: { userId: session.user.id },
  });

  return Response.json(
    setting ?? { emailEnabled: true, frequency: "realtime" }
  );
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "ログインが必要です", 401);

  const body = await req.json();
  const result = NotificationSettingSchema.safeParse(body);
  if (!result.success) {
    return apiError("VALIDATION_ERROR", "入力値が不正です", 400, result.error.flatten());
  }

  const setting = await prisma.notificationSetting.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...result.data },
    update: result.data,
  });

  return Response.json(setting);
}
