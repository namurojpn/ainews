import { prisma } from "@/lib/prisma";
import { redis, NOTIFICATION_QUEUE_KEY } from "@/lib/redis";
import { sendNewsNotification } from "@/lib/sendgrid";
import { apiError } from "@/types/api";

// Vercel Cron から呼ばれる内部エンドポイント
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.INTERNAL_CRON_SECRET) {
    return apiError("UNAUTHORIZED", "不正なリクエストです", 401);
  }

  // キューから最大10件処理
  const jobs: string[] = [];
  for (let i = 0; i < 10; i++) {
    const job = await redis.rpop(NOTIFICATION_QUEUE_KEY).catch(() => null);
    if (!job) break;
    jobs.push(job as string);
  }

  if (jobs.length === 0) return Response.json({ processed: 0 });

  let processed = 0;
  for (const jobStr of jobs) {
    try {
      const { newsDate } = JSON.parse(jobStr);

      const articles = await prisma.newsArticle.findMany({
        where: { newsDate: new Date(newsDate), type: "daily" },
        orderBy: { publishedAt: "desc" },
        take: 5,
      });
      if (articles.length === 0) continue;

      const recipients = await prisma.notificationSetting.findMany({
        where: { emailEnabled: true },
        include: {
          user: {
            select: {
              email: true,
              subscriptionStatus: true,
              deletedAt: true,
            },
          },
        },
      });

      const ceoInsight = articles[0]?.ceoInsight ?? "";
      const sendJobs = recipients
        .filter(
          (r) =>
            !r.user.deletedAt &&
            ["trialing", "active"].includes(r.user.subscriptionStatus)
        )
        .map((r) =>
          sendNewsNotification(
            r.user.email,
            newsDate,
            articles.map((a) => ({
              aiName: a.aiName,
              title: a.title,
              summary: a.summary,
            })),
            ceoInsight
          ).catch(() => {})
        );

      await Promise.allSettled(sendJobs);
      processed++;
    } catch {
      // 個別ジョブ失敗はスキップ
    }
  }

  return Response.json({ processed });
}
