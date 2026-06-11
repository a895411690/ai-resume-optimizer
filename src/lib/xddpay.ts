import { createHash } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const XDDPAY_GATEWAY = "https://gateway.xddpay.com";
const XDDPAY_QUERY_URL = "https://gateway.xddpay.com/query.ashx";

function getAppId() {
  return process.env.XDDPAY_APP_ID || "";
}
function getSecret() {
  return process.env.XDDPAY_SECRET || "";
}

// Build sign string: order params in documented order, then append secret
function buildSignString(params: [string, string | number][]): string {
  return params
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${v}`)
    .join("&") + getSecret();
}

function md5Sign(str: string): string {
  return createHash("md5").update(str, "utf-8").digest("hex").toUpperCase();
}

// Payment sign: MD5(order_no=xxx&subject=xxx&pay_type=xxx&money=xxx&app_id=xxx&extra=xxx&secret)
function signPayment(params: {
  order_no: string;
  subject: string;
  pay_type: number;
  money: string;
  app_id: string;
  extra?: string;
}): string {
  const ordered: [string, string | number][] = [
    ["order_no", params.order_no],
    ["subject", params.subject],
    ["pay_type", params.pay_type],
    ["money", params.money],
    ["app_id", params.app_id],
  ];
  if (params.extra) ordered.push(["extra", params.extra]);
  return md5Sign(buildSignString(ordered));
}

// Notify sign: MD5(order_no=xxx&subject=xxx&pay_type=xxx&money=xxx&realmoney=xxx&result=xxx&xddpay_order=xxx&app_id=xxx&extra=xxx&secret)
function signNotify(params: Record<string, string>): string {
  const ordered: [string, string | number][] = [
    ["order_no", params.order_no || ""],
    ["subject", params.subject || ""],
    ["pay_type", params.pay_type || ""],
    ["money", params.money || ""],
    ["realmoney", params.realmoney || ""],
    ["result", params.result || ""],
    ["xddpay_order", params.xddpay_order || ""],
    ["app_id", params.app_id || ""],
  ];
  if (params.extra) ordered.push(["extra", params.extra]);
  return md5Sign(buildSignString(ordered));
}

// Query sign: MD5(app_id=xxx&order_no=xxx&secret)
function signQuery(params: { app_id: string; order_no: string }): string {
  const ordered: [string, string | number][] = [
    ["app_id", params.app_id],
    ["order_no", params.order_no],
  ];
  return md5Sign(buildSignString(ordered));
}

export type PayType = 43 | 44; // 43=alipay, 44=wechat

export interface CreatePaymentResult {
  payUrl: string;
  qrImg?: string;
  qrCode?: string;
  xddpayOrder?: string;
  realMoney?: string;
}

export async function createPaymentOrder(params: {
  userId: string;
  orderNo: string;
  payType: PayType;
  money: number;
  subject: string;
}) {
  const { userId, orderNo, payType, money, subject } = params;

  // Store order in Supabase first
  const admin = getSupabaseAdmin();
  const { error: dbError } = await admin.from("payment_orders").insert({
    order_no: orderNo,
    user_id: userId,
    pay_type: payType,
    money,
    subject,
    status: "pending",
  });
  if (dbError) throw new Error(dbError.message || "订单创建失败");

  const appId = getAppId();
  const signParams = {
    order_no: orderNo,
    subject,
    pay_type: payType,
    money: money.toFixed(2),
    app_id: appId,
  };

  const paySign = signPayment(signParams);

  // Use JSON format to get QR code directly
  const formData = new URLSearchParams();
  formData.append("order_no", signParams.order_no);
  formData.append("subject", signParams.subject);
  formData.append("pay_type", String(signParams.pay_type));
  formData.append("money", signParams.money);
  formData.append("app_id", signParams.app_id);
  formData.append("sign", paySign);

  const response = await fetch(`${XDDPAY_GATEWAY}?format=json`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });
  const text = await response.text();

  let data: Record<string, string>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("支付接口返回格式异常");
  }

  return {
    payUrl: `${XDDPAY_GATEWAY}?format=json`,
    qrImg: data.qr_img || "",
    qrCode: data.qr || "",
    xddpayOrder: data.xddpay_order || "",
    realMoney: data.realmoney || String(money),
  } satisfies CreatePaymentResult;
}

export function verifyNotifySign(params: Record<string, string>): boolean {
  const receivedSign = (params.sign || "").toUpperCase();
  if (!receivedSign) return false;
  const expected = signNotify(params);
  return receivedSign === expected;
}

export async function queryOrderStatus(orderNo: string): Promise<string> {
  const appId = getAppId();
  const querySign = signQuery({ app_id: appId, order_no: orderNo });
  const url = `${XDDPAY_QUERY_URL}?app_id=${appId}&order_no=${orderNo}&sign=${querySign}`;
  const response = await fetch(url);
  const text = await response.text();

  let data: { status?: string };
  try {
    data = JSON.parse(text);
  } catch {
    return "unknown";
  }
  return data.status || "unknown";
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
