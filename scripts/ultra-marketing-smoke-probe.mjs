import fs from 'node:fs'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

const envFile = process.argv[2] || '.env.development.local'
const content = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : ''
for (const rawLine of content.split(/\r?\n/)) {
  const line = rawLine.trim()
  if (!line || line.startsWith('#') || !line.includes('=')) continue
  const idx = line.indexOf('=')
  const key = line.slice(0, idx).trim()
  let value = line.slice(idx + 1).trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  }
  if (!process.env[key]) process.env[key] = value
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error(JSON.stringify({ ok: false, error: 'missing_supabase_env', envFile }))
  process.exit(1)
}

const host = new URL(url).hostname
const targetType = host === 'localhost' || host === '127.0.0.1' ? 'local' : 'remote'
const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

async function countRows(table) {
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true })
  return error ? { error: error.message } : { count }
}

const result = { ok: true, envFile, targetType, host, checks: {} }

for (const table of ['clients', 'products', 'subscriptions', 'activity_types']) {
  result.checks[`${table}_reachable`] = await countRows(table)
}

const { data: ultraProduct, error: productError } = await supabase
  .from('products')
  .select('id, slug, name, active')
  .eq('slug', 'ultra-marketing')
  .maybeSingle()
result.checks.ultra_product = productError
  ? { error: productError.message }
  : { exists: Boolean(ultraProduct), active: Boolean(ultraProduct?.active) }

const { data: clientProbe, error: clientError } = await supabase
  .from('clients')
  .select('id, features')
  .limit(1)
  .maybeSingle()
result.checks.clients_features_column = clientError
  ? { error: clientError.message }
  : { readable: true, sampled: Boolean(clientProbe), featuresType: clientProbe ? typeof clientProbe.features : 'none' }

const { data: subscriptionProbe, error: subscriptionError } = await supabase
  .from('subscriptions')
  .select('id, status, product_id, client_id, updated_at')
  .limit(1)
result.checks.subscriptions_columns = subscriptionError
  ? { error: subscriptionError.message }
  : { readable: true, sampled: Boolean(subscriptionProbe?.length) }

console.log(JSON.stringify(result, null, 2))
