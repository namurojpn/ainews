import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

type ActionType =
  | "view_news"
  | "view_archive"
  | "view_monthly"
  | "login"
  | "logout"
  | "register"
  | "search"
  | "admin_action";

export async function logAccess(params: {
  userId?: string;
  actionType: ActionType;
  articleId?: string;
  req?: Request;
}): Promise<void> {
  void (async () => {
    try {
      const headersList = await headers();
      const ip =
        params.req?.headers.get("x-forwarded-for") ??
        headersList.get("x-forwarded-for") ??
        undefined;
      const ua =
        params.req?.headers.get("user-agent") ??
        headersList.get("user-agent") ??
        undefined;

      await prisma.accessLog.create({
        data: {
          userId: params.userId,
          actionType: params.actionType,
          articleId: params.articleId,
          ipAddress: ip?.split(",")[0].trim(),
          userAgent: ua,
          accessedAt: new Date(),
        },
      });
    } catch {
      // ログ書き込み失敗はサイレントに無視
    }
  })();
}
