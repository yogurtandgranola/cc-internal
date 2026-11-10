import { route } from "@/lib/api";
import { HttpError } from "@/lib/authz";
import * as dal from "@/lib/dal";
export const GET = route(async (u, _req, ctx) => {
  const { id } = await ctx.params;
  const p = dal.getProperty(u, id!);
  if (!p) throw new HttpError(404, "Not found");
  return { property: p };
});
