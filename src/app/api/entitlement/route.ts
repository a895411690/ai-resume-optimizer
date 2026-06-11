import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { getEntitlementSummary } from "@/lib/ai-access-control";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req);
    if ("response" in auth) return auth.response;

    return NextResponse.json(await getEntitlementSummary(auth.user.id));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "权益状态加载失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
