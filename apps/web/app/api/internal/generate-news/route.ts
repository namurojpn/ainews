import { NextRequest, NextResponse } from "next/server";
import { getGeminiModel } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const maxDuration = 60;

const ArticleSchema = z.object({
  aiName: z.string(),
  title: z.string(),
  summary: z.string(),
  ceoInsight: z.string(),
  sourceUrls: z.array(z.string()).default([]),
});

const ResponseSchema = z.object({
  articles: z.array(ArticleSchema),
});

function getTodayJST(): Date {
  const now = new Date();
  const jst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  jst.setHours(0, 0, 0, 0);
  return jst;
}

async function handler(req: NextRequest) {
  const secret =
    req.headers.get("x-cron-secret") ??
    new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const newsDate = getTodayJST();
    const dateStr = newsDate.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const model = getGeminiModel();

    const prompt = `
あなたはAIニュースのキュレーターです。
今日（${dateStr}）時点での、以下3つのAIに関する最新ニュースを日本語でまとめてください。

対象: Claude (Anthropic), ChatGPT (OpenAI), Gemini (Google DeepMind)

各AIについて1〜2件、合計3〜5件のニュース記事を生成してください。
ニュースは実際に最近起きた出来事や発表に基づいてください。

以下のJSON形式のみで返してください（説明文不要）:

{
  "articles": [
    {
      "aiName": "Claude",
      "title": "ニュースタイトル（40文字以内）",
      "summary": "ニュースの詳細な要約（150〜250文字）",
      "ceoInsight": "IT企業CEOが経営判断・事業戦略に活用できる示唆（80〜120文字）",
      "sourceUrls": ["https://関連URL"]
    }
  ]
}

aiName は必ず "Claude", "ChatGPT", "Gemini" のいずれかにしてください。
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let parsed;
    try {
      parsed = ResponseSchema.parse(JSON.parse(text));
    } catch {
      // JSON抽出を試みる
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("JSONのパースに失敗しました");
      parsed = ResponseSchema.parse(JSON.parse(match[0]));
    }

    const expiresAt = new Date(newsDate);
    expiresAt.setFullYear(expiresAt.getFullYear() + 5);

    // 本日分を削除してから再作成（べき等）
    await prisma.newsArticle.deleteMany({
      where: { newsDate: newsDate, type: "daily" },
    });

    const created = await prisma.newsArticle.createMany({
      data: parsed.articles.map((a) => ({
        newsDate,
        type: "daily" as const,
        aiName: a.aiName,
        title: a.title,
        summary: a.summary,
        ceoInsight: a.ceoInsight,
        sourceUrls: a.sourceUrls,
        publishedAt: new Date(),
        expiresAt,
      })),
    });

    return NextResponse.json({
      success: true,
      count: created.count,
      date: newsDate.toISOString(),
    });
  } catch (error) {
    console.error("[generate-news]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export const GET = handler;
export const POST = handler;
