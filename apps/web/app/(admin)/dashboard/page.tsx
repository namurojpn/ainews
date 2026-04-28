"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Stats {
  totalUsers: number;
  activeUsers: number;
  trialingUsers: number;
  totalArticles: number;
  dau: number;
  mau: number;
  recentUsers: { id: string; name: string | null; email: string; status: string; createdAt: string }[];
}

const STATUS_LABEL: Record<string, string> = {
  trialing: "トライアル",
  active: "有効",
  canceled: "解約済",
  suspended: "停止",
  past_due: "支払遅延",
};

const STATUS_COLOR: Record<string, string> = {
  trialing: "bg-blue-100 text-blue-700",
  active: "bg-emerald-100 text-emerald-700",
  canceled: "bg-slate-100 text-slate-500",
  suspended: "bg-red-100 text-red-600",
  past_due: "bg-amber-100 text-amber-700",
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false); });
  }, []);

  async function handleGenerateNews() {
    setGenerating(true);
    setGenResult(null);
    try {
      const res = await fetch("/api/admin/generate-news", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setGenResult(`✅ ${data.count}件のニュースを生成しました`);
        const updated = await fetch("/api/admin/stats").then((r) => r.json());
        setStats(updated);
      } else {
        setGenResult(`❌ エラー: ${data.error}`);
      }
    } catch {
      setGenResult("❌ 通信エラーが発生しました");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        読み込み中...
      </div>
    );
  }

  if (!stats) return null;

  const kpiCards = [
    { label: "総ユーザー数", value: stats.totalUsers, sub: "登録累計" },
    { label: "有効会員数", value: stats.activeUsers, sub: "有料プラン" },
    { label: "トライアル中", value: stats.trialingUsers, sub: "無料30日" },
    { label: "総記事数", value: stats.totalArticles, sub: "蓄積済み" },
    { label: "DAU", value: stats.dau, sub: "本日のアクティブ" },
    { label: "MAU", value: stats.mau, sub: "今月のアクティブ" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-800">管理ダッシュボード</h1>
        <div className="flex items-center gap-3">
          {genResult && (
            <span className="text-xs text-slate-600">{genResult}</span>
          )}
          <button
            onClick={handleGenerateNews}
            disabled={generating}
            className="bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2"
          >
            {generating ? (
              <>
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                生成中...
              </>
            ) : (
              "⚡ 今すぐニュース更新"
            )}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {kpiCards.map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 mb-1">{k.label}</p>
            <p className="text-2xl font-bold text-blue-700">{k.value.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Conversion funnel */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-sm font-bold text-slate-700 mb-4">コンバージョンファネル</p>
        {[
          { label: "登録ユーザー", value: stats.totalUsers, color: "bg-blue-400" },
          { label: "トライアル中", value: stats.trialingUsers, color: "bg-indigo-400" },
          { label: "有料転換", value: stats.activeUsers, color: "bg-emerald-500" },
        ].map((f) => {
          const pct = stats.totalUsers > 0 ? Math.round((f.value / stats.totalUsers) * 100) : 0;
          return (
            <div key={f.label} className="mb-3">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>{f.label}</span>
                <span>{f.value.toLocaleString()}人 ({pct}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className={`h-2 rounded-full ${f.color}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent users */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-slate-700">最近の登録ユーザー</p>
          <Link href="/admin/users" className="text-xs text-blue-600 hover:underline">
            すべて表示 →
          </Link>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100">
              <th className="text-left pb-2 font-medium">名前</th>
              <th className="text-left pb-2 font-medium">メール</th>
              <th className="text-left pb-2 font-medium">ステータス</th>
              <th className="text-left pb-2 font-medium">登録日</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentUsers.map((u) => (
              <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-2 font-medium text-slate-700">{u.name ?? "—"}</td>
                <td className="py-2 text-slate-500">{u.email}</td>
                <td className="py-2">
                  <span className={`px-2 py-0.5 rounded-full font-semibold ${STATUS_COLOR[u.status] ?? "bg-slate-100 text-slate-500"}`}>
                    {STATUS_LABEL[u.status] ?? u.status}
                  </span>
                </td>
                <td className="py-2 text-slate-400">
                  {new Date(u.createdAt).toLocaleDateString("ja-JP")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
