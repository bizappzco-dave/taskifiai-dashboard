import { NextResponse } from 'next/server'
import { requireClientRouteAccess } from '@/lib/client-access'
import { getClient, enableSocialDrive, createSubscription, getProductBySlug } from '@/lib/queries'

function generateToken(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = params.id

    const accessResult = await requireClientRouteAccess(request, clientId, { minimumRole: 'manager' })
    if (accessResult.response) return accessResult.response
    
    // Get client details
    const client = await getClient(clientId)
    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }
    
    // SocialDrive reads the same TaskifiAI Supabase clients table, so enabling
    // this product only needs permanent tokens on the existing client record.
    // Do not call the SocialDrive agency-client creation endpoint here: it
    // creates duplicate client rows before this dashboard update runs.
    let uploadToken = client.upload_token || null
    let reviewToken = client.review_token || null

    uploadToken = uploadToken || generateToken()
    reviewToken = reviewToken || generateToken()
    
    // Update client in TaskifiAI
    const updatedClient = await enableSocialDrive(clientId, {
      upload_token: uploadToken,
      review_token: reviewToken,
      upload_url: `https://socialdrive-ai.vercel.app/upload/${uploadToken}`,
      dashboard_url: `https://socialdrive-ai.vercel.app/review?token=${reviewToken}`,
    })

    const product: { id?: string } | null = (await getProductBySlug('socialdrive')) as { id?: string } | null
    if (product && product.id) {
      await createSubscription({
        client_id: clientId,
        product_id: product.id,
        plan: client.subscription_tier || 'starter',
        billing_model: client.billing_cycle || 'monthly',
        monthly_price: client.monthly_revenue || 0,
        plan_description: client.subscription_description || null,
        external_account_id: null,
        external_login_url: `https://socialdrive-ai.vercel.app/review?token=${reviewToken}`
      })
    }
    
    return NextResponse.json({
      success: true,
      client: updatedClient,
      socialdrive: {
        upload_url: `https://socialdrive-ai.vercel.app/upload/${uploadToken}`,
        review_url: `https://socialdrive-ai.vercel.app/review?token=${reviewToken}`,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
