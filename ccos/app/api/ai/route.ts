import { route } from "@/lib/api";
import { ask } from "@/lib/ai";
import { getStore } from "@/lib/store";
export const POST = route(async (u, req) => {
  const body = (await req.json().catch(() => ({}))) as { question?: string };
  return ask(getStore(), u, String(body.question ?? ""));
});
