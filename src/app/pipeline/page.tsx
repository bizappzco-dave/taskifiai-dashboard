'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase';
import { Phone, MessageCircle, Mail, Plus, Calendar, DollarSign } from 'lucide-react';
import { format, isPast } from 'date-fns';
import AddLeadModal from '@/components/AddLeadModal';
import LeadDetailModal from '@/components/LeadDetailModal';
import DashboardNav from '@/components/DashboardNav';

const PIPELINE_STAGES = [
  { id: 'new_lead', label: 'New Lead', tone: 'blue' },
  { id: 'contacted', label: 'Contacted', tone: 'amber' },
  { id: 'qualified', label: 'Qualified', tone: 'purple' },
  { id: 'quoted', label: 'Quoted', tone: 'indigo' },
  { id: 'follow_up', label: 'Follow-up', tone: 'orange' },
  { id: 'won', label: 'Won', tone: 'green' },
  { id: 'lost', label: 'Lost', tone: 'slate' },
] as const;

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  gmail: 'Gmail',
  instagram_dm: 'Instagram',
  facebook_dm: 'Facebook',
  website_form: 'Website',
  gbp_call: 'GBP Call',
  manual: 'Manual',
};

interface Lead {
  id: string;
  contact_id: string;
  client_id: string;
  source: string;
  activity_id: string | null;
  assigned_user_id: string | null;
  value: number;
  status: string;
  next_follow_up_date: string | null;
  notes: string;
  won_lost_reason: string;
  created_at: string;
  updated_at: string;
  contact?: { name: string; email: string; phone: string; };
  client?: { name: string; industry: string; };
}

export default function LeadPipeline() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [showAddLead, setShowAddLead] = useState(false);

  const supabase = getSupabase() as any;

  useEffect(() => {
    fetchLeads();
  }, [sourceFilter]);

  async function fetchLeads() {
    try {
      let query = supabase
        .from('leads')
        .select(`
          *,
          contact:contact_id (name, email, phone),
          client:client_id (name, industry)
        `)
        .order('created_at', { ascending: false });

      if (sourceFilter !== 'all') query = query.eq('source', sourceFilter);

      const { data, error } = await query;
      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateLeadStatus(leadId: string, newStatus: string) {
    setLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, status: newStatus, updated_at: new Date().toISOString() } : lead));

    try {
      const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating lead:', error);
      fetchLeads();
    }
  }

  function getFollowUpBadge(lead: Lead) {
    if (!lead.next_follow_up_date) return null;
    const date = new Date(lead.next_follow_up_date);
    const isOverdue = isPast(date);

    return (
      <div className={isOverdue ? 'taskifi-followup overdue' : 'taskifi-followup'}>
        <Calendar className="w-3 h-3" />
        <span>{format(date, 'MMM d')}</span>
        {isOverdue && <span>Overdue</span>}
      </div>
    );
  }

  const totalValue = leads.reduce((sum, lead) => sum + (Number(lead.value) || 0), 0);
  const wonCount = leads.filter(lead => lead.status === 'won').length;
  const openCount = leads.filter(lead => !['won', 'lost'].includes(lead.status)).length;

  return (
    <div className="taskifi-dashboard">
      <DashboardNav />
      <main className="taskifi-main taskifi-feature-main">
        <section className="taskifi-feature-hero">
          <div>
            <Link href="/" className="taskifi-back-link">← Back to dashboard</Link>
            <p className="taskifi-pill"><span /> Lead pipeline</p>
            <h1>Every enquiry, clearly tracked.</h1>
            <p>Follow WhatsApp, email, social and website enquiries from first contact through quote, follow-up and won work.</p>
          </div>
          <div className="taskifi-feature-actions">
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="taskifi-feature-select" aria-label="Filter leads by source">
              <option value="all">All sources</option>
              {Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button onClick={() => setShowAddLead(true)} className="taskifi-button taskifi-button-primary">
              <Plus className="w-4 h-4" /> Add lead
            </button>
          </div>
        </section>

        <section className="taskifi-stats-grid taskifi-pipeline-stats" aria-label="Pipeline summary">
          <article className="taskifi-stat-card"><span>Open leads</span><strong>{openCount}</strong><p>Active opportunities needing follow-up.</p></article>
          <article className="taskifi-stat-card"><span>Pipeline value</span><strong>€{totalValue.toLocaleString()}</strong><p>Estimated value across visible leads.</p></article>
          <article className="taskifi-stat-card"><span>Won</span><strong>{wonCount}</strong><p>Leads marked as successful.</p></article>
          <article className="taskifi-stat-card"><span>Total leads</span><strong>{leads.length}</strong><p>All tracked enquiries in this view.</p></article>
        </section>

        {loading ? (
          <div className="taskifi-loading-card taskifi-inline-loading">
            <div className="taskifi-spinner" />
            <p>Loading leads...</p>
          </div>
        ) : (
          <section className="taskifi-pipeline-board" aria-label="Lead pipeline board">
            {PIPELINE_STAGES.map((stage) => {
              const stageLeads = leads.filter(lead => lead.status === stage.id);
              return (
                <div key={stage.id} className="taskifi-pipeline-column">
                  <div className="taskifi-pipeline-column-head">
                    <span className={`taskifi-stage-dot ${stage.tone}`} />
                    <h2>{stage.label}</h2>
                    <strong>{stageLeads.length}</strong>
                  </div>

                  <div className="taskifi-lead-stack">
                    {stageLeads.length === 0 ? (
                      <div className="taskifi-lead-empty">No leads here yet</div>
                    ) : stageLeads.map((lead) => (
                      <article key={lead.id} className="taskifi-lead-card" onClick={() => setSelectedLead(lead)}>
                        <div className="taskifi-lead-card-top">
                          <div>
                            <h3>{lead.contact?.name || 'Unknown contact'}</h3>
                            <p>{lead.client?.name || 'Unknown business'}</p>
                          </div>
                          <span className="taskifi-source-chip">{SOURCE_LABELS[lead.source] || lead.source}</span>
                        </div>

                        {lead.value > 0 && (
                          <div className="taskifi-lead-value"><DollarSign className="w-3 h-3" />€{lead.value.toLocaleString()}</div>
                        )}

                        {getFollowUpBadge(lead)}

                        <div className="taskifi-lead-tools">
                          {lead.contact?.phone && <button aria-label="Call lead"><Phone className="w-3 h-3" /></button>}
                          {lead.contact?.email && <button aria-label="Email lead"><Mail className="w-3 h-3" /></button>}
                          {lead.contact?.phone && <button aria-label="WhatsApp lead"><MessageCircle className="w-3 h-3" /></button>}
                        </div>

                        <select value={lead.status} onChange={(e) => updateLeadStatus(lead.id, e.target.value)} onClick={(e) => e.stopPropagation()} className="taskifi-lead-status" aria-label="Update lead status">
                          {PIPELINE_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </article>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {selectedLead && (
          <LeadDetailModal
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onUpdate={(updates) => {
              setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, ...updates, updated_at: new Date().toISOString() } : l));
              setSelectedLead(prev => prev ? { ...prev, ...updates, updated_at: new Date().toISOString() } : null);
            }}
            onRefresh={fetchLeads}
          />
        )}

        <AddLeadModal isOpen={showAddLead} onClose={() => setShowAddLead(false)} onSuccess={fetchLeads} />
      </main>
    </div>
  );
}
