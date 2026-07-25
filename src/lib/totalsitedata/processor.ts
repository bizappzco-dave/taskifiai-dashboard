import { getSupabaseAdmin } from '@/lib/supabase'
import {
  createContactForPromotion,
  createLeadRecord,
  findActivityByExternalId,
  findContactForPromotion,
  findLeadByActivityId,
  findOpenLeadForContact,
  getClientOwnerInfo,
  logActivity,
} from '@/lib/queries'
import {
  mapPromotionPayloadToLeadSource,
  mapPromotionPayloadToLeadStage,
  type TotalSiteDataPromotionPayload,
} from '@/lib/totalsitedata/promotion'

export interface TotalSiteDataPromotionExecutionResult {
  success: true
  deduplicated: boolean
  client_id: string
  activity_id: string | null
  contact_id: string | null
  lead_id: string | null
  stage: string | null
  assigned_user_id: string | null
}

function getMissingTargetClientError(): Error {
  return new Error(
    'target_client_id is required and no TOTALSITEDATA_STAGING_CLIENT_ID is configured'
  )
}

function getTargetClientId(
  payload: TotalSiteDataPromotionPayload,
  stagingClientId: string | null
): string {
  const resolvedTargetClientId = payload.target_client_id || stagingClientId
  if (!resolvedTargetClientId) {
    throw getMissingTargetClientError()
  }
  return resolvedTargetClientId
}

async function getValidAssignedUserId(userId?: string | null) {
  if (!userId) return null

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (error || !data?.user) return null
    return data.user.id
  } catch {
    return null
  }
}

export async function executeTotalSiteDataPromotion(
  rawPayload: TotalSiteDataPromotionPayload,
  stagingClientId?: string | null
): Promise<TotalSiteDataPromotionExecutionResult> {
  const payload: TotalSiteDataPromotionPayload = {
    ...rawPayload,
    target_client_id: getTargetClientId(rawPayload, stagingClientId || null),
  }

  const client: any = await getClientOwnerInfo(payload.target_client_id)
  const assignedUserId = await getValidAssignedUserId(client.user_id)
  const externalId = `totalsitedata:prospect:${payload.prospect_id}`

  const existingActivity: any = await findActivityByExternalId(payload.target_client_id, externalId)
  if (existingActivity?.id) {
    const existingLead: any = await findLeadByActivityId(existingActivity.id)

    return {
      success: true,
      deduplicated: true,
      client_id: payload.target_client_id,
      contact_id: existingActivity.contact_id || null,
      activity_id: existingActivity.id,
      lead_id: existingLead?.id || null,
      stage: existingLead?.status || null,
      assigned_user_id: assignedUserId || null,
    }
  }

  let contact: any = await findContactForPromotion({
    client_id: payload.target_client_id,
    email: payload.email,
    phone: payload.phone,
    business_name: payload.business_name,
  })

  if (!contact) {
    contact = await createContactForPromotion({
      client_id: payload.target_client_id,
      name: payload.business_name,
      email: payload.email,
      phone: payload.phone,
      business_name: payload.business_name,
      notes: payload.promotion_reason,
      metadata: {
        source: payload.source,
        source_detail: payload.source_detail || null,
        totalsitedata_prospect_id: payload.prospect_id,
        domain: payload.domain || null,
        category: payload.category || null,
        location: payload.location || null,
      },
    })
  }

  const activity: any = await logActivity({
    client_id: payload.target_client_id,
    contact_id: contact.id,
    product: 'totalsitedata',
    activity_type: 'totalsitedata_promoted',
    activity_category: 'sales',
    title: `TotalSiteData promoted lead: ${payload.business_name}`,
    description: payload.promotion_reason,
    source: payload.source,
    external_id: externalId,
    details: {
      totalsitedata_prospect_id: payload.prospect_id,
      source_detail: payload.source_detail || null,
      business_name: payload.business_name,
      domain: payload.domain || null,
      email: payload.email || null,
      phone: payload.phone || null,
      category: payload.category || null,
      location: payload.location || null,
      warmth_status: payload.warmth_status || null,
      promotion_trigger: payload.promotion_trigger || null,
      promotion_reason: payload.promotion_reason,
      lead_score: payload.lead_score ?? null,
      pain_score: payload.pain_score ?? null,
      fit_score: payload.fit_score ?? null,
      report_links: payload.report_links || {},
      scan_summary: payload.scan_summary || {},
    },
  })

  let lead: any = await findOpenLeadForContact(contact.id, payload.target_client_id)
  if (!lead) {
    lead = await createLeadRecord({
      contact_id: contact.id,
      client_id: payload.target_client_id,
      activity_id: activity.id,
      assigned_user_id: assignedUserId,
      source: mapPromotionPayloadToLeadSource(payload),
      status: mapPromotionPayloadToLeadStage(payload),
      notes: [
        `Source: ${payload.source}`,
        payload.source_detail ? `Source detail: ${payload.source_detail}` : null,
        `Promotion reason: ${payload.promotion_reason}`,
      ]
        .filter(Boolean)
        .join('\n'),
    })
  }

  return {
    success: true,
    deduplicated: false,
    client_id: payload.target_client_id,
    contact_id: contact.id,
    activity_id: activity.id,
    lead_id: lead?.id || null,
    stage: lead?.status || null,
    assigned_user_id: lead?.assigned_user_id || assignedUserId || null,
  }
}
