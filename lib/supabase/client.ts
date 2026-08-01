"use client";

import { createBrowserClient } from "@supabase/ssr";
import { assertSupabaseEnv } from "@/lib/supabase/env";

export function createClient() {
  const env = assertSupabaseEnv();
  return createBrowserClient(env.url, env.anonKey);
}
