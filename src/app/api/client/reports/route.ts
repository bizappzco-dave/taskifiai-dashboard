import { NextResponse } from 'next/server'
import { getClientAccessFromRequest } from '@/lib/client-access'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const SIGNED_URL_TTL_SECONDS = 60 * 60

async function withSignedUrl(report: any) {
  if (!report?.storage_path) return { ...report, signed_pdf_url: report?.pdf_url || null }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.storage
    .from('client-reports')
    .createSignedUrl(report.storage_path, SIGNED_URL_TTL_SECONDS)

  return {
    ...report,
    signed_pdf_url: error ? report.pdf_url || null : data?.signedUrl || report.pdf_url || null,
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')
    const reportType = searchParams.get('report_type')

    if (!clientId) {
      return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
    }

    const access = await getClientAccessFromRequest(request, clientId)
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('client_reports')
      .select('*')
      .eq('client_id', clientId)
      .order('period_end', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(24)

    if (reportType) query = query.eq('report_type', reportType)

    const { data, error } = await query
    if (error) throw error

    const reports = await Promise.all((data || []).map(withSignedUrl))

    return NextResponse.json({ reports })
  } catch (error: any) {
    console.error('Client reports load error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load reports' }, { status: 500 })
  }
}
