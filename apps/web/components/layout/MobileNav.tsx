"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/news", icon: "📰", label: "ニュース" },
  { href: "/news/monthly", icon: "📅", label: "月別" },
  { href: "/archive", icon: "🔍", label: "検索" },
  { href: "/settings", icon: "👤", label: "設定" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex z-40 safe-area-pb">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs transition-colors ${
            pathname.startsWith(t.href) ? "text-blue-700" : "text-slate-400"
          }`}
        >
          <span className="text-lg leading-none">{t.icon}</span>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
