'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ClientNav from '@/components/ClientNav';
import { getSupabase } from '@/lib/supabase';
import { DashboardClient, clientName, loadAccessibleClients, requireDashboardUser } from '@/lib/dashboard-data';

type PostItem = {
  id: string;
  submission_id?: string | null;
  caption?: string | null;
  hashtags?: string[] | null;
  image_urls?: string[] | null;
  platform?: string | null;
  status?: string | null;
  scheduled_for?: string | null;
  created_at?: string | null;
};

type PostingJob = {
  id: string;
  post_id?: string | null;
  mode?: string | null;
  status?: string | null;
  error_message?: string | null;
  posted_at?: string | null;
  scheduled_date_utc?: string | null;
  created_at?: string | null;
};

const emptyForm = {
  caption: '',
  hashtags: '',
  image_url: '',
  platform: 'instagram',
  scheduled_for: '',
};

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleString('en-IE', { dateStyle: 'medium', timeStyle: 'short' });
}

function statusLabel(status?: string | null) {
  return status ? status.replace(/_/g, ' ') : 'draft';
}

export default function ClientPostingPage() {
  const router = useRouter();
  const [clients, setClients] = useState<DashboardClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [jobs, setJobs] = useState<PostingJob[]>([]);
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [formData, setFormData] = useState(emptyForm);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [panelLoading, setPanelLoading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    loadPostingHome();
  }, []);

  useEffect(() => {
    if (selectedClientId) loadPostingData(selectedClientId);
  }, [selectedClientId]);

  async function authToken() {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  async function loadPostingHome() {
    try {
      const user = await requireDashboardUser();
      if (!user) {
        router.push('/auth/signin');
        return;
      }

      setUserEmail(user.email || '');
      const accessibleClients = await loadAccessibleClients(user.id);
      setClients(accessibleClients);

      const requestedClient = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('client_id') : null;
      const selected = accessibleClients.find((client) => client.id === requestedClient) || accessibleClients[0];
      if (selected) setSelectedClientId(selected.id);
    } catch (err: any) {
      setWarnings([err.message || 'Could not load posting workspace.']);
    } finally {
      setLoading(false);
    }
  }

  async function loadPostingData(clientId: string) {
    setPanelLoading(true);
    setSelectedPosts([]);
    const nextWarnings: string[] = [];

    try {
      const supabase = getSupabase();

      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select('id, submission_id, caption, hashtags, image_urls, platform, status, scheduled_for, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (postError) nextWarnings.push(`Posts: ${postError.message}`);
      else setPosts((postData || []) as PostItem[]);

      const { data: jobData, error: jobError } = await supabase
        .from('posting_jobs')
        .select('id, post_id, mode, status, error_message, posted_at, scheduled_date_utc, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (jobError) nextWarnings.push(`Posting history: ${jobError.message}`);
      else setJobs((jobData || []) as PostingJob[]);
    } catch (err: any) {
      nextWarnings.push(err.message || 'Posting data could not load.');
    } finally {
      setWarnings(nextWarnings);
      setPanelLoading(false);
    }
  }

  function togglePost(postId: string) {
    setSelectedPosts((current) => current.includes(postId) ? current.filter((id) => id !== postId) : [...current, postId]);
  }

  function toggleDrafts() {
    const draftIds = posts.filter((post) => (post.status || 'draft') === 'draft').map((post) => post.id);
    setSelectedPosts((current) => current.length === draftIds.length ? [] : draftIds);
  }

  async function createPost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClientId) return;

    setWorking('create');
    setMessage(null);

    try {
      const token = await authToken();
      if (!token) throw new Error('Please sign in again.');

      const res = await fetch('/api/client/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          client_id: selectedClientId,
          caption: formData.caption,
          hashtags: formData.hashtags,
          image_url: formData.image_url,
          platform: formData.platform,
          scheduled_for: formData.scheduled_for || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create post');

      setFormData(emptyForm);
      setMessage(data.approval
        ? 'Post saved and added to the Ultra Marketing approval queue. It can be posted after approval.'
        : 'Post saved in TaskifiAI. You can post it now or keep it as a draft.');
      await loadPostingData(selectedClientId);
    } catch (err: any) {
      setMessage(`Post not saved: ${err.message}`);
    } finally {
      setWorking(null);
    }
  }

  async function publishSelected() {
    if (!selectedClientId || selectedPosts.length === 0) {
      setMessage('Choose at least one draft post first.');
      return;
    }

    setWorking('publish');
    setMessage(null);

    try {
      const token = await authToken();
      if (!token) throw new Error('Please sign in again.');

      const res = await fetch('/api/client/posting/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          client_id: selectedClientId,
          post_ids: selectedPosts,
          platforms: ['instagram'],
          mode: 'post_now',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post');

      const failures = (data.upload_results || []).filter((result: any) => !result.success);
      if (data.integration_mode === 'live' && failures.length === 0) {
        setMessage(`Post request sent to Upload-Post for ${selectedPosts.length} post${selectedPosts.length === 1 ? '' : 's'}.`);
      } else if (failures.length > 0) {
        setMessage(`Some posts need attention: ${failures.map((failure: any) => failure.error).join(' • ')}`);
      } else {
        setMessage(data.message || 'Posting job created.');
      }

      await loadPostingData(selectedClientId);
    } catch (err: any) {
      setMessage(`Posting failed: ${err.message}`);
    } finally {
      setWorking(null);
    }
  }

  const selectedClient = clients.find((client) => client.id === selectedClientId) || null;
  const draftPosts = useMemo(() => posts.filter((post) => (post.status || 'draft') === 'draft'), [posts]);
  const postedJobs = jobs.filter((job) => job.status === 'posted').length;
  const failedJobs = jobs.filter((job) => job.status === 'failed').length;
  const uploadUrl = selectedClient?.upload_token ? `https://socialdrive-ai.vercel.app/upload/${selectedClient.upload_token}` : null;
  const reviewUrl = selectedClient?.review_token ? `https://socialdrive-ai.vercel.app/review?token=${selectedClient.review_token}` : null;

  if (loading) {
    return <main className="taskifi-dashboard taskifi-loading-screen"><div className="taskifi-loading-card"><div className="taskifi-spinner" /><p className="taskifi-eyebrow">Posting</p><h1>Loading content tools</h1><p>Checking your upload link, drafts and posting queue.</p></div></main>;
  }

  return (
    <div className="taskifi-dashboard taskifi-client-dashboard">
      <ClientNav userEmail={userEmail} />
      <main className="taskifi-main taskifi-feature-main">
        <section className="taskifi-feature-hero">
          <div>
            <Link href={`/client${selectedClientId ? `?client_id=${selectedClientId}` : ''}`} className="taskifi-back-link">← Back to client home</Link>
            <p className="taskifi-pill"><span /> Content posting</p>
            <h1>{selectedClient ? `${clientName(selectedClient)} posting` : 'Upload and post from one place'}</h1>
            <p>Upload new photos, review ready captions and send approved posts without leaving the TaskifiAI dashboard.</p>
          </div>
          <div className="taskifi-feature-actions">
            {clients.length > 1 && (
              <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)} className="taskifi-feature-select" aria-label="Choose client account">
                {clients.map((client) => <option key={client.id} value={client.id}>{clientName(client)}</option>)}
              </select>
            )}
            {uploadUrl ? <a href={uploadUrl} target="_blank" rel="noopener noreferrer" className="taskifi-button taskifi-button-primary">Upload photos</a> : <span className="taskifi-button taskifi-button-secondary">Upload link not enabled</span>}
          </div>
        </section>

        {warnings.length > 0 && <section className="taskifi-alert" role="status"><strong>Posting notes:</strong> {warnings.join(' • ')}</section>}
        {message && <section className={message.includes('failed') || message.includes('not saved') || message.includes('attention') ? 'taskifi-alert' : 'taskifi-success-panel'} role="status">{message}</section>}

        {!selectedClient ? (
          <section className="taskifi-empty-state taskifi-empty-wide"><p className="taskifi-eyebrow">No client access</p><h2>Your account is not linked to a client workspace.</h2><p>Ask your TaskifiAI admin to add your email to the client account.</p></section>
        ) : panelLoading ? (
          <div className="taskifi-loading-card taskifi-inline-loading"><div className="taskifi-spinner" /><p>Refreshing posting workspace...</p></div>
        ) : (
          <>
            <section className="taskifi-stats-grid" aria-label="Posting summary">
              <article className="taskifi-stat-card"><span>Drafts</span><strong>{draftPosts.length}</strong><p>Posts ready to review or publish.</p></article>
              <article className="taskifi-stat-card"><span>Upload link</span><strong>{uploadUrl ? 'On' : 'Off'}</strong><p>{uploadUrl ? 'Photos can be uploaded by the client.' : 'Enable SocialDrive upload first.'}</p></article>
              <article className="taskifi-stat-card"><span>Posted</span><strong>{postedJobs}</strong><p>Recent successful posting jobs.</p></article>
              <article className="taskifi-stat-card"><span>Needs attention</span><strong>{failedJobs}</strong><p>Recent posting jobs that failed.</p></article>
            </section>

            <section className="taskifi-posting-grid">
              <article className="taskifi-module-card">
                <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Upload first</p><h2>Client upload link</h2></div><span className={uploadUrl ? 'taskifi-connection-badge live' : 'taskifi-connection-badge'}>{uploadUrl ? 'Ready' : 'Not enabled'}</span></div>
                <div className="taskifi-client-action-grid">
                  {uploadUrl ? <a href={uploadUrl} target="_blank" rel="noopener noreferrer">Upload images</a> : <span>Upload page not enabled</span>}
                  {reviewUrl ? <a href={reviewUrl} target="_blank" rel="noopener noreferrer">Review generated posts</a> : <span>Review link not enabled</span>}
                </div>
                <p className="taskifi-muted-note">Uploaded photos and generated captions will appear here as draft posts once SocialDrive creates them.</p>
              </article>

              <article className="taskifi-module-card">
                <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Manual post</p><h2>Create a draft</h2></div></div>
                <form className="taskifi-client-form taskifi-post-form" onSubmit={createPost}>
                  <label className="taskifi-field"><span>Caption</span><textarea rows={5} value={formData.caption} onChange={(event) => setFormData({ ...formData, caption: event.target.value })} placeholder="Write the post caption" required /></label>
                  <label className="taskifi-field"><span>Image URL</span><input value={formData.image_url} onChange={(event) => setFormData({ ...formData, image_url: event.target.value })} placeholder="Paste a public image URL, or use the upload link first" /></label>
                  <div className="taskifi-form-grid">
                    <label className="taskifi-field"><span>Hashtags</span><input value={formData.hashtags} onChange={(event) => setFormData({ ...formData, hashtags: event.target.value })} placeholder="#local #business" /></label>
                    <label className="taskifi-field"><span>Platform</span><select value={formData.platform} onChange={(event) => setFormData({ ...formData, platform: event.target.value })}><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="linkedin">LinkedIn</option><option value="tiktok">TikTok</option></select></label>
                  </div>
                  <button className="taskifi-button taskifi-button-primary" disabled={working === 'create'}>{working === 'create' ? 'Saving...' : 'Save draft'}</button>
                </form>
              </article>

              <article className="taskifi-module-card taskifi-span-2">
                <div className="taskifi-module-header taskifi-module-header-wrap"><div><p className="taskifi-eyebrow">Ready posts</p><h2>Drafts and recent posts</h2></div><div className="taskifi-feature-actions"><button onClick={toggleDrafts} className="taskifi-button taskifi-button-secondary">Select drafts</button><button onClick={publishSelected} disabled={working === 'publish' || selectedPosts.length === 0} className="taskifi-button taskifi-button-primary">{working === 'publish' ? 'Posting...' : `Post now${selectedPosts.length ? ` (${selectedPosts.length})` : ''}`}</button></div></div>
                {posts.length === 0 ? <div className="taskifi-inner-empty"><h3>No posts yet</h3><p>Use the upload link to create AI captions, or add a manual draft above.</p></div> : (
                  <div className="taskifi-post-list">
                    {posts.map((post) => {
                      const imageUrl = Array.isArray(post.image_urls) ? post.image_urls[0] : null;
                      const checked = selectedPosts.includes(post.id);
                      const disabled = (post.status || 'draft') !== 'draft';
                      return (
                        <article key={post.id} className="taskifi-post-row">
                          <label className="taskifi-post-check"><input type="checkbox" checked={checked} disabled={disabled} onChange={() => togglePost(post.id)} /><span>{statusLabel(post.status)}</span></label>
                          {imageUrl ? <img src={imageUrl} alt="Post media preview" /> : <div className="taskifi-post-placeholder">No image</div>}
                          <div className="taskifi-post-copy"><h3>{post.caption?.slice(0, 90) || 'Untitled post'}{(post.caption?.length || 0) > 90 ? '...' : ''}</h3><p>{(post.hashtags || []).join(' ') || 'No hashtags yet'}</p><small>{post.platform || 'instagram'} • Created {formatDate(post.created_at)}</small></div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </article>

              <article className="taskifi-module-card taskifi-span-2">
                <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Posting history</p><h2>Recent jobs</h2></div><span className="taskifi-soft-badge">{jobs.length} recent</span></div>
                {jobs.length === 0 ? <div className="taskifi-inner-empty"><h3>No posting jobs yet</h3><p>When posts are sent to Upload-Post, their status will appear here.</p></div> : (
                  <div className="taskifi-list-stack">
                    {jobs.map((job) => <article key={job.id} className="taskifi-report-row"><div><h3>{statusLabel(job.status)}</h3><p>{job.error_message || `${job.mode || 'post'} • ${job.posted_at ? `Posted ${formatDate(job.posted_at)}` : `Created ${formatDate(job.created_at)}`}`}</p></div><span className={job.status === 'posted' ? 'taskifi-connection-badge live' : job.status === 'failed' ? 'taskifi-connection-badge' : 'taskifi-connection-badge planned'}>{statusLabel(job.status)}</span></article>)}
                  </div>
                )}
              </article>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
