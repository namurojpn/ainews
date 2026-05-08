import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/types/api";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "ログインが必要です", 401);
  if (session.user.role !== "ADMIN") return apiError("FORBIDDEN", "管理者権限が必要です", 403);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalUsers,
    activeUsers,
    trialingUsers,
    totalArticles,
    dau,
    mau,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { subscriptionStatus: "active", deletedAt: null } }),
    prisma.user.count({ where: { subscriptionStatus: "trialing", deletedAt: null } }),
    prisma.newsArticle.count(),
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT "userId") FROM access_logs
      WHERE "accessedAt" >= ${startOfDay} AND "userId" IS NOT NULL
    `.then((r) => Number(r[0]?.count ?? 0)),
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT "userId") FROM access_logs
      WHERE "accessedAt" >= ${startOfMonth} AND "userId" IS NOT NULL
    `.then((r) => Number(r[0]?.count ?? 0)),
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        displayName: true,
        email: true,
        subscriptionStatus: true,
        createdAt: true,
      },
    }),
  ]);

  return Response.json({
    totalUsers,
    activeUsers,
    trialingUsers,
    totalArticles,
    dau,
    mau,
    recentUsers: recentUsers.map((u) => ({
      id: u.id,
      name: u.displayName,
      email: u.email,
      status: u.subscriptionStatus,
      createdAt: u.createdAt.toISOString(),
    })),
  });
}
