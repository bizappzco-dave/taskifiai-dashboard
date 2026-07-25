import { NextResponse } from 'next/server'
import { requireWebhookSecret } from '@/lib/webhook-auth'
import { validateTotalSiteDataPromotionPayload } from '@/lib/totalsitedata/promotion'
import { executeTotalSiteDataPromotion } from '@/lib/totalsitedata/processor'

function looksLikeSupabaseHtmlError(message: string | undefined): boolean {
  return !!message && /^<!doctype html>/i.test(message.trim())
}

function getInternalSecret() {
  return process.env.TOTALSITEDATA_INTERNAL_SECRET || process.env.INTERNAL_API_SECRET
}

function getStagingClientId(): string | null {
  return process.env.TOTALSITEDATA_STAGING_CLIENT_ID || null
}

export async function POST(request: Request) {
  try {
    const expectedSecret = getInternalSecret()
    const authError = requireWebhookSecret(
      request,
      expectedSecret,
      'TOTALSITEDATA_INTERNAL_SECRET'
    )
    if (authError) return authError

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
            error:
              'target_client_id is required and no TOTALSITEDATA_STAGING_CLIENT_ID is configured',
            code: 'target_client_id_required',
            explanation:
              'TaskifiAI contacts, activities, and leads currently require a client_id anchor. Provide a target_client_id in the payload, or configure TOTALSITEDATA_STAGING_CLIENT_ID in the environment.',
          },
          { status: 409 }
        )
      }
    }

    const result = await executeTotalSiteDataPromotion(payload, payload.target_client_id)

    return NextResponse.json(result)
  } catch (error: any) {
    const message = error?.message || 'Unknown error'

    if (looksLikeSupabaseHtmlError(message)) {
      console.error('TotalSiteData promotion route returned non-Supabase response body (likely invalid SUPABASE_URL).')
      return NextResponse.json(
        {
          error:
            'Supabase response is HTML instead of JSON; verify SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL points to a real Supabase project.',
          details: {
            message,
          },
        },
        { status: 500 }
      )
    }

    console.error('TotalSiteData promotion route error:', error)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
