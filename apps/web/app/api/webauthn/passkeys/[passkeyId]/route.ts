import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ passkeyId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { passkeyId } = await params;
  const passkey = await prisma.passkey.findFirst({
    where: { id: passkeyId, userId: session.user.id },
  });

  if (!passkey) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.passkey.delete({ where: { id: passkeyId } });
  return NextResponse.json({ deleted: true });
}
