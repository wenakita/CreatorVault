import { createClient, type SupabaseClient } from '@supabase/supabase-js'

declare const process: { env: Record<string, string | undefined> }

// Server-only config. Do NOT use client-exposed env vars in API routes.
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false },
      })
    : null

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin not configured')
  }
  return supabaseAdmin
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(supabaseAdmin)
}

