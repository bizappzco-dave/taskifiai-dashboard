'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { DragDropContext, Droppable, Draggable, DropResult } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Phone, MessageCircle, Mail, Plus, Calendar, DollarSign } from 'lucide-react';
import { format, isPast } from 'date-fns';

const PIPELINE_STAGES = [
  { id: 'new_lead', label: 'New Lead', color: 'bg-blue-500' },
  { id: 'contacted', label: 'Contacted', color: 'bg-yellow-500' },
  { id: 'qualified', label: 'Qualified', color: 'bg-purple-500' },
  { id: 'quoted', label: 'Quoted', color: 'bg-indigo-500' },
  { id: 'follow_up', label: 'Follow-up', color: 'bg-orange-500' },
  { id: 'won', label: 'Won', color: 'bg-green-500' },
  { id: 'lost', label: 'Lost', color: 'bg-gray-500' },
] as const;

const SOURCE_COLORS = {
  whatsapp: 'bg-green-100 text-green-800',
  gmail: 'bg-red-100 text-red-800',
  instagram_dm: 'bg-pink-100 text-pink-800',
  facebook_dm: 'bg-blue-100 text-blue-800',
  website_form: 'bg-purple-100 text-purple-800',
  gbp_call: 'bg-yellow-100 text-yellow-800',
  manual: 'bg-gray-100 text-gray-800',
};

const SOURCE_LABELS = {
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
  source: keyof typeof SOURCE_COLORS;
  activity_id: string | null;
  assigned_user_id: string | null;
  value: number;
  status: (typeof PIPELINE_STAGES)[number]['id'];
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
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const supabase = createClient();

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

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return;

    const newStatus = result.destination.droppableId as Lead['status'];
    const leadId = result.draggableId;

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
      // Revert on error
      fetchLeads();
    }
  }

  function handleLeadClick(lead: Lead) {
    setSelectedLead(lead);
    setIsDetailOpen(true);
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
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading leads...</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => (
            <Droppable key={stage.id} droppableId={stage.id}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="flex-shrink-0 w-80 bg-gray-50 rounded-lg p-3"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                    <h2 className="font-semibold">{stage.label}</h2>
                    <Badge variant="secondary" className="ml-auto">
                      {leads.filter(l => l.status === stage.id).length}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    {leads
                      .filter(lead => lead.status === stage.id)
                      .map((lead, index) => (
                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`bg-white rounded-lg p-3 shadow-sm border cursor-pointer hover:shadow-md transition-shadow ${
                                snapshot.isDragging ? 'shadow-lg rotate-2' : ''
                              }`}
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
                                <Badge
                                  variant="secondary"
                                  className={`text-xs ${SOURCE_COLORS[lead.source]}`}
                                >
                                  {SOURCE_LABELS[lead.source]}
                                </Badge>
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
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                    <Phone className="w-3 h-3" />
                                  </Button>
                                )}
                                {lead.contact?.email && (
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                    <Mail className="w-3 h-3" />
                                  </Button>
                                )}
                                {lead.contact?.phone && (
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                    <MessageCircle className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      )}

      {/* Lead Detail Dialog */}
      {selectedLead && (
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedLead.contact?.name || 'Unknown'} - {selectedLead.client?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
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
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
