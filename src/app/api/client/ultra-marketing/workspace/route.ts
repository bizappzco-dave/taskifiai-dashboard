import { NextResponse } from 'next/server'
import { requireClientRouteAccess } from '@/lib/client-access'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getClient, getClientActivities } from '@/lib/queries'
import {
  buildUltraMarketingWorkspace,
  getUltraMarketingFeature,
  isUltraMarketingEnabled,
  ULTRA_MARKETING_APPROVAL_POLICY,
  ULTRA_MARKETING_WORKFLOWS,
} from '@/lib/ultra-marketing'
import {
  approvalItemFromTask,
  approvalSummary,
  ULTRA_MARKETING_APPROVAL_KIND,
  ULTRA_MARKETING_OPEN_APPROVAL_STATUSES,
} from '@/lib/ultra-marketing-approvals'

export const dynamic = 'force-dynamic'

const openLeadStatuses = ['new_lead', 'contacted', 'qualified', 'quoted', 'follow_up']

const workflowLabels: Record<string, { label: string; description: string }> = {
  marketing_analysis: {
    label: 'Marketing analysis',
    description: 'Summarise reports, leads, activities and growth signals into next actions.',
  },
  social_content_drafts: {
    label: 'Social content drafts',
    description: 'Prepare captions, post ideas and creative briefs for approval.',
  },
  email_campaign_drafts: {
    label: 'Email campaign drafts',
    description: 'Draft campaign copy and follow-up sequences before any send is approved.',
  },
  gbp_post_drafts: {
    label: 'Google Business Profile drafts',
    description: 'Prepare GBP post and update ideas for admin review.',
  },
  review_response_drafts: {
    label: 'Review response drafts',
    description: 'Draft review replies while keeping public responses approval-gated.',
  },
  paid_ads_intelligence: {
    label: 'Paid ads intelligence',
    description: 'Highlight account alerts and recommendations without changing spend automatically.',
  },
  approval_queue: {
    label: 'Approval queue',
    description: 'Keep publish, send, reply and spend-changing actions waiting for approval.',
  },
}

function safeNumber(value: number | null | undefined) {
  return typeof value === 'number' ? value : 0
}

function workflowCards(workflows: string[]) {
  return workflows.map((key) => ({
    key,
    label: workflowLabels[key]?.label || key.replace(/_/g, ' '),
    description: workflowLabels[key]?.description || 'Assistant workflow available in this workspace.',
    status: key === 'approval_queue' ? 'approval_required' : 'ready_for_drafts',
  }))
}

function sanitizeWorkspace(workspace: ReturnType<typeof buildUltraMarketingWorkspace>) {
  return {
    id: workspace.id,
    display_name: workspace.display_name,
    assistant_label: workspace.assistant_label,
    status: workspace.status,
    workspace_type: workspace.workspace_type,
    approval_policy: workspace.approval_policy,
    allowed_workflows: workspace.allowed_workflows,
    connected_account_status: workspace.connected_account_status,
    provisioned_at: workspace.provisioned_at,
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const clientId = url.searchParams.get('client_id')

    if (!clientId) {
      return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
    }

    const accessResult = await requireClientRouteAccess(request, clientId)
    if (accessResult.response) return accessResult.response

    const client = await getClient(clientId)
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (!isUltraMarketingEnabled(client)) {
      return NextResponse.json({ error: 'Ultra Marketing is not enabled for this client' }, { status: 403 })
    }

    const feature = getUltraMarketingFeature(client)
    const workspace = buildUltraMarketingWorkspace(client, { status: feature.status || 'active' })
    const workflows = Array.isArray(workspace.allowed_workflows) && workspace.allowed_workflows.length > 0
      ? workspace.allowed_workflows
      : ULTRA_MARKETING_WORKFLOWS
    const supabaseAdmin = getSupabaseAdmin() as any

    const [activities, openLeadsResult, approvalTasksResult, approvalHistoryResult, latestClientReportResult, latestAdReportResult] = await Promise.all([
      getClientActivities(clientId, 8),
      supabaseAdmin
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .in('status', openLeadStatuses),
      supabaseAdmin
        .from('tasks')
        .select('id, client_id, title, description, status, priority, due_date, completed_at, metadata, created_at, updated_at', { count: 'exact' })
        .eq('client_id', clientId)
        .filter('metadata->>kind', 'eq', ULTRA_MARKETING_APPROVAL_KIND)
        .in('status', ULTRA_MARKETING_OPEN_APPROVAL_STATUSES)
        .order('created_at', { ascending: false })
        .limit(5),
      supabaseAdmin
        .from('tasks')
        .select('id, client_id, title, description, status, priority, due_date, completed_at, metadata, created_at, updated_at')
        .eq('client_id', clientId)
        .filter('metadata->>kind', 'eq', ULTRA_MARKETING_APPROVAL_KIND)
        .order('updated_at', { ascending: false })
        .limit(12),
      supabaseAdmin
        .from('client_reports')
        .select('id, title, report_type, status, score, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('ad_reports')
        .select('id, report_start_date, total_cost, total_clicks, total_impressions, avg_roas, created_at')
        .eq('client_id', clientId)
        .order('report_start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const latestClientReport = latestClientReportResult.error ? null : latestClientReportResult.data
    const latestAdReport = latestAdReportResult.error ? null : latestAdReportResult.data
    const approvals = approvalTasksResult.error ? [] : (approvalTasksResult.data || []).map(approvalItemFromTask)
    const approvalHistory = approvalHistoryResult.error ? [] : (approvalHistoryResult.data || []).map(approvalItemFromTask)
    const approvalsSummary = approvalSummary(approvals)

    return NextResponse.json({
      client: {
        id: client.id,
        name: client.name || client.business_name,
        industry: client.industry || null,
        tier: client.tier || client.subscription_tier || null,
      },
      workspace: sanitizeWorkspace(workspace),
      summary: {
        open_leads: safeNumber(openLeadsResult.count),
        pending_approvals: safeNumber(approvalTasksResult.count) || approvalsSummary.open,
        recent_activity: Array.isArray(activities) ? activities.length : 0,
        latest_report: latestClientReport
          ? {
              id: latestClientReport.id,
              title: latestClientReport.title,
              type: latestClientReport.report_type,
              status: latestClientReport.status,
              score: latestClientReport.score,
              created_at: latestClientReport.created_at,
            }
          : latestAdReport
            ? {
                id: latestAdReport.id,
                title: 'Paid media snapshot',
                type: 'ads',
                status: 'ready',
                score: latestAdReport.avg_roas || null,
                created_at: latestAdReport.report_start_date || latestAdReport.created_at,
              }
            : null,
      },
      modules: workflowCards(workflows),
      approval_defaults: [
        'Publishing social posts requires approval',
        'Sending email campaigns requires approval',
        'Replying publicly to reviews requires approval',
        'Changing ad spend or campaign settings requires explicit approval',
        'Connecting accounts or credentials requires attended admin approval',
      ],
      approvals,
      approval_history: approvalHistory,
      approvals_summary: {
        ...approvalsSummary,
        total_matching: approvalTasksResult.count || approvals.length,
      },
      recent_activity: (activities || []).map((activity: any) => ({
        id: activity.id,
        title: activity.title || activity.activity_type || 'Activity',
        description: activity.description || null,
        activity_type: activity.activity_type || null,
        created_at: activity.created_at || null,
      })),
      policy: {
        approval_policy: workspace.approval_policy || ULTRA_MARKETING_APPROVAL_POLICY,
        external_actions: 'approval_required',
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Workspace could not load' }, { status: 500 })
  }
}
