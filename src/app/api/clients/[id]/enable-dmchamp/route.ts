import { NextResponse } from 'next/server'
import { getClient, enableDMChamp, createSubscription } from '@/lib/queries'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = params.id
    
    // Get client details
    const client = await getClient(clientId)
    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }
    
    // Call DM Champ API to create sub-account
    const dmchampApiUrl = process.env.DMCHAMP_API_URL || 'https://api.dmchamp.com/v1'
    const dmchampApiKey = process.env.DMCHAMP_API_KEY
    
    if (!dmchampApiKey) {
      throw new Error('DMCHAMP_API_KEY not configured')
    }
    
    // Split contact name into first/last
    const nameParts = (client.contact_name || '').split(' ')
    const firstName = nameParts[0] || client.business_name
    const lastName = nameParts.slice(1).join(' ') || ''
    
    const response = await fetch(`${dmchampApiUrl}/subaccounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dmchampApiKey}`
      },
      body: JSON.stringify({
        email: client.email,
        first_name: firstName,
        last_name: lastName,
        business_name: client.business_name,
        usage_limits: {
          monthly_credits: 1000
        }
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to create DM Champ account')
    }
    
    const accountData = await response.json()
    
    // Update client in TaskifiAI
    const updatedClient = await enableDMChamp(clientId, {
      account_id: accountData.sub_account_id,
      login_url: 'https://app.dmchamp.com'
    })
    
    // Create subscription record
    await createSubscription({
      client_id: clientId,
      product_id: await getProductId('dm-champ'),
      plan: client.subscription_tier,
      monthly_price: 179.00,
      external_account_id: accountData.sub_account_id,
      external_login_url: 'https://app.dmchamp.com'
    })
    
    return NextResponse.json({
      success: true,
      client: updatedClient,
      dmchamp: accountData
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// Helper to get product ID
async function getProductId(slug: string) {
  const { getProductBySlug } = await import('@/lib/queries')
  const product = await getProductBySlug(slug)
  return product?.id
}
