import { NextResponse } from "next/server";
export function GET() { return NextResponse.json({ ok: true, mode: process.env.CCOS_MODE ?? "demo" }); }
