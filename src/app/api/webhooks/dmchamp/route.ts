import { NextResponse } from 'next/server'
import { logWebhook, markWebhookFailed, markWebhookProcessed, logActivity } from '@/lib/queries'
import { mapDMChampEventToActivity } from '@/lib/activities/webhook-events'
import { requireWebhookSecret } from '@/lib/webhook-auth'

const DMCHAMP_WEBHOOK_SECRET =
  process.env.DMCHAMP_WEBHOOK_SECRET || process.env.WEBHOOK_INTERNAL_SECRET || process.env.INTERNAL_API_SECRET

export async function POST(request: Request) {
  let webhookId: string | undefined

  try {
    const authResponse = requireWebhookSecret(request, DMCHAMP_WEBHOOK_SECRET, 'DMCHAMP_WEBHOOK_SECRET')
    if (authResponse) return authResponse

    const body = await request.json()

    const webhook: any = await logWebhook({
      source_product: 'dm-champ',
      event_type: body.event || body.type || 'unknown',
      payload: body,
    })

    if (!webhook?.id) {
      throw new Error('Webhook log insert did not return an id')
    }

    const persistedWebhookId = webhook.id
    webhookId = persistedWebhookId

    const activity = mapDMChampEventToActivity(body)
    if (activity) {
      await logActivity(activity)
    }

    await markWebhookProcessed(persistedWebhookId)

    return NextResponse.json({ success: true, activity_logged: Boolean(activity) })
  } catch (error: any) {
    if (webhookId) {
      try {
        await markWebhookFailed(webhookId, error.message)
      } catch (markFailedError) {
        console.error('Failed to mark DM Champ webhook as failed:', markFailedError)
      }
    }

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
