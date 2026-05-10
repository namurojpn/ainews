/**
 * ニュースページ E2E テスト
 * - 認証済みセッションを注入してページ構造を検証
 * - デスクトップ: サイドバー・日付タブ・AIフィルタ
 * - モバイル: AIフィルタチップ・モバイルナビ
 */
import { test, expect } from "@playwright/test";
import { loginAs, TEST_USER } from "./helpers/auth";

const MOCK_ARTICLES = [
  {
    id: "e2e-a1",
    aiName: "Claude",
    title: "Claude E2Eテスト記事",
    summary: "Anthropicが新機能を発表しました。",
    ceoInsight: "CEOへの示唆テスト",
    sourceUrls: ["https://anthropic.com"],
    publishedAt: new Date().toISOString(),
  },
  {
    id: "e2e-a2",
    aiName: "ChatGPT",
    title: "GPT E2Eテスト記事",
    summary: "OpenAIが新モデルを公開しました。",
    ceoInsight: "CEOへの示唆テスト2",
    sourceUrls: [],
    publishedAt: new Date().toISOString(),
  },
];

test.describe("ニュースページ (/news) — デスクトップ", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ context, page }) => {
    await loginAs(context, TEST_USER);

    // ニュース API をモック
    await page.route("**/api/news/daily*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          articles: MOCK_ARTICLES,
        }),
      });
    });

    await page.goto("/news");
    await page.waitForLoadState("networkidle");
  });

  test("ページが正常にロードされる（ログインへのリダイレクトなし）", async ({ page }) => {
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/news/);
  });

  test("デスクトップサイドバーに日付タブが表示される", async ({ page }) => {
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText("日付")).toBeVisible();
  });

  test("デスクトップサイドバーに AI フィルタリンクが表示される", async ({ page }) => {
    const sidebar = page.locator("aside");
    await expect(sidebar.getByText("Claude")).toBeVisible();
    await expect(sidebar.getByText("ChatGPT")).toBeVisible();
    await expect(sidebar.getByText("Gemini")).toBeVisible();
    await expect(sidebar.getByText("その他")).toBeVisible();
  });

  test("アプリヘッダーにユーザー名またはナビが表示される", async ({ page }) => {
    const header = page.locator("header").first();
    await expect(header).toBeVisible();
    await expect(header.getByText("AI Insight Daily")).toBeVisible();
  });
});

test.describe("ニュースページ (/news) — モバイル", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ context, page }) => {
    await loginAs(context, TEST_USER);

    await page.route("**/api/news/daily*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          articles: MOCK_ARTICLES,
        }),
      });
    });

    await page.goto("/news");
    await page.waitForLoadState("networkidle");
  });

  test("モバイルで AI フィルタチップが表示される", async ({ page }) => {
    // モバイル専用チップ行（md:hidden の div）
    const chipRow = page.locator(".md\\:hidden").filter({ hasText: "Claude" });
    await expect(chipRow).toBeVisible();
    await expect(chipRow.getByText("すべて")).toBeVisible();
    await expect(chipRow.getByText("Claude")).toBeVisible();
    await expect(chipRow.getByText("ChatGPT")).toBeVisible();
  });

  test("モバイルナビが表示される", async ({ page }) => {
    const mobileNav = page.locator("nav").last();
    await expect(mobileNav).toBeVisible();
  });

  test("デスクトップサイドバーは非表示", async ({ page }) => {
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeHidden();
  });
});

test.describe("ニュースページ — AI フィルタ動作", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ context, page }) => {
    await loginAs(context, TEST_USER);

    await page.route("**/api/news/daily*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          articles: MOCK_ARTICLES,
        }),
      });
    });

    await page.goto("/news");
    await page.waitForLoadState("networkidle");
  });

  test("Claude フィルタをクリックすると URL に ai=Claude が付く", async ({ page }) => {
    const chipRow = page.locator(".md\\:hidden").filter({ hasText: "Claude" });
    await chipRow.getByRole("link", { name: "Claude" }).click();
    await expect(page).toHaveURL(/ai=Claude/);
  });

  test("「すべて」をクリックすると ai パラメータが消える", async ({ page }) => {
    await page.goto("/news?ai=Claude");
    const chipRow = page.locator(".md\\:hidden").filter({ hasText: "すべて" });
    await chipRow.getByRole("link", { name: "すべて" }).click();
    await expect(page).not.toHaveURL(/ai=/);
  });
});
