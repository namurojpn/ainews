import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const res = await fetch(
    `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/internal/generate-news`,
    {
      method: "POST",
      headers: { "x-cron-secret": process.env.CRON_SECRET! },
    }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
