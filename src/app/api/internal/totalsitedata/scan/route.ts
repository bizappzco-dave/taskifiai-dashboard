import { NextResponse } from 'next/server'
import { requireWebhookSecret } from '@/lib/webhook-auth'
import { validateTotalSiteDataPromotionPayload } from '@/lib/totalsitedata/promotion'
import { enqueueTotalSiteDataScanJob } from '@/lib/totalsitedata/queue'

export const dynamic = 'force-dynamic'

type UnknownRecord = Record<string, unknown>

type ScanIssueSource = unknown

function getStagingClientId(): string | null {
  return process.env.TOTALSITEDATA_STAGING_CLIENT_ID || null
}

function getIntEnv(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.trunc(parsed)
}

function looksLikeSupabaseHtmlError(message: string | undefined): boolean {
  return !!message && /^<!doctype html>/i.test(message.trim())
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function asOptionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value
    .map((item) => asTrimmedString(item))
    .filter(Boolean) as string[]
  return items.length > 0 ? items : undefined
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'passed', 'pass', 'ok'].includes(normalized)) return true
    if (['false', '0', 'no', 'failed', 'fail', 'not ok', 'na'].includes(normalized)) return false
  }
  return undefined
}

function asCheckPassed(value: unknown): boolean | undefined {
  const fromBoolean = asBoolean(value)
  if (fromBoolean !== undefined) return fromBoolean

  const status = asTrimmedString(value)
  if (!status) return undefined
  const normalized = status.toLowerCase()
  if (normalized === 'pass' || normalized === 'passed' || normalized === 'ok') return true
  if (normalized === 'fail' || normalized === 'failed' || normalized === 'error' || normalized === 'false')
    return false

  return undefined
}

function extractFailedChecksSummary(checksValue: ScanIssueSource): string[] | undefined {
  if (!Array.isArray(checksValue)) return undefined

  const issues = checksValue
    .map((check) => {
      if (!check || typeof check !== 'object' || Array.isArray(check)) return undefined
      const record = check as UnknownRecord
      const name = asTrimmedString(record.name)
      const passed = asCheckPassed(record.pass)

      if (!name) return undefined
      if (passed === undefined) return undefined

      return passed ? undefined : name
    })
    .filter(Boolean) as string[]

  return issues.length > 0 ? issues : undefined
}

function normalizeScanSummary(rawSummary: UnknownRecord | undefined, fallbackChecks: unknown): UnknownRecord | undefined {
  if (!rawSummary) {
    const issuesFromChecks = extractFailedChecksSummary(fallbackChecks)
    return issuesFromChecks ? { top_issues: issuesFromChecks } : undefined
  }

  const summary = { ...rawSummary }
  const hasExplicitTopIssues = Object.prototype.hasOwnProperty.call(summary, 'top_issues')
  const explicitTopIssues = asOptionalStringArray(summary.top_issues)

  if (hasExplicitTopIssues) {
    if (explicitTopIssues) {
      summary.top_issues = explicitTopIssues
      return summary
    }

    if (Array.isArray(summary.top_issues) && summary.top_issues.length === 0) {
      summary.top_issues = []
      return summary
    }

    const derivedFromFixes = asOptionalStringArray(summary.priorityFixes)
    const derivedFromChecks = extractFailedChecksSummary(summary.checks)
    const derivedFromFallbackChecks = extractFailedChecksSummary(fallbackChecks)
    const derivedTopIssues =
      derivedFromFixes || derivedFromChecks || derivedFromFallbackChecks

    if (derivedTopIssues) summary.top_issues = derivedTopIssues

    return summary
  }

  const priorityFixes = asOptionalStringArray(summary.priorityFixes)
  const fromChecks = extractFailedChecksSummary(summary.checks)
  const fromFallback = extractFailedChecksSummary(fallbackChecks)
  const derivedTopIssues = priorityFixes || fromChecks || fromFallback

  if (derivedTopIssues) {
    summary.top_issues = derivedTopIssues
  }

  return summary
}

function normalizeScanPayload(rawBody: unknown): unknown {
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) return rawBody

  const body = rawBody as UnknownRecord
  const normalizedScanSummary = normalizeScanSummary(
    body.scan_summary && typeof body.scan_summary === 'object' && !Array.isArray(body.scan_summary)
      ? (body.scan_summary as UnknownRecord)
      : undefined,
    body.checks
  )

  if (!normalizedScanSummary) return rawBody

  return {
    ...body,
    scan_summary: normalizedScanSummary,
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

    const rawBody = await request.json()
    const normalizedPayload = normalizeScanPayload(rawBody)
    const validation = validateTotalSiteDataPromotionPayload(normalizedPayload)
    if (!validation.success || !validation.data) {
      return NextResponse.json(
        { error: 'Invalid payload', details: validation.errors || [] },
        { status: 400 }
      )
    }

    const payload = validation.data
    if (!payload.target_client_id) {
      const stagingClientId = getStagingClientId()
      if (stagingClientId) {
        payload.target_client_id = stagingClientId
      } else {
        return NextResponse.json(
          {
            error: 'target_client_id is required and no TOTALSITEDATA_STAGING_CLIENT_ID is configured',
            code: 'target_client_id_required',
          },
          { status: 409 }
        )
      }
    }

    const result = await enqueueTotalSiteDataScanJob(payload, {
      rateLimitWindowSeconds: getIntEnv('TOTALSITEDATA_SCAN_RATE_LIMIT_WINDOW_SECONDS', 60),
      rateLimitMaxRequests: getIntEnv('TOTALSITEDATA_SCAN_RATE_LIMIT_MAX_REQUESTS', 120),
    })

    if (result.rate_limited) {
      return NextResponse.json(
        {
          success: false,
          message: result.reason,
          task_id: null,
          queued: false,
          deduplicated: false,
        },
        { status: 429 }
      )
    }

    const status = result.queued ? 202 : 200

    return NextResponse.json(
      {
        success: true,
        task_id: result.task_id,
        queued: result.queued,
        deduplicated: result.deduplicated,
        reason: result.reason,
      },
      { status }
    )
  } catch (error: any) {
    const message = error?.message || 'Unknown error'

    if (looksLikeSupabaseHtmlError(message)) {
      console.error('TotalSiteData scan enqueue route returned non-Supabase response body (likely invalid SUPABASE_URL).')
      return NextResponse.json(
        {
          error:
            'Supabase response is HTML instead of JSON; verify SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL points to a real Supabase project.',
          details: {
            message,
          },
        },
        { status: 500 }
      )
    }

    console.error('TotalSiteData scan enqueue route error:', error)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
