import { NextResponse } from 'next/server'
import { getClient, updateClient } from '@/lib/queries'
import { requireClientRouteAccess } from '@/lib/client-access'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const accessResult = await requireClientRouteAccess(request, params.id)
    if (accessResult.response) return accessResult.response

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
    const accessResult = await requireClientRouteAccess(request, params.id, { minimumRole: 'manager' })
    if (accessResult.response) return accessResult.response

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
