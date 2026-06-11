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

// MD5 signature: join key=value pairs with &, append secret, then MD5 uppercase
function sign(params: Record<string, string | number>): string {
  const str = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&") + getSecret();
  return createHash("md5").update(str, "utf-8").digest("hex").toUpperCase();
}

export type PayType = 43 | 44; // 43=alipay, 44=wechat

export interface CreatePaymentParams {
  orderNo: string;
  subject: string;
  payType: PayType;
  money: number;
  extra?: string;
}

export interface CreatePaymentResult {
  payUrl: string;
  qrCode?: string;
  qrImg?: string;
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

  // Build xddpay request
  const signParams: Record<string, string | number> = {
    order_no: orderNo,
    subject,
    pay_type: payType,
    money: money.toFixed(2),
    app_id: getAppId(),
  };
  if (params.subject) signParams.subject = subject;

  const paySign = sign(signParams);

  // Use JSON format to get QR code directly
  const formData = new URLSearchParams();
  for (const [k, v] of Object.entries(signParams)) {
    formData.append(k, String(v));
  }
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

  if (data.qr || data.qr_img) {
    return {
      payUrl: `${XDDPAY_GATEWAY}?format=json`,
      qrCode: data.qr || "",
      qrImg: data.qr_img || "",
      xddpayOrder: data.xddpay_order || "",
      realMoney: data.realmoney || String(money),
    } satisfies CreatePaymentResult;
  }

  // Fallback: use redirect URL for form submission
  const redirectForm = Object.entries({ ...signParams, sign: paySign })
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${v}">`)
    .join("");

  return {
    payUrl: `data:text/html,<form id="f" method="POST" action="${XDDPAY_GATEWAY}">${redirectForm}</form><script>document.getElementById("f").submit()</script>`,
  } satisfies CreatePaymentResult;
}

export function verifyNotifySign(params: Record<string, string>): boolean {
  const { sign: receivedSign, ...rest } = params;
  if (!receivedSign) return false;
  const expected = sign(rest);
  return receivedSign.toUpperCase() === expected.toUpperCase();
}

export async function queryOrderStatus(orderNo: string): Promise<string> {
  const signParams = {
    app_id: getAppId(),
    order_no: orderNo,
  };
  const querySign = sign(signParams);

  const url = `${XDDPAY_QUERY_URL}?app_id=${signParams.app_id}&order_no=${orderNo}&sign=${querySign}`;
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
