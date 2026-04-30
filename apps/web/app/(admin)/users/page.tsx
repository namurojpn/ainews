"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface User {
  id: string;
  displayName: string | null;
  email: string;
  role: string;
  subscriptionStatus: string | null;
  createdAt: string;
  deletedAt: string | null;
}

interface UserListResult {
  total: number;
  page: number;
  totalPages: number;
  users: User[];
}

const STATUS_COLOR: Record<string, string> = {
  trialing: "bg-blue-100 text-blue-700",
  active: "bg-emerald-100 text-emerald-700",
  canceled: "bg-slate-100 text-slate-500",
  suspended: "bg-red-100 text-red-600",
  past_due: "bg-amber-100 text-amber-700",
};

const STATUS_LABEL: Record<string, string> = {
  trialing: "トライアル",
  active: "有効",
  canceled: "解約済",
  suspended: "停止",
  past_due: "支払遅延",
};

export default function UsersPage() {
  const [result, setResult] = useState<UserListResult | null>(null);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), pageSize: "20" });
    if (keyword) params.set("q", keyword);
    const res = await fetch(`/api/admin/users?${params}`);
    if (res.ok) {
      setResult(await res.json());
      setPage(p);
    }
    setLoading(false);
  }, [keyword]);

  useEffect(() => { fetchUsers(1); }, [fetchUsers]);

  async function suspendUser(userId: string, isSuspended: boolean) {
    if (!confirm(isSuspended ? "このユーザーの停止を解除しますか？" : "このユーザーを停止しますか？")) return;
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionStatus: isSuspended ? "active" : "suspended" }),
    });
    fetchUsers(page);
  }

  async function deleteUser(userId: string) {
    if (!confirm("このユーザーを削除しますか？この操作は取り消せません。")) return;
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    fetchUsers(page);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-lg font-bold text-slate-800">ユーザー管理</h1>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="名前またはメールで検索..."
            onKeyDown={(e) => e.key === "Enter" && fetchUsers(1)}
            className="flex-1"
          />
          <Button onClick={() => fetchUsers(1)} disabled={loading}>
            {loading ? "検索中..." : "検索"}
          </Button>
        </div>
      </div>

      {result && (
        <>
          <p className="text-sm text-slate-500">
            <span className="font-bold text-slate-800">{result.total.toLocaleString()}人</span> のユーザー
          </p>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["名前", "メール", "ロール", "サブスク", "登録日", "操作"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-slate-500 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.users.map((u) => {
                  const subStatus = u.subscriptionStatus;
                  const isSuspended = subStatus === "suspended";
                  return (
                    <tr key={u.id} className={`border-b border-slate-50 ${u.deletedAt ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3 font-medium text-slate-700">{u.displayName ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full font-semibold ${u.role === "ADMIN" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {subStatus ? (
                          <span className={`px-2 py-0.5 rounded-full font-semibold ${STATUS_COLOR[subStatus] ?? "bg-slate-100 text-slate-500"}`}>
                            {STATUS_LABEL[subStatus] ?? subStatus}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString("ja-JP")}
                      </td>
                      <td className="px-4 py-3">
                        {!u.deletedAt && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => suspendUser(u.id, isSuspended)}
                              className="text-amber-600 hover:text-amber-800"
                            >
                              {isSuspended ? "解除" : "停止"}
                            </button>
                            <button
                              onClick={() => deleteUser(u.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              削除
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {result.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => fetchUsers(page - 1)}>←</Button>
              <span className="px-3 py-1 text-sm text-slate-600">{page} / {result.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= result.totalPages} onClick={() => fetchUsers(page + 1)}>→</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
