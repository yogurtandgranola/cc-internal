import { NextResponse } from "next/server";
import { defaultDb, liveAuthConfigured } from "@/lib/live-auth";

// For uptime monitors. Says only whether the site and its database answer. No data, no names, no counts.
export const dynamic = "force-dynamic";
export async function GET() {
  if (!liveAuthConfigured()) return NextResponse.json({ ok: true, database: "not_in_use" });
  try {
    await defaultDb().query("select 1");
    return NextResponse.json({ ok: true, database: "ok" });
  } catch {
    return NextResponse.json({ ok: false, database: "down" }, { status: 503 });
  }
}
