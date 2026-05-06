/**
 * 認証フロー結合テスト
 * - ユーザー登録 (POST /api/register)
 * - 保護ルートの認証チェック (GET /api/news/daily)
 * - サブスクリプション状態によるアクセス制御
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    newsArticle: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/sendgrid", () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
  dailyNewsCacheKey: (date: string) => `news:daily:${date}`,
  CACHE_TTL: { dailyNews: 600 },
}));

vi.mock("@/lib/access-log", () => ({
  logAccess: vi.fn(),
}));

import { POST as registerPOST } from "@/app/api/register/route";
import { GET as dailyGET } from "@/app/api/news/daily/route";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const mp = prisma as any;
const mockAuth = auth as ReturnType<typeof vi.fn>;

describe("POST /api/register — ユーザー登録", () => {
  beforeEach(() => vi.clearAllMocks());

  it("正常な入力でユーザーを作成し 201 を返す", async () => {
    mp.user.findUnique.mockResolvedValue(null);
    mp.user.create.mockResolvedValue({ id: "user-1" });

    const req = new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "new@example.com",
        password: "Password1",
        displayName: "新規ユーザー",
      }),
    });
    const res = await registerPOST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("user-1");
  });

  it("既存メールアドレスの場合 409 を返す", async () => {
    mp.user.findUnique.mockResolvedValue({ id: "existing" });

    const req = new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "existing@example.com",
        password: "Password1",
        displayName: "既存",
      }),
    });
    const res = await registerPOST(req);
    expect(res.status).toBe(409);
  });

  it("不正なメールアドレスの場合 400 を返す", async () => {
    const req = new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "not-an-email",
        password: "Password1",
        displayName: "テスト",
      }),
    });
    const res = await registerPOST(req);
    expect(res.status).toBe(400);
  });

  it("パスワードが数字を含まない場合 400 を返す", async () => {
    const req = new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "PasswordOnly",
        displayName: "テスト",
      }),
    });
    const res = await registerPOST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/news/daily — 認証・認可チェック", () => {
  beforeEach(() => vi.clearAllMocks());

  it("未認証の場合 401 を返す", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request("http://localhost/api/news/daily");
    const res = await dailyGET(req);
    expect(res.status).toBe(401);
  });

  it("サブスク停止中の場合 403 を返す", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", subscriptionStatus: "canceled", role: "USER" },
    });
    const req = new Request("http://localhost/api/news/daily");
    const res = await dailyGET(req);
    expect(res.status).toBe(403);
  });

  it("トライアル中のユーザーは 200 で記事を受け取る", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", subscriptionStatus: "trialing", role: "USER" },
    });
    mp.newsArticle.findMany.mockResolvedValue([
      {
        id: "a1",
        aiName: "Claude",
        title: "テスト記事",
        summary: "要約",
        ceoInsight: "示唆",
        sourceUrls: [],
        publishedAt: new Date(),
      },
    ]);
    const req = new Request("http://localhost/api/news/daily");
    const res = await dailyGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.articles).toHaveLength(1);
    expect(body.articles[0].title).toBe("テスト記事");
  });

  it("ADMIN ロールは subscription 状態に関わらずアクセスできる", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", subscriptionStatus: "canceled", role: "ADMIN" },
    });
    mp.newsArticle.findMany.mockResolvedValue([]);
    const req = new Request("http://localhost/api/news/daily");
    const res = await dailyGET(req);
    expect(res.status).toBe(200);
  });

  it("不正な日付フォーマットの場合 400 を返す", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", subscriptionStatus: "active", role: "USER" },
    });
    const req = new Request("http://localhost/api/news/daily?date=invalid-date");
    const res = await dailyGET(req);
    expect(res.status).toBe(400);
  });
});
