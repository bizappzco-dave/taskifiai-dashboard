export type ActivityCategory =
  | 'communication'
  | 'marketing'
  | 'support'
  | 'sales'
  | 'operations'
  | 'reputation'

export interface WebhookActivityPayload {
  client_id: string
  product: string
  activity_type: string
  title: string
  description?: string
  activity_category?: ActivityCategory
  source?: string
  external_id?: string
  contact_id?: string
  details?: Record<string, unknown>
}

function firstString(...values: unknown[]) {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0) as string | undefined
}

function normalizeChannel(channel: unknown) {
  const value = typeof channel === 'string' ? channel.trim().toLowerCase() : ''

  if (['whatsapp', 'wa'].includes(value)) return 'whatsapp'
  if (['instagram', 'instagram_dm', 'ig'].includes(value)) return 'instagram'
  if (['facebook', 'facebook_dm', 'messenger'].includes(value)) return 'facebook'
  if (['email', 'gmail'].includes(value)) return 'email'

  return value || 'unknown'
}

function inferDirection(eventName: string, payload: Record<string, unknown>) {
  const explicit = firstString(payload.direction, payload.message_direction, payload.direction_type)?.toLowerCase()

  if (explicit && ['inbound', 'received', 'incoming'].includes(explicit)) return 'inbound'
  if (explicit && ['outbound', 'sent', 'outgoing'].includes(explicit)) return 'outbound'

  if (eventName.includes('received') || eventName.includes('inbound')) return 'inbound'
  if (eventName.includes('sent') || eventName.includes('broadcast') || eventName.includes('outbound')) return 'outbound'

  return undefined
}

function buildMessageActivityType(channel: string, direction: 'inbound' | 'outbound') {
  if (channel === 'whatsapp') {
    return direction === 'inbound' ? 'whatsapp_received' : 'whatsapp_sent'
  }

  if (channel === 'instagram') {
    return direction === 'inbound' ? 'instagram_dm_received' : 'instagram_dm_sent'
  }

  if (channel === 'facebook') {
    return direction === 'inbound' ? 'facebook_dm_received' : 'facebook_dm_sent'
  }

  if (channel === 'email') {
    return direction === 'inbound' ? 'email_received' : 'email_sent'
  }

  return direction === 'inbound' ? 'message_received' : 'message_sent'
}

function buildMessageTitle(channel: string, direction: 'inbound' | 'outbound') {
  const label =
    channel === 'whatsapp'
      ? 'WhatsApp message'
      : channel === 'instagram'
        ? 'Instagram DM'
        : channel === 'facebook'
          ? 'Facebook DM'
          : channel === 'email'
            ? 'Email'
            : 'Message'

  const suffix = direction === 'inbound' ? 'received' : 'sent'
  return `${label} ${suffix}`
}

function trimDescription(value: unknown, fallback: string) {
  if (typeof value !== 'string' || !value.trim()) return fallback
  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized
}

function compactObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as T
}

export function mapDMChampEventToActivity(payload: Record<string, unknown>): WebhookActivityPayload | null {
  const eventName = firstString(payload.event, payload.type)?.toLowerCase()
  const clientId = firstString(payload.client_id)

  if (!eventName || !clientId) return null

  if (eventName === 'contact.created') {
    return {
      client_id: clientId,
      product: 'dm-champ',
      activity_type: 'contact_created',
      activity_category: 'sales',
      source: normalizeChannel(payload.channel || 'whatsapp'),
      contact_id: firstString(payload.contact_id),
      title: 'Contact created',
      description: firstString(payload.contact_name, payload.phone, payload.email),
      details: compactObject({
        contact_id: firstString(payload.contact_id),
        contact_name: firstString(payload.contact_name),
        phone: firstString(payload.phone),
        email: firstString(payload.email),
        channel: normalizeChannel(payload.channel || 'whatsapp'),
        event: eventName,
      }),
    }
  }

  if (eventName === 'flow.completed') {
    return {
      client_id: clientId,
      product: 'dm-champ',
      activity_type: 'onboarding_completed',
      activity_category: 'operations',
      source: normalizeChannel(payload.channel || 'whatsapp'),
      contact_id: firstString(payload.contact_id),
      title: 'Onboarding flow completed',
      description: firstString(payload.contact_name, payload.contact_id),
      details: compactObject({
        contact_id: firstString(payload.contact_id),
        flow_id: firstString(payload.flow_id),
        answers: payload.answers,
        channel: normalizeChannel(payload.channel || 'whatsapp'),
        event: eventName,
      }),
    }
  }

  const direction = inferDirection(eventName, payload)
  const looksLikeMessage =
    eventName.includes('message') ||
    eventName.includes('conversation') ||
    Boolean(firstString(payload.content, payload.message, payload.body))

  if (!direction || !looksLikeMessage) {
    return null
  }

  const channel = normalizeChannel(payload.channel || payload.platform || payload.source || 'whatsapp')
  const messageId = firstString(payload.message_id, payload.external_id, payload.id)
  const content = firstString(payload.content, payload.message, payload.body)

  return {
    client_id: clientId,
    product: 'dm-champ',
    activity_type: buildMessageActivityType(channel, direction),
    activity_category: 'communication',
    source: channel,
    external_id: messageId,
    contact_id: firstString(payload.contact_id),
    title: buildMessageTitle(channel, direction),
    description: trimDescription(content, direction === 'inbound' ? 'New inbound message' : 'Outbound message sent'),
    details: compactObject({
      contact_id: firstString(payload.contact_id),
      phone: firstString(payload.phone),
      email: firstString(payload.email),
      content,
      channel,
      direction,
      event: eventName,
      message_id: messageId,
      campaign_id: firstString(payload.campaign_id),
      sent_count: payload.sent_count,
      delivered_count: payload.delivered_count,
    }),
  }
}

export function mapSocialDriveEventToActivity(payload: Record<string, unknown>): WebhookActivityPayload | null {
  const eventName = firstString(payload.event, payload.type)?.toLowerCase()
  const clientId = firstString(payload.client_id)

  if (!eventName || !clientId) return null

  if (eventName === 'client.created') {
    return {
      client_id: clientId,
      product: 'socialdrive-ai',
      activity_type: 'client_created',
      activity_category: 'operations',
      source: 'socialdrive',
      title: 'Client created in SocialDrive AI',
      description: firstString(payload.client_name),
      details: {
        client_name: firstString(payload.client_name),
        event: eventName,
      },
    }
  }

  if (eventName === 'content.uploaded') {
    return {
      client_id: clientId,
      product: 'socialdrive-ai',
      activity_type: 'content_uploaded',
      activity_category: 'marketing',
      source: firstString(payload.platform, payload.source) || 'socialdrive',
      external_id: firstString(payload.submission_id),
      title: 'Content uploaded',
      description: `${Number(payload.image_count || 0)} images uploaded`,
      details: compactObject({
        submission_id: firstString(payload.submission_id),
        image_count: payload.image_count,
        platform: firstString(payload.platform),
        event: eventName,
      }),
    }
  }

  if (['post.published', 'content.published', 'posting_job.posted'].includes(eventName)) {
    const platform = firstString(payload.platform, payload.channel) || 'social'
    return {
      client_id: clientId,
      product: 'socialdrive-ai',
      activity_type: 'social_post_published',
      activity_category: 'marketing',
      source: platform,
      external_id: firstString(payload.post_id, payload.external_post_id, payload.posting_job_id),
      title: 'Social post published',
      description: `Published to ${platform}`,
      details: compactObject({
        post_id: firstString(payload.post_id, payload.external_post_id),
        posting_job_id: firstString(payload.posting_job_id),
        platform,
        caption: firstString(payload.caption),
        image_count: payload.image_count,
        external_post_url: firstString(payload.external_post_url, payload.post_url),
        event: eventName,
      }),
    }
  }

  if (['review.received', 'gbp.review.received'].includes(eventName)) {
    const platform = firstString(payload.platform, payload.source) || 'google'
    const reviewerName = firstString(payload.reviewer_name, payload.author_name, payload.author)
    const rating = payload.rating
    return {
      client_id: clientId,
      product: 'socialdrive-ai',
      activity_type: 'review_received',
      activity_category: 'reputation',
      source: platform,
      external_id: firstString(payload.review_id),
      title: 'Review received',
      description: reviewerName ? `New review from ${reviewerName}` : 'New review received',
      details: compactObject({
        review_id: firstString(payload.review_id),
        platform,
        rating,
        reviewer_name: reviewerName,
        review_text: firstString(payload.review_text, payload.content),
        event: eventName,
      }),
    }
  }

  if (eventName === 'content.generated') {
    return {
      client_id: clientId,
      product: 'socialdrive-ai',
      activity_type: 'content_generated',
      activity_category: 'marketing',
      source: 'socialdrive',
      external_id: firstString(payload.submission_id),
      title: 'AI content generated',
      description: `${Number(payload.post_count || 0)} posts generated`,
      details: {
        submission_id: firstString(payload.submission_id),
        post_count: payload.post_count,
        platforms: payload.platforms,
        event: eventName,
      },
    }
  }

  return null
}
