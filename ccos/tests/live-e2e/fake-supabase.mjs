// A tiny stand-in for Supabase Auth, for the live browser test only. Passwords live in memory.
// It also writes new logins into auth.users, like the real service does.
import http from "node:http";
import crypto from "node:crypto";
import pg from "pg";
import { pgConfig } from "../../lib/pg-config.ts";

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54399);
const SERVICE_KEY = "service-key";
const users = new Map(); // email -> { id, password }
const db = new pg.Pool(pgConfig(process.env.LIVE_E2E_DB_URL));

async function addUser(email, password) {
  const id = crypto.randomUUID();
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
  users.set(email, { id, password });
  return id;
}
await addUser("owner@cornell.test", "owner-password-123");

const read = (req) => new Promise((res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => res(b ? JSON.parse(b) : {})); });
const send = (res, status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const body = await read(req);
    if (req.method === "POST" && url.pathname === "/auth/v1/token") {
      const u = users.get(String(body.email).toLowerCase());
      if (!u || u.password !== body.password) return send(res, 400, { error: "invalid_grant" });
      return send(res, 200, { access_token: "t", user: { id: u.id, email: body.email } });
    }
    if (req.headers.apikey !== SERVICE_KEY) return send(res, 401, { error: "no" });
    if (req.method === "POST" && url.pathname === "/auth/v1/admin/users") {
      const email = String(body.email).toLowerCase();
      if (users.has(email)) return send(res, 422, { error: "email_exists" });
      return send(res, 200, { id: await addUser(email, body.password) });
    }
    const m = url.pathname.match(/^\/auth\/v1\/admin\/users\/([^/]+)$/);
    if (req.method === "PUT" && m) {
      for (const [e, v] of users) if (v.id === m[1]) users.set(e, { id: v.id, password: body.password });
      return send(res, 200, {});
    }
    send(res, 404, {});
  } catch (e) { console.error(e); send(res, 500, {}); }
}).listen(PORT, () => console.log("fake supabase on " + PORT));
