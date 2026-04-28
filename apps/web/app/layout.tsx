import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const noto = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "AI Insight Daily", template: "%s | AI Insight Daily" },
  description:
    "ChatGPT・Claude・GeminiなどのAI最新ニュースとCEO向け経営示唆をワンスクリーンで",
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? "https://ainewsdaily.app"),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={`${noto.variable} h-full`}>
      <body className="min-h-full bg-slate-50 font-[family-name:var(--font-noto)] antialiased">
        {children}
      </body>
    </html>
  );
}
