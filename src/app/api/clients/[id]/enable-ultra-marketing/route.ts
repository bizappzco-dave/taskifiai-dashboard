import { NextResponse } from 'next/server'
import { requireClientRouteAccess } from '@/lib/client-access'
import { createSubscription, enableUltraMarketing, getClient, getProductBySlug } from '@/lib/queries'

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
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const product: { id?: string } | null = await getProductBySlug('ultra-marketing') as { id?: string } | null
    if (!product?.id) {
      return NextResponse.json({ error: 'Ultra Marketing product not found' }, { status: 404 })
    }

    await createSubscription({
      client_id: clientId,
      product_id: product.id,
      plan: client.subscription_tier || 'growth',
      billing_model: client.billing_cycle || 'monthly',
      monthly_price: client.monthly_revenue || 0,
      plan_description: client.subscription_description || 'Ultra Marketing Assistant workspace access',
      external_account_id: null,
      external_login_url: null,
      metadata: {
        enabled_by: accessResult.access.userId,
        access_model: 'shared_tenant_isolated_runtime',
        approval_policy: 'approval_required_for_external_actions',
      },
    })

    const updatedClient = await enableUltraMarketing(clientId, {
      tier: client.subscription_tier || client.tier || 'growth',
      enabled_by: accessResult.access.userId,
    })

    return NextResponse.json({
      success: true,
      client: updatedClient,
      ultra_marketing: updatedClient.features?.products?.ultra_marketing || null,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
