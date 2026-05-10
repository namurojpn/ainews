/**
 * 認証ページ E2E テスト
 * - /login: フォーム表示・バリデーション・API モック
 * - /register: フォーム表示・バリデーション・API モック
 * - 未認証時のリダイレクト
 */
import { test, expect } from "@playwright/test";

// ── /login ─────────────────────────────────────────────────────────────────

test.describe("ログインページ (/login)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("ページタイトルと主要 UI 要素が表示される", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "おかえりなさい" })).toBeVisible();
    await expect(page.getByText("AI Insight Daily")).toBeVisible();
  });

  test("パスキーボタンが表示される", async ({ page }) => {
    await expect(page.getByText("パスキーでログイン")).toBeVisible();
  });

  test("Google ログインボタンが表示される", async ({ page }) => {
    await expect(page.getByText("Googleでログイン")).toBeVisible();
  });

  test("メール・パスワードフォームが表示される", async ({ page }) => {
    await expect(page.getByLabel("メールアドレス")).toBeVisible();
    await expect(page.getByLabel("パスワード")).toBeVisible();
    await expect(page.getByRole("button", { name: "ログイン", exact: true })).toBeVisible();
  });

  test("新規登録リンクが /register に繋がる", async ({ page }) => {
    const link = page.getByRole("link", { name: "新規登録（30日無料）" });
    await expect(link).toHaveAttribute("href", "/register");
  });

  test("認証エラー時にエラーメッセージを表示する", async ({ page }) => {
    await page.route("/api/auth/callback/credentials", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "CredentialsSignin" }),
      });
    });

    await page.getByLabel("メールアドレス").fill("wrong@example.com");
    await page.getByLabel("パスワード").fill("wrongpassword123");
    await page.getByRole("button", { name: "ログイン", exact: true }).click();

    await expect(
      page.getByText("メールアドレスまたはパスワードが間違っています")
    ).toBeVisible({ timeout: 5000 });
  });
});

// ── /register ──────────────────────────────────────────────────────────────

test.describe("登録ページ (/register)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/register");
  });

  test("ページ見出しと説明文が表示される", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "アカウント作成" })).toBeVisible();
    await expect(page.getByText("30日間無料でお試しいただけます")).toBeVisible();
  });

  test("フォームフィールドが表示される", async ({ page }) => {
    await expect(page.getByLabel("お名前")).toBeVisible();
    await expect(page.getByLabel("メールアドレス")).toBeVisible();
    await expect(page.getByLabel("パスワード")).toBeVisible();
  });

  test("利用規約に同意しないと登録ボタンが無効", async ({ page }) => {
    const btn = page.getByRole("button", { name: /アカウントを作成/ });
    await expect(btn).toBeDisabled();
  });

  test("利用規約チェック後に登録ボタンが有効になる", async ({ page }) => {
    await page.getByLabel(/利用規約/).check();
    const btn = page.getByRole("button", { name: /アカウントを作成/ });
    await expect(btn).toBeEnabled();
  });

  test("同意せずに送信するとエラーメッセージが出る", async ({ page }) => {
    await page.getByLabel("お名前").fill("テストユーザー");
    await page.getByLabel("メールアドレス").fill("test@example.com");
    await page.getByLabel("パスワード").fill("Password1");

    // 同意チェックなしでフォーム submit を直接試みる
    await page.evaluate(() => {
      const form = document.querySelector("form") as HTMLFormElement;
      if (form) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await expect(page.getByText("利用規約に同意してください")).toBeVisible();
  });

  test("重複メールの場合 API エラーを表示する", async ({ page }) => {
    await page.route("/api/register", async (route) => {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "このメールアドレスは既に使用されています" } }),
      });
    });

    await page.getByLabel("お名前").fill("テストユーザー");
    await page.getByLabel("メールアドレス").fill("existing@example.com");
    await page.getByLabel("パスワード").fill("Password1");
    await page.getByLabel(/利用規約/).check();
    await page.getByRole("button", { name: /アカウントを作成/ }).click();

    await expect(
      page.getByText("このメールアドレスは既に使用されています")
    ).toBeVisible({ timeout: 5000 });
  });

  test("ログインページへのリンクが表示される", async ({ page }) => {
    const link = page.getByRole("link", { name: "ログイン" });
    await expect(link).toHaveAttribute("href", "/login");
  });
});

// ── 未認証リダイレクト ─────────────────────────────────────────────────────

test.describe("未認証時のリダイレクト", () => {
  test("/news にアクセスすると /login にリダイレクトされる", async ({ page }) => {
    await page.goto("/news");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/archive にアクセスすると /login にリダイレクトされる", async ({ page }) => {
    await page.goto("/archive");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/settings にアクセスすると /login にリダイレクトされる", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/news/monthly にアクセスすると /login にリダイレクトされる", async ({ page }) => {
    await page.goto("/news/monthly");
    await expect(page).toHaveURL(/\/login/);
  });
});
