import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { z } from "zod";

const prisma = new PrismaClient();

const server = new McpServer({
  name: "ainews-export",
  version: "1.0.0",
});

server.tool(
  "get_daily_news",
  "指定日のAIニュース一覧を取得する",
  {
    date: z.string().date().describe("日付 (YYYY-MM-DD)"),
    aiFilter: z
      .array(z.string())
      .optional()
      .describe("AIフィルタ (例: ['Claude', 'ChatGPT'])"),
  },
  async ({ date, aiFilter }) => {
    const articles = await prisma.newsArticle.findMany({
      where: {
        newsDate: new Date(date),
        type: "daily",
        ...(aiFilter?.length && { aiName: { in: aiFilter } }),
      },
      orderBy: { publishedAt: "desc" },
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            date,
            count: articles.length,
            articles: articles.map((a) => ({
              id: a.id,
              aiName: a.aiName,
              title: a.title,
              summary: a.summary,
              ceoInsight: a.ceoInsight,
              sourceUrls: a.sourceUrls,
              publishedAt: a.publishedAt.toISOString(),
            })),
          }, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "get_monthly_summary",
  "指定月のAIニュースサマリを取得する",
  {
    yearMonth: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .describe("年月 (YYYY-MM)"),
  },
  async ({ yearMonth }) => {
    const report = await prisma.monthlyReport.findUnique({ where: { yearMonth } });
    if (!report) {
      return {
        content: [{ type: "text" as const, text: `月次レポートが見つかりません: ${yearMonth}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            yearMonth: report.yearMonth,
            summaryText: report.summaryText,
            keyEvents: report.keyEvents,
            ceoInsight: report.ceoInsight,
            publishedAt: report.publishedAt.toISOString(),
          }, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "search_news_archive",
  "キーワードと期間でニュースアーカイブを検索する",
  {
    keyword: z.string().max(100).describe("検索キーワード"),
    from: z.string().date().describe("開始日 (YYYY-MM-DD)"),
    to: z.string().date().describe("終了日 (YYYY-MM-DD)"),
    aiFilter: z.array(z.string()).optional().describe("AIフィルタ"),
    limit: z.number().int().min(1).max(50).default(20),
  },
  async ({ keyword, from, to, aiFilter, limit }) => {
    const articles = await prisma.newsArticle.findMany({
      where: {
        newsDate: { gte: new Date(from), lte: new Date(to) },
        ...(aiFilter?.length && { aiName: { in: aiFilter } }),
        OR: [
          { title: { contains: keyword, mode: "insensitive" } },
          { summary: { contains: keyword, mode: "insensitive" } },
        ],
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            keyword,
            from,
            to,
            count: articles.length,
            articles: articles.map((a) => ({
              id: a.id,
              newsDate: a.newsDate.toISOString().slice(0, 10),
              aiName: a.aiName,
              title: a.title,
              summary: a.summary,
            })),
          }, null, 2),
        },
      ],
    };
  }
);

// APIキー検証
async function validateApiKey(key: string): Promise<boolean> {
  const keyHash = createHash("sha256").update(key).digest("hex");
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      keyHash,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  if (apiKey) {
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });
  }
  return !!apiKey;
}

const httpServer = createServer(async (req, res) => {
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (!apiKey || !(await validateApiKey(apiKey))) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  if (req.url === "/mcp/export" && req.method === "POST") {
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

const PORT = parseInt(process.env.MCP_EXPORT_PORT ?? "3002", 10);
httpServer.listen(PORT, () => {
  console.log(`✅ MCP Export Server running on port ${PORT}`);
});
