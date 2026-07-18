import { NextResponse } from 'next/server'
import { requireClientRouteAccess } from '@/lib/client-access'
import { getClient, enableDMChamp, createSubscription, getProductBySlug } from '@/lib/queries'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = params.id

    const accessResult = await requireClientRouteAccess(request, clientId, { minimumRole: 'manager' })
    if (accessResult.response) return accessResult.response

    const client = await getClient(clientId)
    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }

    const dmchampApiUrl = process.env.DMCHAMP_API_URL || 'https://api.dmchamp.com/v1'
    const dmchampApiKey = process.env.DMCHAMP_API_KEY

    if (!dmchampApiKey) {
      return NextResponse.json({ error: 'DMCHAMP_API_KEY not configured' }, { status: 503 })
    }

    const nameParts = (client.contact_name || '').split(' ')
    const firstName = nameParts[0] || client.business_name
    const lastName = nameParts.slice(1).join(' ') || ''

    const response = await fetch(`${dmchampApiUrl}/subaccounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dmchampApiKey}`
      },
      body: JSON.stringify({
        email: client.email,
        first_name: firstName,
        last_name: lastName,
        business_name: client.business_name,
        usage_limits: {
          monthly_credits: 1000,
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to create DM Champ account')
    }

    const accountData = await response.json()

    const updatedClient = await enableDMChamp(clientId, {
      account_id: accountData.sub_account_id,
      login_url: 'https://app.dmchamp.com',
    })

    const product: { id?: string } | null = (await getProductBySlug('dm-champ')) as { id?: string } | null
    if (!product || !product.id) {
      return NextResponse.json(
        { error: 'DM Champ product not found' },
        { status: 404 }
      )
    }

    await createSubscription({
      client_id: clientId,
      product_id: product.id,
      plan: client.subscription_tier || 'starter',
      billing_model: client.billing_cycle || 'monthly',
      monthly_price: client.monthly_revenue || 0,
      plan_description: client.subscription_description || null,
      external_account_id: accountData.sub_account_id,
      external_login_url: 'https://app.dmchamp.com',
    })

    return NextResponse.json({
      success: true,
      client: updatedClient,
      dmchamp: accountData,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
