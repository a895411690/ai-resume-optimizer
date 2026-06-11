import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { createPaymentOrder, generateOrderNo, type PayType } from "@/lib/xddpay";

export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req);
  if ("response" in auth) return auth.response;

  try {
    const body = await req.json();
    const payType: PayType = body.payType === 44 ? 44 : 43;
    const money = Number(body.money) || 29.9;

    if (money < 0.01 || money > 9999) {
      return NextResponse.json({ error: "金额无效" }, { status: 400 });
    }

    const orderNo = generateOrderNo();
    const result = await createPaymentOrder({
      userId: auth.user.id,
      orderNo,
      payType,
      money,
      subject: `VIP会员-${money}元`,
    });

    return NextResponse.json({ orderNo, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "创建订单失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
