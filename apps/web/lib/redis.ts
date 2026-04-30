import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL ?? "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
});

export const CACHE_TTL = {
  dailyNews: 600,       // 10分
  monthlyReport: 3600,  // 1時間
  session: 86400,       // 24時間
  webauthnChallenge: 300, // 5分
} as const;

export function dailyNewsCacheKey(date: string) {
  return `news:daily:${date}`;
}

export function monthlyReportCacheKey(yearMonth: string) {
  return `news:monthly:${yearMonth}`;
}

export const NOTIFICATION_QUEUE_KEY = "notification:pending";
