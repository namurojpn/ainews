/**
 * アーカイブ検索ページ E2E テスト
 * - フォーム表示・AI フィルタチップ・ページネーション
 * - キーワード検索・API モック
 */
import { test, expect } from "@playwright/test";
import { loginAs, TEST_USER } from "./helpers/auth";

const MOCK_ARCHIVE_RESPONSE = {
  total: 2,
  page: 1,
  pageSize: 20,
  totalPages: 1,
  articles: [
    {
      id: "arc-1",
      newsDate: "2026-05-01",
      type: "daily",
      aiName: "Claude",
      title: "アーカイブ Claude 記事",
      summary: "Claude のアーカイブサマリです。",
      ceoInsight: "示唆テスト",
      sourceUrls: [],
      publishedAt: "2026-05-01T09:00:00.000Z",
    },
    {
      id: "arc-2",
      newsDate: "2026-05-01",
      type: "daily",
      aiName: "ChatGPT",
      title: "アーカイブ ChatGPT 記事",
      summary: "ChatGPT のアーカイブサマリです。",
      ceoInsight: "示唆テスト2",
      sourceUrls: [],
      publishedAt: "2026-05-01T09:05:00.000Z",
    },
  ],
};

test.describe("アーカイブページ (/archive)", () => {
  test.beforeEach(async ({ context, page }) => {
    await loginAs(context, TEST_USER);
    await page.goto("/archive");
    await page.waitForLoadState("networkidle");
  });

  test("ページが正常にロードされる", async ({ page }) => {
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/archive/);
  });

  test("キーワード入力フォームが表示される", async ({ page }) => {
    const input = page.getByPlaceholder(/マルチモーダル/);
    await expect(input).toBeVisible();
  });

  test("キーワード入力に maxLength=100 が設定されている", async ({ page }) => {
    const input = page.getByPlaceholder(/マルチモーダル/);
    const maxLength = await input.getAttribute("maxlength");
    expect(maxLength).toBe("100");
  });

  test("日付範囲フォームが表示される", async ({ page }) => {
    const dateInputs = page.locator('input[type="date"]');
    await expect(dateInputs.nth(0)).toBeVisible();
    await expect(dateInputs.nth(1)).toBeVisible();
  });

  test("AI フィルタチップが 4 つ表示される", async ({ page }) => {
    for (const ai of ["Claude", "ChatGPT", "Gemini", "その他"]) {
      await expect(page.getByRole("button", { name: ai })).toBeVisible();
    }
  });

  test("AI フィルタチップをクリックで選択・解除できる", async ({ page }) => {
    const claudeBtn = page.getByRole("button", { name: "Claude" });

    // 選択前は outline スタイル
    await expect(claudeBtn).not.toHaveClass(/bg-blue-600/);

    // クリックで選択
    await claudeBtn.click();
    await expect(claudeBtn).toHaveClass(/bg-blue-600/);

    // 再クリックで解除
    await claudeBtn.click();
    await expect(claudeBtn).not.toHaveClass(/bg-blue-600/);
  });

  test("検索ボタンと リセットボタンが表示される", async ({ page }) => {
    await expect(page.getByRole("button", { name: "検索" })).toBeVisible();
    await expect(page.getByRole("button", { name: "リセット" })).toBeVisible();
  });
});

test.describe("アーカイブ検索 — API モック", () => {
  test.beforeEach(async ({ context, page }) => {
    await loginAs(context, TEST_USER);
  });

  test("検索結果が正常に表示される", async ({ page }) => {
    await page.route("**/api/news/archive*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ARCHIVE_RESPONSE),
      });
    });

    await page.goto("/archive");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page.getByText("2件")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("アーカイブ Claude 記事")).toBeVisible();
    await expect(page.getByText("アーカイブ ChatGPT 記事")).toBeVisible();
  });

  test("キーワードを入力して検索するとクエリパラメータに含まれる", async ({ page }) => {
    let capturedUrl = "";
    await page.route("**/api/news/archive*", async (route) => {
      capturedUrl = route.request().url();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...MOCK_ARCHIVE_RESPONSE, total: 1, articles: [MOCK_ARCHIVE_RESPONSE.articles[0]] }),
      });
    });

    await page.goto("/archive");
    await page.waitForLoadState("networkidle");

    const input = page.getByPlaceholder(/マルチモーダル/);
    await input.fill("Claude");
    await page.getByRole("button", { name: "検索" }).click();

    await page.waitForResponse("**/api/news/archive*");
    expect(capturedUrl).toContain("keyword=Claude");
  });

  test("AI フィルタを選択して検索するとクエリパラメータに含まれる", async ({ page }) => {
    let capturedUrl = "";
    await page.route("**/api/news/archive*", async (route) => {
      capturedUrl = route.request().url();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ARCHIVE_RESPONSE),
      });
    });

    await page.goto("/archive");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Claude" }).click();
    await page.getByRole("button", { name: "検索" }).click();

    await page.waitForResponse("**/api/news/archive*");
    expect(capturedUrl).toContain("aiFilter=Claude");
  });

  test("リセットボタンで検索条件がクリアされる", async ({ page }) => {
    await page.goto("/archive");
    await page.waitForLoadState("networkidle");

    const input = page.getByPlaceholder(/マルチモーダル/);
    await input.fill("テストキーワード");
    await page.getByRole("button", { name: "ChatGPT" }).click();

    await page.getByRole("button", { name: "リセット" }).click();

    await expect(input).toHaveValue("");
    await expect(page.getByRole("button", { name: "ChatGPT" })).not.toHaveClass(/bg-blue-600/);
  });

  test("検索エラー時にエラーメッセージを表示する", async ({ page }) => {
    await page.route("**/api/news/archive*", async (route) => {
      await route.fulfill({ status: 500, body: "Internal Server Error" });
    });

    await page.goto("/archive");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page.getByText("検索に失敗しました")).toBeVisible({ timeout: 5000 });
  });

  test("ページネーションが複数ページ時に表示される", async ({ page }) => {
    await page.route("**/api/news/archive*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...MOCK_ARCHIVE_RESPONSE,
          total: 45,
          totalPages: 3,
        }),
      });
    });

    await page.goto("/archive");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page.getByText("3 / 3 ページ").or(page.getByText("1 / 3 ページ"))).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "→" })).toBeVisible();
  });
});
