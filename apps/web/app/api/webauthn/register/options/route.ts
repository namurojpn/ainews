import { auth } from "@/lib/auth";
import { createRegistrationOptions } from "@/lib/webauthn";
import { apiError } from "@/types/api";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "ログインが必要です", 401);

  const options = await createRegistrationOptions(session.user.id);
  return Response.json(options);
}
