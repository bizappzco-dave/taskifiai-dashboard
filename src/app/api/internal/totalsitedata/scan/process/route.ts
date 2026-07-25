import { NextResponse } from 'next/server'
import { requireWebhookSecret } from '@/lib/webhook-auth'
import { getTotalSiteDataScanQueueHealth, processScanQueueBatch } from '@/lib/totalsitedata/queue'

export const dynamic = 'force-dynamic'

function nowIso() {
  return new Date().toISOString()
}

function getIntParam(rawValue: unknown, fallback: number, max = 100) {
  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(max, Math.max(1, Math.trunc(parsed)))
}

function getQueueWindowParam(rawValue: unknown, fallback: number) {
  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.max(60, Math.trunc(parsed))
}

export async function GET(request: Request) {
  try {
    const expectedSecret = process.env.TOTALSITEDATA_INTERNAL_SECRET || process.env.INTERNAL_API_SECRET
    const authError = requireWebhookSecret(
      request,
      expectedSecret,
      'TOTALSITEDATA_INTERNAL_SECRET'
    )
    if (authError) return authError

    const url = new URL(request.url)
    const windowSeconds = getQueueWindowParam(url.searchParams.get('window_seconds'), 3600)
    const cacheTtlSeconds = getIntParam(url.searchParams.get('cache_ttl_seconds'), 120)

    const queue = await getTotalSiteDataScanQueueHealth({
      windowSeconds,
      cacheTtlSeconds,
    })

    return NextResponse.json({
      success: true,
      generated_at: nowIso(),
      queue,
    })
  } catch (error: any) {
    console.error('TotalSiteData scan health route error:', error)

    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const expectedSecret = process.env.TOTALSITEDATA_INTERNAL_SECRET || process.env.INTERNAL_API_SECRET
    const authError = requireWebhookSecret(
      request,
      expectedSecret,
      'TOTALSITEDATA_INTERNAL_SECRET'
    )
    if (authError) return authError

    let body: any = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const url = new URL(request.url)
    const limit = getIntParam(url.searchParams.get('limit'), body?.limit || 5, 50)
    const stopOnError =
      body?.stopOnError === true ||
      String(body?.stop_on_error || '').toLowerCase() === 'true' ||
      String(url.searchParams.get('stopOnError') || '').toLowerCase() === 'true'

    const result = await processScanQueueBatch({
      limit,
      stopOnError,
    })

    const queue = await getTotalSiteDataScanQueueHealth({ windowSeconds: 3600, cacheTtlSeconds: 30 })

    return NextResponse.json({
      success: true,
      processed: result.processed,
      results: result.results,
      queue,
      generated_at: nowIso(),
    })
  } catch (error: any) {
    console.error('TotalSiteData scan worker route error:', error)

    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
