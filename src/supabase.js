import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

// True once both values are set (in .env locally, or in Vercel env vars).
export const supabaseConfigured = Boolean(url && anon);

export const supabase = supabaseConfigured ? createClient(url, anon) : null;
