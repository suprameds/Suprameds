/**
 * Supabase config for client-side use (auth, realtime, etc.).
 * Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.
 *
 * To use the Supabase client, install: npm i @supabase/supabase-js
 * Then: import { createClient } from '@supabase/supabase-js'; createClient(supabaseUrl, supabaseAnonKey);
 */
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ""
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ""

export const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey)
