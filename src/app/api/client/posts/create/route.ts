import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getClientAccessFromRequest, roleAtLeast } from '@/lib/client-access'
import { isUltraMarketingEnabled } from '@/lib/ultra-marketing'
import { approvalItemFromTask, buildPostingDraftApprovalTask } from '@/lib/ultra-marketing-approvals'

export const dynamic = 'force-dynamic'

function parseHashtags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value !== 'string') return []
  return value
    .split(/\s+/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.startsWith('#'))
    .map((tag) => tag.replace(/[^#a-zA-Z0-9_]/g, ''))
    .filter(Boolean)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const clientId = body?.client_id

    if (!clientId) return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
    if (!body?.caption) return NextResponse.json({ error: 'Caption is required' }, { status: 400 })

    const access = await getClientAccessFromRequest(request, clientId)
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!roleAtLeast(access.role, 'editor')) {
      return NextResponse.json({ error: 'You do not have permission to create posts for this client' }, { status: 403 })
    }

    const imageUrls = Array.isArray(body.image_urls)
      ? body.image_urls.map(String).filter(Boolean)
      : body.image_url
        ? [String(body.image_url)]
        : []

    const supabase = getSupabaseAdmin() as any
    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        client_id: clientId,
        caption: String(body.caption),
        hashtags: parseHashtags(body.hashtags),
        image_urls: imageUrls,
        platform: body.platform || 'instagram',
        scheduled_for: body.scheduled_for || null,
        status: body.scheduled_for ? 'scheduled' : 'draft',
      })
      .select('id, client_id, submission_id, caption, hashtags, image_urls, platform, status, scheduled_for, created_at')
      .single()

    if (error) throw error

    let approval = null
    if ((post.status || 'draft') === 'draft' && isUltraMarketingEnabled(access.client)) {
      const { data: approvalTask, error: approvalError } = await supabase
        .from('tasks')
        .insert([buildPostingDraftApprovalTask(post, { createdBy: access.userId })] as any)
        .select('id, client_id, title, description, status, priority, due_date, completed_at, metadata, created_at, updated_at')
        .single()

      if (approvalError) throw approvalError
      approval = approvalItemFromTask(approvalTask)
    }

    return NextResponse.json({ success: true, post, approval })
  } catch (error: any) {
    console.error('TaskifiAI create post error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create post' }, { status: 500 })
  }
}
