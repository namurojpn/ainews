import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminLogQuerySchema, apiError } from "@/types/api";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "ログインが必要です", 401);
  if (session.user.role !== "ADMIN") return apiError("FORBIDDEN", "管理者権限が必要です", 403);

  const url = new URL(req.url);
  const result = AdminLogQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!result.success) {
    return apiError("VALIDATION_ERROR", "クエリが不正です", 400, result.error.flatten());
  }

  const { from, to, userId, actionType, page, pageSize, format } = result.data;

  const where = {
    ...(from && { accessedAt: { gte: new Date(from) } }),
    ...(to && { accessedAt: { lte: new Date(to + "T23:59:59Z") } }),
    ...(userId && { userId }),
    ...(actionType && { actionType }),
  };

  const [total, logs] = await Promise.all([
    prisma.accessLog.count({ where }),
    prisma.accessLog.findMany({
      where,
      orderBy: { accessedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { email: true, displayName: true } },
      },
    }),
  ]);

  if (format === "csv") {
    const headers = "日時,ユーザー,メール,操作,記事ID,IP,UserAgent\n";
    const rows = logs
      .map((l) =>
        [
          l.accessedAt.toISOString(),
          l.user?.displayName ?? "",
          l.user?.email ?? "",
          l.actionType,
          l.articleId ?? "",
          l.ipAddress ?? "",
          `"${(l.userAgent ?? "").replace(/"/g, '""')}"`,
        ].join(",")
      )
      .join("\n");

    return new Response(headers + rows, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="access_logs_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return Response.json({
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    logs: logs.map((l) => ({
      id: l.id,
      userId: l.userId,
      userName: l.user?.displayName,
      userEmail: l.user?.email,
      actionType: l.actionType,
      articleId: l.articleId,
      ipAddress: l.ipAddress,
      accessedAt: l.accessedAt.toISOString(),
    })),
  });
}
