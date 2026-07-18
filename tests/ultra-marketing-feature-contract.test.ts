import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const queriesPath = path.resolve('src/lib/queries.ts')
const queriesSource = fs.readFileSync(queriesPath, 'utf8')

function functionBody(name: string): string {
  const marker = `export async function ${name}`
  const start = queriesSource.indexOf(marker)
  assert.notEqual(start, -1, `${name} must exist`)

  const nextFunction = queriesSource.indexOf('\nexport async function ', start + marker.length)
  return queriesSource.slice(start, nextFunction === -1 ? undefined : nextFunction)
}

test('Ultra Marketing enable/disable persist explicit feature enabled flags', () => {
  const enableBody = functionBody('enableUltraMarketing')
  const disableBody = functionBody('disableUltraMarketing')

  assert.match(enableBody, /enabled:\s*true/, 'enableUltraMarketing must set features.products.ultra_marketing.enabled true')
  assert.match(disableBody, /enabled:\s*false/, 'disableUltraMarketing must set features.products.ultra_marketing.enabled false')
})
