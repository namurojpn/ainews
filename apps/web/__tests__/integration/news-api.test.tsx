/**
 * ニュース API 結合テスト (NewsCard + ページ統合)
 * - GET /api/news/daily: キャッシュ・DB 取得・レスポンス整形
 * - GET /api/news/archive: フィルタリング・ページネーション・キーワード検索
 * - AI フィルタロジック (ページコンポーネントの絞り込み相当)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NewsCard } from "@/components/news/NewsCard";

// ── API route mocks ──────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue(undefined),
  },
  dailyNewsCacheKey: (date: string) => `news:daily:${date}`,
  CACHE_TTL: { dailyNews: 600 },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    newsArticle: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));
vi.mock("@/lib/access-log", () => ({ logAccess: vi.fn() }));

import { GET as dailyGET } from "@/app/api/news/daily/route";
import { GET as archiveGET } from "@/app/api/news/archive/route";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redis } from "@/lib/redis";

const mp = prisma as any;
const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockRedis = redis as any;

const ACTIVE_SESSION = {
  user: { id: "u1", subscriptionStatus: "active", role: "USER" },
};

const MOCK_ARTICLES = [
  {
    id: "a1",
    aiName: "Claude",
    title: "Claude 新機能",
    summary: "Anthropicが発表しました。",
    ceoInsight: "CEOへの示唆",
    sourceUrls: ["https://anthropic.com"],
    publishedAt: new Date("2026-05-01T09:00:00Z"),
  },
  {
    id: "a2",
    aiName: "ChatGPT",
    title: "GPT-5 登場",
    summary: "OpenAIからリリースです。",
    ceoInsight: "CEOへの示唆2",
    sourceUrls: [],
    publishedAt: new Date("2026-05-01T09:05:00Z"),
  },
];

// ── GET /api/news/daily ──────────────────────────────────────────────────────

describe("GET /api/news/daily — DB 取得・レスポンス整形", () => {
  beforeEach(() => vi.clearAllMocks());

  it("DB の記事を整形して返す", async () => {
    mockAuth.mockResolvedValue(ACTIVE_SESSION);
    mockRedis.get.mockResolvedValue(null);
    mp.newsArticle.findMany.mockResolvedValue(MOCK_ARTICLES);

    const req = new Request("http://localhost/api/news/daily?date=2026-05-01");
    const res = await dailyGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.date).toBe("2026-05-01");
    expect(body.articles).toHaveLength(2);
    expect(body.articles[0]).toMatchObject({
      id: "a1",
      aiName: "Claude",
      title: "Claude 新機能",
    });
    expect(typeof body.articles[0].publishedAt).toBe("string");
  });

  it("Redis キャッシュがある場合は DB を呼ばずキャッシュを返す", async () => {
    mockAuth.mockResolvedValue(ACTIVE_SESSION);
    const cached = { date: "2026-05-01", articles: [{ id: "cached-1" }] };
    mockRedis.get.mockResolvedValue(cached);

    const req = new Request("http://localhost/api/news/daily?date=2026-05-01");
    const res = await dailyGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.articles[0].id).toBe("cached-1");
    expect(mp.newsArticle.findMany).not.toHaveBeenCalled();
  });

  it("DB 取得後に Redis にキャッシュを書き込む", async () => {
    mockAuth.mockResolvedValue(ACTIVE_SESSION);
    mockRedis.get.mockResolvedValue(null);
    mp.newsArticle.findMany.mockResolvedValue(MOCK_ARTICLES);

    const req = new Request("http://localhost/api/news/daily?date=2026-05-01");
    await dailyGET(req);

    expect(mockRedis.set).toHaveBeenCalledWith(
      "news:daily:2026-05-01",
      expect.objectContaining({ date: "2026-05-01" }),
      expect.objectContaining({ ex: 600 })
    );
  });
});

// ── GET /api/news/archive ────────────────────────────────────────────────────

// アーカイブルートは newsDate・type フィールドも必要
const MOCK_ARCHIVE_ARTICLES = MOCK_ARTICLES.map((a) => ({
  ...a,
  newsDate: new Date("2026-05-01"),
  type: "daily" as const,
}));

describe("GET /api/news/archive — フィルタリング・ページネーション", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ページネーションのデフォルト値で取得する", async () => {
    mockAuth.mockResolvedValue(ACTIVE_SESSION);
    mp.newsArticle.count.mockResolvedValue(25);
    mp.newsArticle.findMany.mockResolvedValue(MOCK_ARCHIVE_ARTICLES);

    const req = new Request("http://localhost/api/news/archive");
    const res = await archiveGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    expect(body.total).toBe(25);
    expect(body.totalPages).toBe(2);
  });

  it("AI フィルタを複数指定して絞り込む", async () => {
    mockAuth.mockResolvedValue(ACTIVE_SESSION);
    mp.newsArticle.count.mockResolvedValue(1);
    mp.newsArticle.findMany.mockResolvedValue([MOCK_ARCHIVE_ARTICLES[0]]);

    const req = new Request("http://localhost/api/news/archive?aiFilter=Claude,ChatGPT");
    const res = await archiveGET(req);

    const findCall = mp.newsArticle.findMany.mock.calls[0][0];
    expect(findCall.where.aiName.in).toEqual(["Claude", "ChatGPT"]);
  });

  it("キーワード検索でタイトル・要約を横断検索する", async () => {
    mockAuth.mockResolvedValue(ACTIVE_SESSION);
    mp.newsArticle.count.mockResolvedValue(1);
    mp.newsArticle.findMany.mockResolvedValue([MOCK_ARCHIVE_ARTICLES[0]]);

    const req = new Request("http://localhost/api/news/archive?keyword=Claude");
    await archiveGET(req);

    const findCall = mp.newsArticle.findMany.mock.calls[0][0];
    expect(findCall.where.OR).toBeDefined();
    expect(findCall.where.OR[0].title.contains).toBe("Claude");
    expect(findCall.where.OR[1].summary.contains).toBe("Claude");
  });

  it("2ページ目は skip が pageSize 分ずれる", async () => {
    mockAuth.mockResolvedValue(ACTIVE_SESSION);
    mp.newsArticle.count.mockResolvedValue(40);
    mp.newsArticle.findMany.mockResolvedValue([]);

    const req = new Request("http://localhost/api/news/archive?page=2&pageSize=10");
    await archiveGET(req);

    const findCall = mp.newsArticle.findMany.mock.calls[0][0];
    expect(findCall.skip).toBe(10);
    expect(findCall.take).toBe(10);
  });

  it("type=daily を指定すると type フィルタが付く", async () => {
    mockAuth.mockResolvedValue(ACTIVE_SESSION);
    mp.newsArticle.count.mockResolvedValue(0);
    mp.newsArticle.findMany.mockResolvedValue([]);

    const req = new Request("http://localhost/api/news/archive?type=daily");
    await archiveGET(req);

    const findCall = mp.newsArticle.findMany.mock.calls[0][0];
    expect(findCall.where.type).toBe("daily");
  });
});

// ── AI フィルタロジック (ページの絞り込み相当) ───────────────────────────────

const AI_FILTER_ARTICLES = [
  { id: "1", aiName: "Claude",  title: "Claude記事",  summary: "", ceoInsight: "", sourceUrls: [], publishedAt: new Date().toISOString() },
  { id: "2", aiName: "ChatGPT", title: "ChatGPT記事", summary: "", ceoInsight: "", sourceUrls: [], publishedAt: new Date().toISOString() },
  { id: "3", aiName: "Gemini",  title: "Gemini記事",  summary: "", ceoInsight: "", sourceUrls: [], publishedAt: new Date().toISOString() },
  { id: "4", aiName: "Grok",    title: "Grok記事",    summary: "", ceoInsight: "", sourceUrls: [], publishedAt: new Date().toISOString() },
];

function applyAiFilter(articles: typeof AI_FILTER_ARTICLES, aiFilter?: string) {
  if (!aiFilter || aiFilter === "all") return articles;
  return articles.filter((a) =>
    aiFilter === "その他"
      ? !["Claude", "ChatGPT", "Gemini"].includes(a.aiName)
      : a.aiName === aiFilter
  );
}

describe("AIフィルタロジック — ニュースページ絞り込み", () => {
  it("フィルタなしは全記事を返す", () => {
    expect(applyAiFilter(AI_FILTER_ARTICLES)).toHaveLength(4);
  });

  it("'all' は全記事を返す", () => {
    expect(applyAiFilter(AI_FILTER_ARTICLES, "all")).toHaveLength(4);
  });

  it("'Claude' で絞り込むと Claude の記事のみ返す", () => {
    const result = applyAiFilter(AI_FILTER_ARTICLES, "Claude");
    expect(result).toHaveLength(1);
    expect(result[0].aiName).toBe("Claude");
  });

  it("'その他' は Claude/ChatGPT/Gemini 以外を返す", () => {
    const result = applyAiFilter(AI_FILTER_ARTICLES, "その他");
    expect(result).toHaveLength(1);
    expect(result[0].aiName).toBe("Grok");
  });
});

// ── NewsCard 複数レンダリング統合 ─────────────────────────────────────────────

describe("NewsCard — 複数記事のリスト表示", () => {
  it("複数の NewsCard を並べてすべてのタイトルが表示される", () => {
    const articles = AI_FILTER_ARTICLES.filter((a) =>
      ["Claude", "ChatGPT"].includes(a.aiName)
    );
    const { container } = render(
      <div>
        {articles.map((a) => <NewsCard key={a.id} article={a} />)}
      </div>
    );
    expect(screen.getByRole("heading", { name: "Claude記事" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "ChatGPT記事" })).toBeDefined();
    expect(container.querySelectorAll("article")).toHaveLength(2);
  });

  it("記事が 0 件のとき何も表示しない", () => {
    const { container } = render(
      <div>
        {[].map((a: typeof AI_FILTER_ARTICLES[0]) => <NewsCard key={a.id} article={a} />)}
      </div>
    );
    expect(container.querySelectorAll("article")).toHaveLength(0);
  });
});
