import { NextResponse } from 'next/server'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: url ? 'SET (length: ' + url.length + ')' : 'NOT SET',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anon ? 'SET (length: ' + anon.length + ')' : 'NOT SET',
    SUPABASE_SERVICE_ROLE_KEY: service ? 'SET (length: ' + service.length + ')' : 'NOT SET',
    allSet: !!(url && anon && service)
  })
}
