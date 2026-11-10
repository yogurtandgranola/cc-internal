import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getStore } from "./store";
import { mockAuthAllowed, userFromToken } from "./auth";
import { COOKIE } from "./session";
import { HttpError, type SessionUser } from "./authz";

// Wraps a route handler. 401 when not signed in, 403/404 from HttpError. Error bodies never carry data.
export function route(handler: (user: SessionUser, req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response | object>) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      const token = (await cookies()).get(COOKIE)?.value;
      const user = mockAuthAllowed() ? userFromToken(getStore(), token) : null;
      if (!user) throw new HttpError(401, "Not signed in");
      const out = await handler(user, req, ctx);
      return out instanceof Response ? out : NextResponse.json(out, { headers: { "Cache-Control": "private, no-store" } });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status, headers: { "Cache-Control": "private, no-store" } });
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  };
}
