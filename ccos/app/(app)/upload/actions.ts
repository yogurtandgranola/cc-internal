"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { can, HttpError } from "@/lib/authz";
import { defaultDb } from "@/lib/live-auth";
import { parsePacket, pdfPages, type PacketRow } from "@/lib/uploads/rm-packet";
import { resolveRows, savePacket, type Resolved } from "@/lib/uploads/save";

export type UploadState = { error?: string; ok?: string; fileName?: string; rows?: Resolved[]; problems?: string[] } | undefined;
const MAX = 5 * 1024 * 1024;

async function actor() {
  const u = await getCurrentUser();
  if (!u || !u.live || !can(u, "upload_data")) throw new HttpError(403, "You do not have permission to upload data.");
  return u;
}

export async function previewAction(_prev: UploadState, f: FormData): Promise<UploadState> {
  try {
    await actor();
    const file = f.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF file first." };
    if (file.size > MAX) return { error: "That file is too large. The limit is 5 MB." };
    if (!file.name.toLowerCase().endsWith(".pdf")) return { error: "This upload reads the Rent Manager weekly packet PDF." };
    const { rows, problems } = parsePacket(await pdfPages(new Uint8Array(await file.arrayBuffer())));
    if (rows.length === 0) return { error: problems[0] ?? "No property totals were found in that file." };
    return { fileName: file.name, rows: await resolveRows(defaultDb(), rows), problems };
  } catch (e) {
    if (e instanceof HttpError) return { error: e.message };
    console.error("upload preview failed", e instanceof Error ? e.message : e);
    return { error: "That file could not be read. Nothing was saved." };
  }
}

export async function saveAction(_prev: UploadState, f: FormData): Promise<UploadState> {
  try {
    const user = await actor();
    let rows: PacketRow[];
    try { rows = JSON.parse(String(f.get("payload") ?? "[]")) as PacketRow[]; } catch { return { error: "Something went wrong. Read the file again." }; }
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 50) return { error: "Nothing to save. Read the file again." };
    const r = await savePacket(defaultDb(), user, String(f.get("fileName") ?? "upload.pdf"), rows);
    revalidatePath("/operations");
    revalidatePath("/");
    if (r.saved.length === 0) return { error: `Nothing was saved. Not matched or not allowed: ${r.skipped.join(", ")}.` };
    return { ok: `Saved ${r.saved.join(", ")}.${r.skipped.length ? ` Skipped (not matched or not allowed): ${r.skipped.join(", ")}.` : ""}` };
  } catch (e) {
    if (e instanceof HttpError) return { error: e.message };
    console.error("upload save failed", e instanceof Error ? e.message : e);
    return { error: "Something went wrong. Nothing was saved. Try again in a minute." };
  }
}
