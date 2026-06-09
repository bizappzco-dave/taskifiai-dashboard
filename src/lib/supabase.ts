import { createClient } from '@supabase/supabase-js'

// Lazy initialization - don't create client until actually used
let _supabase: ReturnType<typeof createClient> | null = null
let _supabaseAdmin: ReturnType<typeof createClient> | null = null

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is not set')
  return url
}

export function getSupabasePublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set')
  return key
}

export function getSupabaseSecretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is not set')
  return key
}

// Client-side (with RLS) - lazy loaded
export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(getSupabaseUrl(), getSupabasePublishableKey())
  }
  return _supabase
}

// Server-side (admin, bypasses RLS) - lazy loaded
export function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(getSupabaseUrl(), getSupabaseSecretKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }
  return _supabaseAdmin
}
