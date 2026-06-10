import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (client) return client;
  if (typeof window === "undefined") {
    // Return a dummy client during SSR - won't actually be used since all auth is client-side
    return createClient("https://placeholder.supabase.co", "placeholder");
  }

  const directUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

  // In production, route Supabase requests through our own domain to avoid
  // China GFW blocking direct connections to .supabase.co
  const supabaseUrl = process.env.NODE_ENV === "production"
    ? `${window.location.origin}/supabase`
    : directUrl;

  client = createClient(supabaseUrl, anonKey);
  return client;
}

export const supabase = {
  get auth() { return getSupabase().auth; },
  from(table: string) { return getSupabase().from(table); },
  rpc(functionName: string, args?: Record<string, unknown>) { return getSupabase().rpc(functionName, args); },
  get storage() { return getSupabase().storage; },
  get functions() { return getSupabase().functions; },
};
