"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LogEntry {
  id: string;
  userId: string | null;
  path: string;
  method: string;
  statusCode: number;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { name: string | null; email: string } | null;
}

interface LogResult {
  total: number;
  page: number;
  totalPages: number;
  logs: LogEntry[];
}

export default function LogsPage() {
  const [result, setResult] = useState<LogResult | null>(null);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ from, to, page: String(p), pageSize: "50" });
    const res = await fetch(`/api/admin/logs?${params}`);
    if (res.ok) {
      setResult(await res.json());
      setPage(p);
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => { fetchLogs(1); }, [fetchLogs]);

  function downloadCSV() {
    const params = new URLSearchParams({ from, to, format: "csv" });
    window.location.href = `/api/admin/logs?${params}`;
  }

  function statusColor(code: number) {
    if (code < 300) return "text-emerald-600";
    if (code < 400) return "text-blue-600";
    if (code < 500) return "text-amber-600";
    return "text-red-600";
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-lg font-bold text-slate-800">アクセスログ</h1>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs">開始日</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-36" />
          </div>
          <div>
            <Label className="text-xs">終了日</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-36" />
          </div>
          <Button onClick={() => fetchLogs(1)} disabled={loading}>
            {loading ? "検索中..." : "検索"}
          </Button>
          <Button variant="outline" onClick={downloadCSV}>
            CSVエクスポート
          </Button>
        </div>
      </div>

      {result && (
        <>
          <p className="text-sm text-slate-500">
            <span className="font-bold text-slate-800">{result.total.toLocaleString()}件</span> のログ
          </p>

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["日時", "ユーザー", "メソッド", "パス", "ステータス", "IP"].map((h) => (
                    <th key={h} className="text-left px-3 py-3 text-slate-500 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-400">
                      {new Date(log.createdAt).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {log.user ? (log.user.name ?? log.user.email) : log.userId ? log.userId.slice(0, 8) + "…" : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`font-mono font-bold ${log.method === "GET" ? "text-blue-600" : log.method === "POST" ? "text-emerald-600" : "text-amber-600"}`}>
                        {log.method}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-600 max-w-xs truncate">
                      {log.path}
                    </td>
                    <td className={`px-3 py-2 font-mono font-bold ${statusColor(log.statusCode)}`}>
                      {log.statusCode}
                    </td>
                    <td className="px-3 py-2 text-slate-400 font-mono">
                      {log.ipAddress ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => fetchLogs(page - 1)}>←</Button>
              <span className="px-3 py-1 text-sm text-slate-600">{page} / {result.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= result.totalPages} onClick={() => fetchLogs(page + 1)}>→</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
