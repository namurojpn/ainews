import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redis, monthlyReportCacheKey, CACHE_TTL } from "@/lib/redis";
import { logAccess } from "@/lib/access-log";
import { apiError } from "@/types/api";
import { z } from "zod";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "ログインが必要です", 401);

  const { subscriptionStatus, role } = session.user;
  if (!["trialing", "active"].includes(subscriptionStatus) && role !== "ADMIN") {
    return apiError("FORBIDDEN", "有効なサブスクリプションが必要です", 403);
  }

  const url = new URL(req.url);
  const now = new Date();
  const defaultYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const yearMonth = url.searchParams.get("yearMonth") ?? defaultYM;

  const ymResult = z.string().regex(/^\d{4}-\d{2}$/).safeParse(yearMonth);
  if (!ymResult.success) return apiError("VALIDATION_ERROR", "年月形式が不正です", 400);

  const cacheKey = monthlyReportCacheKey(yearMonth);
  const cached = await redis.get(cacheKey).catch(() => null);
  if (cached) {
    logAccess({ userId: session.user.id, actionType: "view_monthly" });
    return Response.json(cached);
  }

  const report = await prisma.monthlyReport.findUnique({ where: { yearMonth } });
  if (!report) return apiError("NOT_FOUND", "月次レポートが見つかりません", 404);

  const result = {
    id: report.id,
    yearMonth: report.yearMonth,
    summaryText: report.summaryText,
    keyEvents: report.keyEvents as string[],
    ceoInsight: report.ceoInsight,
    publishedAt: report.publishedAt.toISOString(),
  };

  await redis.set(cacheKey, result, { ex: CACHE_TTL.monthlyReport }).catch(() => {});
  logAccess({ userId: session.user.id, actionType: "view_monthly" });

  return Response.json(result);
}
