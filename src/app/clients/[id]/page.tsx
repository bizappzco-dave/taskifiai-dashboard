'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardNav from '@/components/DashboardNav';
import ActivityFeed from '@/components/ActivityFeed';
import { DashboardClient, clientName, clientTier, hasDmChamp, hasSocialDrive, hasUltraMarketing } from '@/lib/dashboard-data';
import { fetchWithDashboardAuth } from '@/lib/authenticated-fetch';

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params.id as string;
  const [client, setClient] = useState<DashboardClient | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
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
      fetchInvoices(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load client');
    } finally {
      setLoading(false);
    }
  }

  async function fetchInvoices(id: string) {
    setInvoicesLoading(true);
    try {
      const response = await fetchWithDashboardAuth(`/api/clients/${id}/invoices`);

      if (response.ok) {
        const invoiceData = await response.json();
        if (Array.isArray(invoiceData)) {
          setInvoices(invoiceData);
        }
      }
    } finally {
      setInvoicesLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="taskifi-dashboard taskifi-loading-screen">
        <div className="taskifi-loading-card"><div className="taskifi-spinner" /><p className="taskifi-eyebrow">Client Intelligence</p><h1>Loading client</h1><p>Pulling profile, products and activity.</p></div>
      </main>
    );
  }

  if (error || !client) {
    return (
      <div className="taskifi-dashboard">
        <DashboardNav />
        <main className="taskifi-main"><section className="taskifi-empty-state"><p className="taskifi-eyebrow">Client not found</p><h1>{error || 'Client not found'}</h1><Link href="/clients" className="taskifi-button taskifi-button-primary">Back to clients</Link></section></main>
      </div>
    );
  }

  const ultraMarketingLive = hasUltraMarketing(client);
  const connectedProducts = [hasSocialDrive(client), hasDmChamp(client), ultraMarketingLive, client.upload_post_connected].filter(Boolean).length;
  const brandFields = [client.brand_tone, client.target_audience, client.usps, client.content_goals, client.posting_frequency].filter(Boolean).length;
  const contactLines = [client.email, client.phone, client.website].filter(Boolean);

  return (
    <div className="taskifi-dashboard">
      <DashboardNav />
      <main className="taskifi-main taskifi-feature-main">
        <section className="taskifi-feature-hero taskifi-client-intel-hero">
          <div>
            <Link href="/clients" className="taskifi-back-link">← Back to clients</Link>
            <p className="taskifi-pill"><span /> Client Intelligence</p>
            <h1>{clientName(client)}</h1>
            <p>{client.industry || 'Local business'} profile with brand context, products, activity and CRM links in one place.</p>
          </div>
          <div className="taskifi-feature-actions">
            <Link href={`/clients/${client.id}/products`} className="taskifi-button taskifi-button-primary">Products</Link>
            <Link href={`/clients/${client.id}/brand-context`} className="taskifi-button taskifi-button-secondary">Brand context</Link>
            <Link href={`/clients/${client.id}/team`} className="taskifi-button taskifi-button-secondary">Team</Link>
          </div>
        </section>

        <section className="taskifi-stats-grid" aria-label="Client intelligence summary">
          <article className="taskifi-stat-card"><span>Tier</span><strong>{clientTier(client)}</strong><p>Current service level or subscription.</p></article>
          <article className="taskifi-stat-card"><span>Products</span><strong>{connectedProducts}</strong><p>Connected TaskifiAI product paths.</p></article>
          <article className="taskifi-stat-card"><span>Brand context</span><strong>{brandFields}/5</strong><p>Core AI-ready brand fields filled.</p></article>
          <article className="taskifi-stat-card"><span>Growth Score</span><strong>—</strong><p>Placeholder for visibility, engagement, reputation and lead capture.</p></article>
        </section>

        <section className="taskifi-client-intel-grid">
          <article className="taskifi-module-card">
            <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Profile</p><h2>Client details</h2></div><span className="taskifi-soft-badge">{client.status || 'active'}</span></div>
            <dl className="taskifi-detail-list">
              <div><dt>Business</dt><dd>{clientName(client)}</dd></div>
              <div><dt>Industry</dt><dd>{client.industry || 'Not set'}</dd></div>
              <div><dt>Email</dt><dd>{client.email ? <a href={`mailto:${client.email}`}>{client.email}</a> : 'Not set'}</dd></div>
              <div><dt>Phone</dt><dd>{client.phone ? <a href={`tel:${client.phone}`}>{client.phone}</a> : 'Not set'}</dd></div>
              <div><dt>Website</dt><dd>{client.website ? <a href={client.website.startsWith('http') ? client.website : `https://${client.website}`} target="_blank" rel="noopener noreferrer">{client.website}</a> : 'Not set'}</dd></div>
            </dl>
            {contactLines.length === 0 && <p className="taskifi-muted-note">Add contact details through the client onboarding/edit flow.</p>}
          </article>

          <article className="taskifi-module-card">
            <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Connected products</p><h2>Product status</h2></div><Link href={`/clients/${client.id}/products`} className="taskifi-soft-link">Manage</Link></div>
            <div className="taskifi-product-status-list">
              <div><span className={hasSocialDrive(client) ? 'taskifi-status-dot live' : 'taskifi-status-dot'} />SocialDrive AI <strong>{hasSocialDrive(client) ? 'Connected' : 'Not connected'}</strong></div>
              <div><span className={hasDmChamp(client) ? 'taskifi-status-dot live' : 'taskifi-status-dot'} />Social Chats / DM Champ <strong>{hasDmChamp(client) ? 'Connected' : 'Planned'}</strong></div>
              <div><span className={ultraMarketingLive ? 'taskifi-status-dot live' : 'taskifi-status-dot'} />Ultra Marketing <strong>{ultraMarketingLive ? 'Enabled' : 'Not enabled'}</strong></div>
              <div><span className={client.upload_post_connected ? 'taskifi-status-dot live' : 'taskifi-status-dot'} />Upload Post <strong>{client.upload_post_connected ? 'Connected' : 'Not connected'}</strong></div>
              <div><span className="taskifi-status-dot planned" />GBP / Reviews <strong>Planned</strong></div>
              <div><span className="taskifi-status-dot planned" />Lead-Drive Ads <strong>Reports linked</strong></div>
            </div>
          </article>

          <article className="taskifi-module-card">
            <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Brand voice</p><h2>AI context summary</h2></div><Link href={`/clients/${client.id}/brand-context`} className="taskifi-soft-link">Edit</Link></div>
            <dl className="taskifi-detail-list">
              <div><dt>Tone</dt><dd>{client.brand_tone || 'Not set'}</dd></div>
              <div><dt>Audience</dt><dd>{client.target_audience || 'Not set'}</dd></div>
              <div><dt>USPs</dt><dd>{client.usps || 'Not set'}</dd></div>
              <div><dt>Content goals</dt><dd>{client.content_goals || 'Not set'}</dd></div>
              <div><dt>Posting frequency</dt><dd>{client.posting_frequency || 'Not set'}</dd></div>
            </dl>
          </article>

          <article className="taskifi-module-card">
            <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">CRM links</p><h2>Next actions</h2></div><Link href="/crm" className="taskifi-soft-link">Open CRM</Link></div>
            <div className="taskifi-action-list">
              <Link href="/pipeline">View lead pipeline</Link>
              <Link href="/dashboard/ads">View ad reports</Link>
              <Link href={`/clients/${client.id}/team`}>Manage staff access</Link>
              <Link href={`/clients/${client.id}/products`}>Connect products</Link>
            </div>
          </article>

          <article className="taskifi-module-card taskifi-span-2">
            <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Activity</p><h2>Recent activity feed</h2></div><span className="taskifi-soft-badge">Client stream</span></div>
            <ActivityFeed clientId={client.id} />
          </article>

          <article className="taskifi-module-card taskifi-span-2">
            <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Billing</p><h2>Invoices</h2></div></div>
            <div className="taskifi-action-list">
              {invoicesLoading && <p className="taskifi-muted-note">Loading invoices…</p>}
              {!invoicesLoading && invoices.length === 0 && <p className="taskifi-muted-note">No invoices yet.</p>}
              {invoices.map((invoice) => (
                <a key={invoice.id} href={`/api/clients/${client.id}/invoices/${invoice.id}?format=html`} target="_blank" rel="noopener noreferrer">
                  {invoice.invoice_number || 'Invoice'} · {invoice.amount} {invoice.currency}
                </a>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
