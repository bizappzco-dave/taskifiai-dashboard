import { NextResponse } from 'next/server'
import { getClientAccessFromRequest } from '@/lib/client-access'
import { getInvoicesForClient } from '@/lib/queries'

function isInvoicesMissing(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || '')
  const code = String((error as { code?: string })?.code || '')
  return code === 'PGRST205' || /Could not find the table ['"]public\.invoices['"] in the schema cache/.test(message)
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const access = await getClientAccessFromRequest(request, params.id)

    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const rawLimit = searchParams.get('limit')
    const parsedLimit = rawLimit ? Number(rawLimit) : 20
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20

    const invoices = await getInvoicesForClient(params.id)
    return NextResponse.json((invoices || []).slice(0, limit))
  } catch (error: unknown) {
    if (isInvoicesMissing(error)) {
      return NextResponse.json([])
    }

    console.error('Error loading invoices:', error)
    return NextResponse.json(
      { error: (error as { message?: string })?.message || 'Failed to load invoices' },
      { status: 500 }
    )
  }
}
