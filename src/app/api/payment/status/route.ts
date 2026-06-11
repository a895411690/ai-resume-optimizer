import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req);
  if ("response" in auth) return auth.response;

  const orderNo = req.nextUrl.searchParams.get("order_no");
  if (!orderNo) {
    return NextResponse.json({ error: "缺少订单号" }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("payment_orders")
      .select("status,paid_at,money")
      .eq("order_no", orderNo)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    }

    return NextResponse.json({ status: data.status, paidAt: data.paid_at, money: data.money });
  } catch (err) {
    const message = err instanceof Error ? err.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
