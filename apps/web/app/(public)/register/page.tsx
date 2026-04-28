"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", displayName: "" });
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  async function handleGoogle() {
    await signIn("google", { callbackUrl: "/news" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) return setError("利用規約に同意してください");
    setLoading(true);
    setError("");

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.message ?? "登録に失敗しました");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    if (result?.error) {
      setError("登録は完了しましたが、ログインに失敗しました");
    } else {
      router.push("/news");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-2">
        <div className="w-7 h-7 bg-blue-700 rounded-lg flex items-center justify-center">
          <span className="text-white text-xs font-bold">AI</span>
        </div>
        <span className="font-bold text-slate-800">AI Insight Daily</span>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <h1 className="text-xl font-bold text-slate-900 mb-1">アカウント作成</h1>
          <p className="text-sm text-slate-500 mb-6">30日間無料でお試しいただけます</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 rounded-lg py-3 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 mb-4 shadow-sm disabled:opacity-60 transition"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Googleで登録
          </button>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-slate-50 text-xs text-slate-400">
                またはメールで登録
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="displayName" className="text-xs">お名前</Label>
              <Input
                id="displayName"
                value={form.displayName}
                onChange={set("displayName")}
                placeholder="山田 太郎"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-xs">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="you@example.com"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-xs">パスワード</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={set("password")}
                placeholder="8文字以上（英数字を含む）"
                required
                className="mt-1"
              />
              <p className="text-xs text-slate-400 mt-1">8文字以上、英数字を含む</p>
            </div>

            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                id="agree"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 rounded"
              />
              <label htmlFor="agree" className="text-xs text-slate-600">
                <Link href="#" className="text-blue-600 underline">利用規約</Link>と
                <Link href="#" className="text-blue-600 underline">プライバシーポリシー</Link>
                に同意する
              </label>
            </div>

            <Button type="submit" className="w-full" disabled={loading || !agreed}>
              {loading ? "登録中..." : "アカウントを作成 →"}
            </Button>
          </form>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100 text-center">
            <p className="text-xs text-blue-700">
              🎉 登録後30日間は完全無料。クレジットカード不要。
            </p>
          </div>

          <p className="text-center text-xs text-slate-500 mt-5">
            すでにアカウントをお持ちの方は{" "}
            <Link href="/login" className="text-blue-600 font-medium">ログイン</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
