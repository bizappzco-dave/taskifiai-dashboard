'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardNav from '@/components/DashboardNav';
import { getSupabase } from '@/lib/supabase';
import { DashboardClient, clientName, loadAccessibleClients, requireDashboardUser } from '@/lib/dashboard-data';

interface Lead {
  id: string;
  client_id?: string;
  source?: string;
  value?: number;
  status?: string;
  next_follow_up_date?: string | null;
  notes?: string;
  created_at?: string;
  contact?: { name?: string; email?: string; phone?: string } | null;
  client?: { name?: string; business_name?: string; industry?: string } | null;
}

interface Activity {
  id: string;
  title?: string;
  description?: string | null;
  activity_type?: string;
  activity_category?: string;
  source?: string | null;
  occurred_at?: string;
  created_at?: string;
  clients?: { name?: string; business_name?: string } | null;
}

const openStatuses = ['new_lead', 'contacted', 'qualified', 'quoted', 'follow_up'];

export default function CrmOverviewPage() {
  const router = useRouter();
  const [clients, setClients] = useState<DashboardClient[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [contactCount, setContactCount] = useState(0);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    loadCrm();
  }, []);

  async function loadCrm() {
    const nextWarnings: string[] = [];
    try {
      const user = await requireDashboardUser();
      if (!user) {
        router.push('/auth/signin');
        return;
      }
      setUserEmail(user.email || '');

      const supabase = getSupabase();
      const accessibleClients = await loadAccessibleClients(user.id);
      setClients(accessibleClients);
      const clientIds = accessibleClients.map((client) => client.id);

      if (clientIds.length > 0) {
        const { data: leadData, error: leadError } = await supabase
          .from('leads')
          .select('*, contact:contact_id (name, email, phone), client:client_id (name, business_name, industry)')
          .in('client_id', clientIds)
          .order('created_at', { ascending: false })
          .limit(40);
        if (leadError) nextWarnings.push(`Leads: ${leadError.message}`);
        else setLeads((leadData || []) as Lead[]);

        const { count, error: contactsError } = await supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .in('client_id', clientIds);
        if (contactsError) nextWarnings.push(`Contacts: ${contactsError.message}`);
        else setContactCount(count || 0);

        const { data: activityData, error: activityError } = await supabase
          .from('activities')
          .select('id, title, description, activity_type, activity_category, source, occurred_at, created_at, clients:client_id (name, business_name)')
          .in('client_id', clientIds)
          .order('created_at', { ascending: false })
          .limit(10);
        if (activityError) nextWarnings.push(`Activities: ${activityError.message}`);
        else setActivities((activityData || []) as Activity[]);
      }
    } catch (err: any) {
      nextWarnings.push(err.message || 'CRM could not load fully.');
    } finally {
      setWarnings(nextWarnings);
      setLoading(false);
    }
  }

  const openLeads = leads.filter((lead) => openStatuses.includes(lead.status || ''));
  const followUpsDue = openLeads.filter((lead) => lead.next_follow_up_date && new Date(lead.next_follow_up_date) <= new Date());
  const pipelineValue = openLeads.reduce((sum, lead) => sum + (Number(lead.value) || 0), 0);
  const leadSources = useMemo(() => {
    const counts = new Map<string, number>();
    leads.forEach((lead) => counts.set(lead.source || 'manual', (counts.get(lead.source || 'manual') || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [leads]);

  return (
    <div className="taskifi-dashboard">
      <DashboardNav userEmail={userEmail} />
      <main className="taskifi-main taskifi-feature-main">
        <section className="taskifi-feature-hero">
          <div>
            <p className="taskifi-pill"><span /> CRM overview</p>
            <h1>The client intelligence layer.</h1>
            <p>One home for contacts, leads, follow-ups and recent activity across TaskifiAI products.</p>
          </div>
          <div className="taskifi-feature-actions">
            <Link href="/pipeline" className="taskifi-button taskifi-button-primary">Open pipeline</Link>
            <Link href="/clients/new" className="taskifi-button taskifi-button-secondary">Add client</Link>
          </div>
        </section>

        <section className="taskifi-stats-grid" aria-label="CRM summary">
          <article className="taskifi-stat-card"><span>Clients</span><strong>{clients.length}</strong><p>Businesses feeding the CRM layer.</p></article>
          <article className="taskifi-stat-card"><span>Contacts</span><strong>{contactCount}</strong><p>Known people linked to client records.</p></article>
          <article className="taskifi-stat-card"><span>Open leads</span><strong>{openLeads.length}</strong><p>Active sales opportunities.</p></article>
          <article className="taskifi-stat-card"><span>Follow-ups due</span><strong>{followUpsDue.length}</strong><p>Leads needing attention now.</p></article>
        </section>

        {warnings.length > 0 && (
          <section className="taskifi-alert" role="status">
            <strong>CRM loaded with notes:</strong> {warnings.join(' • ')}
          </section>
        )}

        {loading ? (
          <div className="taskifi-loading-card taskifi-inline-loading"><div className="taskifi-spinner" /><p>Loading CRM...</p></div>
        ) : (
          <section className="taskifi-crm-grid">
            <article className="taskifi-module-card">
              <div className="taskifi-module-header">
                <div><p className="taskifi-eyebrow">Action list</p><h2>Leads needing attention</h2></div>
                <span className="taskifi-soft-badge">€{pipelineValue.toLocaleString()} open value</span>
              </div>
              {openLeads.length === 0 ? (
                <div className="taskifi-inner-empty"><h3>No active leads yet</h3><p>New enquiries from Social Chats, ads, website forms or manual entry will appear here.</p><Link href="/pipeline" className="taskifi-button taskifi-button-primary">View pipeline</Link></div>
              ) : (
                <div className="taskifi-list-stack">
                  {openLeads.slice(0, 6).map((lead) => (
                    <article key={lead.id} className="taskifi-crm-row">
                      <div>
                        <h3>{lead.contact?.name || 'Unknown contact'}</h3>
                        <p>{lead.client?.name || lead.client?.business_name || 'Unknown client'} • {lead.source || 'manual'} • {lead.status || 'new'}</p>
                      </div>
                      <div className="taskifi-row-actions compact">
                        {lead.next_follow_up_date && <span>{new Date(lead.next_follow_up_date).toLocaleDateString('en-IE')}</span>}
                        <Link href="/pipeline">Pipeline</Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </article>

            <article className="taskifi-module-card">
              <div className="taskifi-module-header">
                <div><p className="taskifi-eyebrow">Recent history</p><h2>Activity feed</h2></div>
                <span className="taskifi-soft-badge">{activities.length} recent</span>
              </div>
              {activities.length === 0 ? (
                <div className="taskifi-inner-empty"><h3>No recent activity</h3><p>Emails, calls, reviews, posts and CRM actions will appear here as integrations feed activity logs.</p></div>
              ) : (
                <div className="taskifi-list-stack">
                  {activities.map((activity) => (
                    <article key={activity.id} className="taskifi-activity-row-lite">
                      <span className="taskifi-activity-dot" />
                      <div>
                        <h3>{activity.title || activity.activity_type || 'Activity'}</h3>
                        <p>{activity.description || activity.clients?.name || activity.clients?.business_name || 'Client activity'}</p>
                      </div>
                      <small>{activity.created_at ? new Date(activity.created_at).toLocaleDateString('en-IE') : ''}</small>
                    </article>
                  ))}
                </div>
              )}
            </article>

            <article className="taskifi-module-card taskifi-span-2">
              <div className="taskifi-module-header">
                <div><p className="taskifi-eyebrow">CRM routing</p><h2>Where enquiries come from</h2></div>
                <Link href="/dashboard/ads" className="taskifi-soft-link">Ad reports</Link>
              </div>
              <div className="taskifi-source-grid">
                {leadSources.length === 0 ? ['WhatsApp', 'Website', 'Google Ads', 'GBP', 'Manual'].map((source) => (
                  <div key={source} className="taskifi-source-card"><strong>{source}</strong><span>Ready to connect</span></div>
                )) : leadSources.map(([source, count]) => (
                  <div key={source} className="taskifi-source-card"><strong>{source}</strong><span>{count} lead{count === 1 ? '' : 's'}</span></div>
                ))}
              </div>
            </article>
          </section>
        )}
      </main>
    </div>
  );
}
