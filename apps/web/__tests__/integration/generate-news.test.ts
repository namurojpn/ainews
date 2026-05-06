/**
 * ニュース自動生成API 結合テスト
 * - CRON_SECRET 認証
 * - Gemini API 呼び出し → JSON パース → DB 保存
 * - JSON 抽出フォールバック
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/gemini", () => ({
  getGeminiModel: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    newsArticle: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

import { GET, POST } from "@/app/api/internal/generate-news/route";
import { getGeminiModel } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";

const mp = prisma as any;
const mockGetModel = getGeminiModel as ReturnType<typeof vi.fn>;

const VALID_GEMINI_RESPONSE = JSON.stringify({
  articles: [
    {
      aiName: "Claude",
      title: "Claude 最新アップデート",
      summary: "Anthropicが新しいモデルをリリースしました。詳細は公式サイトをご確認ください。",
      ceoInsight: "IT企業のCEOは早急に評価を開始すべきです。",
      sourceUrls: ["https://anthropic.com/news"],
    },
    {
      aiName: "ChatGPT",
      title: "GPT-5 リリース",
      summary: "OpenAIが最新モデルを公開しました。コーディング能力が大幅に向上しています。",
      ceoInsight: "開発コスト削減の機会として検討すべきです。",
      sourceUrls: [],
    },
  ],
});

function makeRequest(method: "GET" | "POST", secret?: string, useHeader = false) {
  const url = secret && !useHeader
    ? `http://localhost/api/internal/generate-news?secret=${secret}`
    : "http://localhost/api/internal/generate-news";
  const headers: Record<string, string> = {};
  if (secret && useHeader) headers["x-cron-secret"] = secret;
  return new Request(url, { method, headers });
}

describe("GET|POST /api/internal/generate-news — CRON 認証", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
  });

  it("シークレットなしは 401 を返す", async () => {
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(401);
  });

  it("間違ったシークレットは 401 を返す", async () => {
    const res = await GET(makeRequest("GET", "wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("クエリパラメータでシークレット認証できる", async () => {
    const model = { generateContent: vi.fn().mockResolvedValue({ response: { text: () => VALID_GEMINI_RESPONSE } }) };
    mockGetModel.mockReturnValue(model);
    mp.newsArticle.deleteMany.mockResolvedValue({ count: 0 });
    mp.newsArticle.createMany.mockResolvedValue({ count: 2 });

    const res = await GET(makeRequest("GET", "test-cron-secret"));
    expect(res.status).toBe(200);
  });

  it("ヘッダーでシークレット認証できる", async () => {
    const model = { generateContent: vi.fn().mockResolvedValue({ response: { text: () => VALID_GEMINI_RESPONSE } }) };
    mockGetModel.mockReturnValue(model);
    mp.newsArticle.deleteMany.mockResolvedValue({ count: 0 });
    mp.newsArticle.createMany.mockResolvedValue({ count: 2 });

    const res = await POST(makeRequest("POST", "test-cron-secret", true));
    expect(res.status).toBe(200);
  });
});

describe("GET /api/internal/generate-news — Gemini 連携", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
  });

  it("Gemini レスポンスを DB に保存し件数を返す", async () => {
    const model = { generateContent: vi.fn().mockResolvedValue({ response: { text: () => VALID_GEMINI_RESPONSE } }) };
    mockGetModel.mockReturnValue(model);
    mp.newsArticle.deleteMany.mockResolvedValue({ count: 3 });
    mp.newsArticle.createMany.mockResolvedValue({ count: 2 });

    const res = await GET(makeRequest("GET", "test-cron-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.count).toBe(2);
    expect(mp.newsArticle.deleteMany).toHaveBeenCalledOnce();
    expect(mp.newsArticle.createMany).toHaveBeenCalledOnce();
  });

  it("本日分を削除してから再作成する（べき等）", async () => {
    const model = { generateContent: vi.fn().mockResolvedValue({ response: { text: () => VALID_GEMINI_RESPONSE } }) };
    mockGetModel.mockReturnValue(model);
    mp.newsArticle.deleteMany.mockResolvedValue({ count: 2 });
    mp.newsArticle.createMany.mockResolvedValue({ count: 2 });

    await GET(makeRequest("GET", "test-cron-secret"));

    const deleteCall = mp.newsArticle.deleteMany.mock.calls[0][0];
    expect(deleteCall.where.type).toBe("daily");
  });

  it("JSON が {} で囲まれていないレスポンスでも抽出して処理する", async () => {
    const wrappedJson = `以下がニュースです:\n${VALID_GEMINI_RESPONSE}\n以上です。`;
    const model = { generateContent: vi.fn().mockResolvedValue({ response: { text: () => wrappedJson } }) };
    mockGetModel.mockReturnValue(model);
    mp.newsArticle.deleteMany.mockResolvedValue({ count: 0 });
    mp.newsArticle.createMany.mockResolvedValue({ count: 2 });

    const res = await GET(makeRequest("GET", "test-cron-secret"));
    expect(res.status).toBe(200);
  });

  it("Gemini が完全に不正な JSON を返した場合 500 を返す", async () => {
    const model = { generateContent: vi.fn().mockResolvedValue({ response: { text: () => "これはJSONではありません" } }) };
    mockGetModel.mockReturnValue(model);

    const res = await GET(makeRequest("GET", "test-cron-secret"));
    expect(res.status).toBe(500);
  });
});
