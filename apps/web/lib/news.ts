import { z } from "zod";

export const ArticleSchema = z.object({
  aiName: z.string(),
  title: z.string(),
  summary: z.string(),
  ceoInsight: z.string(),
  sourceUrls: z.array(z.string()).default([]),
});

export const ResponseSchema = z.object({
  articles: z.array(ArticleSchema),
});

export type ArticleInput = z.infer<typeof ArticleSchema>;

export function getTodayJST(): Date {
  const now = new Date();
  const jst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  jst.setHours(0, 0, 0, 0);
  return jst;
}
