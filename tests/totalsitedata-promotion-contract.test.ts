import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  mapPromotionPayloadToLeadSource,
  mapPromotionPayloadToLeadStage,
  validateTotalSiteDataPromotionPayload,
} from '../src/lib/totalsitedata/promotion'

const fixturePath = path.resolve('tests/fixtures/totalsitedata-promotion.payload.json')
const promoteScriptPath = path.resolve('scripts/smoke-totalsitedata-promotion.sh')
const scanScriptPath = path.resolve('scripts/smoke-totalsitedata-scan.sh')
const scanRouteSource = fs.readFileSync(
  path.resolve('src/app/api/internal/totalsitedata/scan/route.ts'),
  'utf8'
)
const scanProcessRouteSource = fs.readFileSync(
  path.resolve('src/app/api/internal/totalsitedata/scan/process/route.ts'),
  'utf8'
)
const queueSource = fs.readFileSync(
  path.resolve('src/lib/totalsitedata/queue.ts'),
  'utf8'
)

test('sample TotalSiteData promotion payload fixture validates and maps cleanly', () => {
  const raw = fs.readFileSync(fixturePath, 'utf8')
  const payload = JSON.parse(raw)
  const validation = validateTotalSiteDataPromotionPayload(payload)

  assert.equal(validation.success, true)
  assert.equal(validation.data?.business_name, 'TEST TotalSiteData Warm Prospect')
  assert.equal(mapPromotionPayloadToLeadSource(validation.data!), 'website_form')
  assert.equal(mapPromotionPayloadToLeadStage(validation.data!), 'qualified')
})

test('smoke scripts exist and target the expected internal endpoints with supported auth headers', () => {
  const script = fs.readFileSync(promoteScriptPath, 'utf8')
  const scanScript = fs.readFileSync(scanScriptPath, 'utf8')

  assert.match(script, /\/api\/internal\/totalsitedata\/promote/)
  assert.match(script, /Authorization:\s*Bearer/)
  assert.match(script, /x-totalsitedata-secret/)
  assert.match(script, /tests\/fixtures\/totalsitedata-promotion\.payload\.json/)

  assert.match(scanScript, /\/api\/internal\/totalsitedata\/scan/)
  assert.match(scanScript, /\/api\/internal\/totalsitedata\/scan\/process/)
  assert.match(scanScript, /Authorization:\s*Bearer/)
})

test('scan enqueue route uses queue module and exposes rate limiting / queueing behavior', () => {
  assert.match(scanRouteSource, /TOTALSITEDATA_SCAN_RATE_LIMIT_WINDOW_SECONDS/)
  assert.match(scanRouteSource, /TOTALSITEDATA_SCAN_RATE_LIMIT_MAX_REQUESTS/)
  assert.match(scanRouteSource, /getIntEnv/)
  assert.match(scanRouteSource, /queued/)
  assert.match(scanRouteSource, /deduplicated/)
})

test('scan process route includes worker invocation and observability surface', () => {
  assert.match(scanProcessRouteSource, /export async function GET/)
  assert.match(scanProcessRouteSource, /getTotalSiteDataScanQueueHealth/)
  assert.match(scanProcessRouteSource, /processed/)
  assert.match(scanProcessRouteSource, /retry_waiting|queue/)
  assert.match(scanProcessRouteSource, /generated_at/)
})

test('scan queue module includes retry, dead-letter, and rate-limit metadata', () => {
  assert.match(queueSource, /TOTALSITEDATA_SCAN_DEDUPE_TTL_SECONDS/)
  assert.match(queueSource, /dead_letter/)
  assert.match(queueSource, /createRateLimitKey/)
  assert.match(queueSource, /getTotalSiteDataScanQueueHealth/)
  assert.match(queueSource, /requeued/)
  assert.match(queueSource, /makeMetaWithLifecycle/)
})
