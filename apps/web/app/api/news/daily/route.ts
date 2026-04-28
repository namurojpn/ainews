import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redis, dailyNewsCacheKey, CACHE_TTL } from "@/lib/redis";
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
  const dateStr = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const dateResult = z.string().date().safeParse(dateStr);
  if (!dateResult.success) return apiError("VALIDATION_ERROR", "日付形式が不正です", 400);

  const cacheKey = dailyNewsCacheKey(dateStr);
  const cached = await redis.get(cacheKey).catch(() => null);
  if (cached) {
    logAccess({ userId: session.user.id, actionType: "view_news" });
    return Response.json(cached);
  }

  const targetDate = new Date(dateStr);
  const articles = await prisma.newsArticle.findMany({
    where: {
      newsDate: targetDate,
      type: "daily",
    },
    orderBy: { publishedAt: "desc" },
  });

  const result = {
    date: dateStr,
    articles: articles.map((a) => ({
      id: a.id,
      aiName: a.aiName,
      title: a.title,
      summary: a.summary,
      ceoInsight: a.ceoInsight,
      sourceUrls: a.sourceUrls as string[],
      publishedAt: a.publishedAt.toISOString(),
    })),
  };

  await redis.set(cacheKey, result, { ex: CACHE_TTL.dailyNews }).catch(() => {});
  logAccess({ userId: session.user.id, actionType: "view_news" });

  return Response.json(result);
}
