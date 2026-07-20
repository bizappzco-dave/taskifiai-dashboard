import { NextResponse } from 'next/server'
import { requireClientRouteAccess } from '@/lib/client-access'
import { getSupabaseAdmin } from '@/lib/supabase'
import { logActivity } from '@/lib/queries'
import { isUltraMarketingEnabled } from '@/lib/ultra-marketing'
import {
  approvalItemFromTask,
  approvalSeedReference,
  buildAssistantSuggestionApprovalTasks,
  buildPostingDraftApprovalTask,
  ULTRA_MARKETING_APPROVAL_KIND,
  ULTRA_MARKETING_APPROVAL_SOURCES,
} from '@/lib/ultra-marketing-approvals'

export const dynamic = 'force-dynamic'

type SeedSource = 'posting_drafts' | 'assistant_suggestions'

const DEFAULT_SOURCES: SeedSource[] = ['assistant_suggestions', 'posting_drafts']

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

function approvalSelect() {
  return 'id, client_id, title, description, status, priority, due_date, completed_at, metadata, created_at, updated_at'
}

function seedSources(body: any): SeedSource[] | null {
  const rawSources = Array.isArray(body?.sources)
    ? body.sources
    : typeof body?.source === 'string'
      ? [body.source]
      : DEFAULT_SOURCES

  const unique = [...new Set(rawSources.map((source) => String(source)))]
  if (unique.some((source) => !DEFAULT_SOURCES.includes(source as SeedSource))) return null
  return unique as SeedSource[]
}

function safeLimit(value: unknown) {
  const parsed = Number(value || 10)
  return Number.isFinite(parsed) ? Math.max(1, Math.min(25, parsed)) : 10
}

async function requireUltraMarketingAccess(request: Request, clientId: string) {
  const accessResult = await requireClientRouteAccess(request, clientId, { minimumRole: 'editor' })
  if (accessResult.response) return { response: accessResult.response }

  if (!isUltraMarketingEnabled(accessResult.access.client)) {
    return { response: NextResponse.json({ error: 'Ultra Marketing is not enabled for this client' }, { status: 403 }) }
  }

  return { access: accessResult.access }
}

async function existingApprovalReferences(supabaseAdmin: any, clientId: string) {
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .select('id, metadata')
    .eq('client_id', clientId)
    .filter('metadata->>kind', 'eq', ULTRA_MARKETING_APPROVAL_KIND)
    .limit(500)

  if (error) throw error
  const refs = new Set<string>()
  ;(data || []).forEach((task: any) => {
    const reference = approvalSeedReference(task.metadata)
    if (reference) refs.add(reference)
  })
  return refs
}

async function seedPostingDrafts(supabaseAdmin: any, clientId: string, userId: string, existingRefs: Set<string>, limit: number) {
  const { data: posts, error } = await supabaseAdmin
    .from('posts')
    .select('id, client_id, submission_id, caption, hashtags, image_urls, platform, status, scheduled_for, created_at')
    .eq('client_id', clientId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows = (posts || [])
    .map((post: any) => buildPostingDraftApprovalTask(post, { createdBy: userId }))
    .filter((row: any) => {
      const reference = approvalSeedReference(row.metadata)
      return reference && !existingRefs.has(reference)
    })

  rows.forEach((row) => {
    const reference = approvalSeedReference(row.metadata)
    if (reference) existingRefs.add(reference)
  })

  return {
    rows,
    scanned: (posts || []).length,
    source: ULTRA_MARKETING_APPROVAL_SOURCES.postingDrafts,
  }
}

async function seedAssistantSuggestions(client: any, userId: string, existingRefs: Set<string>) {
  const rows = buildAssistantSuggestionApprovalTasks(client, { createdBy: userId })
    .filter((row: any) => {
      const reference = approvalSeedReference(row.metadata)
      return reference && !existingRefs.has(reference)
    })

  rows.forEach((row) => {
    const reference = approvalSeedReference(row.metadata)
    if (reference) existingRefs.add(reference)
  })

  return {
    rows,
    scanned: 3,
    source: ULTRA_MARKETING_APPROVAL_SOURCES.assistantSuggestions,
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const clientId = body.client_id
    if (!clientId || typeof clientId !== 'string') return badRequest('client_id is required')

    const sources = seedSources(body)
    if (!sources) return badRequest('source must be assistant_suggestions, posting_drafts, or a sources array using those values')

    const accessResult = await requireUltraMarketingAccess(request, clientId)
    if (accessResult.response) return accessResult.response

    const supabaseAdmin = getSupabaseAdmin() as any
    const existingRefs = await existingApprovalReferences(supabaseAdmin, clientId)
    const limit = safeLimit(body.limit)
    const seedResults = []

    for (const source of sources) {
      if (source === 'posting_drafts') {
        seedResults.push(await seedPostingDrafts(supabaseAdmin, clientId, accessResult.access.userId, existingRefs, limit))
      }
      if (source === 'assistant_suggestions') {
        seedResults.push(await seedAssistantSuggestions(accessResult.access.client, accessResult.access.userId, existingRefs))
      }
    }

    const rows = seedResults.flatMap((result) => result.rows)
    let created: any[] = []

    if (rows.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('tasks')
        .insert(rows as any)
        .select(approvalSelect())

      if (error) throw error
      created = data || []

      await logActivity({
        client_id: clientId,
        product: 'ultra-marketing',
        activity_type: 'approval_queue_seeded',
        title: 'Approval queue seeded',
        description: `${created.length} approval item${created.length === 1 ? '' : 's'} added from assistant suggestions or posting drafts.`,
        activity_category: 'operations',
        details: {
          sources,
          created_count: created.length,
          external_action: 'not_executed_by_seed',
        },
      })
    }

    return NextResponse.json({
      success: true,
      created_count: created.length,
      skipped_count: seedResults.reduce((sum, result) => sum + Math.max(0, result.scanned - result.rows.length), 0),
      scanned_count: seedResults.reduce((sum, result) => sum + result.scanned, 0),
      sources,
      approvals: created.map(approvalItemFromTask),
      policy: {
        external_action_executed: false,
        publishing_requires_separate_workflow: true,
      },
    }, { status: rows.length > 0 ? 201 : 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Approval queue could not be seeded' }, { status: 500 })
  }
}
