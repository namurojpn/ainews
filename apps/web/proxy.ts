import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|api/webauthn).*)",
  ],
};

const PUBLIC_PATHS = ["/", "/login", "/register"];
const ADMIN_PREFIX = "/admin";
export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl;
  const session = (req as { auth?: { user?: { role?: string; subscriptionStatus?: string } } }).auth;

  // 公開パスはそのまま通す
  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 未認証
  if (!session?.user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const { role, subscriptionStatus } = session.user;

  // 管理者ページへのアクセス
  if (pathname.startsWith(ADMIN_PREFIX) && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/news", req.url));
  }

  // サブスクリプション確認（管理者は除外）
  const requiresSubscription = /^\/(news|archive)/.test(pathname);
  const validSubscription = ["trialing", "active"].includes(
    subscriptionStatus ?? ""
  );
  if (requiresSubscription && !validSubscription && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/settings", req.url));
  }

  return NextResponse.next();
});
