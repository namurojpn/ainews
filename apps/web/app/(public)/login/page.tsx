"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startAuthentication } from "@simplewebauthn/browser";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/news";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePasskey() {
    setLoading(true);
    setError("");
    try {
      const optRes = await fetch("/api/webauthn/authenticate/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email || undefined }),
      });
      const options = await optRes.json();
      const credential = await startAuthentication({ optionsJSON: options });

      const verRes = await fetch("/api/webauthn/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: credential }),
      });
      const { email: verifiedEmail } = await verRes.json();

      const result = await signIn("credentials", {
        email: verifiedEmail,
        password: "__passkey__",
        redirect: false,
      });
      if (result?.error) throw new Error("パスキー認証後のサインインに失敗しました");
      router.push(callbackUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "パスキー認証に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    await signIn("google", { callbackUrl });
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (result?.error) {
      setError("メールアドレスまたはパスワードが間違っています");
      setLoading(false);
    } else {
      router.push(callbackUrl);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-700 rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold">AI</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">おかえりなさい</h1>
          <p className="text-sm text-slate-500 mt-1">AI Insight Daily</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Passkey */}
        <button
          onClick={handlePasskey}
          disabled={loading}
          className="w-full bg-blue-700 hover:bg-blue-800 text-white rounded-xl p-4 flex items-center gap-3 mb-3 transition disabled:opacity-60"
        >
          <span className="text-2xl">🔑</span>
          <div className="text-left">
            <p className="font-semibold text-sm">パスキーでログイン</p>
            <p className="text-blue-200 text-xs">Touch ID / Face ID で素早くログイン</p>
          </div>
          <svg
            className="w-4 h-4 ml-auto opacity-70"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 rounded-xl py-3 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 mb-5 shadow-sm disabled:opacity-60 transition"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Googleでログイン
        </button>

        <div className="relative mb-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-3 bg-slate-50 text-xs text-slate-400">
              またはメールでログイン
            </span>
          </div>
        </div>

        <form onSubmit={handleCredentials} className="space-y-3">
          <div>
            <Label htmlFor="email" className="text-xs">
              メールアドレス
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-xs">
              パスワード
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="mt-1"
            />
          </div>
          <div className="flex justify-end">
            <Link href="#" className="text-xs text-blue-600">
              パスワードを忘れた方
            </Link>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "確認中..." : "ログイン"}
          </Button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-6">
          アカウントをお持ちでない方は{" "}
          <Link href="/register" className="text-blue-600 font-medium">
            新規登録（30日無料）
          </Link>
        </p>
      </div>
    </div>
  );
}
