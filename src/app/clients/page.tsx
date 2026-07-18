'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardNav from '@/components/DashboardNav';
import { DashboardClient, clientName, clientTier, hasDmChamp, hasSocialDrive, loadAccessibleClients, requireDashboardUser } from '@/lib/dashboard-data';

export default function ClientsIndexPage() {
  const router = useRouter();
  const [clients, setClients] = useState<DashboardClient[]>([]);
  const [userEmail, setUserEmail] = useState<string>('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    try {
      const user = await requireDashboardUser();
      if (!user) {
        router.push('/auth/signin');
        return;
      }
      setUserEmail(user.email || '');
      setClients(await loadAccessibleClients(user.id));
    } catch (err: any) {
      setError(err.message || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }

  const filteredClients = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) => [clientName(client), client.industry, client.email, client.phone, client.website]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term)));
  }, [clients, query]);

  const socialDriveCount = clients.filter(hasSocialDrive).length;
  const dmChampCount = clients.filter(hasDmChamp).length;

  return (
    <div className="taskifi-dashboard">
      <DashboardNav userEmail={userEmail} />
      <main className="taskifi-main taskifi-feature-main">
        <section className="taskifi-feature-hero">
          <div>
            <p className="taskifi-pill"><span /> Clients</p>
            <h1>Every business in one client layer.</h1>
            <p>Search clients, open their intelligence profile, manage brand context, staff access and connected products from one place.</p>
          </div>
          <div className="taskifi-feature-actions">
            <Link href="/clients/new" className="taskifi-button taskifi-button-primary">Add client</Link>
            <Link href="/crm" className="taskifi-button taskifi-button-secondary">Open CRM</Link>
          </div>
        </section>

        <section className="taskifi-stats-grid" aria-label="Client summary">
          <article className="taskifi-stat-card"><span>Total clients</span><strong>{clients.length}</strong><p>Businesses available to this workspace.</p></article>
          <article className="taskifi-stat-card"><span>SocialDrive</span><strong>{socialDriveCount}</strong><p>Clients with upload, review or posting access.</p></article>
          <article className="taskifi-stat-card"><span>DM / chats</span><strong>{dmChampCount}</strong><p>Clients connected to message automation.</p></article>
          <article className="taskifi-stat-card"><span>Needs setup</span><strong>{clients.filter((client) => !hasSocialDrive(client) && !hasDmChamp(client)).length}</strong><p>Clients without a connected product yet.</p></article>
        </section>

        <section className="taskifi-module-card">
          <div className="taskifi-module-header taskifi-module-header-wrap">
            <div>
              <p className="taskifi-eyebrow">Client inventory</p>
              <h2>Clients list</h2>
            </div>
            <input className="taskifi-search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, industry, email or phone" aria-label="Search clients" />
          </div>

          {error && <div className="taskifi-alert" role="alert"><strong>Could not load clients:</strong> {error}</div>}

          {loading ? (
            <div className="taskifi-loading-card taskifi-inline-loading"><div className="taskifi-spinner" /><p>Loading clients...</p></div>
          ) : filteredClients.length === 0 ? (
            <div className="taskifi-inner-empty">
              <h3>{clients.length === 0 ? 'No clients yet' : 'No matching clients'}</h3>
              <p>{clients.length === 0 ? 'Add the first client to begin connecting products, leads and reports.' : 'Try a different search term.'}</p>
              <Link href="/clients/new" className="taskifi-button taskifi-button-primary">Add client</Link>
            </div>
          ) : (
            <div className="taskifi-client-list">
              {filteredClients.map((client) => (
                <article key={client.id} className="taskifi-client-list-row">
                  <div className="taskifi-client-avatar">{clientName(client).slice(0, 1).toUpperCase()}</div>
                  <div className="taskifi-client-list-main">
                    <h3>{clientName(client)}</h3>
                    <p>{client.industry || 'Local business'}{client.email ? ` • ${client.email}` : ''}{client.phone ? ` • ${client.phone}` : ''}</p>
                    <div className="taskifi-mini-chip-row">
                      <span>{clientTier(client)}</span>
                      <span className={hasSocialDrive(client) ? 'is-live' : ''}>SocialDrive</span>
                      <span className={hasDmChamp(client) ? 'is-live' : ''}>DM/Chats</span>
                    </div>
                  </div>
                  <div className="taskifi-row-actions">
                    <Link href={`/clients/${client.id}`}>Intelligence</Link>
                    <Link href={`/clients/${client.id}/products`}>Products</Link>
                    <Link href={`/clients/${client.id}/brand-context`}>Brand</Link>
                    <Link href={`/clients/${client.id}/team`}>Team</Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
