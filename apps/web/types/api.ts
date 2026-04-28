import { z } from "zod";

// ---- News ----

export const DailyNewsArticleSchema = z.object({
  id: z.string().uuid(),
  aiName: z.string(),
  title: z.string(),
  summary: z.string(),
  ceoInsight: z.string(),
  sourceUrls: z.array(z.string()),
  publishedAt: z.string(),
});

export const DailyNewsResponseSchema = z.object({
  date: z.string(),
  articles: z.array(DailyNewsArticleSchema),
});

export const MonthlyReportSchema = z.object({
  id: z.string().uuid(),
  yearMonth: z.string(),
  summaryText: z.string(),
  keyEvents: z.array(z.string()),
  ceoInsight: z.string(),
  publishedAt: z.string(),
});

export const ArchiveQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  aiFilter: z.string().optional(),
  keyword: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  type: z.enum(["daily", "monthly_summary", "all"]).default("all"),
});

// ---- Auth / User ----

export const RegisterSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z
    .string()
    .min(8, "パスワードは8文字以上で入力してください")
    .regex(/[a-zA-Z]/, "英字を含めてください")
    .regex(/[0-9]/, "数字を含めてください"),
  displayName: z.string().min(1, "お名前を入力してください").max(50),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ---- Notification ----

export const NotificationSettingSchema = z.object({
  emailEnabled: z.boolean(),
  frequency: z.enum(["realtime", "daily_digest"]),
});

// ---- Admin ----

export const UpdateUserSchema = z.object({
  status: z.enum(["active", "suspended"]).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  subscriptionStatus: z
    .enum(["active", "trialing", "canceled", "suspended"])
    .optional(),
});

export const AdminLogQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  userId: z.string().optional(),
  actionType: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  format: z.enum(["json", "csv"]).default("json"),
});

// ---- API Error ----

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: unknown
): Response {
  return Response.json(
    { error: { code, message, details } } satisfies ApiErrorResponse,
    { status }
  );
}

// ---- Types ----
export type DailyNewsArticle = z.infer<typeof DailyNewsArticleSchema>;
export type DailyNewsResponse = z.infer<typeof DailyNewsResponseSchema>;
export type MonthlyReport = z.infer<typeof MonthlyReportSchema>;
export type ArchiveQuery = z.infer<typeof ArchiveQuerySchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type NotificationSetting = z.infer<typeof NotificationSettingSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
export type AdminLogQuery = z.infer<typeof AdminLogQuerySchema>;
