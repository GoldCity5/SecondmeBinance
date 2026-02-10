import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/secondme";

export async function GET() {
  const state = crypto.randomUUID();
  const url = getAuthorizationUrl(state);
  return NextResponse.redirect(url);
}
