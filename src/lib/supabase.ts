import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (client) return client;
  if (typeof window === "undefined") {
    // Return a dummy client during SSR - won't actually be used since all auth is client-side
    return createClient("https://placeholder.supabase.co", "placeholder");
  }
  client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
  );
  return client;
}

export const supabase = {
  get auth() { return getSupabase().auth; },
  from(table: string) { return getSupabase().from(table); },
  rpc(functionName: string, args?: Record<string, unknown>) { return getSupabase().rpc(functionName, args); },
  get storage() { return getSupabase().storage; },
  get functions() { return getSupabase().functions; },
};
