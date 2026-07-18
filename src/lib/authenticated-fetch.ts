import { getSupabase } from '@/lib/supabase'

export async function getDashboardAccessToken(): Promise<string> {
  const supabase = getSupabase()
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error || !session?.access_token) {
    throw new Error('Please sign in again before continuing.')
  }

  return session.access_token
}

export async function fetchWithDashboardAuth(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await getDashboardAccessToken()
  const headers = new Headers(init.headers || {})
  headers.set('Authorization', `Bearer ${token}`)

  return fetch(input, {
    ...init,
    headers,
  })
}
