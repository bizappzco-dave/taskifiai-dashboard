import { NextResponse } from 'next/server'
import { createClientRecord } from '@/lib/queries'
import { listAccessibleClientsForUser, requireAuthenticatedUserFromRequest } from '@/lib/client-access'

export async function GET(request: Request) {
  try {
    const authResult = await requireAuthenticatedUserFromRequest(request)
    if (authResult.response) return authResult.response

    const clients = await listAccessibleClientsForUser(authResult.user.id)
    return NextResponse.json(clients)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validate required fields
    if (!body.business_name) {
      return NextResponse.json(
        { error: 'business_name is required' },
        { status: 400 }
      )
    }

    const authResult = await requireAuthenticatedUserFromRequest(request)
    if (authResult.response) return authResult.response
    
    const client = await createClientRecord(body, authResult.user.id)
    return NextResponse.json(client)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
