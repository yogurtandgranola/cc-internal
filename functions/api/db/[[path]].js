// Tiny document store on Cloudflare KV. One KV key per collection holding {id: doc}.
// Fine for a small team and a few dozen records. Move to a real database
// (Supabase, D1) when concurrent edits or volume grow.
import { json, identify, can } from "../../_lib.js";

const MAX_BYTES = 1_000_000;

async function load(env, c) {
  return (await env.DB.get("col:" + c, "json")) || {};
}

export async function onRequest({ request, env, params }) {
  const user = identify(request, env);
  if (!user) return json({ error: "Not signed in" }, 401);

  const [collection, id] = params.path || [];
  if (!collection || !/^[a-z0-9_-]{1,40}$/.test(collection)) return json({ error: "Bad collection" }, 400);
  if (id && !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return json({ error: "Bad id" }, 400);

  const method = request.method;
  const mode = method === "GET" ? "read" : "write";
  if (!can(user, collection, mode)) return json({ error: "Forbidden" }, 403);

  const all = await load(env, collection);

  if (method === "GET") {
    return json({ docs: Object.entries(all).map(([k, v]) => ({ id: k, data: v })) });
  }

  if (method === "DELETE") {
    if (!id) return json({ error: "Missing id" }, 400);
    delete all[id];
  } else if (method === "POST" || method === "PUT") {
    const text = await request.text();
    if (text.length > MAX_BYTES) return json({ error: "Too large" }, 413);
    let body;
    try { body = JSON.parse(text); } catch (e) { return json({ error: "Bad JSON" }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Bad body" }, 400);
    const newId = method === "POST" ? "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) : id;
    if (!newId) return json({ error: "Missing id" }, 400);
    all[newId] = body;
    await env.DB.put("col:" + collection, JSON.stringify(all));
    return json({ id: newId });
  } else {
    return json({ error: "Method not allowed" }, 405);
  }

  await env.DB.put("col:" + collection, JSON.stringify(all));
  return json({ ok: true });
}
