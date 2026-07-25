import { getSupabaseAdmin } from '@/lib/supabase'
import {
  type TotalSiteDataPromotionPayload,
  validateTotalSiteDataPromotionPayload,
} from '@/lib/totalsitedata/promotion'
import { executeTotalSiteDataPromotion } from '@/lib/totalsitedata/processor'

export const TOTALSITEDATA_SCAN_QUEUE_KIND = 'totalsitedata_scan'

const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 120
const DEFAULT_DEDUPE_TTL_SECONDS = 3600
const DEFAULT_CACHE_TTL_SECONDS = 30
const DEFAULT_MAX_RETRY_ATTEMPTS = 3
const DEFAULT_MAX_BATCH_SIZE = 10
const DEFAULT_WORKER_RESULT_CACHE_TTL_SECONDS = 120

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

interface ScanQueueMetadata {
  kind: string
  totalsitedata_payload: TotalSiteDataPromotionPayload
  staged_target_client_id: string | null
  dedupe_key: string
  rate_limit_key: string
  attempts: number
  max_attempts: number
  last_error: string | null
  next_retry_at: string | null
  processor_version: string
  dead_letter?: boolean
  dead_letter_reason?: string | null
  failed_at?: string | null
  last_error_code?: string | null
}

interface ScanQueueEnqueueResultMeta {
  status: 'queued' | 'deduplicated' | 'rate_limited' | 'invalid'
  reason?: string
}

export interface ScanQueueEnqueueResult {
  task_id: string
  queued: boolean
  deduplicated: boolean
  rate_limited: boolean
  reason: string | null
}

export interface ScanQueueHealth {
  kind: string
  window_seconds: number
  pending: number
  in_progress: number
  completed: number
  cancelled: number
  retry_waiting: number
  oldest_pending_at: string | null
  dead_lettered_pending_24h: number
  recent_completed_24h: number
}

const enqueueResultCache = new Map<string, CacheEntry<ScanQueueEnqueueResult>>()
const queueHealthCache = new Map<string, CacheEntry<ScanQueueHealth>>()

function nowIso() {
  return new Date().toISOString()
}

function toMetadataJson(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as Record<string, unknown>
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function computeRetryDelaySeconds(attempt: number) {
  return Math.min(30 * 2 ** Math.max(0, attempt - 1), 5 * 60)
}

function readPositiveInt(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.trunc(parsed)
}

function getTtlMsFromEnv(name: string, fallbackSeconds: number) {
  return Math.max(1000, readPositiveInt(name, fallbackSeconds) * 1000)
}

function getFromCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() >= entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.value
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  })
}

function createRateLimitKey(payload: TotalSiteDataPromotionPayload) {
  const domain = payload.domain ? payload.domain.toLowerCase() : null
  return `${payload.target_client_id || 'unknown'}:${payload.source}:${domain || 'no-domain'}:${payload.prospect_id}`
}

function createDeduplicationKey(payload: TotalSiteDataPromotionPayload) {
  return `${payload.target_client_id || 'unknown'}:${payload.source}:${payload.prospect_id}`
}

function createTaskTitle(payload: TotalSiteDataPromotionPayload) {
  return `TotalSiteData scan: ${payload.business_name}`
}

function createTaskDescription(payload: TotalSiteDataPromotionPayload) {
  return `source=${payload.source}, prospect=${payload.prospect_id}, reason=${payload.promotion_reason}`
}

function normalizePayload(metadata: Record<string, unknown>) {
  const rawPayload = metadata.totalsitedata_payload
  const stagedClient = metadata.staged_target_client_id
  const validation = validateTotalSiteDataPromotionPayload(rawPayload)

  if (!validation.success || !validation.data) return null
  if (typeof stagedClient === 'string' && stagedClient.length > 0) {
    validation.data.target_client_id = stagedClient
  }

  return validation.data
}

function queueMetadataDefaults(
  payload: TotalSiteDataPromotionPayload,
  nextRetryAt: string | null,
  attempts: number,
  lastError: string | null,
  maxAttempts: number
) {
  return {
    kind: TOTALSITEDATA_SCAN_QUEUE_KIND,
    totalsitedata_payload: payload,
    staged_target_client_id: payload.target_client_id || null,
    dedupe_key: createDeduplicationKey(payload),
    rate_limit_key: createRateLimitKey(payload),
    attempts,
    max_attempts: maxAttempts,
    last_error: lastError,
    next_retry_at: nextRetryAt,
    processor_version: 'p2.1',
  }
}

function makeMetaWithLifecycle(metadata: ScanQueueMetadata, error?: Error | unknown) {
  const errorMessage =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error'

  return {
    ...metadata,
    last_error: errorMessage,
    failed_at: nowIso(),
  }
}

function queueResultForState(
  state: ScanQueueEnqueueResultMeta['status'],
  taskId: string = ''
): ScanQueueEnqueueResult {
  return {
    task_id: taskId,
    queued: state === 'queued',
    deduplicated: state === 'deduplicated',
    rate_limited: state === 'rate_limited',
    reason: state === 'queued' ? null : 'duplicate queue key already exists',
  }
}

function sanitizeTaskStatus(status: unknown) {
  if (status === 'pending' || status === 'in_progress' || status === 'completed' || status === 'cancelled') {
    return status
  }
  return null
}

function getQueueCacheKeyForKind(kind: string) {
  return `totalsitedata-queue-stats:${kind}`
}

export async function getTotalSiteDataScanQueueHealth(
  options?: { windowSeconds?: number; cacheTtlSeconds?: number }
): Promise<ScanQueueHealth> {
  const supabaseAdmin = getSupabaseAdmin() as any
  const windowSeconds = options?.windowSeconds || DEFAULT_DEDUPE_TTL_SECONDS
  const cacheTtlSeconds = options?.cacheTtlSeconds || DEFAULT_WORKER_RESULT_CACHE_TTL_SECONDS
  const cacheKey = `${getQueueCacheKeyForKind(TOTALSITEDATA_SCAN_QUEUE_KIND)}:${windowSeconds}`
  const cached = getFromCache(queueHealthCache, cacheKey)
  if (cached) {
    return cached
  }

  const now = nowIso()
  const cutoff = new Date(Date.now() - windowSeconds * 1000).toISOString()

  const { count: pendingCount, error: pendingError } = await supabaseAdmin
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .filter('metadata->>kind', 'eq', TOTALSITEDATA_SCAN_QUEUE_KIND)
    .eq('status', 'pending')
    .gte('created_at', cutoff)

  const { count: inProgressCount, error: inProgressError } = await supabaseAdmin
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .filter('metadata->>kind', 'eq', TOTALSITEDATA_SCAN_QUEUE_KIND)
    .eq('status', 'in_progress')
    .gte('created_at', cutoff)

  const { count: completedCount, error: completedError } = await supabaseAdmin
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .filter('metadata->>kind', 'eq', TOTALSITEDATA_SCAN_QUEUE_KIND)
    .eq('status', 'completed')
    .gte('created_at', cutoff)

  const { count: cancelledCount, error: cancelledError } = await supabaseAdmin
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .filter('metadata->>kind', 'eq', TOTALSITEDATA_SCAN_QUEUE_KIND)
    .eq('status', 'cancelled')
    .gte('created_at', cutoff)

  const { count: retryWaitingCount, error: retryError } = await supabaseAdmin
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .filter('metadata->>kind', 'eq', TOTALSITEDATA_SCAN_QUEUE_KIND)
    .eq('status', 'pending')
    .not('metadata->>next_retry_at', 'is', null)
    .gt('metadata->>next_retry_at', now)

  const { count: deadLetterCount, error: deadLetterError } = await supabaseAdmin
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .filter('metadata->>kind', 'eq', TOTALSITEDATA_SCAN_QUEUE_KIND)
    .eq('metadata->>dead_letter', 'true')
    .eq('status', 'cancelled')
    .gte('created_at', cutoff)

  const { data: oldestPending, error: oldestError } = await supabaseAdmin
    .from('tasks')
    .select('created_at')
    .filter('metadata->>kind', 'eq', TOTALSITEDATA_SCAN_QUEUE_KIND)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)

  if (pendingError) throw pendingError
  if (inProgressError) throw inProgressError
  if (completedError) throw completedError
  if (cancelledError) throw cancelledError
  if (retryError) throw retryError
  if (deadLetterError) throw deadLetterError
  if (oldestError) throw oldestError

  const result: ScanQueueHealth = {
    kind: TOTALSITEDATA_SCAN_QUEUE_KIND,
    window_seconds: windowSeconds,
    pending: pendingCount || 0,
    in_progress: inProgressCount || 0,
    completed: completedCount || 0,
    cancelled: cancelledCount || 0,
    retry_waiting: retryWaitingCount || 0,
    oldest_pending_at: oldestPending?.[0]?.created_at || null,
    dead_lettered_pending_24h: deadLetterCount || 0,
    recent_completed_24h: completedCount || 0,
  }

  setCache(queueHealthCache, cacheKey, result, cacheTtlMs(cacheTtlSeconds))

  return result
}

function cacheTtlMs(ttlSeconds: number) {
  return Math.max(1000, ttlSeconds * 1000)
}

function getRateLimitAndDedupeConfig(options?: { rateLimitWindowSeconds?: number; rateLimitMaxRequests?: number; dedupeTtlSeconds?: number }) {
  const rateLimitWindowSeconds =
    options?.rateLimitWindowSeconds ?? readPositiveInt('TOTALSITEDATA_SCAN_RATE_LIMIT_WINDOW_SECONDS', DEFAULT_RATE_LIMIT_WINDOW_SECONDS)
  const rateLimitMaxRequests =
    options?.rateLimitMaxRequests ?? readPositiveInt('TOTALSITEDATA_SCAN_RATE_LIMIT_MAX_REQUESTS', DEFAULT_RATE_LIMIT_MAX_REQUESTS)
  const dedupeTtlSeconds = options?.dedupeTtlSeconds ?? readPositiveInt('TOTALSITEDATA_SCAN_DEDUPE_TTL_SECONDS', DEFAULT_DEDUPE_TTL_SECONDS)
  const responseCacheTtlSeconds = readPositiveInt('TOTALSITEDATA_SCAN_RESPONSE_CACHE_TTL_SECONDS', DEFAULT_CACHE_TTL_SECONDS)

  return {
    rateLimitWindowSeconds,
    rateLimitMaxRequests,
    dedupeTtlSeconds,
    responseCacheTtlSeconds,
  }
}

export async function enqueueTotalSiteDataScanJob(
  rawPayload: TotalSiteDataPromotionPayload,
  options?: {
    rateLimitWindowSeconds?: number
    rateLimitMaxRequests?: number
    dedupeTtlSeconds?: number
    responseCacheTtlSeconds?: number
  }
): Promise<ScanQueueEnqueueResult> {
  const supabaseAdmin = getSupabaseAdmin() as any
  const payload = rawPayload
  const {
    rateLimitWindowSeconds,
    rateLimitMaxRequests,
    dedupeTtlSeconds,
    responseCacheTtlSeconds,
  } = getRateLimitAndDedupeConfig(options)

  const dedupeKey = createDeduplicationKey(payload)
  const cachedResult = getFromCache(enqueueResultCache, `enqueue:${dedupeKey}`)
  if (cachedResult) return cachedResult

  const metadata = queueMetadataDefaults(
    payload,
    null,
    0,
    null,
    readPositiveInt('TOTALSITEDATA_SCAN_MAX_RETRIES', DEFAULT_MAX_RETRY_ATTEMPTS)
  )
  const rateLimitKey = createRateLimitKey(payload)
  const cutoff = new Date(Date.now() - rateLimitWindowSeconds * 1000).toISOString()

  const { count: recentCount, error: recentError } = await supabaseAdmin
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .filter('metadata->>kind', 'eq', TOTALSITEDATA_SCAN_QUEUE_KIND)
    .filter('metadata->>rate_limit_key', 'eq', rateLimitKey)
    .gte('created_at', cutoff)
    .neq('status', 'cancelled')

  if (recentError) throw recentError
  if ((recentCount || 0) >= rateLimitMaxRequests) {
    const result: ScanQueueEnqueueResult = {
      task_id: '',
      queued: false,
      deduplicated: false,
      rate_limited: true,
      reason: `rate limit exceeded for key ${rateLimitKey}`,
    }
    setCache(
      enqueueResultCache,
      `enqueue:${dedupeKey}`,
      result,
      getTtlMsFromEnv('TOTALSITEDATA_SCAN_RESPONSE_CACHE_TTL_SECONDS', responseCacheTtlSeconds)
    )
    return result
  }

  const dedupeCutoff = new Date(Date.now() - dedupeTtlSeconds * 1000).toISOString()
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('tasks')
    .select('id, status, metadata')
    .eq('client_id', payload.target_client_id)
    .filter('metadata->>kind', 'eq', TOTALSITEDATA_SCAN_QUEUE_KIND)
    .filter('metadata->>dedupe_key', 'eq', dedupeKey)
    .gte('created_at', dedupeCutoff)
    .order('created_at', { ascending: false })
    .limit(1)

  if (existingError) throw existingError

  const existingTask = existing?.[0]
  const existingStatus = sanitizeTaskStatus(existingTask?.status)
  if (existingTask && (existingStatus === 'pending' || existingStatus === 'in_progress' || existingStatus === 'completed')) {
    const result = {
      ...queueResultForState('deduplicated'),
      reason: 'duplicate queue key already exists within dedupe window',
    }

    setCache(
      enqueueResultCache,
      `enqueue:${dedupeKey}`,
      {
        task_id: existingTask.id,
        queued: false,
        deduplicated: true,
        rate_limited: false,
        reason: result.reason,
      },
      getTtlMsFromEnv('TOTALSITEDATA_SCAN_RESPONSE_CACHE_TTL_SECONDS', responseCacheTtlSeconds)
    )
    return {
      task_id: existingTask.id,
      queued: false,
      deduplicated: true,
      rate_limited: false,
      reason: result.reason,
    }
  }

  const now = nowIso()
  const { data: created, error } = await supabaseAdmin
    .from('tasks')
    .insert([
      {
        client_id: payload.target_client_id,
        contact_id: null,
        created_by: null,
        assigned_to: null,
        title: createTaskTitle(payload),
        description: createTaskDescription(payload),
        status: 'pending',
        priority: 'medium',
        metadata,
        created_at: now,
        updated_at: now,
      },
    ])
    .select('id')

  if (error) throw error
  const taskId = created?.[0]?.id
  if (!taskId) {
    throw new Error('queue insert did not return task identifier')
  }

  const result = {
    task_id: taskId,
    queued: true,
    deduplicated: false,
    rate_limited: false,
    reason: null,
  }

  setCache(
    enqueueResultCache,
    `enqueue:${dedupeKey}`,
    result,
    getTtlMsFromEnv('TOTALSITEDATA_SCAN_RESPONSE_CACHE_TTL_SECONDS', responseCacheTtlSeconds)
  )

  return result
}

export async function claimScanQueueJob(limit = DEFAULT_MAX_BATCH_SIZE) {
  const supabaseAdmin = getSupabaseAdmin() as any
  const candidateLimit = Math.max(1, Math.min(20, limit * 3))

  const { data: candidates, error } = await supabaseAdmin
    .from('tasks')
    .select('id, status, metadata, client_id')
    .eq('status', 'pending')
    .filter('metadata->>kind', 'eq', TOTALSITEDATA_SCAN_QUEUE_KIND)
    .order('created_at', { ascending: true })
    .limit(candidateLimit)

  if (error) throw error
  if (!candidates || candidates.length === 0) return [] as any[]

  const now = Date.now()
  const claimed: any[] = []

  for (const candidate of candidates) {
    if (claimed.length >= limit) break

    const metadata = toMetadataJson(candidate.metadata)
    const nextRetryAt = metadata.next_retry_at
    if (typeof nextRetryAt === 'string' && nextRetryAt) {
      const retryAtMs = Date.parse(nextRetryAt)
      if (Number.isFinite(retryAtMs) && retryAtMs > now) {
        continue
      }
    }

    const { data: updated, error: claimError } = await supabaseAdmin
      .from('tasks')
      .update({ status: 'in_progress', updated_at: nowIso() })
      .eq('id', candidate.id)
      .eq('status', 'pending')
      .select('id, status, metadata, client_id')
      .maybeSingle()

    if (claimError) throw claimError
    if (updated?.id) {
      claimed.push(updated)
    }
  }

  return claimed
}

export async function processScanQueueBatch(
  options?: {
    limit?: number
    stopOnError?: boolean
  }
): Promise<{
  processed: number
  results: Array<{
    task_id: string
    status: 'completed' | 'requeued' | 'cancelled'
    success: boolean
    error?: string
    result?: Record<string, any>
  }>
}> {
  const supabaseAdmin = getSupabaseAdmin() as any
  const limit = options?.limit ?? 5
  const stopOnError = options?.stopOnError ?? false
  const claimedJobs = await claimScanQueueJob(limit)

  let processed = 0
  const results: Array<{
    task_id: string
    status: 'completed' | 'requeued' | 'cancelled'
    success: boolean
    error?: string
    result?: Record<string, any>
  }> = []

  for (const job of claimedJobs) {
    const metadata = toMetadataJson(job.metadata)
    const payload = normalizePayload(metadata)
    const now = nowIso()
    let attempts = asNumber(metadata.attempts) || 0
    attempts += 1

    const baseMetadata: ScanQueueMetadata = {
      kind: TOTALSITEDATA_SCAN_QUEUE_KIND,
      totalsitedata_payload: payload || (metadata.totalsitedata_payload as TotalSiteDataPromotionPayload),
      staged_target_client_id: typeof metadata.staged_target_client_id === 'string' ? metadata.staged_target_client_id : null,
      dedupe_key: typeof metadata.dedupe_key === 'string' ? metadata.dedupe_key : '',
      rate_limit_key: typeof metadata.rate_limit_key === 'string' ? metadata.rate_limit_key : '',
      attempts,
      max_attempts: asNumber(metadata.max_attempts) || readPositiveInt('TOTALSITEDATA_SCAN_MAX_RETRIES', DEFAULT_MAX_RETRY_ATTEMPTS),
      last_error: null,
      next_retry_at: null,
      processor_version: 'p2.1',
    }

    if (!payload) {
      await supabaseAdmin
        .from('tasks')
        .update({
          status: 'cancelled',
          completed_at: now,
          updated_at: now,
          metadata: {
            ...baseMetadata,
            ...makeMetaWithLifecycle(baseMetadata),
            dead_letter: true,
            dead_letter_reason: 'invalid payload in task metadata',
          },
        })
        .eq('id', job.id)

      results.push({
        task_id: job.id,
        status: 'cancelled',
        success: false,
        error: 'invalid payload in task metadata',
      })
      processed += 1
      continue
    }

    try {
      const result = await executeTotalSiteDataPromotion(payload, payload.target_client_id)
      await supabaseAdmin
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: now,
          updated_at: now,
          metadata: {
            ...metadata,
            ...baseMetadata,
            result,
            attempts,
            processed_at: now,
            processor_version: 'p2.1',
          },
        })
        .eq('id', job.id)

      setCache(enqueueResultCache, `enqueue:${baseMetadata.dedupe_key}`, {
        task_id: job.id,
        queued: false,
        deduplicated: true,
        rate_limited: false,
        reason: 'completed',
      }, getTtlMsFromEnv('TOTALSITEDATA_SCAN_RESPONSE_CACHE_TTL_SECONDS', DEFAULT_CACHE_TTL_SECONDS))

      results.push({ task_id: job.id, status: 'completed', success: true, result: result as Record<string, any> })
      processed += 1
    } catch (error: any) {
      const maxRetries = asNumber(baseMetadata.max_attempts) || DEFAULT_MAX_RETRY_ATTEMPTS
      const reachedMaxRetries = attempts >= maxRetries
      const nextRetryAt = reachedMaxRetries
        ? null
        : new Date(Date.now() + computeRetryDelaySeconds(attempts) * 1000).toISOString()

      const updatedMetadata: ScanQueueMetadata = {
        ...baseMetadata,
        ...makeMetaWithLifecycle(baseMetadata, error),
        attempts,
        next_retry_at: nextRetryAt,
        dead_letter: reachedMaxRetries,
        dead_letter_reason: reachedMaxRetries ? (error?.message || 'Unknown error') : null,
      }

      const updatePayload: Record<string, any> = {
        status: reachedMaxRetries ? 'cancelled' : 'pending',
        updated_at: now,
        metadata: updatedMetadata,
      }

      if (reachedMaxRetries) {
        updatePayload.completed_at = now
      }

      await supabaseAdmin.from('tasks').update(updatePayload).eq('id', job.id)

      if (reachedMaxRetries && typeof metadata.dedupe_key === 'string') {
        setCache(
          enqueueResultCache,
          `enqueue:${metadata.dedupe_key}`,
          {
            task_id: job.id,
            queued: false,
            deduplicated: true,
            rate_limited: false,
            reason: 'dead letter after retry exhaustion',
          },
          getTtlMsFromEnv('TOTALSITEDATA_SCAN_RESPONSE_CACHE_TTL_SECONDS', DEFAULT_CACHE_TTL_SECONDS)
        )
      }

      results.push({
        task_id: job.id,
        status: reachedMaxRetries ? 'cancelled' : 'requeued',
        success: false,
        error: error?.message || 'Unknown error',
      })
      processed += 1

      if (stopOnError && reachedMaxRetries) break
    }
  }

  return { processed, results }
}

export function getQueueMetadataForTask(task: { metadata?: unknown }) {
  return toMetadataJson(task.metadata)
}
