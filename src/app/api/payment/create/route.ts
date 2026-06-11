import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { createPaymentOrder, generateOrderNo, PRODUCTS, type PayType, type ProductCode } from "@/lib/xddpay";

export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req);
  if ("response" in auth) return auth.response;

  try {
    const body = await req.json();
    const productCode: string = body.productCode || "";
    const product = PRODUCTS[productCode as ProductCode];
    if (!product) {
      return NextResponse.json({ error: "无效的商品类型" }, { status: 400 });
    }

    const payType: PayType = body.payType === 44 ? 44 : 43;
    const orderNo = generateOrderNo();
    const result = await createPaymentOrder({
      userId: auth.user.id, orderNo, payType, product,
    });

    return NextResponse.json({ orderNo, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "创建订单失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
