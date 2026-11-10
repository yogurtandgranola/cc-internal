import { route } from "@/lib/api";
import * as dal from "@/lib/dal";
export const GET = route(async (u) => ({ properties: dal.listProperties(u) }));
