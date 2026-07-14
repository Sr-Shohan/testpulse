import { NextRequest } from "next/server";
import { GET as flakyGet } from "@/app/api/flaky/route";

const DEFAULT_TOP = 10;

/**
 * Public flaky endpoint — defaults to `top=10` when omitted so responses
 * stay compact. Override with `top=5`, `top=20`, etc. (max 50).
 *
 * The internal `/api/flaky` route (dashboard UI) has no default limit.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const top = url.searchParams.get("top");

  if (top == null || top.trim() === "") {
    url.searchParams.set("top", String(DEFAULT_TOP));
  }

  return flakyGet(new NextRequest(url, request));
}
