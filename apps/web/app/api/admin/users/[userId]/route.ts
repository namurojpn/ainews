import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UpdateUserSchema, apiError } from "@/types/api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "ログインが必要です", 401);
  if (session.user.role !== "ADMIN") return apiError("FORBIDDEN", "管理者権限が必要です", 403);

  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    include: {
      subscription: true,
      passkeys: { select: { id: true, deviceName: true, lastUsedAt: true } },
      _count: { select: { accessLogs: true } },
    },
  });

  if (!user) return apiError("NOT_FOUND", "ユーザーが見つかりません", 404);

  return Response.json({
    ...user,
    passwordHash: undefined,
    trialEndDate: user.trialEndDate?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    accessCount: user._count.accessLogs,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "ログインが必要です", 401);
  if (session.user.role !== "ADMIN") return apiError("FORBIDDEN", "管理者権限が必要です", 403);

  const { userId } = await params;
  const body = await req.json();
  const result = UpdateUserSchema.safeParse(body);
  if (!result.success) {
    return apiError("VALIDATION_ERROR", "入力値が不正です", 400, result.error.flatten());
  }

  const { role, subscriptionStatus } = result.data;

  const user = await prisma.user.update({
    where: { id: userId, deletedAt: null },
    data: {
      ...(role && { role }),
      ...(subscriptionStatus && { subscriptionStatus }),
    },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: session.user.id,
      action: "update_user",
      targetUserId: userId,
      detail: result.data,
    },
  });

  return Response.json({ id: user.id, email: user.email });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "ログインが必要です", 401);
  if (session.user.role !== "ADMIN") return apiError("FORBIDDEN", "管理者権限が必要です", 403);

  const { userId } = await params;
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: session.user.id,
      action: "soft_delete_user",
      targetUserId: userId,
      detail: {},
    },
  });

  return new Response(null, { status: 204 });
}
