import { NextRequest, NextResponse } from "next/server";
import { verifyNotifySign } from "@/lib/xddpay";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => { params[key] = String(value); });

    const { order_no, result, money, realmoney, xddpay_order } = params;

    if (!verifyNotifySign(params)) return new NextResponse("sign error", { status: 200 });
    if (result !== "success" || !order_no) return new NextResponse("ignored", { status: 200 });

    const admin = getSupabaseAdmin();
    const { data: order, error: orderError } = await admin
      .from("payment_orders")
      .select("id,user_id,status,product_code,credits_granted,lifetime_vip_granted")
      .eq("order_no", order_no)
      .maybeSingle();

    if (orderError || !order) return new NextResponse("order not found", { status: 200 });
    if (order.status === "paid") return new NextResponse("success", { status: 200 });

    await admin.from("payment_orders").update({
      status: "paid", paid_at: new Date().toISOString(),
      xddpay_order: xddpay_order || null, real_money: parseFloat(realmoney || money || "0"),
    }).eq("id", order.id);

    // Grant entitlements based on product
    if (order.lifetime_vip_granted) {
      await admin.from("user_entitlements").upsert({
        user_id: order.user_id, lifetime_vip: true,
      }, { onConflict: "user_id" });
    } else if (order.credits_granted > 0) {
      // Increment credits atomically
      const { data: existing } = await admin
        .from("user_entitlements")
        .select("optimization_credits")
        .eq("user_id", order.user_id)
        .maybeSingle();
      const newCredits = (existing?.optimization_credits || 0) + order.credits_granted;
      await admin.from("user_entitlements").upsert({
        user_id: order.user_id, optimization_credits: newCredits,
      }, { onConflict: "user_id" });
    }

    return new NextResponse("success", { status: 200 });
  } catch (err) {
    console.error("Payment notify error:", err);
    return new NextResponse("server error", { status: 500 });
  }
}
