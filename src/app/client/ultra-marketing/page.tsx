'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ClientNav from '@/components/ClientNav';
import { fetchWithDashboardAuth } from '@/lib/authenticated-fetch';
import { DashboardClient, clientName, hasUltraMarketing, loadAccessibleClients, requireDashboardUser } from '@/lib/dashboard-data';

type WorkspaceModule = {
  key: string;
  label: string;
  description: string;
  status: string;
};

type WorkspaceActivity = {
  id: string;
  title: string;
  description?: string | null;
  activity_type?: string | null;
  created_at?: string | null;
};

type WorkspacePayload = {
  client: {
    id: string;
    name?: string | null;
    industry?: string | null;
    tier?: string | null;
  };
  workspace: {
    id: string;
    display_name: string;
    assistant_label: string;
    status: string;
    workspace_type: string;
    approval_policy: string;
    allowed_workflows: string[];
    connected_account_status: Record<string, unknown>;
    provisioned_at?: string | null;
  };
  summary: {
    open_leads: number;
    pending_approvals: number;
    recent_activity: number;
    latest_report?: {
      id: string;
      title: string;
      type?: string | null;
      status?: string | null;
      score?: number | null;
      created_at?: string | null;
    } | null;
  };
  modules: WorkspaceModule[];
  approval_defaults: string[];
  recent_activity: WorkspaceActivity[];
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-IE', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending';
}

function statusLabel(value?: string | null) {
  return value ? value.replace(/_/g, ' ') : 'ready';
}

export default function UltraMarketingWorkspacePage() {
  const router = useRouter();
  const [clients, setClients] = useState<DashboardClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [workspaceData, setWorkspaceData] = useState<WorkspacePayload | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [panelLoading, setPanelLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    loadWorkspaceHome();
  }, []);

  useEffect(() => {
    if (selectedClientId) loadWorkspace(selectedClientId);
  }, [selectedClientId]);

  async function loadWorkspaceHome() {
    try {
      const user = await requireDashboardUser();
      if (!user) {
        router.push('/auth/signin');
        return;
      }

      setUserEmail(user.email || '');
      const accessibleClients = await loadAccessibleClients(user.id);
      const ultraClients = accessibleClients.filter(hasUltraMarketing);
      setClients(ultraClients);

      const requestedClient = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('client_id') : null;
      const selected = ultraClients.find((client) => client.id === requestedClient) || ultraClients[0];
      if (selected) setSelectedClientId(selected.id);
    } catch (err: any) {
      setWarnings([err.message || 'Could not load your assistant workspace.']);
    } finally {
      setLoading(false);
    }
  }

  async function loadWorkspace(clientId: string) {
    setPanelLoading(true);
    setWorkspaceData(null);
    setWarnings([]);

    try {
      const res = await fetchWithDashboardAuth(`/api/client/ultra-marketing/workspace?client_id=${clientId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Assistant workspace could not load');
      setWorkspaceData(data as WorkspacePayload);
    } catch (err: any) {
      setWarnings([err.message || 'Assistant workspace could not load.']);
    } finally {
      setPanelLoading(false);
    }
  }

  const selectedClient = clients.find((client) => client.id === selectedClientId) || null;
  const latestReport = workspaceData?.summary.latest_report || null;

  if (loading) {
    return <main className="taskifi-dashboard taskifi-loading-screen"><div className="taskifi-loading-card"><div className="taskifi-spinner" /><p className="taskifi-eyebrow">Ultra Marketing</p><h1>Loading assistant workspace</h1><p>Checking your client access and enabled products.</p></div></main>;
  }

  return (
    <div className="taskifi-dashboard taskifi-client-dashboard">
      <ClientNav userEmail={userEmail} />
      <main className="taskifi-main taskifi-feature-main">
        <section className="taskifi-feature-hero taskifi-client-home-hero">
          <div>
            <p className="taskifi-pill"><span /> 24/7 AI Marketing Assistant</p>
            <h1>{selectedClient ? `${clientName(selectedClient)} assistant workspace` : 'Ultra Marketing Assistant'}</h1>
            <p>Review growth signals, draft marketing actions and keep public-facing work approval-gated from one secure client workspace.</p>
          </div>
          <div className="taskifi-feature-actions">
            {clients.length > 1 && (
              <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)} className="taskifi-feature-select" aria-label="Choose client workspace">
                {clients.map((client) => <option key={client.id} value={client.id}>{clientName(client)}</option>)}
              </select>
            )}
            <Link href={`/client${selectedClientId ? `?client_id=${selectedClientId}` : ''}`} className="taskifi-button taskifi-button-secondary">Client home</Link>
            <Link href={`/client/reports${selectedClientId ? `?client_id=${selectedClientId}` : ''}`} className="taskifi-button taskifi-button-primary">Reports</Link>
          </div>
        </section>

        {warnings.length > 0 && <section className="taskifi-alert" role="status"><strong>Assistant note:</strong> {warnings.join(' • ')}</section>}

        {clients.length === 0 ? (
          <section className="taskifi-empty-state taskifi-empty-wide">
            <p className="taskifi-eyebrow">Not enabled yet</p>
            <h2>Your account is not linked to an Ultra Marketing workspace.</h2>
            <p>Ask your TaskifiAI admin to enable Ultra Marketing for the right client account.</p>
            <div className="taskifi-feature-actions left">
              <Link href="/client" className="taskifi-button taskifi-button-secondary">Back to client home</Link>
            </div>
          </section>
        ) : panelLoading ? (
          <div className="taskifi-loading-card taskifi-inline-loading"><div className="taskifi-spinner" /><p>Refreshing assistant workspace...</p></div>
        ) : workspaceData ? (
          <>
            <section className="taskifi-stats-grid" aria-label="Assistant workspace summary">
              <article className="taskifi-stat-card"><span>Open leads</span><strong>{workspaceData.summary.open_leads}</strong><p>Active enquiries the assistant can summarise.</p></article>
              <article className="taskifi-stat-card"><span>Approvals</span><strong>{workspaceData.summary.pending_approvals}</strong><p>Items waiting for human review or action.</p></article>
              <article className="taskifi-stat-card"><span>Latest report</span><strong>{latestReport ? statusLabel(latestReport.status) : 'Pending'}</strong><p>{latestReport ? latestReport.title : 'Reports will appear once connected.'}</p></article>
              <article className="taskifi-stat-card"><span>Activity</span><strong>{workspaceData.summary.recent_activity}</strong><p>Recent client updates available for context.</p></article>
            </section>

            <section className="taskifi-client-home-grid">
              <article className="taskifi-module-card taskifi-span-2">
                <div className="taskifi-module-header">
                  <div><p className="taskifi-eyebrow">Workspace</p><h2>{workspaceData.workspace.display_name}</h2></div>
                  <span className="taskifi-connection-badge live">{workspaceData.workspace.status}</span>
                </div>
                <p className="taskifi-muted-note">This assistant can research, analyse and draft automatically. Publishing, sending, replying publicly and budget-changing actions stay approval-gated.</p>
                <div className="taskifi-source-grid taskifi-report-mini-grid">
                  <div className="taskifi-source-card"><strong>{workspaceData.modules.length}</strong><span>Assistant workflows</span></div>
                  <div className="taskifi-source-card"><strong>{formatDate(workspaceData.workspace.provisioned_at)}</strong><span>Provisioned</span></div>
                  <div className="taskifi-source-card"><strong>Approval</strong><span>External actions</span></div>
                  <div className="taskifi-source-card"><strong>Secure</strong><span>Client-scoped access</span></div>
                </div>
              </article>

              <article className="taskifi-module-card">
                <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Assistant modules</p><h2>What it can draft</h2></div><span className="taskifi-soft-badge">Draft mode</span></div>
                <div className="taskifi-list-stack">
                  {workspaceData.modules.map((module) => (
                    <article key={module.key} className="taskifi-crm-row">
                      <div><h3>{module.label}</h3><p>{module.description}</p></div>
                      <span className={module.status === 'approval_required' ? 'taskifi-connection-badge planned' : 'taskifi-connection-badge live'}>{statusLabel(module.status)}</span>
                    </article>
                  ))}
                </div>
              </article>

              <article className="taskifi-module-card">
                <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Approval defaults</p><h2>Human review stays on</h2></div><span className="taskifi-soft-badge">Safe by default</span></div>
                <ul className="taskifi-report-recommendations">
                  {workspaceData.approval_defaults.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </article>

              <article className="taskifi-module-card">
                <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Next actions</p><h2>Start from live context</h2></div></div>
                <div className="taskifi-client-action-grid">
                  <Link href={`/client/reports?client_id=${workspaceData.client.id}`}>Review latest reports</Link>
                  <Link href={`/client/posting?client_id=${workspaceData.client.id}`}>Prepare a social post</Link>
                  <Link href={`/client?client_id=${workspaceData.client.id}`}>Check leads and activity</Link>
                  <span>Approval queue coming next</span>
                </div>
              </article>

              <article className="taskifi-module-card">
                <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Latest report</p><h2>Growth signal</h2></div></div>
                {latestReport ? (
                  <div className="taskifi-report-row">
                    <div><h3>{latestReport.title}</h3><p>{latestReport.type || 'report'} • {statusLabel(latestReport.status)}</p></div>
                    <small>{formatDate(latestReport.created_at)}</small>
                  </div>
                ) : (
                  <div className="taskifi-inner-empty"><h3>No report yet</h3><p>The assistant workspace will surface report summaries once connected.</p></div>
                )}
              </article>

              <article className="taskifi-module-card taskifi-span-2">
                <div className="taskifi-module-header"><div><p className="taskifi-eyebrow">Recent context</p><h2>What the assistant can reference</h2></div><span className="taskifi-soft-badge">{workspaceData.recent_activity.length} updates</span></div>
                {workspaceData.recent_activity.length === 0 ? <div className="taskifi-inner-empty"><h3>No activity yet</h3><p>Client activity, reports, lead updates and content events will appear here.</p></div> : (
                  <div className="taskifi-list-stack">
                    {workspaceData.recent_activity.map((activity) => (
                      <article key={activity.id} className="taskifi-activity-row-lite"><span className="taskifi-activity-dot" /><div><h3>{activity.title}</h3><p>{activity.description || 'Client activity update'}</p></div><small>{formatDate(activity.created_at)}</small></article>
                    ))}
                  </div>
                )}
              </article>
            </section>
          </>
        ) : (
          <section className="taskifi-empty-state taskifi-empty-wide"><h2>Workspace could not load.</h2><p>Choose another client or try again after refreshing your session.</p></section>
        )}
      </main>
    </div>
  );
}
