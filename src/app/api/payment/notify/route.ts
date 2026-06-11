import { NextRequest, NextResponse } from "next/server";
import { verifyNotifySign } from "@/lib/xddpay";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = String(value);
    });

    const { order_no, result, money, realmoney, xddpay_order } = params;

    if (!verifyNotifySign(params)) {
      return new NextResponse("sign error", { status: 200 });
    }

    if (result !== "success" || !order_no) {
      return new NextResponse("ignored", { status: 200 });
    }

    const admin = getSupabaseAdmin();

    // Update payment order
    const { data: order, error: orderError } = await admin
      .from("payment_orders")
      .select("id,user_id,status,money")
      .eq("order_no", order_no)
      .maybeSingle();

    if (orderError || !order) {
      return new NextResponse("order not found", { status: 200 });
    }

    if (order.status === "paid") {
      return new NextResponse("success", { status: 200 });
    }

    // Update order status
    await admin
      .from("payment_orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        xddpay_order: xddpay_order || null,
        real_money: parseFloat(realmoney || money || "0"),
      })
      .eq("id", order.id);

    // Activate VIP: set 30 days from now
    const vipExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await admin
      .from("user_entitlements")
      .upsert({
        user_id: order.user_id,
        vip_expires_at: vipExpiresAt,
      }, { onConflict: "user_id" })
      .select()
      .single();

    return new NextResponse("success", { status: 200 });
  } catch (err) {
    console.error("Payment notify error:", err);
    return new NextResponse("server error", { status: 500 });
  }
}
