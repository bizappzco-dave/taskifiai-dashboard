export const ULTRA_MARKETING_APPROVAL_KIND = 'ultra_marketing_approval'

export const ULTRA_MARKETING_APPROVAL_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'published',
] as const

export const ULTRA_MARKETING_OPEN_APPROVAL_STATUSES = ['draft', 'pending', 'pending_approval']

export const ULTRA_MARKETING_APPROVAL_SOURCES = {
  postingDrafts: 'taskifiai_posting_drafts',
  assistantSuggestions: 'ultra_marketing_assistant_suggestions',
} as const

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

export type UltraMarketingApprovalTaskInsert = {
  client_id: string
  title: string
  description: string | null
  status: 'draft' | 'pending_approval'
  priority: string
  due_date: string | null
  created_by: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
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

function arrayOfText(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}

function trimPreview(value: unknown, limit = 700) {
  const text = textOrNull(value)
  if (!text) return null
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text
}

function postDraftPreview(post: any) {
  const caption = trimPreview(post?.caption, 900) || 'Draft caption is ready for review.'
  const hashtags = arrayOfText(post?.hashtags).join(' ')
  return hashtags ? `${caption}\n\n${hashtags}` : caption
}

export function approvalSeedReference(metadata: unknown): string | null {
  return textOrNull(approvalObjectOrEmpty(metadata).external_reference)
}

export function buildPostingDraftApprovalTask(
  post: any,
  options: { createdBy?: string | null; now?: string } = {}
): UltraMarketingApprovalTaskInsert {
  const now = options.now || new Date().toISOString()
  const platform = textOrNull(post?.platform) || 'instagram'
  const postId = String(post?.id || '')
  const imageUrls = arrayOfText(post?.image_urls)

  return {
    client_id: String(post?.client_id || ''),
    title: `Approve ${platform} post draft`,
    description: 'Review this SocialDrive/posting draft before it can be published.',
    status: 'pending_approval',
    priority: 'medium',
    due_date: null,
    created_by: options.createdBy || null,
    metadata: buildApprovalTaskMetadata({
      action_type: 'social_post',
      channel: platform,
      summary: trimPreview(post?.caption, 360) || 'Social post draft waiting for review.',
      draft_preview: postDraftPreview(post),
      requested_action: 'Approve this post for publishing',
      source: ULTRA_MARKETING_APPROVAL_SOURCES.postingDrafts,
      external_reference: `post:${postId}`,
      extra: {
        source_table: 'posts',
        post_id: postId,
        image_count: imageUrls.length,
        original_status: textOrNull(post?.status) || 'draft',
      },
    }),
    created_at: now,
    updated_at: now,
  }
}

export function buildAssistantSuggestionApprovalTasks(
  client: any,
  options: { createdBy?: string | null; now?: string } = {}
): UltraMarketingApprovalTaskInsert[] {
  const now = options.now || new Date().toISOString()
  const clientId = String(client?.id || '')
  const name = textOrNull(client?.business_name || client?.name) || 'this client'
  const common = {
    client_id: clientId,
    status: 'pending_approval' as const,
    priority: 'medium',
    due_date: null,
    created_by: options.createdBy || null,
    created_at: now,
    updated_at: now,
  }

  return [
    {
      ...common,
      title: 'Approve assistant social post suggestion',
      description: `Let the assistant prepare a social post draft for ${name}.`,
      metadata: buildApprovalTaskMetadata({
        action_type: 'social_content_draft',
        channel: 'instagram',
        summary: `Prepare a client-safe social post idea for ${name} using the latest business context.`,
        draft_preview: 'Suggested action: create a fresh social post draft for review. No post will be published from this approval.',
        requested_action: 'Approve assistant to draft content',
        source: ULTRA_MARKETING_APPROVAL_SOURCES.assistantSuggestions,
        external_reference: 'assistant-suggestion:social_content_draft',
      }),
    },
    {
      ...common,
      title: 'Approve local visibility suggestion',
      description: `Let the assistant prepare a local visibility update for ${name}.`,
      metadata: buildApprovalTaskMetadata({
        action_type: 'local_visibility_update',
        channel: 'google_business_profile',
        summary: `Review recent visibility signals and propose the next local update for ${name}.`,
        draft_preview: 'Suggested action: draft a local update or GBP post for approval. No public reply or profile change happens from this approval.',
        requested_action: 'Approve assistant to prepare local update',
        source: ULTRA_MARKETING_APPROVAL_SOURCES.assistantSuggestions,
        external_reference: 'assistant-suggestion:local_visibility_update',
      }),
    },
    {
      ...common,
      title: 'Approve follow-up message suggestion',
      description: `Let the assistant prepare a follow-up message draft for ${name}.`,
      metadata: buildApprovalTaskMetadata({
        action_type: 'lead_follow_up_draft',
        channel: 'email',
        summary: `Prepare a reusable follow-up message draft for recent enquiries or warm leads for ${name}.`,
        draft_preview: 'Suggested action: draft a follow-up message for review. No email, DM or WhatsApp message is sent from this approval.',
        requested_action: 'Approve assistant to draft follow-up',
        source: ULTRA_MARKETING_APPROVAL_SOURCES.assistantSuggestions,
        external_reference: 'assistant-suggestion:lead_follow_up_draft',
      }),
    },
  ]
}
