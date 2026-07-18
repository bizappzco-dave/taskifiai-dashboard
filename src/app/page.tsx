'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardNav from '@/components/DashboardNav';
import { DashboardClient, clientName, clientTier, hasDmChamp, hasSocialDrive, loadAccessibleClients, requireDashboardUser } from '@/lib/dashboard-data';

export default function DashboardPage() {
  const router = useRouter();
  const [clients, setClients] = useState<DashboardClient[]>([]);
  const [user, setUser] = useState<{ email: string; id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const currentUser = await requireDashboardUser();

      if (!currentUser) {
        router.push('/auth/signin');
        return;
      }

      setUser({ email: currentUser.email || '', id: currentUser.id });
      setClients(await loadAccessibleClients(currentUser.id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }


  if (loading) {
    return (
      <main className="taskifi-dashboard taskifi-loading-screen">
        <div className="taskifi-loading-card">
          <div className="taskifi-spinner" />
          <p className="taskifi-eyebrow">TaskifiAI Dashboard</p>
          <h1>Loading your workspace</h1>
          <p>Connecting your clients, content tools and growth systems.</p>
        </div>
      </main>
    );
  }

  const activeSocialDrive = clients.filter(hasSocialDrive).length;
  const reviewEnabled = clients.filter((client) => !!client.review_token).length;
  const uploadEnabled = clients.filter((client) => !!client.upload_token).length;

  return (
    <div className="taskifi-dashboard">
      <DashboardNav userEmail={user?.email} />

      <main className="taskifi-main">
        <section className="taskifi-hero-panel">
          <div>
            <p className="taskifi-pill"><span /> One dashboard. Every platform. Connected.</p>
            <h1>Your client growth workspace.</h1>
            <p>
              Manage local-business clients, content approvals, ad reports, reviews and SocialDrive AI links from one clear place.
            </p>
            <div className="taskifi-hero-actions">
              <Link href="/clients/new" className="taskifi-button taskifi-button-primary">Add a client</Link>
              <Link href="/dashboard/ads" className="taskifi-button taskifi-button-secondary">View ad reports</Link>
            </div>
          </div>
          <div className="taskifi-hero-image-card" aria-label="TaskifiAI connects local business platforms">
            <img
              src="/images/taskifiai-integrations-hero.webp"
              alt="TaskifiAI connecting Facebook, Instagram, Google Business Profile, Meta, WhatsApp, Google Drive, Google Ads, email and AI tools"
            />
          </div>
        </section>

        {error && (
          <div className="taskifi-alert" role="alert">
            <strong>Something needs attention:</strong> {error}
          </div>
        )}

        <section className="taskifi-stats-grid" aria-label="Dashboard summary">
          <article className="taskifi-stat-card">
            <span>Total clients</span>
            <strong>{clients.length}</strong>
            <p>Businesses connected to your workspace.</p>
          </article>
          <article className="taskifi-stat-card">
            <span>SocialDrive AI</span>
            <strong>{activeSocialDrive}</strong>
            <p>Clients with upload, review or publishing access.</p>
          </article>
          <article className="taskifi-stat-card">
            <span>Review flows</span>
            <strong>{reviewEnabled}</strong>
            <p>Clients ready for content review links.</p>
          </article>
          <article className="taskifi-stat-card">
            <span>Upload portals</span>
            <strong>{uploadEnabled}</strong>
            <p>Clients able to send photos and updates.</p>
          </article>
        </section>

        <section className="taskifi-section-heading">
          <div>
            <p className="taskifi-eyebrow">Clients</p>
            <h2>Client operating layer</h2>
          </div>
          <p>Signed in as {user?.email || 'TaskifiAI user'}</p>
        </section>

        {clients.length === 0 ? (
          <section className="taskifi-empty-state">
            <p className="taskifi-eyebrow">Start here</p>
            <h2>No clients yet</h2>
            <p>Add your first client to connect SocialDrive AI, reviews, ad reports and lead tracking.</p>
            <Link href="/clients/new" className="taskifi-button taskifi-button-primary">Add your first client</Link>
          </section>
        ) : (
          <section className="taskifi-client-grid" aria-label="Client list">
            {clients.map((client) => (
              <article key={client.id} className="taskifi-client-card">
                <div className="taskifi-client-card-header">
                  <div>
                    <p className="taskifi-client-industry">{client.industry || 'Local business'}</p>
                    <h3>{clientName(client)}</h3>
                  </div>
                  <span className="taskifi-tier">{clientTier(client)}</span>
                </div>

                <div className="taskifi-product-row">
                  <span className={hasSocialDrive(client) ? 'is-live' : ''}>SocialDrive AI</span>
                  <span className={hasDmChamp(client) ? 'is-live' : ''}>DM Champ</span>
                </div>

                <div className="taskifi-card-actions">
                  {client.upload_token ? (
                    <a href={`https://socialdrive-ai.vercel.app/upload/${client.upload_token}`} target="_blank" rel="noopener noreferrer" className="taskifi-action-primary">
                      Upload Images
                    </a>
                  ) : (
                    <button disabled className="taskifi-action-disabled">Upload not enabled</button>
                  )}

                  {client.review_token ? (
                    <a href={`https://socialdrive-ai.vercel.app/review?token=${client.review_token}`} target="_blank" rel="noopener noreferrer" className="taskifi-action-secondary">
                      Review Posts
                    </a>
                  ) : (
                    <button disabled className="taskifi-action-disabled">Review not enabled</button>
                  )}

                  <Link href={`/client/posting?client_id=${client.id}`} className="taskifi-action-green">
                    Create a post
                  </Link>
                </div>

                <div className="taskifi-card-footer">
                  <Link href={`/clients/${client.id}`}>View details</Link>
                  <Link href={`/clients/${client.id}/products`}>Products</Link>
                  <Link href={`/clients/${client.id}/team`}>Manage team</Link>
                </div>

                <p className="taskifi-added">Added {client.created_at ? new Date(client.created_at).toLocaleDateString() : 'recently'}</p>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
