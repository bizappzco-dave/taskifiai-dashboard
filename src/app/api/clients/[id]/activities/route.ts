import { NextRequest, NextResponse } from 'next/server'
import { getActivitiesByClient } from '@/lib/queries'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params

    // Get limit and category filter from query params
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const category = url.searchParams.get('category') || null

    const result = await getActivitiesByClient(clientId, { limit, category })

    if (result.error) {
      console.error('Failed to load activities:', result.error)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error loading activities:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
