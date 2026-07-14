import { GET as branchesGet } from "@/app/api/branches/route";

/**
 * Public re-export of the internal /api/branches handler.
 * The internal route already returns the bot-friendly shape ([{name, url}, ...]).
 */
export const GET = branchesGet;
