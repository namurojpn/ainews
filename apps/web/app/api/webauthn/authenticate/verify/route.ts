import { randomUUID } from "crypto";
import { verifyAuthentication } from "@/lib/webauthn";
import { redis } from "@/lib/redis";

export async function POST(req: Request) {
  const { response } = await req.json();
  const user = await verifyAuthentication(response);

  // 短命の one-time トークンを Redis に保存（60秒）
  // クライアントはこのトークンで credentials signIn を呼ぶ
  const token = randomUUID();
  await redis.set(`passkey:token:${token}`, user.email, { ex: 60 });

  return Response.json({ token, verified: true });
}
