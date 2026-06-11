import { createClient, type User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const AI_AUTH_REQUIRED_MESSAGE = "请先登录后再使用 AI 诊断优化功能。";

let authClient: ReturnType<typeof createClient> | null = null;

function getAuthClient() {
  if (authClient) return authClient;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase Auth 未配置");
  }
  authClient = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return authClient;
}

function getBearerToken(req: NextRequest) {
  const authorization = req.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

export async function getOptionalAuthenticatedUser(req: NextRequest): Promise<{ user: User | null } | { response: NextResponse }> {
  const token = getBearerToken(req);
  if (!token) return { user: null };

  try {
    const { data, error } = await getAuthClient().auth.getUser(token);
    if (error || !data.user) {
      return {
        response: NextResponse.json({ error: AI_AUTH_REQUIRED_MESSAGE }, { status: 401 }),
      };
    }
    return { user: data.user };
  } catch (error) {
    const message = error instanceof Error ? error.message : "登录校验失败";
    return {
      response: NextResponse.json({ error: message }, { status: 500 }),
    };
  }
}

export async function requireAuthenticatedUser(req: NextRequest): Promise<{ user: User } | { response: NextResponse }> {
  const auth = await getOptionalAuthenticatedUser(req);
  if ("response" in auth) return auth;
  if (!auth.user) {
    return {
      response: NextResponse.json({ error: AI_AUTH_REQUIRED_MESSAGE }, { status: 401 }),
    };
  }
  return { user: auth.user };
}
