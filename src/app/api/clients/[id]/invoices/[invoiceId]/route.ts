import { NextResponse } from 'next/server'
import { getClientAccessFromRequest } from '@/lib/client-access'
import { getInvoiceById } from '@/lib/queries'

function isInvoicesMissing(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || '')
  const code = String((error as { code?: string })?.code || '')
  return code === 'PGRST205' || /Could not find the table ['"]public\.invoices['"] in the schema cache/.test(message)
}

export async function GET(request: Request, { params }: { params: { id: string; invoiceId: string } }) {
  try {
    const access = await getClientAccessFromRequest(request, params.id)

    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invoice: any = (await getInvoiceById(params.invoiceId)) as any
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (invoice.client_id !== params.id) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    const format = new URL(request.url).searchParams.get('format') || 'json'

    if (format === 'html') {
      const html = invoice.document_html || '<p>No invoice document available.</p>'
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      })
    }

    return NextResponse.json(invoice)
  } catch (error: unknown) {
    if (isInvoicesMissing(error)) {
      return NextResponse.json(
        { error: 'Invoice data store is not configured for this environment.' },
        { status: 404 }
      )
    }

    console.error('Error loading invoice:', error)
    return NextResponse.json(
      { error: (error as { message?: string })?.message || 'Failed to load invoice' },
      { status: 500 }
    )
  }
}
