import { verifyAuthentication } from "@/lib/webauthn";
import { apiError } from "@/types/api";
import { signIn } from "@/lib/auth";

export async function POST(req: Request) {
  const { response } = await req.json();
  const user = await verifyAuthentication(response);

  // NextAuth Credentials でサインインする代わりにセッション Cookie を返す
  // フロントエンドは受け取った後 signIn("credentials") を呼ぶ
  return Response.json({
    userId: user.id,
    email: user.email,
    verified: true,
  });
}
