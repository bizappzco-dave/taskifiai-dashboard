import { NextResponse } from 'next/server'
import { logWebhook, markWebhookProcessed, logActivity } from '@/lib/queries'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Log the webhook
    const webhook = await logWebhook({
      source_product: 'socialdrive-ai',
      event_type: body.event || 'unknown',
      payload: body
    })
    
    // Process different event types
    switch (body.event) {
      case 'client.created':
        // Client created in SocialDrive (if created directly there)
        await logActivity({
          client_id: body.client_id,
          product: 'socialdrive-ai',
          activity_type: 'client_created',
          title: 'Client created in SocialDrive AI',
          description: body.client_name
        })
        break
        
      case 'content.uploaded':
        // Client uploaded content
        await logActivity({
          client_id: body.client_id,
          product: 'socialdrive-ai',
          activity_type: 'content_uploaded',
          title: 'Content uploaded',
          description: `${body.image_count} images uploaded`,
          details: {
            submission_id: body.submission_id,
            image_count: body.image_count
          }
        })
        break
        
      case 'content.generated':
        // AI generated captions
        await logActivity({
          client_id: body.client_id,
          product: 'socialdrive-ai',
          activity_type: 'content_generated',
          title: 'AI content generated',
          description: `${body.post_count} posts generated`,
          details: {
            submission_id: body.submission_id,
            post_count: body.post_count,
            platforms: body.platforms
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
