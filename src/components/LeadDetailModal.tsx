'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Save, Plus, Clock, DollarSign, Calendar, Edit2 } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import { format } from 'date-fns'

interface Lead {
  id: string
  contact_id: string
  client_id: string
  source: string
  activity_id: string | null
  assigned_user_id: string | null
  value: number
  status: string
  next_follow_up_date: string | null
  notes: string
  won_lost_reason: string
  created_at: string
  updated_at: string
  contact?: {
    name: string
    email: string
    phone: string
  }
  client?: {
    name: string
    industry: string
  }
}

interface LeadDetailModalProps {
  lead: Lead
  onClose: () => void
  onUpdate: (updates: Partial<Lead>) => void
  onRefresh: () => void
}

const PIPELINE_STAGES = [
  { id: 'new_lead', label: 'New Lead', color: 'bg-blue-500' },
  { id: 'contacted', label: 'Contacted', color: 'bg-yellow-500' },
  { id: 'qualified', label: 'Qualified', color: 'bg-purple-500' },
  { id: 'quoted', label: 'Quoted', color: 'bg-indigo-500' },
  { id: 'follow_up', label: 'Follow-up', color: 'bg-orange-500' },
  { id: 'won', label: 'Won', color: 'bg-green-500' },
  { id: 'lost', label: 'Lost', color: 'bg-gray-500' },
] as const

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  gmail: 'Gmail',
  instagram_dm: 'Instagram',
  facebook_dm: 'Facebook',
  website_form: 'Website',
  gbp_call: 'GBP Call',
  manual: 'Manual',
}

const WON_LOST_REASONS = {
  won: [
    'Perfect fit for our services',
    'Competitive pricing',
    'Strong rapport built',
    'Referred by existing client',
    'Urgent need addressed',
  ],
  lost: [
    'Price too high',
    'Went with competitor',
    'Not ready yet',
    'Out of budget',
    'No longer needed',
    'Lost contact',
  ],
}

const TASK_TYPES = [
  { value: 'call', label: 'Phone Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'quote', label: 'Send Quote' },
  { value: 'other', label: 'Other' },
]

export default function LeadDetailModal({ lead, onClose, onUpdate, onRefresh }: LeadDetailModalProps) {
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesText, setNotesText] = useState(lead.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)

  const [editingValue, setEditingValue] = useState(false)
  const [valueText, setValueText] = useState(String(lead.value))
  const [savingValue, setSavingValue] = useState(false)

  const [editingReason, setEditingReason] = useState(false)
  const [reasonText, setReasonText] = useState(lead.won_lost_reason || '')
  const [savingReason, setSavingReason] = useState(false)

  const [showCreateTask, setShowCreateTask] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskType, setTaskType] = useState('follow_up')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [taskPriority, setTaskPriority] = useState('medium')
  const [taskDescription, setTaskDescription] = useState('')
  const [creatingTask, setCreatingTask] = useState(false)

  const [relatedActivities, setRelatedActivities] = useState<any[]>([])
  const [loadingActivities, setLoadingActivities] = useState(true)

  const supabase = getSupabase()
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Load related activities
  useEffect(() => {
    loadActivities()
  }, [lead.contact_id])

  // Sync local state when lead changes
  useEffect(() => {
    setNotesText(lead.notes || '')
    setValueText(String(lead.value))
    setReasonText(lead.won_lost_reason || '')
  }, [lead])

  const loadActivities = async () => {
    if (!lead.contact_id) {
      setLoadingActivities(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('activities')
        .select('id, activity_type, title, description, occurred_at, activity_category')
        .eq('contact_id', lead.contact_id)
        .order('occurred_at', { ascending: false })
        .limit(10)

      if (!error) {
        setRelatedActivities(data || [])
      }
    } catch (err) {
      console.error('Failed to load activities:', err)
    } finally {
      setLoadingActivities(false)
    }
  }

  const saveNotes = async () => {
    setSavingNotes(true)
    try {
      const { error } = await supabase
        .from('leads')
        .update({ notes: notesText })
        .eq('id', lead.id)

      if (error) throw error
      onUpdate({ notes: notesText })
      setEditingNotes(false)
    } catch (err) {
      console.error('Failed to save notes:', err)
    } finally {
      setSavingNotes(false)
    }
  }

  const saveValue = async () => {
    setSavingValue(true)
    try {
      const num = parseFloat(valueText) || 0
      const { error } = await supabase
        .from('leads')
        .update({ value: num })
        .eq('id', lead.id)

      if (error) throw error
      onUpdate({ value: num })
      setEditingValue(false)
    } catch (err) {
      console.error('Failed to save value:', err)
    } finally {
      setSavingValue(false)
    }
  }

  const saveReason = async () => {
    setSavingReason(true)
    try {
      const { error } = await supabase
        .from('leads')
        .update({ won_lost_reason: reasonText })
        .eq('id', lead.id)

      if (error) throw error
      onUpdate({ won_lost_reason: reasonText })
      setEditingReason(false)
    } catch (err) {
      console.error('Failed to save reason:', err)
    } finally {
      setSavingReason(false)
    }
  }

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) return

    setCreatingTask(true)
    try {
      const taskData: any = {
        client_id: lead.client_id,
        contact_id: lead.contact_id,
        title: taskTitle.trim(),
        description: taskDescription.trim() || null,
        status: 'pending',
        priority: taskPriority,
        metadata: { task_type: taskType, source_lead_id: lead.id },
      }

      if (taskDueDate) {
        taskData.due_date = new Date(taskDueDate).toISOString()
      }

      const { error } = await supabase
        .from('tasks')
        .insert([taskData])

      if (error) throw error

      // Log activity
      await supabase.rpc('log_activity', {
        p_client_id: lead.client_id,
        p_activity_type: 'task_created',
        p_title: `Task created: ${taskTitle}`,
        p_description: `Follow-up task for lead - ${lead.contact?.name}`,
        p_activity_category: 'operations',
        p_contact_id: lead.contact_id,
        p_details: JSON.stringify({ lead_id: lead.id, task_type: taskType })
      })

      setTaskTitle('')
      setTaskDescription('')
      setTaskDueDate('')
      setShowCreateTask(false)
      onRefresh()
    } catch (err) {
      console.error('Failed to create task:', err)
    } finally {
      setCreatingTask(false)
    }
  }

  const changeStatus = async (newStatus: string) => {
    try {
      const update: any = { status: newStatus }
      if (['won', 'lost'].includes(newStatus) && !lead.won_lost_reason) {
        update.won_lost_reason = ''
      }

      const { error } = await supabase
        .from('leads')
        .update(update)
        .eq('id', lead.id)

      if (error) throw error

      // Log activity
      await supabase.rpc('log_activity', {
        p_client_id: lead.client_id,
        p_activity_type: newStatus === 'won' ? 'deal_won' : newStatus === 'lost' ? 'deal_lost' : 'lead_created',
        p_title: `Lead ${newStatus === 'won' ? 'won' : newStatus === 'lost' ? 'lost' : `moved to ${PIPELINE_STAGES.find(s => s.id === newStatus)?.label || newStatus}`}`,
        p_description: `Lead status changed to ${PIPELINE_STAGES.find(s => s.id === newStatus)?.label || newStatus}`,
        p_activity_category: 'sales',
        p_contact_id: lead.contact_id,
      })

      onUpdate({ status: newStatus })
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  const getActivityIcon = (type: string) => {
    const icons: Record<string, string> = {
      email_received: '📥', email_sent: '📤',
      whatsapp_received: '💬', whatsapp_sent: '💬',
      social_post_published: '📸', review_received: '⭐',
      lead_created: '🎯', task_created: '📋',
    }
    return icons[type] || '📌'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold">
              {lead.contact?.name || 'Unknown'}
            </h2>
            <p className="text-sm text-gray-500">{lead.client?.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Status and Stage */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
              <select
                value={lead.status}
                onChange={(e) => changeStatus(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {PIPELINE_STAGES.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <div className="px-3 py-2 text-sm text-gray-600 bg-gray-50 rounded-md border border-gray-300">
                {SOURCE_LABELS[lead.source] || lead.source}
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Contact Info</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Email:</span>
                <p className="text-gray-900">{lead.contact?.email || 'Not provided'}</p>
              </div>
              <div>
                <span className="text-gray-500">Phone:</span>
                <p className="text-gray-900">{lead.contact?.phone || 'Not provided'}</p>
              </div>
            </div>
          </div>

          {/* Value */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Value</label>
              {!editingValue && (
                <button onClick={() => setEditingValue(true)} className="text-gray-400 hover:text-gray-600">
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>
            {editingValue ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">£</span>
                <input
                  type="number"
                  value={valueText}
                  onChange={(e) => setValueText(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveValue()
                    if (e.key === 'Escape') { setEditingValue(false); setValueText(String(lead.value)) }
                  }}
                />
                <button onClick={saveValue} disabled={savingValue} className="text-green-600 hover:text-green-700">
                  <Save className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-lg font-medium text-gray-900">
                <DollarSign className="w-4 h-4 text-gray-400" />
                £{lead.value.toLocaleString()}
              </div>
            )}
          </div>

          {/* Follow-up Date */}
          {lead.next_follow_up_date && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>Follow-up: {format(new Date(lead.next_follow_up_date), 'MMM d, yyyy')}</span>
            </div>
          )}

          {/* Won/Lost Reason */}
          {['won', 'lost'].includes(lead.status) && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700">
                  {lead.status === 'won' ? 'Won Reason' : 'Lost Reason'}
                </label>
                {!editingReason && (
                  <button onClick={() => setEditingReason(true)} className="text-gray-400 hover:text-gray-600">
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {editingReason ? (
                <div className="space-y-2">
                  <select
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select a reason...</option>
                    {(WON_LOST_REASONS as any)[lead.status]?.map((r: string) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={reasonText}
                      onChange={(e) => setReasonText(e.target.value)}
                      placeholder="Or type a custom reason..."
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button onClick={saveReason} disabled={savingReason} className="text-green-600 hover:text-green-700">
                      <Save className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600">{lead.won_lost_reason || 'No reason set'}</p>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Notes</label>
              {!editingNotes && (
                <button onClick={() => setEditingNotes(true)} className="text-gray-400 hover:text-gray-600">
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  ref={notesTextareaRef}
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Add notes..."
                  rows={4}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveNotes}
                    disabled={savingNotes}
                    className="px-3 py-1.5 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    {savingNotes ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditingNotes(false); setNotesText(lead.notes || '') }}
                    className="px-3 py-1.5 text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 whitespace-pre-wrap min-h-[2rem]">
                {lead.notes || 'No notes yet. Click edit to add notes.'}
              </p>
            )}
          </div>

          {/* Create Task */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">Follow-up Tasks</h3>
              <button
                onClick={() => setShowCreateTask(true)}
                className="text-sm text-indigo-600 hover:text-indigo-900 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Task
              </button>
            </div>

            {/* Create Task Form */}
            {showCreateTask && (
              <div className="bg-blue-50 rounded-lg p-4 space-y-3 mb-3">
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task title *"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {TASK_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateTask}
                    disabled={creatingTask || !taskTitle.trim()}
                    className="px-3 py-1.5 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {creatingTask ? 'Creating...' : 'Create Task'}
                  </button>
                  <button
                    onClick={() => setShowCreateTask(false)}
                    className="px-3 py-1.5 text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Related Activities */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Activity</h3>
            {loadingActivities ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : relatedActivities.length === 0 ? (
              <div className="text-sm text-gray-500">No related activity yet</div>
            ) : (
              <div className="space-y-2">
                {relatedActivities.map(activity => (
                  <div key={activity.id} className="flex items-start gap-3 p-2 bg-gray-50 rounded-md">
                    <span className="text-lg">{getActivityIcon(activity.activity_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="text-xs text-gray-500">
                        {activity.description} • {format(new Date(activity.occurred_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Created date */}
          <div className="text-xs text-gray-400 pt-2 border-t">
            Created {format(new Date(lead.created_at), 'MMM d, yyyy')}
            {lead.updated_at !== lead.created_at && ` • Updated ${format(new Date(lead.updated_at), 'MMM d, yyyy')}`}
          </div>
        </div>
      </div>
    </div>
  )
}
