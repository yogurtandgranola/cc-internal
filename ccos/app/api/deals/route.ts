import { route } from "@/lib/api";
import { HttpError } from "@/lib/authz";
import * as dal from "@/lib/dal";
export const GET = route(async (u) => {
  if (!dal.visibleDepartments(u).includes("acquisitions")) throw new HttpError(403, "Forbidden");
  return { deals: dal.listDeals(u) };
});
