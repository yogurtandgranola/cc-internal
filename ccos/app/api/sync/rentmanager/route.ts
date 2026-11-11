import { NextResponse } from "next/server";
import { defaultDb } from "@/lib/live-auth";
import { rentManagerConfigured, syncOccupancy } from "@/lib/connectors/rentmanager-live";

// Called daily by Vercel Cron (sends CRON_SECRET as a bearer token). Read-only against Rent Manager.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  if (!rentManagerConfigured()) return NextResponse.json({ error: "Rent Manager is not configured" }, { status: 503 });
  try { return NextResponse.json(await syncOccupancy(defaultDb())); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 502 }); }
}
