import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

function sharedSecretFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice('Bearer '.length).trim()

  return (
    request.headers.get('x-webhook-secret')?.trim() ||
    request.headers.get('x-internal-secret')?.trim() ||
    request.headers.get('x-totalsitedata-secret')?.trim() ||
    ''
  )
}

function safeSecretEqual(provided: string, expected: string) {
  const providedHash = createHash('sha256').update(provided).digest()
  const expectedHash = createHash('sha256').update(expected).digest()
  return timingSafeEqual(providedHash, expectedHash)
}

export function requireWebhookSecret(
  request: Request,
  expectedSecret: string | undefined,
  configName: string
): NextResponse | null {
  if (!expectedSecret) {
    return NextResponse.json({ error: `${configName} is not configured` }, { status: 500 })
  }

  const providedSecret = sharedSecretFromRequest(request)
  if (!providedSecret || !safeSecretEqual(providedSecret, expectedSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
