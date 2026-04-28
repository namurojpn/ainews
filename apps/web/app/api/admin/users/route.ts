import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/types/api";
import { z } from "zod";

const QuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(["trialing", "active", "canceled", "suspended"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "ログインが必要です", 401);
  if (session.user.role !== "ADMIN") return apiError("FORBIDDEN", "管理者権限が必要です", 403);

  const url = new URL(req.url);
  const q = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!q.success) return apiError("VALIDATION_ERROR", "クエリが不正です", 400);

  const { q: search, status, page, pageSize } = q.data;

  const where = {
    deletedAt: null,
    ...(status && { subscriptionStatus: status }),
    ...(search && {
      OR: [
        { email: { contains: search, mode: "insensitive" as const } },
        { displayName: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        subscriptionStatus: true,
        trialEndDate: true,
        createdAt: true,
        _count: { select: { accessLogs: true } },
      },
    }),
  ]);

  return Response.json({
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    users: users.map((u) => ({
      ...u,
      trialEndDate: u.trialEndDate?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      accessCount: u._count.accessLogs,
    })),
  });
}
