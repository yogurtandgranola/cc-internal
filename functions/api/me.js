import { json, identify } from "../_lib.js";

export async function onRequestGet({ request, env }) {
  const user = identify(request, env);
  if (!user) return json({ error: "Not signed in" }, 401);
  return json(user);
}
