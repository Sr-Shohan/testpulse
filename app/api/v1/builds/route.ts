import { GET as buildsGet } from "@/app/api/builds/route";

/** Public re-export of the internal /api/builds handler. */
export const GET = buildsGet;
