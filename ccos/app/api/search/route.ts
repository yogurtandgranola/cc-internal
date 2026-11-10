import { route } from "@/lib/api";
import * as dal from "@/lib/dal";
export const GET = route(async (u, req) => ({ hits: dal.search(u, new URL(req.url).searchParams.get("q") ?? "") }));
