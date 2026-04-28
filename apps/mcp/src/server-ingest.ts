import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { PrismaClient } from "@prisma/client";
import { Redis } from "@upstash/redis";
import { z } from "zod";
import { createServer } from "node:http";

const prisma = new PrismaClient();
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const INGEST_API_KEY = process.env.MCP_INGEST_API_KEY!;
const NEXT_REVALIDATE_TOKEN = process.env.NEXT_REVALIDATE_TOKEN!;
const NEXT_APP_URL = process.env.NEXTAUTH_URL!;
const NOTIFICATION_QUEUE_KEY = "notification:pending";

const ArticleSchema = z.object({
  aiName: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  ceoInsight: z.string().min(1),
  sourceUrls: z.array(z.string().url()).default([]),
  publishedAt: z.string().datetime(),
});

const server = new McpServer({
  name: "ainews-ingest",
  version: "1.0.0",
});

server.tool(
  "ingest_daily_news",
  "指定日のAIニュース記事をDBに格納する（ClaudeCoWork専用）",
  {
    newsDate: z.string().date().describe("ニュースの日付 (YYYY-MM-DD)"),
    articles: z
      .array(ArticleSchema)
      .min(1)
      .max(50)
      .describe("記事配列"),
  },
  async ({ newsDate, articles }) => {
    const targetDate = new Date(newsDate);
    const expiresAt = new Date(newsDate);
    expiresAt.setFullYear(expiresAt.getFullYear() + 5);

    // 冪等性確保：同日同AIの記事は UPSERT
    const results = await Promise.allSettled(
      articles.map((article) =>
        prisma.newsArticle.upsert({
          where: {
            // compound unique を利用（マイグレーションで追加）
            newsDate_aiName_title: {
              newsDate: targetDate,
              aiName: article.aiName,
              title: article.title,
            },
          } as Parameters<typeof prisma.newsArticle.upsert>[0]["where"],
          create: {
            newsDate: targetDate,
            type: "daily",
            aiName: article.aiName,
            title: article.title,
            summary: article.summary,
            ceoInsight: article.ceoInsight,
            sourceUrls: article.sourceUrls,
            publishedAt: new Date(article.publishedAt),
            expiresAt,
          },
          update: {
            summary: article.summary,
            ceoInsight: article.ceoInsight,
            sourceUrls: article.sourceUrls,
          },
        })
      )
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    // Redisキャッシュをパージ
    await redis.del(`news:daily:${newsDate}`).catch(() => {});

    // Next.js ISR オンデマンドrevalidation
    await fetch(`${NEXT_APP_URL}/api/revalidate?path=/news&token=${NEXT_REVALIDATE_TOKEN}`)
      .catch(() => {});

    // 通知キューに追加
    await redis.lpush(NOTIFICATION_QUEUE_KEY, JSON.stringify({ newsDate })).catch(() => {});

    return {
      content: [
        {
          type: "text" as const,
          text: `✅ ${newsDate} のニュースを格納しました。成功: ${succeeded}件 / 失敗: ${failed}件`,
        },
      ],
    };
  }
);

server.tool(
  "ingest_monthly_report",
  "月次AIトレンドサマリをDBに格納する（ClaudeCoWork専用）",
  {
    yearMonth: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .describe("年月 (YYYY-MM)"),
    summaryText: z.string().min(1).describe("月次サマリ本文"),
    keyEvents: z.array(z.string()).describe("主要イベントリスト"),
    ceoInsight: z.string().min(1).describe("CEO向け月次示唆"),
  },
  async ({ yearMonth, summaryText, keyEvents, ceoInsight }) => {
    await prisma.monthlyReport.upsert({
      where: { yearMonth },
      create: {
        yearMonth,
        summaryText,
        keyEvents,
        ceoInsight,
        publishedAt: new Date(),
      },
      update: { summaryText, keyEvents, ceoInsight },
    });

    await redis.del(`news:monthly:${yearMonth}`).catch(() => {});
    await fetch(
      `${NEXT_APP_URL}/api/revalidate?path=/news/monthly&token=${NEXT_REVALIDATE_TOKEN}`
    ).catch(() => {});

    return {
      content: [
        { type: "text" as const, text: `✅ ${yearMonth} の月次レポートを格納しました` },
      ],
    };
  }
);

// HTTP サーバー起動
const httpServer = createServer(async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== INGEST_API_KEY) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  if (req.url === "/mcp/ingest" && req.method === "POST") {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

const PORT = parseInt(process.env.MCP_INGEST_PORT ?? "3001", 10);
httpServer.listen(PORT, () => {
  console.log(`✅ MCP Ingest Server running on port ${PORT}`);
});
