import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewsCard } from "@/components/news/NewsCard";
import { redirect } from "next/navigation";
import Link from "next/link";

export const revalidate = 600;

const AI_FILTERS = ["Claude", "ChatGPT", "Gemini", "その他"];

async function getNewsForDate(date: Date) {
  return prisma.newsArticle.findMany({
    where: { newsDate: date, type: "daily" },
    orderBy: { publishedAt: "desc" },
  });
}

interface PageProps {
  searchParams: Promise<{ date?: string; ai?: string }>;
}

export default async function NewsHomePage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const selectedDateStr = params.date;
  const isYesterday = selectedDateStr === yesterday.toISOString().slice(0, 10);
  const currentDate = isYesterday ? yesterday : today;
  const aiFilter = params.ai;

  let articles = await getNewsForDate(currentDate);
  if (aiFilter && aiFilter !== "all") {
    articles = articles.filter((a) =>
      aiFilter === "その他"
        ? !["Claude", "ChatGPT", "Gemini"].includes(a.aiName)
        : a.aiName === aiFilter
    );
  }

  const todayStr = today.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
  const yesterdayStr = yesterday.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex gap-6">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col w-44 shrink-0 gap-2">
        <p className="text-xs text-slate-400 font-semibold px-2 mb-1 mt-1">日付</p>
        <Link
          href="/news"
          className={`px-3 py-2 rounded-lg text-sm transition-colors ${
            !isYesterday
              ? "bg-blue-50 text-blue-700 font-semibold"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          📅 本日 {todayStr}
        </Link>
        <Link
          href={`/news?date=${yesterday.toISOString().slice(0, 10)}`}
          className={`px-3 py-2 rounded-lg text-sm transition-colors ${
            isYesterday
              ? "bg-blue-50 text-blue-700 font-semibold"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          📅 昨日 {yesterdayStr}
        </Link>

        <div className="border-t border-slate-200 my-2" />
        <p className="text-xs text-slate-400 font-semibold px-2 mb-1">AIフィルタ</p>
        {AI_FILTERS.map((ai) => (
          <Link
            key={ai}
            href={`/news${selectedDateStr ? `?date=${selectedDateStr}&` : "?"}ai=${encodeURIComponent(ai)}`}
            className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
              aiFilter === ai
                ? "bg-blue-50 text-blue-700 font-semibold"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full inline-block ${
                ai === "Claude" ? "bg-purple-500" :
                ai === "ChatGPT" ? "bg-emerald-500" :
                ai === "Gemini" ? "bg-amber-500" : "bg-slate-400"
              }`}
            />
            {ai}
          </Link>
        ))}
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Date tabs (mobile) */}
        <div className="flex gap-2 md:hidden">
          <Link
            href="/news"
            className={`flex-1 py-2 rounded-lg text-sm font-medium text-center transition-colors ${
              !isYesterday ? "bg-blue-700 text-white" : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            本日 {todayStr}
          </Link>
          <Link
            href={`/news?date=${yesterday.toISOString().slice(0, 10)}`}
            className={`flex-1 py-2 rounded-lg text-sm font-medium text-center transition-colors ${
              isYesterday ? "bg-blue-700 text-white" : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            昨日 {yesterdayStr}
          </Link>
        </div>

        {articles.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-slate-400 text-sm mb-3">
              {isYesterday ? "昨日" : "本日"}のニュースはまだ準備中です
            </p>
            <p className="text-xs text-slate-400">
              毎朝9時頃に更新されます
            </p>
          </div>
        ) : (
          <>
            {articles.map((a) => (
              <NewsCard
                key={a.id}
                article={{
                  id: a.id,
                  aiName: a.aiName,
                  title: a.title,
                  summary: a.summary,
                  ceoInsight: a.ceoInsight,
                  sourceUrls: a.sourceUrls as string[],
                  publishedAt: a.publishedAt.toISOString(),
                }}
              />
            ))}

            {/* CEO向け総合示唆 */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">💡</span>
                <h2 className="font-bold text-blue-900 text-sm">CEO向け総合示唆</h2>
                <span className="ml-auto text-xs text-blue-400">{articles.length}件の記事より</span>
              </div>
              <ul className="space-y-3">
                {articles.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                      a.aiName === "Claude"  ? "bg-purple-500" :
                      a.aiName === "ChatGPT" ? "bg-emerald-500" :
                      a.aiName === "Gemini"  ? "bg-amber-500" : "bg-slate-400"
                    }`} />
                    <div>
                      <p className="text-xs font-semibold text-blue-800 mb-0.5">{a.title}</p>
                      <p className="text-xs text-blue-900 leading-relaxed">{a.ceoInsight}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
