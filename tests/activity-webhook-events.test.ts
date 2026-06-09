import test from 'node:test'
import assert from 'node:assert/strict'

import {
  mapDMChampEventToActivity,
  mapSocialDriveEventToActivity,
} from '../src/lib/activities/webhook-events.ts'

test('maps inbound DM Champ WhatsApp message to auto-create-compatible activity', () => {
  const activity = mapDMChampEventToActivity({
    event: 'message.received',
    client_id: 'client-123',
    contact_id: 'contact-456',
    channel: 'whatsapp',
    phone: '+3531234567',
    content: 'Hi, can I get a quote?',
    message_id: 'msg-1',
  })

  assert.deepEqual(activity, {
    client_id: 'client-123',
    product: 'dm-champ',
    activity_type: 'whatsapp_received',
    activity_category: 'communication',
    source: 'whatsapp',
    external_id: 'msg-1',
    contact_id: 'contact-456',
    title: 'WhatsApp message received',
    description: 'Hi, can I get a quote?',
    details: {
      contact_id: 'contact-456',
      phone: '+3531234567',
      content: 'Hi, can I get a quote?',
      channel: 'whatsapp',
      direction: 'inbound',
      event: 'message.received',
      message_id: 'msg-1',
    },
  })
})

test('maps outbound DM Champ Instagram DM message to canonical sent activity', () => {
  const activity = mapDMChampEventToActivity({
    event: 'message.sent',
    client_id: 'client-123',
    contact_id: 'contact-456',
    channel: 'instagram',
    content: 'Thanks for reaching out',
  })

  assert.equal(activity?.activity_type, 'instagram_dm_sent')
  assert.equal(activity?.source, 'instagram')
  assert.equal(activity?.details.direction, 'outbound')
})

test('maps SocialDrive publish webhook to marketing activity', () => {
  const activity = mapSocialDriveEventToActivity({
    event: 'post.published',
    client_id: 'client-123',
    post_id: 'post-789',
    platform: 'instagram',
    caption: 'Summer collection live',
    image_count: 3,
  })

  assert.deepEqual(activity, {
    client_id: 'client-123',
    product: 'socialdrive-ai',
    activity_type: 'social_post_published',
    activity_category: 'marketing',
    source: 'instagram',
    external_id: 'post-789',
    title: 'Social post published',
    description: 'Published to instagram',
    details: {
      post_id: 'post-789',
      platform: 'instagram',
      caption: 'Summer collection live',
      image_count: 3,
      event: 'post.published',
    },
  })
})

test('maps SocialDrive review webhook to reputation activity', () => {
  const activity = mapSocialDriveEventToActivity({
    event: 'review.received',
    client_id: 'client-123',
    review_id: 'review-1',
    platform: 'google',
    rating: 5,
    reviewer_name: 'Jane',
    review_text: 'Fantastic service',
  })

  assert.equal(activity?.activity_type, 'review_received')
  assert.equal(activity?.activity_category, 'reputation')
  assert.equal(activity?.source, 'google')
  assert.equal(activity?.details.rating, 5)
})
