'use client';

import { useEffect, useMemo, useState } from 'react';
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

type ApprovalQueueItem = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority?: string | null;
  due_date?: string | null;
  action_type: string;
  channel?: string | null;
  summary?: string | null;
  draft_preview?: string | null;
  requested_action?: string | null;
  source?: string | null;
  external_reference?: string | null;
  source_table?: string | null;
  original_status?: string | null;
  image_count?: number | null;
  review_note?: string | null;
  reviewed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
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
  approvals: ApprovalQueueItem[];
  approval_history: ApprovalQueueItem[];
  approvals_summary?: {
    total: number;
    open: number;
    draft: number;
    pending: number;
    approved: number;
    rejected: number;
    published: number;
    total_matching: number;
  };
  recent_activity: WorkspaceActivity[];
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-IE', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending';
}

function statusLabel(value?: string | null) {
  return value ? value.replace(/_/g, ' ') : 'ready';
}

function workflowLabel(value?: string | null) {
  return value ? value.replace(/_/g, ' ') : 'Marketing action';
}

function sourceLabel(value?: string | null) {
  if (!value) return 'Assistant workspace';
  if (value === 'taskifiai_posting_drafts') return 'Posting draft';
  if (value === 'ultra_marketing_assistant_suggestions') return 'Assistant suggestion';
  return value.replace(/_/g, ' ');
}

function historyTimestamp(item: ApprovalQueueItem) {
  return item.reviewed_at || item.updated_at || item.created_at || null;
}

function actionTypeLabel(value?: string | null) {
  switch (value) {
    case 'social_post': return 'Social post';
    case 'review_reply': return 'Review reply';
    case 'email_campaign': return 'Email campaign';
    case 'ad_recommendation': return 'Ad recommendation';
    case 'local_visibility_update': return 'Local visibility';
    default: return workflowLabel(value);
  }
}

function actionTypeIcon(value?: string | null) {
  switch (value) {
    case 'social_post': return '✍️';
    case 'review_reply': return '⭐';
    case 'email_campaign': return '✉️';
    case 'ad_recommendation': return '📈';
    case 'local_visibility_update': return '📍';
    default: return '🧠';
  }
}

function actionTypeTone(value?: string | null) {
  switch (value) {
    case 'social_post': return 'social';
    case 'review_reply': return 'review';
    case 'email_campaign': return 'email';
    case 'ad_recommendation': return 'ads';
    case 'local_visibility_update': return 'local';
    default: return 'default';
  }
}

function approvalBadgeClass(status: string) {
  if (status === 'approved') return 'taskifi-connection-badge live';
  if (status === 'rejected') return 'taskifi-connection-badge';
  return 'taskifi-connection-badge planned';
}

export default function UltraMarketingWorkspacePage() {
  const router = useRouter();
  const [clients, setClients] = useState<DashboardClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [workspaceData, setWorkspaceData] = useState<WorkspacePayload | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [panelLoading, setPanelLoading] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState<string | null>(null);
  const [seedLoading, setSeedLoading] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [historySearch, setHistorySearch] = useState('');

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

  async function reviewApproval(approvalId: string, decision: 'approve' | 'reject') {
    if (!workspaceData) return;

    setDecisionLoading(`${decision}:${approvalId}`);
    setWarnings([]);
    setNotice('');

    try {
      const res = await fetchWithDashboardAuth('/api/client/ultra-marketing/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: workspaceData.client.id,
          approval_id: approvalId,
          decision,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval item could not be updated');

      await loadWorkspace(workspaceData.client.id);
      setNotice(decision === 'approve'
        ? 'Approval recorded. No external publishing or sending happened from this queue.'
        : 'Rejection recorded. The draft will not be executed.');
    } catch (err: any) {
      setWarnings([err.message || 'Approval item could not be updated.']);
    } finally {
      setDecisionLoading(null);
    }
  }

  async function seedApprovals(source: 'assistant_suggestions' | 'posting_drafts') {
    if (!workspaceData) return;

    setSeedLoading(source);
    setWarnings([]);
    setNotice('');

    try {
      const res = await fetchWithDashboardAuth('/api/client/ultra-marketing/approvals/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: workspaceData.client.id,
          source,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval queue could not be seeded');

      await loadWorkspace(workspaceData.client.id);
      const label = source === 'assistant_suggestions' ? 'assistant suggestions' : 'posting drafts';
      setNotice(data.created_count > 0
        ? `${data.created_count} ${label} added to the approval queue. Nothing was published or sent.`
        : `No new ${label} to add. Existing queue items were left unchanged.`);
    } catch (err: any) {
      setWarnings([err.message || 'Approval queue could not be seeded.']);
    } finally {
      setSeedLoading(null);
    }
  }

  const selectedClient = clients.find((client) => client.id === selectedClientId) || null;
  const latestReport = workspaceData?.summary.latest_report || null;
  const approvalCount = workspaceData?.approvals_summary?.total_matching ?? workspaceData?.summary.pending_approvals ?? 0;
  const filteredHistory = useMemo(() => {
    if (!workspaceData) return [];
    const query = historySearch.trim().toLowerCase();
    return workspaceData.approval_history.filter((item) => {
      const matchesFilter = historyFilter === 'all'
        || item.status === historyFilter
        || item.action_type === historyFilter
        || item.source === historyFilter;
      if (!matchesFilter) return false;
      if (!query) return true;
      const haystack = [
        item.title,
        item.description,
        item.summary,
        item.draft_preview,
        item.review_note,
        item.source,
        item.external_reference,
        item.channel,
        item.action_type,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [workspaceData, historyFilter, historySearch]);

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
        {notice && <section className="taskifi-alert taskifi-alert-success" role="status"><strong>Approval queue:</strong> {notice}</section>}

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
                  <div className="taskifi-source-card"><strong>{approvalCount}</strong><span>Approval queue</span></div>
                  <div className="taskifi-source-card"><strong>Secure</strong><span>Client-scoped access</span></div>
                </div>
              </article>

              <article className="taskifi-module-card taskifi-span-2">
                <div className="taskifi-module-header taskifi-module-header-wrap">
                  <div><p className="taskifi-eyebrow">Approval queue</p><h2>Review before anything goes live</h2></div>
                  <div className="taskifi-feature-actions">
                    <button onClick={() => seedApprovals('assistant_suggestions')} disabled={Boolean(seedLoading)} className="taskifi-button taskifi-button-secondary">
                      {seedLoading === 'assistant_suggestions' ? 'Adding...' : 'Add suggestions'}
                    </button>
                    <button onClick={() => seedApprovals('posting_drafts')} disabled={Boolean(seedLoading)} className="taskifi-button taskifi-button-secondary">
                      {seedLoading === 'posting_drafts' ? 'Importing...' : 'Import drafts'}
                    </button>
                    <span className="taskifi-soft-badge">{approvalCount} pending</span>
                  </div>
                </div>
                <p className="taskifi-muted-note">Approving an item records your decision only. Publishing, sending, review replies and budget-changing work still run through the connected workflow after approval.</p>
                {workspaceData.approvals.length === 0 ? (
                  <div className="taskifi-inner-empty"><h3>No approvals waiting</h3><p>Draft posts, email campaigns, review replies and ad recommendations will appear here before they can be actioned.</p></div>
                ) : (
                  <div className="taskifi-list-stack">
                    {workspaceData.approvals.map((approval) => (
                      <article key={approval.id} className={`taskifi-approval-card taskifi-approval-card-${actionTypeTone(approval.action_type)}`}>
                        <div className="taskifi-approval-main">
                          <div className="taskifi-approval-title-row">
                            <div>
                              <p className="taskifi-eyebrow">{actionTypeIcon(approval.action_type)} {actionTypeLabel(approval.action_type)}{approval.channel ? ` • ${approval.channel}` : ''}</p>
                              <h3>{approval.title}</h3>
                            </div>
                            <span className={approvalBadgeClass(approval.status)}>{statusLabel(approval.status)}</span>
                          </div>
                          {(approval.description || approval.summary) && <p>{approval.description || approval.summary}</p>}
                          {approval.draft_preview && <blockquote>{approval.draft_preview}</blockquote>}
                          <div className="taskifi-approval-meta">
                            <span>{approval.priority || 'normal'} priority</span>
                            <span>Due {formatDate(approval.due_date)}</span>
                            <span>{sourceLabel(approval.source)}</span>
                            {approval.requested_action && <span>{approval.requested_action}</span>}
                            {approval.channel && <span>{approval.channel}</span>}
                            {approval.original_status && <span>Was {statusLabel(approval.original_status)}</span>}
                            {typeof approval.image_count === 'number' && <span>{approval.image_count} image{approval.image_count === 1 ? '' : 's'}</span>}
                            {approval.external_reference && <span>{approval.external_reference}</span>}
                          </div>
                          {approval.review_note && <p><strong>Review note:</strong> {approval.review_note}</p>}
                        </div>
                        <div className="taskifi-feature-actions left taskifi-approval-actions">
                          <button onClick={() => reviewApproval(approval.id, 'approve')} disabled={Boolean(decisionLoading)} className="taskifi-button taskifi-button-primary">
                            {decisionLoading === `approve:${approval.id}` ? 'Approving...' : 'Approve'}
                          </button>
                          <button onClick={() => reviewApproval(approval.id, 'reject')} disabled={Boolean(decisionLoading)} className="taskifi-button taskifi-button-secondary">
                            {decisionLoading === `reject:${approval.id}` ? 'Rejecting...' : 'Reject'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
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
                <div className="taskifi-module-header taskifi-module-header-wrap"><div><p className="taskifi-eyebrow">Activity / Draft history</p><h2>What is waiting, approved or rejected</h2></div><span className="taskifi-soft-badge">{filteredHistory.length} of {workspaceData.approval_history.length} items</span></div>
                <div className="taskifi-history-toolbar">
                  <input
                    type="search"
                    value={historySearch}
                    onChange={(event) => setHistorySearch(event.target.value)}
                    placeholder="Search title, note, source or reference"
                    className="taskifi-feature-select taskifi-search-input"
                    aria-label="Search approval history"
                  />
                  <select value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value)} className="taskifi-feature-select" aria-label="Filter approval history">
                    <option value="all">All items</option>
                    <option value="pending_approval">Pending approval</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="social_post">Social posts</option>
                    <option value="review_reply">Review replies</option>
                    <option value="email_campaign">Email campaigns</option>
                    <option value="ad_recommendation">Ad recommendations</option>
                    <option value="local_visibility_update">Local visibility</option>
                    <option value="taskifiai_posting_drafts">Posting drafts</option>
                    <option value="ultra_marketing_assistant_suggestions">Assistant suggestions</option>
                  </select>
                </div>
                {workspaceData.approval_history.length === 0 ? <div className="taskifi-inner-empty"><h3>No approval history yet</h3><p>Assistant suggestions, imported drafts and review decisions will appear here as the workspace gets used.</p></div> : filteredHistory.length === 0 ? <div className="taskifi-inner-empty"><h3>No history matches</h3><p>Try a broader search or switch the filter back to all items.</p></div> : (
                  <div className="taskifi-list-stack">
                    {filteredHistory.map((item) => (
                      <article key={item.id} className={`taskifi-activity-row-lite taskifi-history-card taskifi-history-card-${actionTypeTone(item.action_type)}`}>
                        <span className="taskifi-activity-dot" />
                        <div>
                          <h3>{item.title}</h3>
                          <p>{actionTypeIcon(item.action_type)} {actionTypeLabel(item.action_type)} • {sourceLabel(item.source)}{item.channel ? ` • ${item.channel}` : ''}</p>
                          <div className="taskifi-approval-meta">
                            <span>{statusLabel(item.status)}</span>
                            {item.external_reference && <span>{item.external_reference}</span>}
                            {item.original_status && <span>Was {statusLabel(item.original_status)}</span>}
                            {typeof item.image_count === 'number' && <span>{item.image_count} image{item.image_count === 1 ? '' : 's'}</span>}
                          </div>
                          {item.review_note && <p>Review note: {item.review_note}</p>}
                        </div>
                        <span className={approvalBadgeClass(item.status)}>{statusLabel(item.status)}</span>
                        <small>{formatDate(historyTimestamp(item))}</small>
                      </article>
                    ))}
                  </div>
                )}
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
                  <span>Approved items remain gated until the connected workflow runs</span>
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
