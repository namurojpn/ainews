import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NewsCard } from "@/components/news/NewsCard";

const base = {
  id: "1",
  aiName: "Claude",
  title: "Claude 最新アップデート",
  summary: "Anthropicが新モデルをリリースしました。",
  ceoInsight: "CEO向け示唆テキストです。",
  sourceUrls: [],
  publishedAt: new Date("2026-04-28T09:00:00+09:00").toISOString(),
};

describe("NewsCard", () => {
  it("タイトルを表示する", () => {
    render(<NewsCard article={base} />);
    expect(screen.getByRole("heading", { name: base.title })).toBeDefined();
  });

  it("要約テキストを表示する", () => {
    render(<NewsCard article={base} />);
    expect(screen.getByText(base.summary)).toBeDefined();
  });

  it("AI名バッジを表示する", () => {
    render(<NewsCard article={base} />);
    expect(screen.getByText("Claude")).toBeDefined();
  });

  it("sourceUrls が空のとき「ソース」リンクを表示しない", () => {
    render(<NewsCard article={base} />);
    expect(screen.queryByText(/ソース/)).toBeNull();
  });

  it("sourceUrls があるとき「ソース」リンクを表示する", () => {
    render(
      <NewsCard
        article={{ ...base, sourceUrls: ["https://example.com", "https://example2.com"] }}
      />
    );
    expect(screen.getByText("ソース 1 →")).toBeDefined();
    expect(screen.getByText("ソース 2 →")).toBeDefined();
  });

  it("sourceUrls が3件以上でも最大2件だけ表示する", () => {
    render(
      <NewsCard
        article={{
          ...base,
          sourceUrls: ["https://a.com", "https://b.com", "https://c.com"],
        }}
      />
    );
    expect(screen.getByText("ソース 1 →")).toBeDefined();
    expect(screen.getByText("ソース 2 →")).toBeDefined();
    expect(screen.queryByText("ソース 3 →")).toBeNull();
  });

  it("ChatGPT の場合は emerald 系のバッジが付く", () => {
    const { container } = render(
      <NewsCard article={{ ...base, aiName: "ChatGPT" }} />
    );
    expect(container.querySelector(".bg-emerald-100")).toBeDefined();
  });

  it("未知の AI 名はフォールバックスタイルになる", () => {
    const { container } = render(
      <NewsCard article={{ ...base, aiName: "Grok" }} />
    );
    expect(container.querySelector(".bg-slate-100")).toBeDefined();
  });
});
