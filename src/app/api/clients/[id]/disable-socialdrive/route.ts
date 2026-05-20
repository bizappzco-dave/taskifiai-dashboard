import { NextResponse } from 'next/server'
import { updateClient } from '@/lib/queries'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = params.id
    
    // Update client to disable SocialDrive
    const updatedClient = await updateClient(clientId, {
      socialdrive_enabled: false,
      socialdrive_account_id: null,
      socialdrive_upload_url: null,
      socialdrive_dashboard_url: null,
      socialdrive_status: null,
    })
    
    return NextResponse.json({
      success: true,
      client: updatedClient
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
