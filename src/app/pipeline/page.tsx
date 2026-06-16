'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Phone, MessageCircle, Mail, Plus, Calendar, DollarSign, X } from 'lucide-react';
import { format, isPast } from 'date-fns';
import AddLeadModal from '@/components/AddLeadModal';

const PIPELINE_STAGES = [
  { id: 'new_lead', label: 'New Lead', color: 'bg-blue-500' },
  { id: 'contacted', label: 'Contacted', color: 'bg-yellow-500' },
  { id: 'qualified', label: 'Qualified', color: 'bg-purple-500' },
  { id: 'quoted', label: 'Quoted', color: 'bg-indigo-500' },
  { id: 'follow_up', label: 'Follow-up', color: 'bg-orange-500' },
  { id: 'won', label: 'Won', color: 'bg-green-500' },
  { id: 'lost', label: 'Lost', color: 'bg-gray-500' },
] as const;

const SOURCE_COLORS: Record<string, string> = {
  whatsapp: 'bg-green-100 text-green-800',
  gmail: 'bg-red-100 text-red-800',
  instagram_dm: 'bg-pink-100 text-pink-800',
  facebook_dm: 'bg-blue-100 text-blue-800',
  website_form: 'bg-purple-100 text-purple-800',
  gbp_call: 'bg-yellow-100 text-yellow-800',
  manual: 'bg-gray-100 text-gray-800',
};

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
  contact?: {
    name: string;
    email: string;
    phone: string;
  };
  client?: {
    name: string;
    industry: string;
  };
}

export default function LeadPipeline() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [showAddLead, setShowAddLead] = useState(false);

  const supabase = getSupabase();

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

      if (sourceFilter !== 'all') {
        query = query.eq('source', sourceFilter);
      }

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
    // Optimistic update
    setLeads(prev =>
      prev.map(lead =>
        lead.id === leadId ? { ...lead, status: newStatus, updated_at: new Date().toISOString() } : lead
      )
    );

    // Update in database
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', leadId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating lead:', error);
      fetchLeads();
    }
  }

  function handleLeadClick(lead: Lead) {
    setSelectedLead(lead);
  }

  function getFollowUpBadge(lead: Lead) {
    if (!lead.next_follow_up_date) return null;

    const date = new Date(lead.next_follow_up_date);
    const isOverdue = isPast(date);

    return (
      <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
        <Calendar className="w-3 h-3" />
        <span>{format(date, 'MMM d')}</span>
        {isOverdue && <span className="text-red-600">(Overdue)</span>}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Lead Pipeline</h1>
          <p className="text-gray-500">Track prospects from first contact to won/lost</p>
        </div>
        <div className="flex gap-2">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Sources</option>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowAddLead(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Lead
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading leads...</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => (
            <div
              key={stage.id}
              className="flex-shrink-0 w-80 bg-gray-50 rounded-lg p-3"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                <h2 className="font-semibold">{stage.label}</h2>
                <span className="ml-auto text-xs bg-gray-200 px-2 py-1 rounded">
                  {leads.filter(l => l.status === stage.id).length}
                </span>
              </div>

              <div className="space-y-2">
                {leads
                  .filter(lead => lead.status === stage.id)
                  .map((lead) => (
                    <div
                      key={lead.id}
                      className="bg-white rounded-lg p-3 shadow-sm border cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleLeadClick(lead)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-medium text-sm">
                            {lead.contact?.name || 'Unknown'}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {lead.client?.name || 'Unknown Business'}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${SOURCE_COLORS[lead.source]}`}>
                          {SOURCE_LABELS[lead.source]}
                        </span>
                      </div>

                      {lead.value > 0 && (
                        <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                          <DollarSign className="w-3 h-3" />
                          <span>£{lead.value.toLocaleString()}</span>
                        </div>
                      )}

                      {getFollowUpBadge(lead)}

                      <div className="flex gap-1 mt-3 pt-2 border-t">
                        {lead.contact?.phone && (
                          <button className="h-7 w-7 p-0 hover:bg-gray-100 rounded">
                            <Phone className="w-3 h-3" />
                          </button>
                        )}
                        {lead.contact?.email && (
                          <button className="h-7 w-7 p-0 hover:bg-gray-100 rounded">
                            <Mail className="w-3 h-3" />
                          </button>
                        )}
                        {lead.contact?.phone && (
                          <button className="h-7 w-7 p-0 hover:bg-gray-100 rounded">
                            <MessageCircle className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Quick status change */}
                      <div className="mt-2 pt-2 border-t">
                        <select
                          value={lead.status}
                          onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                        >
                          {PIPELINE_STAGES.map(s => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold">
                {selectedLead.contact?.name || 'Unknown'} - {selectedLead.client?.name}
              </h2>
              <button
                onClick={() => setSelectedLead(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Contact Info</h4>
                  <p className="text-sm text-gray-600">{selectedLead.contact?.email}</p>
                  <p className="text-sm text-gray-600">{selectedLead.contact?.phone}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Lead Details</h4>
                  <p className="text-sm text-gray-600">
                    Source: {SOURCE_LABELS[selectedLead.source]}
                  </p>
                  <p className="text-sm text-gray-600">
                    Value: £{selectedLead.value.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    Status: {PIPELINE_STAGES.find(s => s.id === selectedLead.status)?.label}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Notes</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {selectedLead.notes || 'No notes yet'}
                </p>
              </div>

              {selectedLead.won_lost_reason && (
                <div>
                  <h4 className="text-sm font-medium mb-2">
                    {selectedLead.status === 'won' ? 'Won Reason' : 'Lost Reason'}
                  </h4>
                  <p className="text-sm text-gray-600">{selectedLead.won_lost_reason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      <AddLeadModal
        isOpen={showAddLead}
        onClose={() => setShowAddLead(false)}
        onSuccess={fetchLeads}
      />
    </div>
  );
}
