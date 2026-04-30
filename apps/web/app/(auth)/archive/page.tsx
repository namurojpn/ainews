"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Article {
  id: string;
  newsDate: string;
  aiName: string;
  title: string;
  summary: string;
}

interface SearchResult {
  total: number;
  page: number;
  totalPages: number;
  articles: Article[];
}

const AI_OPTIONS = ["Claude", "ChatGPT", "Gemini", "その他"];

const AI_BADGE: Record<string, string> = {
  Claude: "bg-purple-100 text-purple-700",
  ChatGPT: "bg-emerald-100 text-emerald-700",
  Gemini: "bg-amber-100 text-amber-700",
};

export default function ArchivePage() {
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  const [keyword, setKeyword] = useState("");
  const [from, setFrom] = useState(fiveYearsAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [aiFilter, setAiFilter] = useState<string[]>([]);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  function toggleAi(ai: string) {
    setAiFilter((prev) =>
      prev.includes(ai) ? prev.filter((a) => a !== ai) : [...prev, ai]
    );
  }

  async function search(p = 1) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      from,
      to,
      page: String(p),
      pageSize: "20",
      ...(keyword && { keyword }),
      ...(aiFilter.length && { aiFilter: aiFilter.join(",") }),
    });
    const res = await fetch(`/api/news/archive?${params}`);
    if (!res.ok) {
      setError("検索に失敗しました");
    } else {
      const data = await res.json();
      setResult(data);
      setPage(p);
    }
    setLoading(false);
  }

  function highlightKeyword(text: string) {
    if (!keyword) return text;
    const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    return text.replace(regex, '<mark class="bg-yellow-100 text-yellow-800">$1</mark>');
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      {/* Search form */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div>
          <Label className="text-xs">キーワード</Label>
          <div className="relative mt-1">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="例: マルチモーダル、GPT-5..."
              onKeyDown={(e) => e.key === "Enter" && search()}
              className="pr-10"
            />
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              onClick={() => search()}
            >
              🔍
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">開始日</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">終了日</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" />
          </div>
        </div>

        <div>
          <Label className="text-xs">AI / 種別</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {AI_OPTIONS.map((ai) => (
              <button
                key={ai}
                onClick={() => toggleAi(ai)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  aiFilter.includes(ai)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                }`}
              >
                {aiFilter.includes(ai) ? "✓ " : ""}{ai}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => search(1)} disabled={loading}>
            {loading ? "検索中..." : "検索"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setKeyword("");
              setAiFilter([]);
              setFrom(fiveYearsAgo.toISOString().slice(0, 10));
              setTo(new Date().toISOString().slice(0, 10));
              setResult(null);
            }}
          >
            リセット
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              <span className="font-bold text-slate-900">{result.total.toLocaleString()}件</span> の結果
            </p>
            <p className="text-xs text-slate-400">
              {page} / {result.totalPages} ページ
            </p>
          </div>

          <div className="space-y-2">
            {result.articles.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-400">
                該当する記事が見つかりませんでした
              </div>
            ) : (
              result.articles.map((a) => (
                <div
                  key={a.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        AI_BADGE[a.aiName] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {a.aiName}
                    </span>
                    <span className="text-xs text-slate-400 ml-auto">
                      {new Date(a.newsDate).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                  <p
                    className="text-sm font-semibold text-slate-900 mb-1"
                    dangerouslySetInnerHTML={{ __html: highlightKeyword(a.title) }}
                  />
                  <p
                    className="text-xs text-slate-500 leading-relaxed line-clamp-2"
                    dangerouslySetInnerHTML={{ __html: highlightKeyword(a.summary) }}
                  />
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {result.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => search(page - 1)}
              >
                ←
              </Button>
              {Array.from({ length: Math.min(5, result.totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(result.totalPages - 4, page - 2)) + i;
                return (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => search(p)}
                  >
                    {p}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                disabled={page >= result.totalPages}
                onClick={() => search(page + 1)}
              >
                →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
