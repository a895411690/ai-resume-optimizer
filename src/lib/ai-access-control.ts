import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const DEMO_DAILY_DIAGNOSIS_LIMIT = 3;

const VIP_REQUIRED_MESSAGE = "优化次数已用完，请及时充值！";
const DEMO_DIAGNOSIS_LIMIT_MESSAGE = "Demo 今日免费诊断次数已用完，请登录后继续使用。";
const DEMO_CLIENT_REQUIRED_MESSAGE = "Demo 诊断需要有效的浏览器体验标识。";

type AiAction = "diagnose" | "optimize" | "optimize_module";
type EntitlementSource = "authenticated" | "demo_daily" | "free_once" | "vip" | "credits";

export type EntitlementSummary = {
  isVip: boolean;
  isLifetimeVip: boolean;
  vipExpiresAt: string | null;
  freeOptimizationUsed: boolean;
  remainingFreeOptimizations: number;
  optimizationCredits: number;
};

type AccessReservation =
  | { allowed: true; eventId: string | null; entitlementSource: EntitlementSource }
  | { allowed: false; response: NextResponse };

function vipRequiredResponse() {
  return NextResponse.json(
    { code: "VIP_REQUIRED", error: VIP_REQUIRED_MESSAGE },
    { status: 402 }
  );
}

function hashValue(value: string) {
  const salt = process.env.AI_ACCESS_HASH_SALT || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "weihub-demo-access";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

function readIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}

function readDemoClientId(req: NextRequest) {
  return (req.headers.get("x-demo-client-id") || "").trim();
}

async function ensureEntitlement(userId: string) {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("user_entitlements")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message || "权益初始化失败");
}

export async function getEntitlementSummary(userId: string): Promise<EntitlementSummary> {
  await ensureEntitlement(userId);
  const { data, error } = await getSupabaseAdmin()
    .from("user_entitlements")
    .select("vip_expires_at,free_optimization_used,optimization_credits,lifetime_vip")
    .eq("user_id", userId)
    .single();

  if (error) throw new Error(error.message || "权益状态加载失败");

  const vipExpiresAt = data?.vip_expires_at || null;
  const isVip = Boolean(data?.lifetime_vip || (vipExpiresAt && new Date(vipExpiresAt).getTime() > Date.now()));
  const isLifetimeVip = Boolean(data?.lifetime_vip);
  const freeOptimizationUsed = Boolean(data?.free_optimization_used);
  const optimizationCredits = Number(data?.optimization_credits || 0);
  return {
    isVip,
    isLifetimeVip,
    vipExpiresAt,
    freeOptimizationUsed,
    remainingFreeOptimizations: freeOptimizationUsed ? 0 : 1,
    optimizationCredits,
  };
}

export async function reserveOptimizationAccess(userId: string, action: Exclude<AiAction, "diagnose">): Promise<AccessReservation> {
  const admin = getSupabaseAdmin();
  const entitlement = await getEntitlementSummary(userId);

  // Priority: lifetime/time VIP > credits > free once
  let entitlementSource: EntitlementSource;

  if (entitlement.isVip) {
    entitlementSource = "vip";
  } else if (entitlement.optimizationCredits > 0) {
    entitlementSource = "credits";
  } else if (!entitlement.freeOptimizationUsed) {
    entitlementSource = "free_once";
  } else {
    return { allowed: false, response: vipRequiredResponse() };
  }

  const { data: event, error: eventError } = await admin
    .from("ai_usage_events")
    .insert({
      user_id: userId,
      action,
      mode: "authenticated",
      entitlement_source: entitlementSource,
      status: "reserved",
    })
    .select("id")
    .single();
  if (eventError || !event?.id) throw new Error(eventError?.message || "优化权益预约失败");

  // VIP: no deduction needed
  if (entitlementSource === "vip") {
    return { allowed: true, eventId: event.id, entitlementSource };
  }

  // Credits: deduct 1
  if (entitlementSource === "credits") {
    const { data: claimed, error: claimError } = await admin
      .from("user_entitlements")
      .update({
        optimization_credits: entitlement.optimizationCredits - 1,
      })
      .eq("user_id", userId)
      .gte("optimization_credits", 1)
      .select("user_id")
      .maybeSingle();

    if (claimError) throw new Error(claimError.message || "次卡扣减失败");
    if (!claimed) {
      await admin.from("ai_usage_events").update({ status: "blocked" }).eq("id", event.id);
      return { allowed: false, response: vipRequiredResponse() };
    }
    return { allowed: true, eventId: event.id, entitlementSource };
  }

  // Free once: mark used
  const { data: claimed, error: claimError } = await admin
    .from("user_entitlements")
    .update({
      free_optimization_used: true,
      free_optimization_event_id: event.id,
    })
    .eq("user_id", userId)
    .eq("free_optimization_used", false)
    .select("user_id")
    .maybeSingle();

  if (claimError) throw new Error(claimError.message || "免费优化次数扣减失败");
  if (!claimed) {
    await admin.from("ai_usage_events").update({ status: "blocked" }).eq("id", event.id);
    return { allowed: false, response: vipRequiredResponse() };
  }

  return { allowed: true, eventId: event.id, entitlementSource };
}

export async function markAiUsageCompleted(eventId: string | null) {
  if (!eventId) return;
  await getSupabaseAdmin()
    .from("ai_usage_events")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", eventId);
}

export async function markAiUsageFailed(eventId: string | null) {
  if (!eventId) return;
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("ai_usage_events")
    .select("id,user_id,entitlement_source")
    .eq("id", eventId)
    .maybeSingle();

  await admin
    .from("ai_usage_events")
    .update({ status: "failed", completed_at: new Date().toISOString() })
    .eq("id", eventId);

  if (!data?.user_id) return;

  if (data.entitlement_source === "free_once") {
    await admin
      .from("user_entitlements")
      .update({ free_optimization_used: false, free_optimization_event_id: null })
      .eq("user_id", data.user_id)
      .eq("free_optimization_event_id", eventId);
  } else if (data.entitlement_source === "credits") {
    await admin.rpc("increment_credits", { uid: data.user_id, amount: 1 });
  }
}

export async function reserveDemoDiagnosisAccess(req: NextRequest): Promise<AccessReservation> {
  const demoClientId = readDemoClientId(req);
  if (!demoClientId) {
    return {
      allowed: false,
      response: NextResponse.json({ error: DEMO_CLIENT_REQUIRED_MESSAGE }, { status: 400 }),
    };
  }

  const admin = getSupabaseAdmin();
  const usageDay = new Date().toISOString().slice(0, 10);
  const ipHash = hashValue(readIp(req));
  const clientHash = hashValue(demoClientId);

  const { data: current, error: currentError } = await admin
    .from("demo_diagnosis_usage_daily")
    .select("diagnosis_count")
    .eq("usage_day", usageDay)
    .eq("ip_hash", ipHash)
    .eq("client_hash", clientHash)
    .maybeSingle();
  if (currentError) throw new Error(currentError.message || "Demo 诊断次数读取失败");

  const currentCount = Number(current?.diagnosis_count || 0);
  if (currentCount >= DEMO_DAILY_DIAGNOSIS_LIMIT) {
    return {
      allowed: false,
      response: NextResponse.json({ error: DEMO_DIAGNOSIS_LIMIT_MESSAGE }, { status: 429 }),
    };
  }

  const { data: event, error: eventError } = await admin
    .from("ai_usage_events")
    .insert({
      action: "diagnose",
      mode: "demo",
      entitlement_source: "demo_daily",
      status: "completed",
      demo_day: usageDay,
      demo_ip_hash: ipHash,
      demo_client_hash: clientHash,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (eventError || !event?.id) throw new Error(eventError?.message || "Demo 诊断记录失败");

  if (current) {
    const { error } = await admin
      .from("demo_diagnosis_usage_daily")
      .update({ diagnosis_count: currentCount + 1, last_event_id: event.id })
      .eq("usage_day", usageDay)
      .eq("ip_hash", ipHash)
      .eq("client_hash", clientHash);
    if (error) throw new Error(error.message || "Demo 诊断次数更新失败");
  } else {
    const { error } = await admin
      .from("demo_diagnosis_usage_daily")
      .insert({
        usage_day: usageDay,
        ip_hash: ipHash,
        client_hash: clientHash,
        diagnosis_count: 1,
        last_event_id: event.id,
      });
    if (error) throw new Error(error.message || "Demo 诊断次数创建失败");
  }

  return { allowed: true, eventId: event.id, entitlementSource: "demo_daily" };
}
