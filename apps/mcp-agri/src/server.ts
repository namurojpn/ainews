import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import { z } from "zod";
import { DEFAULT_STATS_CODE, getStatsData, getStatsMeta, searchStatsTables } from "./estat.js";

const server = new McpServer({
  name: "agri-market-price",
  version: "1.0.0",
});

server.tool(
  "search_market_price_tables",
  "農林水産省の卸売市場調査（e-Stat）から統計表を検索する。デフォルトは青果物卸売市場調査(00500226)。取得した statsDataId は他のツールで使う。",
  {
    searchWord: z.string().optional().describe("検索キーワード (例: 'きゅうり 東京')"),
    statsCode: z
      .string()
      .optional()
      .describe(`統計調査コード (省略時は青果物卸売市場調査: ${DEFAULT_STATS_CODE})`),
    limit: z.number().int().min(1).max(100).default(20),
  },
  async ({ searchWord, statsCode, limit }) => {
    const { tables, totalNumber } = await searchStatsTables({ searchWord, statsCode, limit });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ totalNumber, count: tables.length, tables }, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "get_market_price_table_meta",
  "指定した統計表(statsDataId)の分類軸（品目コード・市場/地域コード・期間コードなど）を取得する。get_market_price_data で絞り込むコードを調べるために使う。",
  {
    statsDataId: z.string().describe("search_market_price_tables で得た統計表ID"),
  },
  async ({ statsDataId }) => {
    const axes = await getStatsMeta(statsDataId);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ statsDataId, axes }, null, 2) }],
    };
  }
);

server.tool(
  "get_market_price_data",
  "統計表(statsDataId)から実際の価格データを取得する。品目・市場・期間のコードは get_market_price_table_meta で調べて指定する。",
  {
    statsDataId: z.string().describe("統計表ID"),
    cdCat01: z.string().optional().describe("品目コード"),
    cdArea: z.string().optional().describe("市場/地域コード"),
    cdTime: z.string().optional().describe("期間コード"),
    cdTab: z.string().optional().describe("表章項目コード (数量・価額・価格など)"),
    limit: z.number().int().min(1).max(1000).default(100),
  },
  async ({ statsDataId, cdCat01, cdArea, cdTime, cdTab, limit }) => {
    const { records, totalNumber } = await getStatsData({
      statsDataId,
      cdCat01,
      cdArea,
      cdTime,
      cdTab,
      limit,
    });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ totalNumber, count: records.length, records }, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "find_market_price",
  "品目名・市場名・年月のキーワードから、統計表の検索〜コード解決〜価格取得までを一括で行う簡易ツール（ベストエフォート）。" +
    "候補が複数/曖昧な場合は絞り込めないことがあるので、その場合は search_market_price_tables → get_market_price_table_meta → get_market_price_data を個別に使うこと。",
  {
    itemKeyword: z.string().describe("品目名 (例: 'きゅうり')"),
    marketKeyword: z.string().optional().describe("市場名 (例: '東京')"),
    yearMonth: z
      .string()
      .regex(/^\d{4}(-\d{2})?$/)
      .optional()
      .describe("年、または年月 (YYYY または YYYY-MM)"),
  },
  async ({ itemKeyword, marketKeyword, yearMonth }) => {
    const { tables } = await searchStatsTables({ searchWord: itemKeyword, limit: 5 });
    if (tables.length === 0) {
      return {
        content: [{ type: "text" as const, text: `統計表が見つかりませんでした: ${itemKeyword}` }],
        isError: true,
      };
    }

    const table = tables[0];
    const axes = await getStatsMeta(table.statsDataId);

    const findAxis = (id: string) => axes.find((a) => a.id === id);
    const matchCode = (axis: ReturnType<typeof findAxis>, keyword: string | undefined) => {
      if (!axis || !keyword) return undefined;
      const hit = axis.codes.find((c) => c.name.includes(keyword));
      return hit?.code;
    };

    const cat01 = matchCode(findAxis("cat01"), itemKeyword);
    const area = matchCode(findAxis("area"), marketKeyword);

    let time: string | undefined;
    if (yearMonth) {
      const digits = yearMonth.replace(/-/g, "");
      const timeAxis = findAxis("time");
      const hit = timeAxis?.codes.find(
        (c) => c.code.includes(digits) || c.name.replace(/\D/g, "").startsWith(digits)
      );
      time = hit?.code;
    }

    const { records, totalNumber } = await getStatsData({
      statsDataId: table.statsDataId,
      cdCat01: cat01,
      cdArea: area,
      cdTime: time,
      limit: 100,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              resolvedTable: { statsDataId: table.statsDataId, title: table.title },
              resolvedFilters: { cat01: cat01 ?? null, area: area ?? null, time: time ?? null },
              note:
                cat01 || area || time
                  ? undefined
                  : "品目/市場/期間のコードを自動解決できなかったため、絞り込みなしの結果です。get_market_price_table_meta で正確なコードを確認してください。",
              totalNumber,
              count: records.length,
              records,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

function isAuthorized(req: import("node:http").IncomingMessage): boolean {
  const requiredKey = process.env.MCP_AGRI_API_KEY;
  if (!requiredKey) return true; // 未設定なら認証なし（ローカル開発向け）
  return req.headers["x-api-key"] === requiredKey;
}

const httpServer = createServer(async (req, res) => {
  if (!isAuthorized(req)) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  if (req.url === "/mcp/agri-price" && req.method === "POST") {
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    }
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

const PORT = parseInt(process.env.MCP_AGRI_PORT ?? "3003", 10);
httpServer.listen(PORT, () => {
  console.log(`✅ MCP Agri Price Server running on port ${PORT}`);
});
