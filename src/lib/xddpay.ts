import { createHash } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const XDDPAY_GATEWAY = "https://gateway.xddpay.com";
const XDDPAY_QUERY_URL = "https://gateway.xddpay.com/query.ashx";

export type PayType = 43 | 44; // 43=alipay, 44=wechat

export const PRODUCTS = {
  credit_10: { code: "credit_10", name: "次卡10次", money: 9.90, credits: 10, lifetimeVip: false },
  lifetime_vip: { code: "lifetime_vip", name: "永久VIP", money: 99.00, credits: 0, lifetimeVip: true },
} as const;

export type ProductCode = keyof typeof PRODUCTS;

function getAppId() { return process.env.XDDPAY_APP_ID || ""; }
function getSecret() { return process.env.XDDPAY_SECRET || ""; }

function buildSignString(params: [string, string | number][]): string {
  return params
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${v}`)
    .join("&") + getSecret();
}

function md5Sign(str: string): string {
  return createHash("md5").update(str, "utf-8").digest("hex").toUpperCase();
}

function signPayment(params: {
  order_no: string; subject: string; pay_type: number; money: string; app_id: string; extra?: string;
}): string {
  const ordered: [string, string | number][] = [
    ["order_no", params.order_no], ["subject", params.subject],
    ["pay_type", params.pay_type], ["money", params.money], ["app_id", params.app_id],
  ];
  if (params.extra) ordered.push(["extra", params.extra]);
  return md5Sign(buildSignString(ordered));
}

function signNotify(params: Record<string, string>): string {
  const ordered: [string, string | number][] = [
    ["order_no", params.order_no || ""], ["subject", params.subject || ""],
    ["pay_type", params.pay_type || ""], ["money", params.money || ""],
    ["realmoney", params.realmoney || ""], ["result", params.result || ""],
    ["xddpay_order", params.xddpay_order || ""], ["app_id", params.app_id || ""],
  ];
  if (params.extra) ordered.push(["extra", params.extra]);
  return md5Sign(buildSignString(ordered));
}

function signQuery(params: { app_id: string; order_no: string }): string {
  return md5Sign(buildSignString([["app_id", params.app_id], ["order_no", params.order_no]]));
}

export interface CreatePaymentResult {
  payUrl: string;
  qrImg?: string;
  qrCode?: string;
  xddpayOrder?: string;
  realMoney?: string;
}

export async function createPaymentOrder(params: {
  userId: string; orderNo: string; payType: PayType; product: typeof PRODUCTS[ProductCode];
}) {
  const { userId, orderNo, payType, product } = params;

  const admin = getSupabaseAdmin();
  const { error: dbError } = await admin.from("payment_orders").insert({
    order_no: orderNo, user_id: userId, pay_type: payType,
    money: product.money, subject: product.name,
    product_code: product.code, product_name: product.name,
    credits_granted: product.credits, lifetime_vip_granted: product.lifetimeVip,
    status: "pending",
  });
  if (dbError) throw new Error(dbError.message || "订单创建失败");

  const appId = getAppId();
  const paySign = signPayment({
    order_no: orderNo, subject: product.name,
    pay_type: payType, money: product.money.toFixed(2), app_id: appId, extra: product.code,
  });

  const formData = new URLSearchParams();
  formData.append("order_no", orderNo);
  formData.append("subject", product.name);
  formData.append("pay_type", String(payType));
  formData.append("money", product.money.toFixed(2));
  formData.append("app_id", appId);
  formData.append("extra", product.code);
  formData.append("sign", paySign);

  const response = await fetch(`${XDDPAY_GATEWAY}?format=json`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });
  const text = await response.text();
  let data: Record<string, string>;
  try { data = JSON.parse(text); } catch { throw new Error("支付接口返回格式异常: " + text.slice(0, 200)); }

  return {
    payUrl: `${XDDPAY_GATEWAY}?format=json`,
    qrImg: data.qr_img || "",
    qrCode: data.qr || "",
    xddpayOrder: data.xddpay_order || "",
    realMoney: data.realmoney || String(product.money),
  } satisfies CreatePaymentResult;
}

export function verifyNotifySign(params: Record<string, string>): boolean {
  const receivedSign = (params.sign || "").toUpperCase();
  if (!receivedSign) return false;
  return receivedSign === signNotify(params);
}

export function generateOrderNo(): string {
  const now = new Date();
  const ts = now.getFullYear().toString()
    + (now.getMonth() + 1).toString().padStart(2, "0")
    + now.getDate().toString().padStart(2, "0")
    + now.getHours().toString().padStart(2, "0")
    + now.getMinutes().toString().padStart(2, "0")
    + now.getSeconds().toString().padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `VIP${ts}${rand}`;
}
