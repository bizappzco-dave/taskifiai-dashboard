export const ULTRA_MARKETING_APPROVAL_KIND = 'ultra_marketing_approval'

export const ULTRA_MARKETING_APPROVAL_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'published',
] as const

export const ULTRA_MARKETING_OPEN_APPROVAL_STATUSES = ['draft', 'pending', 'pending_approval']

type ApprovalStatus = typeof ULTRA_MARKETING_APPROVAL_STATUSES[number]

export type UltraMarketingApprovalItem = {
  id: string
  client_id: string | null
  title: string
  description: string | null
  status: ApprovalStatus
  priority: string | null
  due_date: string | null
  action_type: string
  channel: string | null
  summary: string | null
  draft_preview: string | null
  requested_action: string | null
  source: string | null
  external_reference: string | null
  review_note: string | null
  reviewed_at: string | null
  created_at: string | null
  updated_at: string | null
}

export function approvalObjectOrEmpty(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function limitedText(value: unknown, limit = 700): string | null {
  const text = textOrNull(value)
  if (!text) return null
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text
}

export function normalizeApprovalStatus(status: unknown): ApprovalStatus {
  const value = typeof status === 'string' ? status : ''
  if (value === 'pending') return 'pending_approval'
  if ((ULTRA_MARKETING_APPROVAL_STATUSES as readonly string[]).includes(value)) {
    return value as ApprovalStatus
  }
  return 'pending_approval'
}

export function isOpenApprovalStatus(status: unknown): boolean {
  return ['draft', 'pending', 'pending_approval'].includes(String(status || ''))
}

export function approvalStatusForDecision(decision: unknown): 'approved' | 'rejected' | null {
  const value = String(decision || '').toLowerCase()
  if (['approve', 'approved'].includes(value)) return 'approved'
  if (['reject', 'rejected'].includes(value)) return 'rejected'
  return null
}

export function approvalItemFromTask(task: any): UltraMarketingApprovalItem {
  const metadata = approvalObjectOrEmpty(task?.metadata)

  return {
    id: String(task?.id || ''),
    client_id: task?.client_id ? String(task.client_id) : null,
    title: String(task?.title || metadata.title || 'Approval request'),
    description: textOrNull(task?.description || metadata.description),
    status: normalizeApprovalStatus(task?.status),
    priority: textOrNull(task?.priority),
    due_date: task?.due_date ? String(task.due_date) : null,
    action_type: String(metadata.action_type || metadata.workflow || 'marketing_action'),
    channel: textOrNull(metadata.channel),
    summary: limitedText(metadata.summary || metadata.payload_summary || task?.description, 360),
    draft_preview: limitedText(metadata.draft_preview || metadata.draft_text || metadata.copy || metadata.message, 900),
    requested_action: textOrNull(metadata.requested_action || metadata.action_label || metadata.action),
    source: textOrNull(metadata.source || metadata.source_system),
    external_reference: textOrNull(metadata.external_reference || metadata.external_id || metadata.reference_id),
    review_note: textOrNull(metadata.review_note),
    reviewed_at: task?.completed_at ? String(task.completed_at) : textOrNull(metadata.reviewed_at),
    created_at: task?.created_at ? String(task.created_at) : null,
    updated_at: task?.updated_at ? String(task.updated_at) : null,
  }
}

export function approvalSummary(items: UltraMarketingApprovalItem[]) {
  return items.reduce(
    (summary, item) => {
      summary.total += 1
      if (item.status === 'draft') summary.draft += 1
      if (item.status === 'pending_approval') summary.pending += 1
      if (item.status === 'approved') summary.approved += 1
      if (item.status === 'rejected') summary.rejected += 1
      if (item.status === 'published') summary.published += 1
      if (isOpenApprovalStatus(item.status)) summary.open += 1
      return summary
    },
    { total: 0, open: 0, draft: 0, pending: 0, approved: 0, rejected: 0, published: 0 }
  )
}

export function buildApprovalTaskMetadata(input: {
  action_type?: string | null
  channel?: string | null
  summary?: string | null
  draft_preview?: string | null
  requested_action?: string | null
  source?: string | null
  external_reference?: string | null
  extra?: Record<string, unknown> | null
} = {}) {
  return {
    ...(input.extra || {}),
    kind: ULTRA_MARKETING_APPROVAL_KIND,
    action_type: input.action_type || 'marketing_action',
    channel: input.channel || null,
    summary: input.summary || null,
    draft_preview: input.draft_preview || null,
    requested_action: input.requested_action || null,
    source: input.source || 'ultra_marketing_assistant',
    external_reference: input.external_reference || null,
    external_action: 'approval_required_before_execution',
  }
}
