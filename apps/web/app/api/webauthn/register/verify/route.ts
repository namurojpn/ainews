import { auth } from "@/lib/auth";
import { verifyRegistration } from "@/lib/webauthn";
import { apiError } from "@/types/api";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "ログインが必要です", 401);

  const { response, deviceName } = await req.json();
  const passkey = await verifyRegistration(session.user.id, response, deviceName);
  return Response.json({ id: passkey.id, deviceName: passkey.deviceName });
}
