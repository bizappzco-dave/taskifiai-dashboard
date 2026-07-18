import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  logWebhook,
  markWebhookFailed,
  markWebhookProcessed,
  createInvoice,
  setInvoiceDocument,
  getClient,
  logActivity,
} from '@/lib/queries'

const REVOLUT_WEBHOOK_SECRET = process.env.REVOLUT_WEBHOOK_SECRET || process.env.REVOLUT_WEBHOOK_SIGNING_SECRET

function parseSignatureHeader(value: string | null): { timestamp: string | null; signature: string | null } {
  if (!value) return { timestamp: null, signature: null }

  const parts = value.split(',').map((part) => part.trim())
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2) || null
  const signature = parts.find((part) => part.startsWith('v1='))?.slice(3) || null

  return { timestamp, signature }
}

function safeHexEqual(a: string, b: string): boolean {
  try {
    const aBuffer = Buffer.from(a, 'hex')
    const bBuffer = Buffer.from(b, 'hex')
    if (aBuffer.length !== bBuffer.length) return false
    return timingSafeEqual(aBuffer, bBuffer)
  } catch {
    return false
  }
}

function verifyRevolutWebhookSignature(body: string, signatureHeader: string | null): void {
  if (!REVOLUT_WEBHOOK_SECRET) {
    throw new Error('REVOLUT_WEBHOOK_SECRET is not configured')
  }

  const { timestamp, signature } = parseSignatureHeader(signatureHeader)

  if (!timestamp || !signature) {
    throw new Error('Missing Revolut webhook signature headers')
  }

  const expected = createHmac('sha256', REVOLUT_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest('hex')
  if (!safeHexEqual(expected, signature)) {
    throw new Error('Invalid Revolut webhook signature')
  }
}

const PAYMENT_CONFIRMED_STATUSES = new Set([
  'completed',
  'confirmed',
  'succeeded',
  'success',
  'paid',
  'completed_successfully',
])

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function firstString(...values: unknown[]): string | undefined {
  return values.map(asString).find(Boolean)
}

function normalizeStatus(value: unknown): string {
  return asString(value)?.toLowerCase() || ''
}

function parseMoney(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null

  const cleaned = value.replace(/[^0-9.\-]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function parseAmount(payload: any): number | null {
  const candidate =
    payload?.amount ??
    payload?.money?.value ??
    payload?.data?.amount ??
    payload?.data?.object?.amount ??
    payload?.data?.amount_charged ??
    payload?.order?.amount

  if (candidate !== undefined && candidate !== null) {
    const value = parseMoney(candidate)
    if (value !== null) return value

    if (typeof candidate === 'object' && 'minor_units' in candidate) {
      const minor = parseMoney((candidate as any).minor_units)
      if (minor !== null) return minor / 100
    }
  }

  return null
}

function parseCurrency(payload: any): string {
  return (
    firstString(
      payload?.currency,
      payload?.money?.currency,
      payload?.data?.currency,
      payload?.data?.object?.currency,
      payload?.order?.currency
    ) || 'EUR'
  )
}

function parseMetadata(payload: any): Record<string, unknown> {
  return (payload?.metadata || payload?.data?.metadata || {}) as Record<string, unknown>
}

function resolveClientId(payload: any): string | undefined {
  const metadata = parseMetadata(payload)
  return firstString(
    metadata.client_id,
    metadata.clientId,
    metadata.client,
    payload?.client_id,
    payload?.clientId,
    payload?.data?.client_id,
    payload?.data?.clientId,
    payload?.customer_id,
  )
}

function isPaymentConfirmed(payload: any): boolean {
  const normalized = normalizeStatus(
    payload?.state ??
      payload?.status ??
      payload?.payment_status ??
      payload?.data?.state ??
      payload?.data?.status ??
      payload?.data?.object?.state ??
      payload?.data?.object?.status ??
      payload?.type ??
      payload?.event
  )

  return PAYMENT_CONFIRMED_STATUSES.has(normalized)
}

function buildInvoiceHtml(data: {
  invoiceNumber: string
  clientName?: string | null
  amount: number
  currency: string
  description: string
  paidAt?: string | null
}) {
  const paidDate = data.paidAt ? new Date(data.paidAt).toLocaleDateString() : new Date().toLocaleDateString()

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${data.invoiceNumber}</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; margin: 0; padding: 32px; background: #fff; color: #0f172a; }
    .card { max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; }
    .title { margin: 0; font-size: 30px; }
    .muted { color: #475569; }
    .row { display: flex; justify-content: space-between; margin-top: 24px; }
    .line { display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding: 16px 0; }
    .line strong { font-size: 28px; }
  </style>
</head>
<body>
  <div class="card">
    <p class="muted">TaskifiAI Invoice</p>
    <h1 class="title">Invoice ${data.invoiceNumber}</h1>
    <div class="row">
      <div>
        <p><strong>Bill to:</strong> ${data.clientName || 'Client'}</p>
        <p><strong>Issue date:</strong> ${paidDate}</p>
      </div>
      <div class="muted">Status: PAID</div>
    </div>
    <div class="line">
      <span>${data.description}</span>
      <strong>${data.currency} ${data.amount.toFixed(2)}</strong>
    </div>
    <p class="muted">Generated automatically on payment confirmation.</p>
  </div>
</body>
</html>`
}

export async function POST(request: Request) {
  let webhookId: string | undefined

  try {
    const rawBody = await request.text()
    const signatureHeader =
      request.headers.get('revolut-signature') ||
      request.headers.get('x-revolut-signature') ||
      request.headers.get('x-revolut-signature-algorithm') ||
      request.headers.get('x-signature')
    verifyRevolutWebhookSignature(rawBody, signatureHeader)

    const payload = JSON.parse(rawBody)

    const webhook = (await logWebhook({
      source_product: 'revolut',
      event_type: firstString(payload?.event, payload?.type) || 'unknown',
      payload,
    })) as any

    if (!webhook?.id) {
      throw new Error('Webhook log insert did not return an id')
    }

    webhookId = String(webhook.id)

    if (!isPaymentConfirmed(payload)) {
      await markWebhookProcessed(webhookId)
      return NextResponse.json({ success: true, payment_confirmed: false })
    }

    const clientId = resolveClientId(payload)
    if (!clientId) {
      throw new Error('Webhook payload missing client_id in payload/metadata')
    }

    const amount = parseAmount(payload)
    if (amount === null) {
      throw new Error('Could not parse payment amount from webhook payload')
    }

    const client = await getClient(clientId)
    if (!client) {
      throw new Error('Client not found')
    }

    const metadata = parseMetadata(payload)
    const planLabel = firstString(
      client.subscription_tier,
      client.subscription_description,
      metadata.plan,
      metadata.plan_name,
      'subscription'
    )

    const description =
      firstString(metadata.description, metadata.invoice_description, metadata.note) ||
      `Subscription invoice for ${planLabel || 'subscription'}`

    const invoiceNumber = firstString(metadata.invoice_number) ||
      `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

    const currency = parseCurrency(payload)
    const paymentId = firstString(
      metadata.provider_payment_id,
      metadata.payment_id,
      payload?.payment_id,
      payload?.data?.id,
      payload?.data?.object?.id,
      payload?.id
    )

    const paidAt = firstString(
      payload?.paid_at,
      payload?.created_at,
      payload?.completed_at,
      payload?.data?.paid_at,
      payload?.data?.created_at
    )

    const invoice = (await createInvoice({
      client_id: clientId,
      subscription_id: firstString(metadata.subscription_id, metadata.subscriptionId),
      product_id: firstString(metadata.product_id, metadata.productId),
      invoice_number: invoiceNumber,
      status: 'paid',
      billing_model: firstString(metadata.billing_model, metadata.billingCycle, client.billing_cycle) || 'monthly',
      amount,
      currency,
      provider: 'revolut',
      provider_payment_id: paymentId,
      description,
      paid_at: paidAt || new Date().toISOString(),
      issued_at: new Date().toISOString(),
      metadata: { source_payload: payload, metadata },
      document_html: '',
    })) as any

    if (!invoice?.id) {
      throw new Error('Failed to create invoice record')
    }

    const invoiceWithHtml = buildInvoiceHtml({
      invoiceNumber: invoice.invoice_number || invoiceNumber,
      clientName: client.business_name || client.name || client.contact_name,
      amount,
      currency,
      description,
      paidAt: paidAt,
    })

    await setInvoiceDocument(invoice.id, invoiceWithHtml)

    await logActivity({
      client_id: clientId,
      product: 'billing',
      activity_type: 'invoice_created',
      title: `Invoice ${invoice.invoice_number || invoice.id} issued`,
      description: `${invoice.amount || amount} ${invoice.currency || currency} invoice issued from payment confirmation`,
      activity_category: 'sales',
      source: 'revolut',
      external_id: paymentId,
      details: {
        invoice_id: invoice.id,
        amount,
        currency,
        billing_model: invoice.billing_model || client.billing_cycle || 'monthly',
      },
    })

    await markWebhookProcessed(webhookId)

    return NextResponse.json({ success: true, invoice_id: invoice.id })
  } catch (error: any) {
    if (webhookId) {
      try {
        await markWebhookFailed(webhookId, error?.message || 'Unknown error')
      } catch (markFailedError) {
        console.error('Failed to mark Revolut webhook as failed:', markFailedError)
      }
    }

    return NextResponse.json({ error: error?.message || 'Webhook processing failed' }, { status: 500 })
  }
}
