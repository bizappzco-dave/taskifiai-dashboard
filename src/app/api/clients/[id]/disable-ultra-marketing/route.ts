import { NextResponse } from 'next/server'
import { requireClientRouteAccess } from '@/lib/client-access'
import { cancelActiveSubscriptionsForProductSlug, disableUltraMarketing, getClient } from '@/lib/queries'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = params.id

    const accessResult = await requireClientRouteAccess(request, clientId, { minimumRole: 'manager' })
    if (accessResult.response) return accessResult.response

    await disableUltraMarketing(clientId, {
      disabled_by: accessResult.access.userId,
    })
    await cancelActiveSubscriptionsForProductSlug(clientId, 'ultra-marketing')
    const updatedClient = await getClient(clientId)

    return NextResponse.json({
      success: true,
      client: updatedClient,
      ultra_marketing: updatedClient.features?.products?.ultra_marketing || null,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
