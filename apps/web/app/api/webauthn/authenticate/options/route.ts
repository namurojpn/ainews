import { createAuthenticationOptions } from "@/lib/webauthn";
import { z } from "zod";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = z.string().email().optional().safeParse(body?.email).data;
  const options = await createAuthenticationOptions(email);
  return Response.json(options);
}
