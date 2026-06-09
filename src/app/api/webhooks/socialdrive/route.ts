import { NextResponse } from 'next/server'
import { logWebhook, markWebhookFailed, markWebhookProcessed, logActivity } from '@/lib/queries'
import { mapSocialDriveEventToActivity } from '@/lib/activities/webhook-events'

export async function POST(request: Request) {
  let webhookId: string | undefined

  try {
    const body = await request.json()

    const webhook: any = await logWebhook({
      source_product: 'socialdrive-ai',
      event_type: body.event || body.type || 'unknown',
      payload: body,
    })

    if (!webhook?.id) {
      throw new Error('Webhook log insert did not return an id')
    }

    const persistedWebhookId = webhook.id
    webhookId = persistedWebhookId

    const activity = mapSocialDriveEventToActivity(body)
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
        console.error('Failed to mark SocialDrive webhook as failed:', markFailedError)
      }
    }

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
