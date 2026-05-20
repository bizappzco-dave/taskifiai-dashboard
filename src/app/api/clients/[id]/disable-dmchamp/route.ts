import { NextResponse } from 'next/server'
import { updateClient } from '@/lib/queries'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = params.id
    
    // Update client to disable DM Champ
    const updatedClient = await updateClient(clientId, {
      dmchamp_enabled: false,
      dmchamp_account_id: null,
      dmchamp_login_url: null,
      dmchamp_status: null,
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
