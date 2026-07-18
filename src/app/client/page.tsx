'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ClientNav from '@/components/ClientNav';
import MonthlyScansPanel from '@/components/MonthlyScansPanel';
import { getSupabase } from '@/lib/supabase';
import { DashboardClient, clientName, clientTier, hasDmChamp, hasSocialDrive, loadAccessibleClients, requireDashboardUser } from '@/lib/dashboard-data';
import { getLatestTotalsitedataScan, getMonthlyScansFromActivities, getScanDate, getScanIssues, getScanSource, getScanTitle, type ScanActivity } from '@/lib/monthly-scans';

interface Lead {
  id: string;
  source?: string;
  value?: number;
  status?: string;
  next_follow_up_date?: string | null;
  created_at?: string;
  contact?: { name?: string; email?: string; phone?: string } | null;
}

interface AdReport {
  id: string;
  report_start_date?: string;
  total_cost?: number;
  total_clicks?: number;
  total_impressions?: number;
  avg_ctr?: number;
  avg_roas?: number;
  alerts_generated?: number;
}

const openStatuses = ['new_lead', 'contacted', 'qualified', 'quoted', 'follow_up'];

function formatCurrency(value?: number) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

export default function ClientDashboardPage() {
  const router = useRouter();
  const [clients, setClients] = useState<DashboardClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<ScanActivity[]>([]);
  const [monthlyScans, setMonthlyScans] = useState<ScanActivity[]>([]);
  const [latestTotalsitedataScan, setLatestTotalsitedataScan] = useState<ScanActivity | null>(null);
  const [latestReport, setLatestReport] = useState<AdReport | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [panelLoading, setPanelLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    loadClientHome();
  }, []);

  useEffect(() => {
    if (selectedClientId) loadClientPanels(selectedClientId);
  }, [selectedClientId]);

  async function loadClientHome() {
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
      setWarnings([err.message || 'Could not load client dashboard.']);
    } finally {
      setLoading(false);
    }
  }

  async function loadClientPanels(clientId: string) {
    setPanelLoading(true);
    setActivities([]);
    setMonthlyScans([]);
    setLatestTotalsitedataScan(null);
    const nextWarnings: string[] = [];
    try {
      const supabase = getSupabase();

      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select('id, source, value, status, next_follow_up_date, created_at, contact:contact_id (name, email, phone)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(8);
      if (leadError) nextWarnings.push(`Leads: ${leadError.message}`);
      else setLeads((leadData || []) as Lead[]);

      const { data: reportData, error: reportError } = await supabase
        .from('ad_reports')
        .select('id, report_start_date, total_cost, total_clicks, total_impressions, avg_ctr, avg_roas, alerts_generated')
        .eq('client_id', clientId)
        .order('report_start_date', { ascending: false })
        .limit(1);
      if (reportError) nextWarnings.push(`Reports: ${reportError.message}`);
      else setLatestReport((reportData || [])[0] || null);

      const { data: activityData, error: activityError } = await supabase
        .from('activities')
        .select('id, title, description, activity_type, source, details, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(12);
      if (activityError) nextWarnings.push(`Activity: ${activityError.message}`);
      else {
        const normalizedActivities = (activityData || []) as ScanActivity[];
        setActivities(normalizedActivities);
        setMonthlyScans(getMonthlyScansFromActivities(normalizedActivities));
        setLatestTotalsitedataScan(getLatestTotalsitedataScan(normalizedActivities));
      }
    } catch (err: any) {
      nextWarnings.push(err.message || 'Some client panels could not load.');
    } finally {
      setWarnings(nextWarnings);
      setPanelLoading(false);
    }
  }

  const selectedClient = clients.find((client) => client.id === selectedClientId) || null;
  const openLeads = useMemo(() => leads.filter((lead) => openStatuses.includes(lead.status || '')), [leads]);
  const followUpsDue = useMemo(() => openLeads.filter((lead) => lead.next_follow_up_date && new Date(lead.next_follow_up_date) <= new Date()), [openLeads]);
  const reportLabel = latestReport?.report_start_date
    ? new Date(latestReport.report_start_date).toLocaleDateString('en-IE', { month: 'short', day: 'numeric' })
    : latestTotalsitedataScan?.created_at
      ? new Date(latestTotalsitedataScan.created_at).toLocaleDateString('en-IE', { month: 'short', day: 'numeric' })
      : 'Pending';
  const reportSubtitle = latestReport
    ? `${formatCurrency(latestReport.total_cost)} spend tracked.`
    : latestTotalsitedataScan
      ? 'Latest monthly scan data available from TotalSiteData.'
      : 'Reports will appear once connected.';
  const totalsiteScanIssues = latestTotalsitedataScan ? getScanIssues(latestTotalsitedataScan) : [];

  if (loading) {
    return <main className="taskifi-dashboard taskifi-loading-screen"><div className="taskifi-loading-card"><div className="taskifi-spinner" /><p className="taskifi-eyebrow">Client dashboard</p><h1>Loading your workspace</h1><p>Preparing your leads, reports and content links.</p></div></main>;
  }

  return (
    <div className="taskifi-dashboard taskifi-client-dashboard">
      <ClientNav userEmail={userEmail} />
      <main className="taskifi-main taskifi-feature-main">
        <section className="taskifi-feature-hero taskifi-client-home-hero">
          <div>
            <p className="taskifi-pill"><span /> Client home</p>
            <h1>{selectedClient ? `${clientName(selectedClient)} dashboard` : 'Your TaskifiAI dashboard'}</h1>
            <p>One simple place for your leads, reports, content actions and monthly growth updates.</p>
          </div>
          <div className="taskifi-feature-actions">
            {clients.length > 1 && (
              <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)} className="taskifi-feature-select" aria-label="Choose client account">
                {clients.map((client) => <option key={client.id} value={client.id}>{clientName(client)}</option>)}
              </select>
            )}
            <Link href={`/client/reports${selectedClientId ? `?client_id=${selectedClientId}` : ''}`} className="taskifi-button taskifi-button-primary">View reports</Link>
          </div>
        </section>

        {warnings.length > 0 && <section className="taskifi-alert" role="status"><strong>Dashboard notes:</strong> {warnings.join(' • ')}</section>}

        {!selectedClient ? (
          <section className="taskifi-empty-state taskifi-empty-wide">
            <p className="taskifi-eyebrow">No client access yet</p>
            <h2>Your account is not linked to a client workspace.</h2>
            <p>Ask your TaskifiAI admin to add your email to the client team access list.</p>
          </section>
        ) : (
          <>
            <section className="taskifi-stats-grid" aria-label="Client dashboard summary">
              <article className="taskifi-stat-card"><span>Open leads</span><strong>{openLeads.length}</strong><p>Active enquiries currently being tracked.</p></article>
              <article className="taskifi-stat-card"><span>Follow-ups due</span><strong>{followUpsDue.length}</strong><p>People who may need a reply or update.</p></article>
              <article className="taskifi-stat-card"><span>Latest report</span><strong>{reportLabel}</strong><p>{reportSubtitle}</p></article>
              <article className="taskifi-stat-card"><span>Monthly scans</span><strong>{monthlyScans.length}</strong><p>Website scan summaries synced into activities.</p></article>
              <article className="taskifi-stat-card"><span>Products</span><strong>{[hasSocialDrive(selectedClient), hasDmChamp(selectedClient), selectedClient.upload_post_connected].filter(Boolean).length}</strong><p>Connected TaskifiAI product paths.</p></article>
            </section>

            {panelLoading ? (
              <div className="taskifi-loading-card taskifi-inline-loading"><div className="taskifi-spinner" /><p>Refreshing your client data...</p></div>
            ) : (
              <section className="taskifi-client-home-grid">
                <article className="taskifi-module-card">
                  <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Leads</p><h2>Recent enquiries</h2></div><span className="taskifi-soft-badge">{leads.length} recent</span></div>
                  {leads.length === 0 ? <div className="taskifi-inner-empty"><h3>No leads yet</h3><p>New calls, forms, DMs or manually added enquiries will appear here.</p></div> : (
                    <div className="taskifi-list-stack">
                      {leads.slice(0, 5).map((lead) => (
                        <article key={lead.id} className="taskifi-crm-row">
                          <div><h3>{lead.contact?.name || 'New enquiry'}</h3><p>{lead.source || 'manual'} • {lead.status || 'new'}{lead.value ? ` • ${formatCurrency(lead.value)}` : ''}</p></div>
                          {lead.next_follow_up_date && <span className="taskifi-soft-badge">{new Date(lead.next_follow_up_date).toLocaleDateString('en-IE')}</span>}
                        </article>
                      ))}
                    </div>
                  )}
                </article>

                <article className="taskifi-module-card">
                  <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Content actions</p><h2>SocialDrive</h2></div><span className={hasSocialDrive(selectedClient) ? 'taskifi-connection-badge live' : 'taskifi-connection-badge'}>{hasSocialDrive(selectedClient) ? 'Ready' : 'Not connected'}</span></div>
                  <div className="taskifi-client-action-grid">
                    {selectedClient.upload_token ? <a href={`https://socialdrive-ai.vercel.app/upload/${selectedClient.upload_token}`} target="_blank" rel="noopener noreferrer">Upload images</a> : <span>Upload link not enabled</span>}
                    {selectedClient.review_token ? <a href={`https://socialdrive-ai.vercel.app/review?token=${selectedClient.review_token}`} target="_blank" rel="noopener noreferrer">Review posts</a> : <span>Review link not enabled</span>}
                    <Link href={`/client/posting?client_id=${selectedClient.id}`}>Create a post</Link>
                  </div>
                </article>

                <article className="taskifi-module-card">
                  <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Latest report</p><h2>Growth snapshot</h2></div><Link href={`/client/reports?client_id=${selectedClient.id}`} className="taskifi-soft-link">Full reports</Link></div>
                  {latestReport ? (
                    <div className="taskifi-source-grid taskifi-report-mini-grid">
                      <div className="taskifi-source-card"><strong>{formatCurrency(latestReport.total_cost)}</strong><span>Ad spend</span></div>
                      <div className="taskifi-source-card"><strong>{(latestReport.total_clicks || 0).toLocaleString()}</strong><span>Clicks</span></div>
                      <div className="taskifi-source-card"><strong>{(latestReport.total_impressions || 0).toLocaleString()}</strong><span>Impressions</span></div>
                      <div className="taskifi-source-card"><strong>{latestReport.avg_roas?.toFixed(1) || '0'}x</strong><span>ROAS</span></div>
                    </div>
                  ) : latestTotalsitedataScan ? (
                    <div className="taskifi-list-stack">
                      <div className="taskifi-report-row">
                        <div>
                          <h3>{getScanTitle(latestTotalsitedataScan)}</h3>
                          <p>
                            {getScanSource(latestTotalsitedataScan)}
                            {latestTotalsitedataScan.description ? ` • ${latestTotalsitedataScan.description}` : ''}
                          </p>
                          {totalsiteScanIssues.length > 0 && <small>Top issues: {totalsiteScanIssues.slice(0, 3).join(' • ')}</small>}
                          <div className="taskifi-client-action-grid">
                            {latestTotalsitedataScan.details?.report_links?.free_preview_html && (
                              <a href={latestTotalsitedataScan.details.report_links.free_preview_html} target="_blank" rel="noopener noreferrer">Open preview</a>
                            )}
                            {latestTotalsitedataScan.details?.report_links?.full_report_pdf && (
                              <a href={latestTotalsitedataScan.details.report_links.full_report_pdf} target="_blank" rel="noopener noreferrer">Download PDF</a>
                            )}
                          </div>
                        </div>
                        <small>{getScanDate(latestTotalsitedataScan)}</small>
                      </div>
                    </div>
                  ) : <div className="taskifi-inner-empty"><h3>Reports are being prepared</h3><p>Your first ad, GBP or SEO report will show here once connected.</p></div>}
                </article>

                <MonthlyScansPanel
                  heading="Latest website checks"
                  eyebrow="Monthly scan"
                  scans={monthlyScans}
                  maxItems={3}
                  variant="home"
                  emptyTitle="No scan summaries yet"
                  emptyDescription="Monthly scan events will appear here when connected."
                />

                <article className="taskifi-module-card">
                  <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Business profile</p><h2>{clientName(selectedClient)}</h2></div><span className="taskifi-soft-badge">{clientTier(selectedClient)}</span></div>
                  <dl className="taskifi-detail-list">
                    <div><dt>Industry</dt><dd>{selectedClient.industry || 'Not set'}</dd></div>
                    <div><dt>Email</dt><dd>{selectedClient.email || 'Not set'}</dd></div>
                    <div><dt>Phone</dt><dd>{selectedClient.phone || 'Not set'}</dd></div>
                    <div><dt>Website</dt><dd>{selectedClient.website || 'Not set'}</dd></div>
                  </dl>
                </article>

                <article className="taskifi-module-card taskifi-span-2">
                  <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Recent activity</p><h2>What changed recently</h2></div><span className="taskifi-soft-badge">{activities.length} updates</span></div>
                  {activities.length === 0 ? <div className="taskifi-inner-empty"><h3>No activity yet</h3><p>Posts, reviews, lead updates and report events will appear here.</p></div> : (
                    <div className="taskifi-list-stack">
                      {activities.map((activity) => (
                        <article key={activity.id} className="taskifi-activity-row-lite"><span className="taskifi-activity-dot" /><div><h3>{activity.title || activity.activity_type || 'Activity'}</h3><p>{activity.description || 'Client activity update'}</p></div><small>{activity.created_at ? new Date(activity.created_at).toLocaleDateString('en-IE') : ''}</small></article>
                      ))}
                    </div>
                  )}
                </article>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
