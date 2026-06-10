export type TotalSiteDataWarmthStatus = 'cold' | 'warming' | 'warm' | 'hot'
export type TotalSiteDataPromotionTrigger =
  | 'free_report_request'
  | 'reply'
  | 'booking'
  | 'manual_approval'
  | 'score_threshold_only'

export interface TotalSiteDataPromotionPayload {
  target_client_id?: string
  source: string
  source_detail?: string
  prospect_id: string
  business_name: string
  domain?: string | null
  email?: string | null
  phone?: string | null
  category?: string | null
  location?: string | null
  lead_score?: number | null
  pain_score?: number | null
  fit_score?: number | null
  warmth_status?: TotalSiteDataWarmthStatus
  promotion_reason: string
  promotion_trigger?: TotalSiteDataPromotionTrigger
  report_links?: {
    free_preview_html?: string | null
    full_report_pdf?: string | null
  }
  scan_summary?: {
    top_issues?: string[]
  }
}

export interface ValidationResult {
  success: boolean
  data?: TotalSiteDataPromotionPayload
  errors?: string[]
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function asOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function asOptionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value
    .map((item) => asTrimmedString(item))
    .filter(Boolean) as string[]
  return items.length > 0 ? items : undefined
}

export function mapPromotionPayloadToLeadSource(
  payload: TotalSiteDataPromotionPayload
): 'website_form' | 'manual' {
  const sourceDetail = payload.source_detail?.toLowerCase() || ''
  const trigger = payload.promotion_trigger || ''

  if (
    sourceDetail.includes('form') ||
    sourceDetail.includes('report_request') ||
    trigger === 'free_report_request'
  ) {
    return 'website_form'
  }

  return 'manual'
}

export function mapPromotionPayloadToLeadStage(
  payload: TotalSiteDataPromotionPayload
): 'new_lead' | 'qualified' {
  const trigger = payload.promotion_trigger
  const warmth = payload.warmth_status

  if (
    trigger === 'free_report_request' ||
    trigger === 'reply' ||
    trigger === 'booking' ||
    trigger === 'manual_approval' ||
    warmth === 'warm' ||
    warmth === 'hot'
  ) {
    return 'qualified'
  }

  return 'new_lead'
}

export function validateTotalSiteDataPromotionPayload(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { success: false, errors: ['Request body must be a JSON object'] }
  }

  const body = input as Record<string, unknown>
  const errors: string[] = []

  const target_client_id = asTrimmedString(body.target_client_id)
  const source = asTrimmedString(body.source)
  const source_detail = asTrimmedString(body.source_detail)
  const prospect_id = asTrimmedString(body.prospect_id)
  const business_name = asTrimmedString(body.business_name)
  const domain = asTrimmedString(body.domain) || null
  const email = asTrimmedString(body.email) || null
  const phone = asTrimmedString(body.phone) || null
  const category = asTrimmedString(body.category) || null
  const location = asTrimmedString(body.location) || null
  const lead_score = asOptionalNumber(body.lead_score)
  const pain_score = asOptionalNumber(body.pain_score)
  const fit_score = asOptionalNumber(body.fit_score)
  const promotion_reason = asTrimmedString(body.promotion_reason)
  const warmth_status = asTrimmedString(body.warmth_status) as TotalSiteDataWarmthStatus | undefined
  const promotion_trigger = asTrimmedString(body.promotion_trigger) as TotalSiteDataPromotionTrigger | undefined

  if (!source) errors.push('source is required')
  if (!prospect_id) errors.push('prospect_id is required')
  if (!business_name) errors.push('business_name is required')
  if (!promotion_reason) errors.push('promotion_reason is required')

  if (target_client_id && !UUID_RE.test(target_client_id)) {
    errors.push('target_client_id must be a valid UUID when provided')
  }

  if (prospect_id && !UUID_RE.test(prospect_id)) {
    errors.push('prospect_id must be a valid UUID')
  }

  if (!domain && !email && !phone && !business_name) {
    errors.push('At least one identifier is required: domain, email, phone, or business_name')
  }

  if (warmth_status && !['cold', 'warming', 'warm', 'hot'].includes(warmth_status)) {
    errors.push('warmth_status must be one of: cold, warming, warm, hot')
  }

  if (
    promotion_trigger &&
    !['free_report_request', 'reply', 'booking', 'manual_approval', 'score_threshold_only'].includes(promotion_trigger)
  ) {
    errors.push('promotion_trigger must be one of: free_report_request, reply, booking, manual_approval, score_threshold_only')
  }

  const reportLinksInput = body.report_links && typeof body.report_links === 'object' && !Array.isArray(body.report_links)
    ? (body.report_links as Record<string, unknown>)
    : undefined

  const scanSummaryInput = body.scan_summary && typeof body.scan_summary === 'object' && !Array.isArray(body.scan_summary)
    ? (body.scan_summary as Record<string, unknown>)
    : undefined

  const report_links = reportLinksInput
    ? {
        free_preview_html: asTrimmedString(reportLinksInput.free_preview_html) || null,
        full_report_pdf: asTrimmedString(reportLinksInput.full_report_pdf) || null,
      }
    : undefined

  const top_issues = scanSummaryInput
    ? asOptionalStringArray(scanSummaryInput.top_issues)
    : undefined

  if (errors.length > 0) {
    return { success: false, errors }
  }

  return {
    success: true,
    data: {
      target_client_id,
      source: source!,
      source_detail,
      prospect_id: prospect_id!,
      business_name: business_name!,
      domain,
      email,
      phone,
      category,
      location,
      lead_score,
      pain_score,
      fit_score,
      warmth_status,
      promotion_reason: promotion_reason!,
      promotion_trigger,
      report_links,
      scan_summary: { top_issues },
    },
  }
}
