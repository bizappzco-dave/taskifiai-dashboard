import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  buildUltraMarketingWorkspace,
  isUltraMarketingEnabled,
  pauseUltraMarketingFeature,
  provisionUltraMarketingFeature,
  ULTRA_MARKETING_APPROVAL_POLICY,
} from '../src/lib/ultra-marketing'
import {
  approvalItemFromTask,
  approvalStatusForDecision,
  buildApprovalTaskMetadata,
  isOpenApprovalStatus,
  ULTRA_MARKETING_APPROVAL_KIND,
} from '../src/lib/ultra-marketing-approvals'

const queriesPath = path.resolve('src/lib/queries.ts')
const queriesSource = fs.readFileSync(queriesPath, 'utf8')
const workspaceRouteSource = fs.readFileSync(path.resolve('src/app/api/client/ultra-marketing/workspace/route.ts'), 'utf8')
const approvalsRouteSource = fs.readFileSync(path.resolve('src/app/api/client/ultra-marketing/approvals/route.ts'), 'utf8')
const workspacePageSource = fs.readFileSync(path.resolve('src/app/client/ultra-marketing/page.tsx'), 'utf8')

function exportedFunctionBody(source: string, name: string): string {
  const marker = `export async function ${name}`
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `${name} must exist`)

  const nextFunction = source.indexOf('\nexport async function ', start + marker.length)
  return source.slice(start, nextFunction === -1 ? undefined : nextFunction)
}

function queryFunctionBody(name: string): string {
  return exportedFunctionBody(queriesSource, name)
}

test('Ultra Marketing enable/disable persist explicit workspace feature states', () => {
  const enableBody = queryFunctionBody('enableUltraMarketing')
  const disableBody = queryFunctionBody('disableUltraMarketing')

  assert.match(enableBody, /provisionUltraMarketingFeature/, 'enableUltraMarketing must provision the workspace feature contract')
  assert.match(disableBody, /pauseUltraMarketingFeature/, 'disableUltraMarketing must pause the workspace feature contract')
  assert.match(enableBody, /withProductFeature\(client,\s*ULTRA_MARKETING_PRODUCT_KEY/, 'enable state must persist under features.products.ultra_marketing')
  assert.match(disableBody, /withProductFeature\(client,\s*ULTRA_MARKETING_PRODUCT_KEY/, 'pause state must persist under features.products.ultra_marketing')
})

test('Ultra Marketing provisioning creates tenant-scoped assistant workspace metadata', () => {
  const now = '2026-07-19T12:00:00.000Z'
  const client = {
    id: '11111111-2222-3333-4444-555555555555',
    name: 'Example Motors',
    tier: 'growth',
    features: {},
  }

  const feature = provisionUltraMarketingFeature(client, { actorId: 'user-123', now })

  assert.equal(feature.enabled, true)
  assert.equal(feature.status, 'active')
  assert.equal(feature.approval_policy, ULTRA_MARKETING_APPROVAL_POLICY)
  assert.ok(feature.allowed_workflows?.includes('approval_queue'))
  assert.equal(feature.workspace?.client_id, client.id)
  assert.equal(feature.workspace?.display_name, 'Example Motors Marketing Workspace')
  assert.equal(feature.workspace?.status, 'active')
  assert.equal(feature.workspace?.access_model, 'shared_tenant_isolated_runtime')
  assert.equal(feature.workspace?.provisioned_at, now)
  assert.equal(feature.workspace?.provisioned_by, 'user-123')
  assert.equal(isUltraMarketingEnabled({ ...client, features: { products: { ultra_marketing: feature } } }), true)
})

test('Ultra Marketing pause preserves workspace identity and disables access flag', () => {
  const enabledAt = '2026-07-19T12:00:00.000Z'
  const pausedAt = '2026-07-19T13:00:00.000Z'
  const client = {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    name: 'Example Clinic',
    features: {
      products: {
        ultra_marketing: provisionUltraMarketingFeature(
          { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', name: 'Example Clinic', features: {} },
          { actorId: 'owner-1', now: enabledAt }
        ),
      },
    },
  }

  const paused = pauseUltraMarketingFeature(client, { actorId: 'owner-2', now: pausedAt })

  assert.equal(paused.enabled, false)
  assert.equal(paused.status, 'paused')
  assert.equal(paused.paused_at, pausedAt)
  assert.equal(paused.workspace?.id, buildUltraMarketingWorkspace(client).id)
  assert.equal(paused.workspace?.status, 'paused')
  assert.equal(isUltraMarketingEnabled({ ...client, features: { products: { ultra_marketing: paused } } }), false)
})

test('Ultra Marketing approval items use existing tasks as a safe decision queue', () => {
  const metadata = buildApprovalTaskMetadata({
    action_type: 'social_post',
    channel: 'instagram',
    summary: 'Approve a drafted post for Friday.',
    draft_preview: 'New summer offer copy',
    requested_action: 'Approve post',
    source: 'assistant_workspace',
    external_reference: 'draft-123',
  })

  assert.equal(metadata.kind, ULTRA_MARKETING_APPROVAL_KIND)
  assert.equal(metadata.external_action, 'approval_required_before_execution')

  const approval = approvalItemFromTask({
    id: 'task-1',
    client_id: 'client-1',
    title: 'Friday post approval',
    description: 'Check tone and offer.',
    status: 'pending',
    priority: 'high',
    due_date: '2026-07-21T10:00:00.000Z',
    metadata,
    created_at: '2026-07-20T10:00:00.000Z',
    updated_at: '2026-07-20T10:00:00.000Z',
  })

  assert.equal(approval.status, 'pending_approval')
  assert.equal(approval.action_type, 'social_post')
  assert.equal(approval.channel, 'instagram')
  assert.equal(approval.draft_preview, 'New summer offer copy')
  assert.equal(isOpenApprovalStatus(approval.status), true)
  assert.equal(approvalStatusForDecision('approve'), 'approved')
  assert.equal(approvalStatusForDecision('reject'), 'rejected')
  assert.equal(approvalStatusForDecision('publish'), null)
})

test('Ultra Marketing workspace API is tenant-gated and client-safe', () => {
  const getBody = exportedFunctionBody(workspaceRouteSource, 'GET')
  const guardIndex = getBody.indexOf('requireClientRouteAccess(request, clientId)')
  const adminIndex = getBody.indexOf('getSupabaseAdmin()')

  assert.match(workspaceRouteSource, /export const dynamic = 'force-dynamic'/)
  assert.notEqual(guardIndex, -1, 'workspace API must require route access')
  assert.notEqual(adminIndex, -1, 'workspace API uses admin reads only after access guard')
  assert.ok(guardIndex < adminIndex, 'workspace API must check client access before admin reads')
  assert.match(workspaceRouteSource, /from\('tasks'\)/, 'workspace summary must read approval queue tasks')
  assert.match(workspaceRouteSource, /metadata->>kind/, 'workspace summary must only count approval tasks')
  assert.doesNotMatch(workspaceRouteSource, /SUPABASE_SECRET_KEY|SERVICE_ROLE|HERMES|VPS/i)
  assert.doesNotMatch(workspacePageSource, /Hermes|VPS|service role|Supabase/i, 'client workspace page must hide backend mechanics')
})

test('Ultra Marketing approvals API guards access and records decisions without external execution', () => {
  const getBody = exportedFunctionBody(approvalsRouteSource, 'GET')
  const postBody = exportedFunctionBody(approvalsRouteSource, 'POST')
  const patchBody = exportedFunctionBody(approvalsRouteSource, 'PATCH')

  assert.match(approvalsRouteSource, /export const dynamic = 'force-dynamic'/)
  assert.ok(getBody.indexOf('requireUltraMarketingAccess(request, clientId)') < getBody.indexOf('getSupabaseAdmin()'))
  assert.match(postBody, /requireUltraMarketingAccess\(request, clientId, 'editor'\)/)
  assert.match(patchBody, /requireUltraMarketingAccess\(request, clientId, 'editor'\)/)
  assert.match(approvalsRouteSource, /eq\('client_id', clientId\)/, 'approval items must stay client-scoped')
  assert.match(approvalsRouteSource, /metadata->>kind/, 'approval API must only read approval queue tasks')
  assert.match(approvalsRouteSource, /decisions_execute_external_actions: false/)
  assert.match(approvalsRouteSource, /external_action_executed: false/)
  assert.match(approvalsRouteSource, /not_executed_by_queue/)
  assert.doesNotMatch(approvalsRouteSource, /Ollama|ChatGPT|OpenAI|Hermes|VPS|service role|SUPABASE_SECRET_KEY/i)
})

test('Ultra Marketing workspace page exposes approval review UI without backend mechanics', () => {
  assert.match(workspacePageSource, /\/api\/client\/ultra-marketing\/approvals/)
  assert.match(workspacePageSource, /method: 'PATCH'/)
  assert.match(workspacePageSource, /Approval queue/)
  assert.match(workspacePageSource, /No external publishing or sending happened from this queue/)
  assert.doesNotMatch(workspacePageSource, /Ollama|ChatGPT|OpenAI|Hermes|VPS|service role|Supabase/i)
})
