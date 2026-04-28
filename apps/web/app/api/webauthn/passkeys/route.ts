import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const passkeys = await prisma.passkey.findMany({
    where: { userId: session.user.id },
    select: { id: true, deviceName: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ passkeys });
}
