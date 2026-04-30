import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ArticleSchema, ResponseSchema, getTodayJST } from "@/lib/news";

describe("getTodayJST", () => {
  it("時刻が 00:00:00.000 にリセットされている", () => {
    const result = getTodayJST();
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("Date オブジェクトを返す", () => {
    expect(getTodayJST()).toBeInstanceOf(Date);
  });

  it("同日に2回呼んでも同じ日付を返す", () => {
    const a = getTodayJST();
    const b = getTodayJST();
    expect(a.toDateString()).toBe(b.toDateString());
  });
});

describe("ArticleSchema", () => {
  const valid = {
    aiName: "Claude",
    title: "テストタイトル",
    summary: "テスト要約テキスト",
    ceoInsight: "CEO向け示唆テキスト",
    sourceUrls: ["https://example.com"],
  };

  it("正常なデータをパースできる", () => {
    const result = ArticleSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("sourceUrls が省略された場合は空配列になる", () => {
    const { sourceUrls: _, ...withoutUrls } = valid;
    const result = ArticleSchema.safeParse(withoutUrls);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceUrls).toEqual([]);
    }
  });

  it("必須フィールドが欠けているとエラーになる", () => {
    expect(ArticleSchema.safeParse({ aiName: "Claude" }).success).toBe(false);
    expect(ArticleSchema.safeParse({ title: "タイトル" }).success).toBe(false);
  });

  it("sourceUrls に URL 以外の文字列も許容する（バリデーションなし）", () => {
    const result = ArticleSchema.safeParse({ ...valid, sourceUrls: ["not-a-url"] });
    expect(result.success).toBe(true);
  });
});

describe("ResponseSchema", () => {
  it("articles 配列を含むオブジェクトをパースできる", () => {
    const result = ResponseSchema.safeParse({
      articles: [
        {
          aiName: "ChatGPT",
          title: "GPT最新情報",
          summary: "詳細な要約テキスト",
          ceoInsight: "CEO向け示唆",
          sourceUrls: [],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.articles).toHaveLength(1);
    }
  });

  it("空の articles 配列でも有効", () => {
    const result = ResponseSchema.safeParse({ articles: [] });
    expect(result.success).toBe(true);
  });

  it("articles が配列でない場合はエラー", () => {
    const result = ResponseSchema.safeParse({ articles: "not-an-array" });
    expect(result.success).toBe(false);
  });
});
