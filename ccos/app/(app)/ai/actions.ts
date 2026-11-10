"use server";
import { ask, type AiAnswer } from "@/lib/ai";
import { getStore } from "@/lib/store";
import { getCurrentUser } from "@/lib/session";
import { HttpError } from "@/lib/authz";

export type ChatState = { answer: AiAnswer | null; question?: string };

export async function askAction(_prev: ChatState, form: FormData): Promise<ChatState> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Not signed in");
  const question = String(form.get("question") ?? "");
  const provider = String(form.get("provider") ?? "") || undefined;
  try {
    return { answer: await ask(getStore(), user, question, provider), question };
  } catch (e) {
    const msg = e instanceof HttpError ? e.message : "Something went wrong";
    return { answer: { status: "error", text: msg, provider: "n/a", citations: [], demo: process.env.CCOS_MODE !== "live" }, question };
  }
}
