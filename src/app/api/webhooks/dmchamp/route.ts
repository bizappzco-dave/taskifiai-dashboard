import { NextResponse } from 'next/server'
import { logWebhook, markWebhookProcessed, logActivity } from '@/lib/queries'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Log the webhook
    const webhook = await logWebhook({
      source_product: 'dm-champ',
      event_type: body.event || 'unknown',
      payload: body
    })
    
    // Process different event types
    switch (body.event) {
      case 'contact.created':
        // New contact created in DM Champ
        await logActivity({
          client_id: body.client_id,
          product: 'dm-champ',
          activity_type: 'contact_created',
          title: 'Contact created',
          description: body.contact_name || body.phone,
          details: {
            contact_id: body.contact_id,
            phone: body.phone
          }
        })
        break
        
      case 'message.broadcast':
        // Broadcast message sent
        await logActivity({
          client_id: body.client_id,
          product: 'dm-champ',
          activity_type: 'message_broadcast',
          title: 'Broadcast sent',
          description: `${body.sent_count} messages sent`,
          details: {
            campaign_id: body.campaign_id,
            sent_count: body.sent_count,
            delivered_count: body.delivered_count
          }
        })
        break
        
      case 'flow.completed':
        // Onboarding flow completed
        await logActivity({
          client_id: body.client_id,
          product: 'dm-champ',
          activity_type: 'onboarding_completed',
          title: 'Onboarding flow completed',
          description: `Contact: ${body.contact_id}`,
          details: {
            contact_id: body.contact_id,
            flow_id: body.flow_id,
            answers: body.answers
          }
        })
        break
    }
    
    // Mark webhook as processed
    await markWebhookProcessed(webhook.id)
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
