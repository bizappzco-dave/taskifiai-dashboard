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
  approvalSeedReference,
  approvalStatusForDecision,
  buildAssistantSuggestionApprovalTasks,
  buildApprovalTaskMetadata,
  buildPostingDraftApprovalTask,
  isOpenApprovalStatus,
  ULTRA_MARKETING_APPROVAL_KIND,
  ULTRA_MARKETING_APPROVAL_SOURCES,
} from '../src/lib/ultra-marketing-approvals'

const queriesPath = path.resolve('src/lib/queries.ts')
const queriesSource = fs.readFileSync(queriesPath, 'utf8')
const workspaceRouteSource = fs.readFileSync(path.resolve('src/app/api/client/ultra-marketing/workspace/route.ts'), 'utf8')
const approvalsRouteSource = fs.readFileSync(path.resolve('src/app/api/client/ultra-marketing/approvals/route.ts'), 'utf8')
const approvalSeedRouteSource = fs.readFileSync(path.resolve('src/app/api/client/ultra-marketing/approvals/seed/route.ts'), 'utf8')
const workspacePageSource = fs.readFileSync(path.resolve('src/app/client/ultra-marketing/page.tsx'), 'utf8')
const createPostRouteSource = fs.readFileSync(path.resolve('src/app/api/client/posts/create/route.ts'), 'utf8')
const publishPostRouteSource = fs.readFileSync(path.resolve('src/app/api/client/posting/publish/route.ts'), 'utf8')

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
  assert.equal(approval.external_reference, 'draft-123')
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
  assert.match(workspaceRouteSource, /approval_history/, 'workspace API must return approval history for the assistant workspace')
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
  assert.match(workspacePageSource, /Activity \/ Draft history/)
  assert.match(workspacePageSource, /approval_history/)
  assert.match(workspacePageSource, /type="search"/)
  assert.match(workspacePageSource, /Filter approval history/)
  assert.match(workspacePageSource, /Social content drafts/)
  assert.match(workspacePageSource, /Lead follow-up drafts/)
  assert.match(workspacePageSource, /case 'social_content_draft': return 'content'/)
  assert.match(workspacePageSource, /case 'lead_follow_up_draft': return 'lead'/)
  assert.match(workspacePageSource, /taskifi-approval-card-\$\{actionTypeTone\(approval.action_type\)\}/)
  assert.match(workspacePageSource, /taskifi-history-card-\$\{actionTypeTone\(item.action_type\)\}/)
  assert.match(workspacePageSource, /No external publishing or sending happened from this queue/)
  assert.doesNotMatch(workspacePageSource, /Ollama|ChatGPT|OpenAI|Hermes|VPS|service role|Supabase/i)
})

test('Ultra Marketing approval seeds build deterministic assistant and posting draft queue items', () => {
  const now = '2026-07-20T12:00:00.000Z'
  const postingSeed = buildPostingDraftApprovalTask({
    id: 'post-123',
    client_id: 'client-1',
    caption: 'Fresh offer for local customers',
    hashtags: ['#local', '#offer'],
    image_urls: ['https://example.com/photo.jpg'],
    platform: 'instagram',
    status: 'draft',
  }, { createdBy: 'user-1', now })

  assert.equal(postingSeed.client_id, 'client-1')
  assert.equal(postingSeed.status, 'pending_approval')
  assert.equal(postingSeed.priority, 'medium')
  assert.equal(postingSeed.metadata.kind, ULTRA_MARKETING_APPROVAL_KIND)
  assert.equal(postingSeed.metadata.source, ULTRA_MARKETING_APPROVAL_SOURCES.postingDrafts)
  assert.equal(postingSeed.metadata.external_reference, 'post:post-123')
  assert.equal(postingSeed.metadata.external_action, 'approval_required_before_execution')
  assert.equal(postingSeed.metadata.image_count, 1)
  assert.equal(postingSeed.metadata.original_status, 'draft')
  assert.equal(approvalSeedReference(postingSeed.metadata), 'post:post-123')

  const assistantSeeds = buildAssistantSuggestionApprovalTasks({ id: 'client-1', name: 'Example Motors' }, { createdBy: 'user-1', now })
  assert.equal(assistantSeeds.length, 3)
  assert.ok(assistantSeeds.every((seed) => seed.priority === 'medium'))
  assert.equal(assistantSeeds[0].metadata.source, ULTRA_MARKETING_APPROVAL_SOURCES.assistantSuggestions)
  assert.ok(new Set(assistantSeeds.map((seed) => seed.metadata.external_reference)).has('assistant-suggestion:social_content_draft'))
  assert.ok(assistantSeeds.every((seed) => seed.metadata.external_action === 'approval_required_before_execution'))
})

test('Ultra Marketing seed API imports both seed sources without executing external actions', () => {
  const postBody = exportedFunctionBody(approvalSeedRouteSource, 'POST')

  assert.match(approvalSeedRouteSource, /export const dynamic = 'force-dynamic'/)
  assert.match(approvalSeedRouteSource, /assistant_suggestions/)
  assert.match(approvalSeedRouteSource, /posting_drafts/)
  assert.match(approvalSeedRouteSource, /buildAssistantSuggestionApprovalTasks/)
  assert.match(approvalSeedRouteSource, /buildPostingDraftApprovalTask/)
  assert.match(approvalSeedRouteSource, /requireClientRouteAccess\(request, clientId, \{ minimumRole: 'editor' \}\)/)
  assert.match(approvalSeedRouteSource, /eq\('client_id', clientId\)/, 'seed reads and writes must stay client-scoped')
  assert.match(approvalSeedRouteSource, /metadata->>kind/, 'seed dedupe must only compare approval queue tasks')
  assert.match(approvalSeedRouteSource, /not_executed_by_seed/)
  assert.match(approvalSeedRouteSource, /external_action_executed: false/)
  assert.doesNotMatch(approvalSeedRouteSource, /fetch\(|UPLOAD_POST|sendEmail|post_now/i)
})

test('Posting draft creation seeds approval queue for Ultra Marketing clients', () => {
  const postBody = exportedFunctionBody(createPostRouteSource, 'POST')

  assert.match(createPostRouteSource, /buildPostingDraftApprovalTask/)
  assert.match(createPostRouteSource, /isUltraMarketingEnabled\(access\.client\)/)
  assert.match(postBody, /from\('tasks'\)/)
  assert.match(postBody, /approvalItemFromTask/)
  assert.match(postBody, /approval/)
  assert.doesNotMatch(postBody, /UPLOAD_POST|fetch\(/i, 'creating a draft approval must not publish externally')
})

test('Posting publish route requires approved queue item before external work for Ultra Marketing clients', () => {
  const postBody = exportedFunctionBody(publishPostRouteSource, 'POST')
  const guardIndex = postBody.indexOf('isUltraMarketingEnabled(access.client)')
  const jobIndex = postBody.indexOf("from('posting_jobs')")
  const uploadIndex = postBody.indexOf('const uploadPostApiKey')

  assert.match(publishPostRouteSource, /approvedPostReferences/)
  assert.match(publishPostRouteSource, /ULTRA_MARKETING_APPROVAL_KIND/)
  assert.match(publishPostRouteSource, /status', 'approved'/)
  assert.match(publishPostRouteSource, /external_action_executed: false/)
  assert.notEqual(guardIndex, -1, 'publish route must check Ultra Marketing gate')
  assert.notEqual(jobIndex, -1, 'publish route must still create jobs after approval')
  assert.notEqual(uploadIndex, -1, 'publish route must still integrate after approval')
  assert.ok(guardIndex < jobIndex, 'approval guard must run before posting jobs are created')
  assert.ok(guardIndex < uploadIndex, 'approval guard must run before external upload work')
})

test('Ultra Marketing workspace page can seed assistant suggestions and posting drafts', () => {
  assert.match(workspacePageSource, /\/api\/client\/ultra-marketing\/approvals\/seed/)
  assert.match(workspacePageSource, /assistant_suggestions/)
  assert.match(workspacePageSource, /posting_drafts/)
  assert.match(workspacePageSource, /Add suggestions/)
  assert.match(workspacePageSource, /Import drafts/)
  assert.match(workspacePageSource, /Nothing was published or sent/)
  assert.doesNotMatch(workspacePageSource, /Ollama|ChatGPT|OpenAI|Hermes|VPS|service role|Supabase/i)
})
