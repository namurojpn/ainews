import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const revalidate = 3600;

interface PageProps {
  searchParams: Promise<{ ym?: string }>;
}

function prevMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ymLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${y}年${Number(m)}月`;
}

export default async function MonthlyPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const now = new Date();
  const defaultYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const yearMonth = params.ym ?? defaultYM;

  const report = await prisma.monthlyReport.findUnique({ where: { yearMonth } });

  // 月別記事件数
  const [y, m] = yearMonth.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const articleCounts = await prisma.newsArticle.groupBy({
    by: ["aiName"],
    _count: { id: true },
    where: { newsDate: { gte: start, lte: end }, type: "daily" },
  });

  const prev = prevMonth(yearMonth);
  const next = nextMonth(yearMonth);
  const isCurrentOrFuture = yearMonth >= defaultYM;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      {/* Month navigation */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between">
        <Link href={`/news/monthly?ym=${prev}`} className="text-slate-400 hover:text-slate-700 text-sm">
          ← {ymLabel(prev)}
        </Link>
        <div className="text-center">
          <p className="font-bold text-slate-900">{ymLabel(yearMonth)}</p>
          <p className="text-xs text-slate-400">月次AIトレンドサマリ</p>
        </div>
        <span className={`text-sm ${isCurrentOrFuture ? "text-slate-300 cursor-default" : "text-slate-400 hover:text-slate-700"}`}>
          {isCurrentOrFuture ? (
            <span className="text-slate-300">{ymLabel(next)} →</span>
          ) : (
            <Link href={`/news/monthly?ym=${next}`}>{ymLabel(next)} →</Link>
          )}
        </span>
      </div>

      {!report ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400 text-sm">{ymLabel(yearMonth)}の月次レポートはまだ準備中です</p>
        </div>
      ) : (
        <>
          {/* Headline */}
          <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-xl p-6">
            <p className="text-xs font-semibold text-blue-200 mb-2">今月のハイライト</p>
            <p className="text-sm leading-relaxed font-medium">{report.summaryText}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: articleCounts.reduce<number>((s, a) => s + a._count.id, 0), label: "ニュース件数" },
              { value: articleCounts.length, label: "主要AI動向" },
              { value: (report.keyEvents as string[]).length, label: "経営示唆数" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* AI breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm font-bold text-slate-700 mb-4">AI別動向サマリ</p>
            <div className="space-y-4">
              {articleCounts.map((ac) => (
                <div key={ac.aiName}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700">{ac.aiName}</span>
                    <span className="text-slate-400">{ac._count.id}件</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-blue-500"
                      style={{
                        width: `${Math.min(100, (ac._count.id / Math.max(...articleCounts.map((a) => a._count.id))) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CEO insight */}
          <div className="bg-blue-50 border-l-4 border-blue-600 p-5 rounded-r-xl">
            <p className="text-sm font-bold text-blue-800 mb-2">
              💡 {ymLabel(yearMonth)} CEO向け月次示唆
            </p>
            <ul className="space-y-2">
              {(report.keyEvents as string[]).map((event, i) => (
                <li key={i} className="text-xs text-blue-900 leading-relaxed flex gap-2">
                  <span>•</span>
                  <span>{event}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
