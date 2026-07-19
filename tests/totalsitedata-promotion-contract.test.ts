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
const scriptPath = path.resolve('scripts/smoke-totalsitedata-promotion.sh')

test('sample TotalSiteData promotion payload fixture validates and maps cleanly', () => {
  const raw = fs.readFileSync(fixturePath, 'utf8')
  const payload = JSON.parse(raw)
  const validation = validateTotalSiteDataPromotionPayload(payload)

  assert.equal(validation.success, true)
  assert.equal(validation.data?.business_name, 'TEST TotalSiteData Warm Prospect')
  assert.equal(mapPromotionPayloadToLeadSource(validation.data!), 'website_form')
  assert.equal(mapPromotionPayloadToLeadStage(validation.data!), 'qualified')
})

test('smoke script exists and targets the internal promotion route with supported auth headers', () => {
  const script = fs.readFileSync(scriptPath, 'utf8')

  assert.match(script, /\/api\/internal\/totalsitedata\/promote/)
  assert.match(script, /Authorization: Bearer/)
  assert.match(script, /x-totalsitedata-secret/)
  assert.match(script, /tests\/fixtures\/totalsitedata-promotion\.payload\.json/)
})
