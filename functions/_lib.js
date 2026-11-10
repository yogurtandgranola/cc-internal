// Shared helpers for Pages Functions.
// Auth: Cloudflare Access sets Cf-Access-Authenticated-User-Email after login.
// Roles: ROLES env secret, JSON like {"loren@example.com":["ops"],"leo@example.com":["admin"]}.

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export function identify(request, env) {
  let email = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").toLowerCase();
  if (!email && env.DEV_EMAIL) email = env.DEV_EMAIL.toLowerCase(); // local wrangler dev only
  if (!email) return null;
  let map = {};
  try { map = JSON.parse(env.ROLES || "{}"); } catch (e) {}
  const lower = {};
  for (const k of Object.keys(map)) lower[k.toLowerCase()] = map[k];
  return { email, roles: lower[email] || [] };
}

// Which roles may read and write each collection.
export const POLICY = {
  parks: { read: ["admin", "ops", "deals", "ir"], write: ["admin", "ops"] },
};

export function can(user, collection, mode) {
  const p = POLICY[collection];
  if (!p || !user) return false;
  return user.roles.some((r) => p[mode].includes(r));
}
