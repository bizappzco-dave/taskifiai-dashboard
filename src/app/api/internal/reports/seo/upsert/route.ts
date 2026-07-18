import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { logActivity } from '@/lib/queries'

export const dynamic = 'force-dynamic'

type ReportStatus = 'processing' | 'ready' | 'failed'

function getInternalSecret() {
  return process.env.TOTALSITEDATA_INTERNAL_SECRET || process.env.INTERNAL_API_SECRET || ''
}

function getProvidedSecret(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice('Bearer '.length).trim()
  return request.headers.get('x-totalsitedata-secret')?.trim() || request.headers.get('x-internal-secret')?.trim() || ''
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'report'
}

function requireString(body: any, key: string) {
  const value = body?.[key]
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} is required`)
  return value.trim()
}

function parseStatus(value: unknown): ReportStatus {
  return value === 'processing' || value === 'failed' || value === 'ready' ? value : 'ready'
}

function normalizeJson(value: unknown, fallback: any) {
  if (value === null || value === undefined) return fallback
  return value
}

async function maybeUploadReportFile(body: any, clientId: string, reportType: string, periodStart: string, title: string) {
  if (!body.pdf_base64) return body.storage_path || null

  if (typeof body.pdf_base64 !== 'string') throw new Error('pdf_base64 must be a base64 string')

  const supabase = getSupabaseAdmin() as any
  const filename = slugify(body.pdf_filename || title || `${periodStart}-${reportType}`)
  const extension = filename.includes('.') ? '' : '.pdf'
  const storagePath = body.storage_path || `${clientId}/${reportType}/${periodStart}-${filename}${extension}`
  const contentType = body.pdf_content_type || 'application/pdf'
  const buffer = Buffer.from(body.pdf_base64, 'base64')

  const { error } = await supabase.storage
    .from('client-reports')
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    })

  if (error) throw error
  return storagePath
}

export async function POST(request: Request) {
  try {
    const expectedSecret = getInternalSecret()
    if (!expectedSecret) {
      return NextResponse.json({ error: 'TOTALSITEDATA_INTERNAL_SECRET is not configured' }, { status: 500 })
    }

    const providedSecret = getProvidedSecret(request)
    if (!providedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const clientId = requireString(body, 'client_id')
    const periodStart = requireString(body, 'period_start')
    const periodEnd = requireString(body, 'period_end')
    const title = requireString(body, 'title')
    const reportType = (body.report_type || 'seo') === 'seo' ? 'seo' : String(body.report_type || 'seo')

    if (!['seo', 'site_health', 'monthly', 'gbp', 'reviews', 'ads', 'custom'].includes(reportType)) {
      return NextResponse.json({ error: 'Invalid report_type' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin() as any
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .maybeSingle()

    if (clientError) throw clientError
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const storagePath = await maybeUploadReportFile(body, clientId, reportType, periodStart, title)

    const reportPayload = {
      client_id: clientId,
      report_type: reportType,
      period_start: periodStart,
      period_end: periodEnd,
      title,
      summary: body.summary || null,
      score: body.score ?? null,
      status: parseStatus(body.status),
      metrics: normalizeJson(body.metrics, {}),
      recommendations: normalizeJson(body.recommendations, []),
      pdf_url: body.pdf_url || null,
      storage_path: storagePath,
      source: body.source || 'marketing',
      external_id: body.external_id || null,
      updated_at: new Date().toISOString(),
    }

    const { data: report, error: upsertError } = await supabase
      .from('client_reports')
      .upsert(reportPayload, {
        onConflict: 'client_id,report_type,period_start,period_end',
      })
      .select()
      .single()

    if (upsertError) throw upsertError

    await logActivity({
      client_id: clientId,
      product: 'reports',
      activity_type: 'client_report_ready',
      activity_category: 'marketing',
      title: `${title} ready`,
      description: body.summary || `${reportType.toUpperCase()} report is now available in the client dashboard.`,
      source: body.source || 'marketing',
      external_id: body.external_id || `client-report:${report.id}`,
      details: {
        report_id: report.id,
        report_type: reportType,
        period_start: periodStart,
        period_end: periodEnd,
        score: body.score ?? null,
        storage_path: storagePath,
        pdf_url: body.pdf_url || null,
        metrics: normalizeJson(body.metrics, {}),
      },
    })

    return NextResponse.json({ success: true, report })
  } catch (error: any) {
    console.error('SEO report upsert error:', error)
    return NextResponse.json({ error: error.message || 'Failed to upsert report' }, { status: 500 })
  }
}
