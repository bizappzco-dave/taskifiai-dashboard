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

const queriesPath = path.resolve('src/lib/queries.ts')
const queriesSource = fs.readFileSync(queriesPath, 'utf8')
const workspaceRouteSource = fs.readFileSync(path.resolve('src/app/api/client/ultra-marketing/workspace/route.ts'), 'utf8')
const workspacePageSource = fs.readFileSync(path.resolve('src/app/client/ultra-marketing/page.tsx'), 'utf8')

function functionBody(name: string): string {
  const marker = `export async function ${name}`
  const start = queriesSource.indexOf(marker)
  assert.notEqual(start, -1, `${name} must exist`)

  const nextFunction = queriesSource.indexOf('\nexport async function ', start + marker.length)
  return queriesSource.slice(start, nextFunction === -1 ? undefined : nextFunction)
}

test('Ultra Marketing enable/disable persist explicit workspace feature states', () => {
  const enableBody = functionBody('enableUltraMarketing')
  const disableBody = functionBody('disableUltraMarketing')

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

test('Ultra Marketing workspace API is tenant-gated and client-safe', () => {
  const guardIndex = workspaceRouteSource.indexOf('requireClientRouteAccess(request, clientId)')
  const adminIndex = workspaceRouteSource.indexOf('getSupabaseAdmin()')

  assert.match(workspaceRouteSource, /export const dynamic = 'force-dynamic'/)
  assert.notEqual(guardIndex, -1, 'workspace API must require route access')
  assert.notEqual(adminIndex, -1, 'workspace API uses service role only after access guard')
  assert.ok(guardIndex < adminIndex, 'workspace API must check client access before service-role reads')
  assert.doesNotMatch(workspaceRouteSource, /SUPABASE_SECRET_KEY|SERVICE_ROLE|HERMES|VPS/i)
  assert.doesNotMatch(workspacePageSource, /Hermes|VPS|service role|Supabase/i, 'client workspace page must hide backend mechanics')
})
