import { NextResponse } from 'next/server'
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
  validateTotalSiteDataPromotionPayload,
} from '@/lib/totalsitedata/promotion'
import { getSupabaseAdmin } from '@/lib/supabase'

function getInternalSecret() {
  return process.env.TOTALSITEDATA_INTERNAL_SECRET || process.env.INTERNAL_API_SECRET || ''
}

function getStagingClientId(): string | null {
  return process.env.TOTALSITEDATA_STAGING_CLIENT_ID || null
}

function getProvidedSecret(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim()
  }

  return request.headers.get('x-totalsitedata-secret')?.trim() || ''
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

export async function POST(request: Request) {
  try {
    const expectedSecret = getInternalSecret()
    if (!expectedSecret) {
      return NextResponse.json(
        { error: 'TOTALSITEDATA_INTERNAL_SECRET is not configured' },
        { status: 500 }
      )
    }

    const providedSecret = getProvidedSecret(request)
    if (!providedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const rawBody = await request.json()
    const validation = validateTotalSiteDataPromotionPayload(rawBody)

    if (!validation.success || !validation.data) {
      return NextResponse.json(
        { error: 'Invalid payload', details: validation.errors || [] },
        { status: 400 }
      )
    }

    const payload = validation.data

    if (!payload.target_client_id) {
      const stagingClientId = getStagingClientId()
      if (stagingClientId) {
        payload.target_client_id = stagingClientId
      } else {
        return NextResponse.json(
          {
            error: 'target_client_id is required and no TOTALSITEDATA_STAGING_CLIENT_ID is configured',
            code: 'target_client_id_required',
            explanation:
              'TaskifiAI contacts, activities, and leads currently require a client_id anchor. Provide a target_client_id in the payload, or configure TOTALSITEDATA_STAGING_CLIENT_ID in the environment.',
          },
          { status: 409 }
        )
      }
    }

    const client: any = await getClientOwnerInfo(payload.target_client_id)
    const assignedUserId = await getValidAssignedUserId(client.user_id)
    const externalId = `totalsitedata:prospect:${payload.prospect_id}`

    const existingActivity: any = await findActivityByExternalId(payload.target_client_id, externalId)
    if (existingActivity?.id) {
      const existingLead: any = await findLeadByActivityId(existingActivity.id)

      return NextResponse.json({
        success: true,
        deduplicated: true,
        client_id: payload.target_client_id,
        activity_id: existingActivity.id,
        lead_id: existingLead?.id || null,
        contact_id: existingActivity.contact_id || null,
      })
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

    return NextResponse.json({
      success: true,
      deduplicated: false,
      client_id: payload.target_client_id,
      contact_id: contact.id,
      activity_id: activity.id,
      lead_id: lead?.id || null,
      stage: lead?.status || null,
      assigned_user_id: lead?.assigned_user_id || assignedUserId || null,
    })
  } catch (error: any) {
    console.error('TotalSiteData promotion route error:', error)

    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
