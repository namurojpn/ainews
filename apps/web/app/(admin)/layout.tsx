import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/news");

  return (
    <div className="min-h-dvh flex flex-col bg-slate-50">
      <AppHeader userName={session.user.name} isAdmin={true} />
      <div className="flex flex-1">
        <aside className="hidden md:flex flex-col w-48 shrink-0 bg-white border-r border-slate-200 pt-4 gap-1 px-2">
          <p className="text-xs text-slate-400 font-semibold px-3 mb-2">管理メニュー</p>
          {[
            { href: "/admin/dashboard", label: "ダッシュボード" },
            { href: "/admin/users", label: "ユーザー管理" },
            { href: "/admin/logs", label: "アクセスログ" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {label}
            </Link>
          ))}
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
