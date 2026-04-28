import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAccess } from "@/lib/access-log";
import { ArchiveQuerySchema, apiError } from "@/types/api";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "ログインが必要です", 401);

  const { subscriptionStatus, role } = session.user;
  if (!["trialing", "active"].includes(subscriptionStatus) && role !== "ADMIN") {
    return apiError("FORBIDDEN", "有効なサブスクリプションが必要です", 403);
  }

  const url = new URL(req.url);
  const queryResult = ArchiveQuerySchema.safeParse(
    Object.fromEntries(url.searchParams)
  );
  if (!queryResult.success) {
    return apiError("VALIDATION_ERROR", "クエリが不正です", 400, queryResult.error.flatten());
  }

  const { from, to, aiFilter, keyword, page, pageSize, type } = queryResult.data;

  const aiNames = aiFilter ? aiFilter.split(",").filter(Boolean) : undefined;

  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  const where = {
    newsDate: {
      gte: from ? new Date(from) : fiveYearsAgo,
      lte: to ? new Date(to) : new Date(),
    },
    ...(type !== "all" && { type: type as "daily" | "monthly_summary" }),
    ...(aiNames?.length && { aiName: { in: aiNames } }),
    ...(keyword && {
      OR: [
        { title: { contains: keyword, mode: "insensitive" as const } },
        { summary: { contains: keyword, mode: "insensitive" as const } },
      ],
    }),
  };

  const [total, articles] = await Promise.all([
    prisma.newsArticle.count({ where }),
    prisma.newsArticle.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        newsDate: true,
        type: true,
        aiName: true,
        title: true,
        summary: true,
        ceoInsight: true,
        sourceUrls: true,
        publishedAt: true,
      },
    }),
  ]);

  logAccess({ userId: session.user.id, actionType: "search" });

  return Response.json({
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    articles: articles.map((a) => ({
      ...a,
      newsDate: a.newsDate.toISOString().slice(0, 10),
      publishedAt: a.publishedAt.toISOString(),
      sourceUrls: a.sourceUrls as string[],
    })),
  });
}
