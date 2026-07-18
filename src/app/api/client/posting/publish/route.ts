import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getClientAccessFromRequest, roleAtLeast } from '@/lib/client-access'

export const dynamic = 'force-dynamic'

type PostRow = {
  id: string
  client_id: string
  submission_id?: string | null
  caption?: string | null
  hashtags?: string[] | null
  image_urls?: string[] | null
  platform?: string | null
  status?: string | null
  scheduled_for?: string | null
}

function uploadApiBase() {
  const configured = process.env.UPLOAD_POST_UPLOAD_BASE_URL || process.env.UPLOAD_POST_BASE_URL || 'https://api.upload-post.com/api'
  return configured.replace(/\/uploadposts\/?$/, '').replace(/\/$/, '')
}

function inferMediaType(urls: string[]) {
  if (urls.some((url) => /\.(mp4|mov|webm)(\?|$)/i.test(url) || url.toLowerCase().includes('video'))) return 'video'
  if (urls.length > 1) return 'carousel'
  if (urls.length === 0) return 'text'
  return 'image'
}

async function publicMediaUrls(supabase: ReturnType<typeof getSupabaseAdmin>, urls: string[]) {
  if (urls.length === 0) return []
  if (!urls[0]?.includes('supabase.co/storage')) return urls

  const bucketMatch = urls[0].match(/\/storage\/v1\/object\/(?:public|private|sign)\/([^/]+)\//)
  const bucketName = bucketMatch?.[1]
  if (!bucketName) return urls

  const relativePaths = urls.map((url) => {
    const pathMatch = url.match(/\/storage\/v1\/object\/(?:public|private|sign)\/[^/]+\/(.+?)(?:\?|$)/)
    return pathMatch ? decodeURIComponent(pathMatch[1]) : url
  })

  const { data, error } = await supabase.storage.from(bucketName).createSignedUrls(relativePaths, 3600)
  if (error || !Array.isArray(data)) return urls
  const signed = data.map((item: any) => item?.signedUrl).filter(Boolean)
  return signed.length ? signed : urls
}

async function updatePostAfterPublish(supabase: any, postId: string, uploadData: any, success: boolean) {
  await supabase
    .from('posts')
    .update({
      status: success ? 'published' : 'draft',
      published_at: success ? new Date().toISOString() : null,
      external_post_id: uploadData?.request_id || uploadData?.job_id || null,
      external_post_url: uploadData?.results?.instagram?.url || uploadData?.url || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const clientId = body?.client_id
    const postIds = Array.isArray(body?.post_ids) ? body.post_ids.map(String).filter(Boolean) : []
    const platforms = Array.isArray(body?.platforms) && body.platforms.length ? body.platforms.map(String) : ['instagram']
    const mode = body?.mode === 'scheduled' ? 'scheduled' : 'post_now'
    const scheduledDate = body?.scheduled_date || null

    if (!clientId) return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
    if (postIds.length === 0) return NextResponse.json({ error: 'Choose at least one post to publish' }, { status: 400 })

    const access = await getClientAccessFromRequest(request, clientId)
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!roleAtLeast(access.role, 'editor')) {
      return NextResponse.json({ error: 'You do not have permission to publish posts for this client' }, { status: 403 })
    }

    const supabase = getSupabaseAdmin() as any
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('id, client_id, submission_id, caption, hashtags, image_urls, platform, status, scheduled_for')
      .eq('client_id', clientId)
      .in('id', postIds)

    if (postsError) throw postsError

    const selectedPosts = ((posts || []) as PostRow[]).filter((post) => post.id)
    if (selectedPosts.length === 0) return NextResponse.json({ error: 'No posts found for this client' }, { status: 404 })

    const jobRows = selectedPosts.map((post) => {
      const urls = Array.isArray(post.image_urls) ? post.image_urls : []
      return {
        client_id: clientId,
        submission_id: post.submission_id || null,
        post_id: post.id,
        mode,
        scheduled_date_utc: mode === 'scheduled' && scheduledDate ? scheduledDate : null,
        platform_targets: platforms,
        media_type: inferMediaType(urls),
        status: mode === 'post_now' ? 'processing' : 'queued',
        created_by: access.userId,
      }
    })

    const { data: jobs, error: jobError } = await supabase
      .from('posting_jobs')
      .insert(jobRows)
      .select('id, post_id, status, mode, scheduled_date_utc, created_at')

    if (jobError) throw jobError

    const uploadPostApiKey = process.env.UPLOAD_POST_API_KEY
    const profileUsername = access.client?.upload_post_username || process.env.UPLOAD_POST_PROFILE_USERNAME || 'Taskifi-AI'

    if (mode === 'scheduled') {
      await supabase.from('posts').update({ status: 'scheduled', scheduled_for: scheduledDate, updated_at: new Date().toISOString() }).in('id', postIds)
      return NextResponse.json({ success: true, integration_mode: 'scheduled_local', message: 'Post scheduled in TaskifiAI. Live schedule sync is next.', jobs: jobs || [] })
    }

    if (!uploadPostApiKey) {
      return NextResponse.json({ success: true, integration_mode: 'local_only', message: 'Posting jobs created. Upload-Post API key is not configured yet.', jobs: jobs || [] })
    }

    const uploadResults = []

    for (const post of selectedPosts) {
      const matchingJob = (jobs || []).find((job: any) => job.post_id === post.id)
      try {
        const rawUrls = Array.isArray(post.image_urls) ? post.image_urls.filter(Boolean) : []
        const mediaUrls = await publicMediaUrls(supabase, rawUrls)
        const mediaType = inferMediaType(mediaUrls)

        if (mediaType !== 'text' && mediaUrls.length === 0) {
          throw new Error('No media URL found for this post')
        }

        const formData = new FormData()
        formData.append('caption', post.caption || '')
        formData.append('hashtags', JSON.stringify(post.hashtags || []))
        platforms.forEach((platform) => formData.append('platform[]', platform))
        formData.append('user', profileUsername)
        formData.append('async_upload', 'true')

        let endpoint = '/upload_text'
        if (mediaType === 'video') {
          endpoint = '/upload'
          formData.append('video_url', mediaUrls[0])
        } else if (mediaType === 'image' || mediaType === 'carousel') {
          endpoint = '/upload_photos'
          mediaUrls.forEach((url) => formData.append('photos[]', url))
        }

        const uploadResponse = await fetch(`${uploadApiBase()}${endpoint}?username=${encodeURIComponent(profileUsername)}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${uploadPostApiKey}` },
          body: formData,
        })

        const uploadData = await uploadResponse.json().catch(() => ({}))
        const success = uploadResponse.ok && uploadData?.success !== false

        await supabase
          .from('posting_jobs')
          .update({
            uploadpost_request_id: uploadData?.request_id || null,
            uploadpost_job_id: uploadData?.job_id || null,
            status: success ? 'posted' : 'failed',
            error_message: success ? null : uploadData?.error || uploadData?.message || 'Upload failed',
            posted_at: success ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', matchingJob?.id)

        await updatePostAfterPublish(supabase, post.id, uploadData, success)

        uploadResults.push({
          post_id: post.id,
          job_id: matchingJob?.id,
          success,
          request_id: uploadData?.request_id,
          error: success ? null : uploadData?.error || uploadData?.message || 'Upload failed',
          url: uploadData?.results?.instagram?.url || uploadData?.url || null,
        })
      } catch (error: any) {
        await supabase
          .from('posting_jobs')
          .update({ status: 'failed', error_message: error.message || 'Upload failed', updated_at: new Date().toISOString() })
          .eq('id', matchingJob?.id)
        uploadResults.push({ post_id: post.id, job_id: matchingJob?.id, success: false, error: error.message || 'Upload failed' })
      }
    }

    return NextResponse.json({ success: true, integration_mode: 'live', username: profileUsername, jobs: jobs || [], upload_results: uploadResults })
  } catch (error: any) {
    console.error('TaskifiAI publish error:', error)
    return NextResponse.json({ error: error.message || 'Failed to publish posts' }, { status: 500 })
  }
}
