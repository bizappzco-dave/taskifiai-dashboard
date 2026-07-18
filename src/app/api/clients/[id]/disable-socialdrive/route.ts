import { NextResponse } from 'next/server'
import { requireClientRouteAccess } from '@/lib/client-access'
import { updateClient } from '@/lib/queries'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = params.id

    const accessResult = await requireClientRouteAccess(request, clientId, { minimumRole: 'manager' })
    if (accessResult.response) return accessResult.response
    
    // Update client to disable SocialDrive
    const updatedClient = await updateClient(clientId, {
      upload_token: null,
      review_token: null,
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
