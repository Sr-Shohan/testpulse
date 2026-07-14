import { NextResponse } from "next/server";

const STARTED_AT = Date.now();

export async function GET() {
  return NextResponse.json({
    status: "ok",
    uptimeMs: Date.now() - STARTED_AT,
    version: process.env.npm_package_version ?? "0.1.0",
    api: "v1",
  });
}
