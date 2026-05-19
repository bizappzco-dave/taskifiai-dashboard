import { NextResponse } from 'next/server'
import { getClient, enableSocialDrive } from '@/lib/queries'

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
    
    // Call SocialDrive AI API to create sub-account
    const socialdriveApiUrl = process.env.SOCIALDRIVE_API_URL || 'https://socialdrive-ai.vercel.app/api'
    
    const response = await fetch(`${socialdriveApiUrl}/agency/clients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: client.business_name,  // SocialDrive expects 'name', not 'business_name'
        industry: client.industry || 'General',
        tier: client.subscription_tier
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to create SocialDrive account')
    }
    
    const accountData = await response.json()
    
    // Update client in TaskifiAI
    const updatedClient = await enableSocialDrive(clientId, {
      account_id: accountData.client.id,  // SocialDrive returns 'client.id' not 'client_id'
      upload_url: accountData.client.upload_url,
      dashboard_url: accountData.client.review_url  // Use review_url as dashboard for now
    })
    
    // TODO: Create subscription record when billing is implemented
    // await createSubscription({...})
    
    return NextResponse.json({
      success: true,
      client: updatedClient,
      socialdrive: accountData
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
