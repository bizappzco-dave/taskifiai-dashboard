import { NextResponse } from 'next/server'
import { getClients, createClientRecord } from '@/lib/queries'

export async function GET() {
  try {
    const clients = await getClients()
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
    
    const client = await createClientRecord(body)
    return NextResponse.json(client)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
