import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";

export const revalidate = 86400;

async function getLatestTeaser() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return prisma.newsArticle.findMany({
    where: { newsDate: today, type: "daily" },
    orderBy: { publishedAt: "desc" },
    take: 3,
    select: { id: true, aiName: true, title: true, summary: true },
  });
}

const AI_COLORS: Record<string, string> = {
  Claude: "bg-purple-100 text-purple-700",
  ChatGPT: "bg-emerald-100 text-emerald-700",
  Gemini: "bg-amber-100 text-amber-700",
};

export default async function LandingPage() {
  const articles = await getLatestTeaser().catch(() => []);

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4">
        <div className="max-w-5xl mx-auto h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 bg-blue-700 rounded-lg flex items-center justify-center text-white text-xs font-bold">
              AI
            </span>
            <span className="font-bold text-slate-800 text-sm">AI Insight Daily</span>
          </div>
          <div className="flex gap-2">
            <Link href="/login" className={buttonVariants({ variant: "outline", size: "sm" })}>ログイン</Link>
            <Link href="/register" className={buttonVariants({ size: "sm" })}>無料で始める</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white px-6 py-16 md:py-24">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 bg-blue-500/20 text-blue-200 text-xs px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
            毎朝 9:00 自動更新
          </div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-6">
            CEOの朝を変える<br />AIニュース
          </h1>
          <p className="text-slate-300 text-base md:text-lg mb-8 leading-relaxed max-w-xl">
            ChatGPT・Claude・Geminiなど主要AIの最新動向を毎日ワンスクリーンに集約。
            経営判断に直結する「CEO向け示唆」付きでお届けします。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className={buttonVariants({ size: "lg", className: "bg-white text-blue-800 hover:bg-blue-50" })}>30日間無料で始める →</Link>
            <Link href="/login" className={buttonVariants({ size: "lg", variant: "outline", className: "border-slate-500 text-white hover:bg-white/10" })}>ログイン</Link>
          </div>
          <p className="text-slate-400 text-xs mt-3">クレジットカード不要 · 30日間完全無料</p>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-slate-50 px-6 py-8 border-b border-slate-200">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-4 text-center">
          {[
            { value: "3+", label: "対応AI" },
            { value: "5年", label: "アーカイブ" },
            { value: "毎朝", label: "自動配信" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-bold text-blue-700">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* News Teaser */}
      <section className="px-6 py-8 max-w-3xl mx-auto w-full flex-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800">本日のAIニュース（プレビュー）</h2>
          <span className="text-xs text-slate-400">
            {new Date().toLocaleDateString("ja-JP")}
          </span>
        </div>

        <div className="space-y-3">
          {articles.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-400">
              本日のニュースを準備中です
            </div>
          ) : (
            articles.map((article) => (
              <div
                key={article.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden relative"
              >
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        AI_COLORS[article.aiName] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {article.aiName}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 mb-1">
                    {article.title}
                  </p>
                  <p className="text-xs text-slate-500 blur-sm select-none line-clamp-2">
                    {article.summary}
                  </p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
                  <div className="text-center">
                    <p className="text-slate-500 text-xs mb-2">
                      ログイン後に全文を閲覧できます
                    </p>
                    <Link href="/login" className={buttonVariants({ size: "sm" })}>ログインして読む</Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* CTA Footer */}
      <section className="px-6 py-10 bg-blue-700 text-white text-center">
        <p className="font-bold text-lg mb-2">今すぐ無料トライアルを開始</p>
        <p className="text-sm text-blue-200 mb-5">
          30日間全機能が無料。いつでも解約可能。
        </p>
        <Link href="/register" className={buttonVariants({ size: "lg", className: "bg-white text-blue-700 hover:bg-blue-50 w-full max-w-sm" })}>Googleアカウントで無料登録</Link>
      </section>
    </div>
  );
}
