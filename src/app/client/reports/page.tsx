'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ClientNav from '@/components/ClientNav';
import { getSupabase } from '@/lib/supabase';
import { DashboardClient, clientName, loadAccessibleClients, requireDashboardUser } from '@/lib/dashboard-data';
import MonthlyScansPanel from '@/components/MonthlyScansPanel';
import { getLatestTotalsitedataScan, getMonthlyScansFromActivities, getScanDate, getScanIssues, getScanSource, getScanTitle, type ScanActivity } from '@/lib/monthly-scans';

interface ClientReport {
  id: string;
  report_type: 'seo' | 'ads' | 'gbp' | 'reviews' | 'site_health' | 'monthly' | 'custom';
  period_start: string;
  period_end: string;
  title: string;
  summary?: string | null;
  score?: number | null;
  status: 'processing' | 'ready' | 'failed';
  metrics?: Record<string, any> | null;
  recommendations?: string[] | Array<{ title?: string; description?: string }> | null;
  pdf_url?: string | null;
  storage_path?: string | null;
  signed_pdf_url?: string | null;
  source?: string | null;
  created_at?: string;
}

interface AdReport {
  id: string;
  report_start_date?: string;
  report_end_date?: string;
  total_cost?: number;
  total_clicks?: number;
  total_impressions?: number;
  avg_ctr?: number;
  avg_roas?: number;
  alerts_generated?: number;
  ai_analysis?: string | null;
  created_at?: string;
}

interface AdAlert {
  id: string;
  title?: string;
  description?: string;
  recommendation?: string;
  severity?: string;
  created_at?: string;
}

function formatCurrency(value?: number) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

function formatPercent(value?: number) {
  return `${((value || 0) * 100).toFixed(2)}%`;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-IE', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

function formatReportType(type?: string) {
  const labels: Record<string, string> = {
    seo: 'SEO',
    ads: 'Ads',
    gbp: 'Google profile',
    reviews: 'Reviews',
    site_health: 'Site health',
    monthly: 'Monthly',
    custom: 'Report',
  };
  return labels[type || 'custom'] || 'Report';
}

function metricValue(metrics: Record<string, any> | null | undefined, keys: string[], fallback = '—') {
  for (const key of keys) {
    const value = metrics?.[key];
    if (value !== undefined && value !== null && value !== '') return String(value);
  }
  return fallback;
}

function recommendationText(item: any) {
  if (typeof item === 'string') return item;
  if (item?.title && item?.description) return `${item.title}: ${item.description}`;
  return item?.title || item?.description || '';
}

function ReportCard({ report }: { report: ClientReport }) {
  const recommendations = Array.isArray(report.recommendations) ? report.recommendations.map(recommendationText).filter(Boolean) : [];
  const reportUrl = report.signed_pdf_url || report.pdf_url;

  return (
    <article className="taskifi-report-autoload-card">
      <div className="taskifi-product-connect-head">
        <div>
          <p className="taskifi-eyebrow">{formatReportType(report.report_type)}</p>
          <h3>{report.title}</h3>
        </div>
        <span className={report.status === 'ready' ? 'taskifi-connection-badge live' : 'taskifi-connection-badge planned'}>{report.status}</span>
      </div>
      <p>{report.summary || 'Report summary is ready.'}</p>
      <div className="taskifi-report-metric-strip">
        <div><strong>{report.score ?? '—'}</strong><span>Score</span></div>
        <div><strong>{metricValue(report.metrics, ['local_visibility_score', 'visibility_score', 'solv', 'share_of_local_voice'])}</strong><span>Visibility</span></div>
        <div><strong>{metricValue(report.metrics, ['organic_clicks', 'clicks', 'total_clicks'])}</strong><span>Clicks</span></div>
      </div>
      {recommendations.length > 0 && (
        <ul className="taskifi-report-recommendations">
          {recommendations.slice(0, 3).map((item, index) => <li key={`${report.id}-${index}`}>{item}</li>)}
        </ul>
      )}
      <div className="taskifi-feature-actions left">
        {reportUrl ? <a href={reportUrl} target="_blank" rel="noopener noreferrer" className="taskifi-button taskifi-button-primary">View report</a> : <span className="taskifi-button taskifi-button-secondary">PDF pending</span>}
      </div>
    </article>
  );
}

export default function ClientReportsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<DashboardClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientReports, setClientReports] = useState<ClientReport[]>([]);
  const [reports, setReports] = useState<AdReport[]>([]);
  const [alerts, setAlerts] = useState<AdAlert[]>([]);
  const [monthlyScans, setMonthlyScans] = useState<ScanActivity[]>([]);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [panelLoading, setPanelLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    loadReportHome();
  }, []);

  useEffect(() => {
    if (selectedClientId) loadReports(selectedClientId);
  }, [selectedClientId]);

  async function loadReportHome() {
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
      setWarnings([err.message || 'Could not load reports.']);
    } finally {
      setLoading(false);
    }
  }

  async function loadReports(clientId: string) {
    setPanelLoading(true);
    setMonthlyScans([]);
    setClientReports([]);
    const nextWarnings: string[] = [];
    try {
      const supabase = getSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (token) {
        const clientReportRes = await fetch(`/api/client/reports?client_id=${clientId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const clientReportData = await clientReportRes.json();
        if (!clientReportRes.ok) nextWarnings.push(`Client reports: ${clientReportData.error || 'Could not load client reports'}`);
        else setClientReports((clientReportData.reports || []) as ClientReport[]);
      } else {
        nextWarnings.push('Client reports: signed-in session missing');
      }

      const { data: reportData, error: reportError } = await supabase
        .from('ad_reports')
        .select('*')
        .eq('client_id', clientId)
        .order('report_start_date', { ascending: false })
        .limit(12);
      if (reportError) nextWarnings.push(`Ad reports: ${reportError.message}`);
      else setReports((reportData || []) as AdReport[]);

      const { data: alertData, error: alertError } = await supabase
        .from('ad_alerts')
        .select('id, title, description, recommendation, severity, created_at')
        .eq('client_id', clientId)
        .eq('is_resolved', false)
        .order('created_at', { ascending: false })
        .limit(8);
      if (alertError) nextWarnings.push(`Alerts: ${alertError.message}`);
      else setAlerts((alertData || []) as AdAlert[]);

      const { data: activityData, error: activityError } = await supabase
        .from('activities')
        .select('id, title, description, activity_type, source, details, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(15);
      if (activityError) nextWarnings.push(`Monthly scans: ${activityError.message}`);
      else setMonthlyScans(getMonthlyScansFromActivities((activityData || []) as ScanActivity[]));
    } catch (err: any) {
      nextWarnings.push(err.message || 'Report panels could not load.');
    } finally {
      setWarnings(nextWarnings);
      setPanelLoading(false);
    }
  }

  const selectedClient = clients.find((client) => client.id === selectedClientId) || null;
  const latestReport = reports[0] || null;
  const latestClientReport = clientReports[0] || null;
  const seoReports = clientReports.filter((report) => report.report_type === 'seo' || report.report_type === 'site_health');
  const latestTotalsitedataScan = getLatestTotalsitedataScan(monthlyScans);
  const totalsiteScanIssues = latestTotalsitedataScan ? getScanIssues(latestTotalsitedataScan) : [];
  const totals = useMemo(() => reports.reduce((acc, report) => ({
    spend: acc.spend + (Number(report.total_cost) || 0),
    clicks: acc.clicks + (Number(report.total_clicks) || 0),
    impressions: acc.impressions + (Number(report.total_impressions) || 0),
  }), { spend: 0, clicks: 0, impressions: 0 }), [reports]);

  if (loading) {
    return <main className="taskifi-dashboard taskifi-loading-screen"><div className="taskifi-loading-card"><div className="taskifi-spinner" /><p className="taskifi-eyebrow">Client reports</p><h1>Loading reports</h1><p>Checking your latest campaign and growth summaries.</p></div></main>;
  }

  return (
    <div className="taskifi-dashboard taskifi-client-dashboard">
      <ClientNav userEmail={userEmail} />
      <main className="taskifi-main taskifi-feature-main">
        <section className="taskifi-feature-hero">
          <div>
            <Link href={`/client${selectedClientId ? `?client_id=${selectedClientId}` : ''}`} className="taskifi-back-link">← Back to client home</Link>
            <p className="taskifi-pill"><span /> Client reports</p>
            <h1>{selectedClient ? `${clientName(selectedClient)} reports` : 'Your reports'}</h1>
            <p>Plain-English SEO, visibility, GBP, ad and monthly growth reports, loaded automatically when TaskifiAI or Marketing publishes a new report.</p>
          </div>
          <div className="taskifi-feature-actions">
            {clients.length > 1 && (
              <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)} className="taskifi-feature-select" aria-label="Choose client account">
                {clients.map((client) => <option key={client.id} value={client.id}>{clientName(client)}</option>)}
              </select>
            )}
          </div>
        </section>

        {warnings.length > 0 && <section className="taskifi-alert" role="status"><strong>Report notes:</strong> {warnings.join(' • ')}</section>}

        {!selectedClient ? (
          <section className="taskifi-empty-state taskifi-empty-wide"><p className="taskifi-eyebrow">No report access</p><h2>Your account is not linked to a client workspace.</h2><p>Ask your TaskifiAI admin to add your email to the right client account.</p></section>
        ) : panelLoading ? (
          <div className="taskifi-loading-card taskifi-inline-loading"><div className="taskifi-spinner" /><p>Refreshing reports...</p></div>
        ) : (
          <>
            <section className="taskifi-stats-grid" aria-label="Report summary">
              <article className="taskifi-stat-card"><span>Client reports</span><strong>{clientReports.length}</strong><p>SEO, GBP and site-health reports available.</p></article>
              <article className="taskifi-stat-card"><span>Latest score</span><strong>{latestClientReport?.score ?? '—'}</strong><p>{latestClientReport ? formatReportType(latestClientReport.report_type) : 'Awaiting first score'}.</p></article>
              <article className="taskifi-stat-card"><span>Monthly scans</span><strong>{monthlyScans.length}</strong><p>Recent website-scan summaries for this client.</p></article>
              <article className="taskifi-stat-card"><span>Total clicks</span><strong>{totals.clicks.toLocaleString()}</strong><p>Tracked ad clicks across reports.</p></article>
              <article className="taskifi-stat-card"><span>Open alerts</span><strong>{alerts.length}</strong><p>Campaign items that need attention.</p></article>
            </section>

            <section className="taskifi-client-reports-grid">
              <article className="taskifi-module-card taskifi-span-2">
                <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Latest report</p><h2>{latestClientReport ? latestClientReport.title : 'Growth snapshot'}</h2></div><span className="taskifi-soft-badge">{latestClientReport ? formatDate(latestClientReport.period_end) : latestReport?.report_start_date ? formatDate(latestReport.report_start_date) : latestTotalsitedataScan ? getScanDate(latestTotalsitedataScan) : 'Pending'}</span></div>
                {latestClientReport ? (
                  <ReportCard report={latestClientReport} />
                ) : latestReport ? (
                  <div className="taskifi-source-grid taskifi-report-card-grid">
                    <div className="taskifi-source-card"><strong>{formatCurrency(latestReport.total_cost)}</strong><span>Total spend</span></div>
                    <div className="taskifi-source-card"><strong>{(latestReport.total_impressions || 0).toLocaleString()}</strong><span>Impressions</span></div>
                    <div className="taskifi-source-card"><strong>{(latestReport.total_clicks || 0).toLocaleString()}</strong><span>Clicks</span></div>
                    <div className="taskifi-source-card"><strong>{formatPercent(latestReport.avg_ctr)}</strong><span>CTR</span></div>
                    <div className="taskifi-source-card"><strong>{latestReport.avg_roas?.toFixed(1) || '0'}x</strong><span>ROAS</span></div>
                  </div>
                ) : latestTotalsitedataScan ? (
                  <div className="taskifi-list-stack">
                    <div className="taskifi-report-row">
                      <div>
                        <h3>{getScanTitle(latestTotalsitedataScan)}</h3>
                        <p>{getScanSource(latestTotalsitedataScan)}{latestTotalsitedataScan.description ? ` • ${latestTotalsitedataScan.description}` : ''}</p>
                        {totalsiteScanIssues.length > 0 && <small>Top issues: {totalsiteScanIssues.slice(0, 3).join(' • ')}</small>}
                        <div className="taskifi-client-action-grid">
                          {latestTotalsitedataScan.details?.report_links?.free_preview_html && <a href={latestTotalsitedataScan.details.report_links.free_preview_html} target="_blank" rel="noopener noreferrer">Open preview</a>}
                          {latestTotalsitedataScan.details?.report_links?.full_report_pdf && <a href={latestTotalsitedataScan.details.report_links.full_report_pdf} target="_blank" rel="noopener noreferrer">Download PDF</a>}
                        </div>
                      </div>
                      <small>{getScanDate(latestTotalsitedataScan)}</small>
                    </div>
                  </div>
                ) : <div className="taskifi-inner-empty"><h3>No report data yet</h3><p>Your first SEO, GBP or monthly report will appear as soon as Marketing publishes it.</p></div>}
               </article>

              <article className="taskifi-module-card">
                <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Needs attention</p><h2>Open alerts</h2></div><span className="taskifi-soft-badge">{alerts.length} open</span></div>
                {alerts.length === 0 ? <div className="taskifi-inner-empty"><h3>No active alerts</h3><p>Nothing urgent needs attention in your connected reports.</p></div> : (
                  <div className="taskifi-list-stack">
                    {alerts.map((alert) => (
                      <article key={alert.id} className="taskifi-alert-row"><div className="taskifi-alert-icon">!</div><div><h3>{alert.title || 'Campaign alert'}</h3><p>{alert.description || 'A connected report needs attention.'}</p>{alert.recommendation && <small>{alert.recommendation}</small>}</div><span className={`taskifi-severity ${alert.severity || 'medium'}`}>{alert.severity || 'medium'}</span></article>
                    ))}
                  </div>
                )}
              </article>

              <article className="taskifi-module-card taskifi-span-2">
                <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">SEO reports</p><h2>Monthly visibility history</h2></div><span className="taskifi-soft-badge">{seoReports.length} reports</span></div>
                {seoReports.length === 0 ? <div className="taskifi-inner-empty"><h3>No SEO reports yet</h3><p>Marketing reports will autoload here after the monthly reporting job writes to TaskifiAI.</p></div> : (
                  <div className="taskifi-report-autoload-grid">
                    {seoReports.slice(0, 6).map((report) => <ReportCard key={report.id} report={report} />)}
                  </div>
                )}
              </article>

              <MonthlyScansPanel
                heading="Monthly scan activity"
                eyebrow="Visibility"
                scans={monthlyScans}
                maxItems={4}
                variant="reports"
                emptyTitle="No scan events yet"
                emptyDescription="Legacy scan summaries will still show here when TotalSiteData writes activity events."
              />

              <article className="taskifi-module-card">
                <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Reputation</p><h2>GBP / reviews</h2></div><span className="taskifi-connection-badge planned">Mapped</span></div>
                <div className="taskifi-inner-empty"><h3>GBP summary coming next</h3><p>This area will show recent posts, new reviews, review responses and 30-day Google Business Profile activity.</p></div>
              </article>

              <article className="taskifi-module-card taskifi-span-2">
                <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">All reports</p><h2>Report history</h2></div><span className="taskifi-soft-badge">{clientReports.length + reports.length} reports</span></div>
                {clientReports.length === 0 && reports.length === 0 ? <div className="taskifi-inner-empty"><h3>No report history yet</h3><p>Weekly or monthly summaries will stack here over time.</p></div> : (
                  <div className="taskifi-list-stack">
                    {clientReports.map((report) => (
                      <article key={report.id} className="taskifi-report-row"><div><h3>{report.title}</h3><p>{formatReportType(report.report_type)} • {formatDate(report.period_start)} – {formatDate(report.period_end)}</p></div><div className="taskifi-report-row-metrics"><strong>{report.score ?? '—'}</strong><span>{report.status}</span></div></article>
                    ))}
                    {reports.map((report) => (
                      <article key={report.id} className="taskifi-report-row"><div><h3>{report.report_start_date ? `Week of ${formatDate(report.report_start_date)}` : 'Ad report period'}</h3><p>{report.alerts_generated ? `${report.alerts_generated} alerts • ` : ''}Performance summary ready</p></div><div className="taskifi-report-row-metrics"><strong>{formatCurrency(report.total_cost)}</strong><span>{report.total_clicks || 0} clicks</span></div></article>
                    ))}
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
