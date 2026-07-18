'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardNav from '@/components/DashboardNav';
import { DashboardClient, clientName, hasDmChamp, hasSocialDrive, hasUltraMarketing } from '@/lib/dashboard-data';
import { fetchWithDashboardAuth } from '@/lib/authenticated-fetch';

type ProductKey = 'socialdrive' | 'dmchamp' | 'ultra-marketing';

function productLabel(product: ProductKey) {
  if (product === 'socialdrive') return 'SocialDrive AI';
  if (product === 'dmchamp') return 'DM Champ';
  return 'Ultra Marketing Assistant';
}

export default function ClientProductsPage() {
  const params = useParams();
  const clientId = params.id as string;
  const [client, setClient] = useState<DashboardClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (clientId) fetchClient(clientId);
  }, [clientId]);

  async function fetchClient(id: string) {
    try {
      const res = await fetchWithDashboardAuth(`/api/clients/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Client not found');
      setClient(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load client');
    } finally {
      setLoading(false);
    }
  }

  async function enableProduct(product: ProductKey) {
    if (!client) return;
    setWorking(`enable-${product}`);
    setError(null);
    setMessage(null);
    try {
      const res = await fetchWithDashboardAuth(`/api/clients/${client.id}/enable-${product}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to enable ${product}`);
      const nextClient = data.client || data;
      setClient(nextClient);
      setMessage(`${productLabel(product)} enabled for ${clientName(nextClient)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setWorking(null);
    }
  }

  async function disableProduct(product: ProductKey) {
    if (!client) return;
    if (!confirm(`Disable ${productLabel(product)} for ${clientName(client)}?`)) return;
    setWorking(`disable-${product}`);
    setError(null);
    setMessage(null);
    try {
      const res = await fetchWithDashboardAuth(`/api/clients/${client.id}/disable-${product}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to disable ${product}`);
      const nextClient = data.client || data;
      setClient(nextClient);
      setMessage(`${productLabel(product)} disabled.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setWorking(null);
    }
  }

  async function connectUploadPost() {
    if (!client) return;
    setWorking('connect-upload-post');
    setError(null);
    setMessage(null);
    try {
      const res = await fetchWithDashboardAuth(`/api/clients/${client.id}/connect-upload-post`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate Upload-Post connection');
      if (data.connect_url) window.open(data.connect_url, '_blank', 'noopener,noreferrer');
      setMessage('Upload-Post connection link opened. Refresh this page after the account is connected.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setWorking(null);
    }
  }

  if (loading) {
    return <main className="taskifi-dashboard taskifi-loading-screen"><div className="taskifi-loading-card"><div className="taskifi-spinner" /><p className="taskifi-eyebrow">Products</p><h1>Loading product connections</h1><p>Checking enabled tools for this client.</p></div></main>;
  }

  if (error && !client) {
    return <div className="taskifi-dashboard"><DashboardNav /><main className="taskifi-main"><section className="taskifi-empty-state"><h1>{error}</h1><Link href="/clients" className="taskifi-button taskifi-button-primary">Back to clients</Link></section></main></div>;
  }

  if (!client) return null;

  const socialDriveLive = hasSocialDrive(client);
  const dmChampLive = hasDmChamp(client);
  const ultraMarketingLive = hasUltraMarketing(client);

  return (
    <div className="taskifi-dashboard">
      <DashboardNav />
      <main className="taskifi-main taskifi-feature-main">
        <section className="taskifi-feature-hero">
          <div>
            <Link href={`/clients/${client.id}`} className="taskifi-back-link">← Back to Client Intelligence</Link>
            <p className="taskifi-pill"><span /> Product connections</p>
            <h1>{clientName(client)} products.</h1>
            <p>Control which TaskifiAI product paths are connected to this client. Keep links simple and visible before exposing client login views.</p>
          </div>
          <div className="taskifi-feature-actions">
            <Link href="/clients" className="taskifi-button taskifi-button-secondary">All clients</Link>
            <Link href="/crm" className="taskifi-button taskifi-button-primary">Open CRM</Link>
          </div>
        </section>

        {message && <section className="taskifi-success-panel" role="status">{message}</section>}
        {error && <section className="taskifi-alert" role="alert"><strong>Product action failed:</strong> {error}</section>}

        <section className="taskifi-product-connect-grid">
          <article className="taskifi-product-connect-card">
            <div className="taskifi-product-connect-head">
              <div><p className="taskifi-eyebrow">Content</p><h2>SocialDrive AI</h2></div>
              <span className={socialDriveLive ? 'taskifi-connection-badge live' : 'taskifi-connection-badge'}>{socialDriveLive ? 'Connected' : 'Not connected'}</span>
            </div>
            <p>Client image upload, AI captions, review links and posting workflow.</p>
            <div className="taskifi-product-links">
              {client.upload_token && <a href={`https://socialdrive-ai.vercel.app/upload/${client.upload_token}`} target="_blank" rel="noopener noreferrer">Upload page</a>}
              {client.review_token && <a href={`https://socialdrive-ai.vercel.app/review?token=${client.review_token}`} target="_blank" rel="noopener noreferrer">Review page</a>}
              <Link href={`/client/posting?client_id=${client.id}`}>Posting page</Link>
            </div>
            <div className="taskifi-feature-actions left">
              {socialDriveLive ? (
                <button onClick={() => disableProduct('socialdrive')} disabled={working === 'disable-socialdrive'} className="taskifi-button taskifi-button-secondary">Disable</button>
              ) : (
                <button onClick={() => enableProduct('socialdrive')} disabled={working === 'enable-socialdrive'} className="taskifi-button taskifi-button-primary">Enable SocialDrive</button>
              )}
            </div>
          </article>

          <article className="taskifi-product-connect-card">
            <div className="taskifi-product-connect-head">
              <div><p className="taskifi-eyebrow">Messages</p><h2>Social Chats / DM Champ</h2></div>
              <span className={dmChampLive ? 'taskifi-connection-badge live' : 'taskifi-connection-badge planned'}>{dmChampLive ? 'Connected' : 'Planned'}</span>
            </div>
            <p>DM and WhatsApp automation that can feed enquiries into CRM and lead pipeline.</p>
            <div className="taskifi-product-links">
              {client.dmchamp_login_url ? <a href={client.dmchamp_login_url} target="_blank" rel="noopener noreferrer">Open DM Champ</a> : <span>Login link not generated yet</span>}
            </div>
            <div className="taskifi-feature-actions left">
              {dmChampLive ? (
                <button onClick={() => disableProduct('dmchamp')} disabled={working === 'disable-dmchamp'} className="taskifi-button taskifi-button-secondary">Disable</button>
              ) : (
                <button onClick={() => enableProduct('dmchamp')} disabled={working === 'enable-dmchamp'} className="taskifi-button taskifi-button-primary">Enable DM Champ</button>
              )}
            </div>
          </article>

          <article className="taskifi-product-connect-card">
            <div className="taskifi-product-connect-head">
              <div><p className="taskifi-eyebrow">24/7 assistant</p><h2>Ultra Marketing Assistant</h2></div>
              <span className={ultraMarketingLive ? 'taskifi-connection-badge live' : 'taskifi-connection-badge'}>{ultraMarketingLive ? 'Enabled' : 'Not enabled'}</span>
            </div>
            <p>Client-level access to the TaskifiAI marketing workspace: reports, draft campaigns, review/GBP/social workflows and approval queues.</p>
            <div className="taskifi-product-links">
              <span>Shared tenant-isolated runtime</span>
              <span>External sends stay approval-gated</span>
              <span>Access follows this client’s team permissions</span>
            </div>
            <div className="taskifi-feature-actions left">
              {ultraMarketingLive ? (
                <button onClick={() => disableProduct('ultra-marketing')} disabled={working === 'disable-ultra-marketing'} className="taskifi-button taskifi-button-secondary">Pause Ultra Marketing</button>
              ) : (
                <button onClick={() => enableProduct('ultra-marketing')} disabled={working === 'enable-ultra-marketing'} className="taskifi-button taskifi-button-primary">Enable Ultra Marketing</button>
              )}
            </div>
          </article>

          <article className="taskifi-product-connect-card">
            <div className="taskifi-product-connect-head">
              <div><p className="taskifi-eyebrow">Social accounts</p><h2>Upload-Post connection</h2></div>
              <span className={client.upload_post_connected ? 'taskifi-connection-badge live' : 'taskifi-connection-badge'}>{client.upload_post_connected ? 'Connected' : 'Not connected'}</span>
            </div>
            <p>Connect client social accounts for the posting workflow while keeping approvals controlled.</p>
            <div className="taskifi-feature-actions left">
              <button onClick={connectUploadPost} disabled={working === 'connect-upload-post'} className="taskifi-button taskifi-button-primary">Generate connect link</button>
              <button onClick={() => fetchClient(client.id)} className="taskifi-button taskifi-button-secondary">Refresh status</button>
            </div>
          </article>

          <article className="taskifi-product-connect-card muted">
            <div className="taskifi-product-connect-head">
              <div><p className="taskifi-eyebrow">Coming next</p><h2>GBP, Reviews & Lead-Drive</h2></div>
              <span className="taskifi-connection-badge planned">Mapped</span>
            </div>
            <p>GBP posts/images/reviews, SEO reports and paid-ads dashboards are mapped but should connect after the CRM spine is stable.</p>
            <div className="taskifi-product-links">
              <Link href="/dashboard/ads">Ad Reports</Link>
              <Link href="/crm">CRM overview</Link>
              <Link href="/pipeline">Pipeline</Link>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
