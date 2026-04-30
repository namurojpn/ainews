"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Props {
  userName?: string | null;
  isAdmin?: boolean;
}

const NAV = [
  { href: "/news", label: "ニュース" },
  { href: "/news/monthly", label: "月別サマリ" },
  { href: "/archive", label: "アーカイブ" },
];

export function AppHeader({ userName, isAdmin }: Props) {
  const pathname = usePathname();
  const initials = userName?.slice(0, 2) ?? "??";

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
        <Link href="/news" className="flex items-center gap-2 shrink-0">
          <span className="w-7 h-7 bg-blue-700 rounded-lg flex items-center justify-center text-white text-xs font-bold">
            AI
          </span>
          <span className="font-bold text-slate-800 text-sm hidden sm:block">
            AI Insight Daily
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 flex-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname.startsWith(n.href)
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {n.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin/dashboard"
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname.startsWith("/admin")
                  ? "bg-slate-800 text-white font-semibold"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              管理者
            </Link>
          )}
        </nav>

        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem render={<Link href="/settings" />}>
                設定・マイページ
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem render={<Link href="/admin/dashboard" />}>
                  管理者ダッシュボード
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                ログアウト
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
