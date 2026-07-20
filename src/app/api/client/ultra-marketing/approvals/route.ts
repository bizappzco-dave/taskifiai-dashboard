import { NextResponse } from 'next/server'
import { requireClientRouteAccess } from '@/lib/client-access'
import { getSupabaseAdmin } from '@/lib/supabase'
import { logActivity } from '@/lib/queries'
import { isUltraMarketingEnabled } from '@/lib/ultra-marketing'
import {
  approvalItemFromTask,
  approvalObjectOrEmpty,
  approvalStatusForDecision,
  approvalSummary,
  buildApprovalTaskMetadata,
  isOpenApprovalStatus,
  ULTRA_MARKETING_APPROVAL_KIND,
  ULTRA_MARKETING_OPEN_APPROVAL_STATUSES,
} from '@/lib/ultra-marketing-approvals'

export const dynamic = 'force-dynamic'

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

function approvalSelect() {
  return 'id, client_id, title, description, status, priority, due_date, completed_at, metadata, created_at, updated_at'
}

function parseLimit(url: URL) {
  const raw = Number(url.searchParams.get('limit') || 25)
  return Number.isFinite(raw) ? Math.max(1, Math.min(50, raw)) : 25
}

function statusFilter(url: URL) {
  return url.searchParams.get('status') || 'open'
}

function applyApprovalStatusFilter(query: any, status: string) {
  if (status === 'all') return query
  if (status === 'open') return query.in('status', ULTRA_MARKETING_OPEN_APPROVAL_STATUSES)
  return query.eq('status', status === 'pending' ? 'pending_approval' : status)
}

async function requireUltraMarketingAccess(request: Request, clientId: string, minimumRole = 'viewer') {
  const accessResult = await requireClientRouteAccess(request, clientId, { minimumRole })
  if (accessResult.response) return { response: accessResult.response }

  if (!isUltraMarketingEnabled(accessResult.access.client)) {
    return { response: NextResponse.json({ error: 'Ultra Marketing is not enabled for this client' }, { status: 403 }) }
  }

  return { access: accessResult.access }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const clientId = url.searchParams.get('client_id')
    if (!clientId) return badRequest('client_id is required')

    const accessResult = await requireUltraMarketingAccess(request, clientId)
    if (accessResult.response) return accessResult.response

    const supabaseAdmin = getSupabaseAdmin() as any
    let query = supabaseAdmin
      .from('tasks')
      .select(approvalSelect(), { count: 'exact' })
      .eq('client_id', clientId)
      .filter('metadata->>kind', 'eq', ULTRA_MARKETING_APPROVAL_KIND)
      .order('created_at', { ascending: false })
      .limit(parseLimit(url))

    query = applyApprovalStatusFilter(query, statusFilter(url))

    const { data, error, count } = await query
    if (error) throw error

    const approvals = (data || []).map(approvalItemFromTask)

    return NextResponse.json({
      approvals,
      summary: {
        ...approvalSummary(approvals),
        total_matching: count || approvals.length,
      },
      policy: {
        external_actions: 'approval_required',
        decisions_execute_external_actions: false,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Approval queue could not load' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const clientId = body.client_id
    if (!clientId || typeof clientId !== 'string') return badRequest('client_id is required')
    if (!body.title || typeof body.title !== 'string') return badRequest('title is required')

    const accessResult = await requireUltraMarketingAccess(request, clientId, 'editor')
    if (accessResult.response) return accessResult.response

    const supabaseAdmin = getSupabaseAdmin() as any
    const now = new Date().toISOString()
    const metadata = buildApprovalTaskMetadata({
      action_type: typeof body.action_type === 'string' ? body.action_type : null,
      channel: typeof body.channel === 'string' ? body.channel : null,
      summary: typeof body.summary === 'string' ? body.summary : null,
      draft_preview: typeof body.draft_preview === 'string' ? body.draft_preview : null,
      requested_action: typeof body.requested_action === 'string' ? body.requested_action : null,
      source: typeof body.source === 'string' ? body.source : null,
      external_reference: typeof body.external_reference === 'string' ? body.external_reference : null,
      extra: approvalObjectOrEmpty(body.metadata),
    })

    const { data: created, error } = await (supabaseAdmin as any)
      .from('tasks')
      .insert([{
        client_id: clientId,
        title: body.title.trim(),
        description: typeof body.description === 'string' ? body.description.trim() || null : null,
        status: body.status === 'draft' ? 'draft' : 'pending_approval',
        priority: typeof body.priority === 'string' ? body.priority : 'medium',
        due_date: typeof body.due_date === 'string' ? body.due_date : null,
        created_by: accessResult.access.userId,
        metadata,
        created_at: now,
        updated_at: now,
      }] as any)
      .select(approvalSelect())
      .single()

    if (error) throw error

    await logActivity({
      client_id: clientId,
      product: 'ultra-marketing',
      activity_type: 'approval_requested',
      title: `Approval requested: ${created.title}`,
      description: created.description || 'A marketing action is waiting for approval.',
      activity_category: 'operations',
      details: {
        approval_id: created.id,
        action_type: metadata.action_type,
        external_action: 'not_executed_by_queue',
      },
    })

    return NextResponse.json({ approval: approvalItemFromTask(created) }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Approval request could not be created' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const clientId = body.client_id
    const approvalId = body.approval_id
    if (!clientId || typeof clientId !== 'string') return badRequest('client_id is required')
    if (!approvalId || typeof approvalId !== 'string') return badRequest('approval_id is required')

    const decisionStatus = approvalStatusForDecision(body.decision)
    if (!decisionStatus) return badRequest('decision must be approve or reject')

    const accessResult = await requireUltraMarketingAccess(request, clientId, 'editor')
    if (accessResult.response) return accessResult.response

    const supabaseAdmin = getSupabaseAdmin() as any
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('tasks')
      .select(approvalSelect())
      .eq('client_id', clientId)
      .eq('id', approvalId)
      .filter('metadata->>kind', 'eq', ULTRA_MARKETING_APPROVAL_KIND)
      .maybeSingle()

    if (existingError) throw existingError
    if (!existing) return NextResponse.json({ error: 'Approval item not found' }, { status: 404 })
    if (!isOpenApprovalStatus(existing.status)) {
      return NextResponse.json({ error: 'Approval item has already been reviewed' }, { status: 409 })
    }

    const now = new Date().toISOString()
    const metadata = {
      ...approvalObjectOrEmpty(existing.metadata),
      review_note: typeof body.note === 'string' ? body.note.trim() || null : null,
      reviewed_at: now,
      reviewed_by: accessResult.access.userId,
      decision: decisionStatus,
      external_action: 'not_executed_by_queue',
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('tasks')
      .update({
        status: decisionStatus,
        completed_at: now,
        updated_at: now,
        metadata,
      })
      .eq('client_id', clientId)
      .eq('id', approvalId)
      .select(approvalSelect())
      .single()

    if (updateError) throw updateError

    await logActivity({
      client_id: clientId,
      product: 'ultra-marketing',
      activity_type: decisionStatus === 'approved' ? 'approval_approved' : 'approval_rejected',
      title: `${decisionStatus === 'approved' ? 'Approved' : 'Rejected'}: ${updated.title}`,
      description: decisionStatus === 'approved'
        ? 'A marketing action was approved. External execution still requires the connected workflow to run separately.'
        : 'A marketing action was rejected and will not be executed.',
      activity_category: 'operations',
      details: {
        approval_id: updated.id,
        decision: decisionStatus,
        external_action: 'not_executed_by_queue',
      },
    })

    return NextResponse.json({
      approval: approvalItemFromTask(updated),
      policy: {
        external_action_executed: false,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Approval item could not be updated' }, { status: 500 })
  }
}
