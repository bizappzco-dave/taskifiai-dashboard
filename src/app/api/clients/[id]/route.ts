import { NextResponse } from 'next/server'
import { getClient, updateClient } from '@/lib/queries'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const client = await getClient(params.id)
    return NextResponse.json(client)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const client = await updateClient(params.id, body)
    return NextResponse.json(client)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
