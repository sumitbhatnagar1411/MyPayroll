import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Placeholders allow the build to complete when env vars are not set (e.g. Netlify before config).
// Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Netlify env vars for production.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key-for-build";

// Storage that avoids "Lock broken by another request" - use simple localStorage
// without Supabase's internal lock which can conflict with multiple tabs/hot reload
const safeStorage = {
  getItem: (key: string) => {
    try {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore storage errors (quota, locked, etc.)
    }
  },
  removeItem: (key: string) => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  },
};

let client: SupabaseClient | null = null;

export function createBrowserClient() {
  if (client) return client;
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      storage: safeStorage,
      storageKey: "sb-payroll-auth",
    },
  });
  return client;
}
