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

    const expectedMoney = Number.parseFloat(realmoney || money || "0");
    if (!Number.isFinite(expectedMoney) || expectedMoney <= 0) {
      return new NextResponse("money error", { status: 200 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc("finalize_payment_order", {
      order_no_input: order_no,
      expected_money: expectedMoney,
      xddpay_order_input: xddpay_order || "",
    });

    if (error) throw new Error(error.message || "payment finalization failed");
    if (data?.status === "money_mismatch") return new NextResponse("money mismatch", { status: 200 });
    if (data?.status === "not_found") return new NextResponse("order not found", { status: 200 });

    return new NextResponse("success", { status: 200 });
  } catch (err) {
    console.error("Payment notify error:", err);
    return new NextResponse("server error", { status: 500 });
  }
}
