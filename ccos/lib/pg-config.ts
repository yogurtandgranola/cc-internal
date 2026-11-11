// Connection settings for Supabase Postgres. TLS stays on with full certificate checking.
// The server certificate is checked against Supabase's published root CA plus Node's normal public roots.
import tls from "node:tls";
import { SUPABASE_ROOT_CA } from "./supabase-ca.ts";

export function pgConfig(url: string): { connectionString: string; ssl?: { ca: string[]; rejectUnauthorized: true } } {
  const u = new URL(url);
  const local = ["localhost", "127.0.0.1", "::1", ""].includes(u.hostname) || u.searchParams.has("host");
  // The driver would otherwise read sslmode from the URL and ignore our certificate list.
  u.searchParams.delete("sslmode");
  u.searchParams.delete("supa");
  if (local) return { connectionString: u.toString() };
  return { connectionString: u.toString(), ssl: { ca: [SUPABASE_ROOT_CA, ...tls.rootCertificates], rejectUnauthorized: true } };
}
