"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface NotificationSetting {
  emailEnabled: boolean;
  frequency: "realtime" | "daily_digest";
}

interface Passkey {
  id: string;
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

interface SubscriptionInfo {
  status: string;
  trialEndDate: string | null;
  currentPeriodEnd: string | null;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [notification, setNotification] = useState<NotificationSetting>({ emailEnabled: false, frequency: "realtime" });
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/notifications").then((r) => r.json()),
      fetch("/api/subscriptions").then((r) => r.json()),
      fetch("/api/webauthn/passkeys").then((r) => r.ok ? r.json() : { passkeys: [] }),
    ]).then(([notif, sub, pk]) => {
      if (notif && !notif.error) setNotification({ emailEnabled: notif.emailEnabled ?? false, frequency: notif.frequency ?? "realtime" });
      if (sub && !sub.error) setSubscription(sub);
      if (pk?.passkeys) setPasskeys(pk.passkeys);
    });
  }, []);

  async function saveNotification() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailEnabled: notification.emailEnabled, frequency: notification.frequency }),
    });
    setMessage(res.ok ? "保存しました" : "保存に失敗しました");
    setSaving(false);
  }

  async function deletePasskey(id: string) {
    if (!confirm("このパスキーを削除しますか？")) return;
    await fetch(`/api/webauthn/passkeys/${id}`, { method: "DELETE" });
    setPasskeys((prev) => prev.filter((p) => p.id !== id));
  }

  function trialDaysLeft() {
    if (!subscription?.trialEndDate) return null;
    const end = new Date(subscription.trialEndDate);
    const now = new Date();
    const days = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
    return days;
  }

  const daysLeft = trialDaysLeft();
  const trialProgress = daysLeft !== null ? Math.max(0, Math.min(100, ((30 - daysLeft) / 30) * 100)) : null;

  const statusLabel: Record<string, string> = {
    trialing: "トライアル中",
    active: "有効",
    canceled: "キャンセル済み",
    suspended: "停止中",
    past_due: "支払い遅延",
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Account Info */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-bold text-slate-700 mb-4">アカウント情報</h2>
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex justify-between">
            <span className="text-slate-400">名前</span>
            <span className="font-medium text-slate-800">{session?.user?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">メールアドレス</span>
            <span className="font-medium text-slate-800">{session?.user?.email ?? "—"}</span>
          </div>
        </div>
      </section>

      {/* Subscription */}
      {subscription && (
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4">サブスクリプション</h2>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-600">ステータス</span>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                subscription.status === "active"
                  ? "bg-emerald-100 text-emerald-700"
                  : subscription.status === "trialing"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {statusLabel[subscription.status] ?? subscription.status}
            </span>
          </div>

          {subscription.status === "trialing" && daysLeft !== null && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>無料トライアル期間</span>
                <span>残り {daysLeft} 日</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${trialProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                トライアル終了日: {new Date(subscription.trialEndDate!).toLocaleDateString("ja-JP")}
              </p>
            </div>
          )}

          {subscription.status === "trialing" && (
            <Button
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
              onClick={() => fetch("/api/subscriptions", { method: "POST" }).then((r) => r.json()).then((d) => { if (d.url) window.location.href = d.url; })}
            >
              有料プランに登録する
            </Button>
          )}

          {subscription.status === "active" && subscription.currentPeriodEnd && (
            <p className="text-xs text-slate-400 mt-2">
              次回更新日: {new Date(subscription.currentPeriodEnd).toLocaleDateString("ja-JP")}
            </p>
          )}
        </section>
      )}

      {/* Notification */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-bold text-slate-700 mb-4">メール通知設定</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="notif-toggle" className="text-sm text-slate-600">ニュース更新通知を受け取る</Label>
            <Switch
              id="notif-toggle"
              checked={notification.emailEnabled}
              onCheckedChange={(v) => setNotification((n) => ({ ...n, emailEnabled: v }))}
            />
          </div>
          {notification.emailEnabled && (
            <div className="flex gap-2">
              {(["realtime", "daily_digest"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setNotification((n) => ({ ...n, frequency: f }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    notification.frequency === f
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                  }`}
                >
                  {f === "realtime" ? "リアルタイム" : "日次まとめ"}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button onClick={saveNotification} disabled={saving} size="sm">
              {saving ? "保存中..." : "保存"}
            </Button>
            {message && (
              <span className={`text-xs ${message.includes("失敗") ? "text-red-600" : "text-emerald-600"}`}>
                {message}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Passkeys */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-bold text-slate-700 mb-4">パスキー管理</h2>
        {passkeys.length === 0 ? (
          <p className="text-sm text-slate-400">登録済みのパスキーはありません</p>
        ) : (
          <ul className="space-y-2 mb-4">
            {passkeys.map((pk) => (
              <li key={pk.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-3 py-2">
                <div>
                  <p className="font-medium text-slate-700">{pk.deviceName ?? "パスキー"}</p>
                  <p className="text-xs text-slate-400">
                    登録: {new Date(pk.createdAt).toLocaleDateString("ja-JP")}
                    {pk.lastUsedAt && (
                      <> · 最終使用: {new Date(pk.lastUsedAt).toLocaleDateString("ja-JP")}</>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => deletePasskey(pk.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const { startRegistration } = await import("@simplewebauthn/browser");
            const optRes = await fetch("/api/webauthn/register/options", { method: "POST" });
            if (!optRes.ok) { alert("オプション取得失敗"); return; }
            const opts = await optRes.json();
            try {
              const regResp = await startRegistration({ optionsJSON: opts });
              const verRes = await fetch("/api/webauthn/register/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(regResp),
              });
              if (verRes.ok) {
                const newPk = await verRes.json();
                setPasskeys((prev) => [...prev, newPk]);
              } else {
                alert("パスキー登録に失敗しました");
              }
            } catch {
              alert("パスキー登録がキャンセルされました");
            }
          }}
        >
          + パスキーを追加
        </Button>
      </section>
    </div>
  );
}
