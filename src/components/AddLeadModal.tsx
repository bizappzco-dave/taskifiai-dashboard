'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Search } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'

interface Client {
  id: string
  name: string
  industry: string
}

interface Contact {
  id: string
  name: string
  email: string | null
  phone: string | null
  client_id: string
}

interface AddLeadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const LEAD_SOURCES = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'gmail', label: 'Gmail' },
  { value: 'instagram_dm', label: 'Instagram DM' },
  { value: 'facebook_dm', label: 'Facebook DM' },
  { value: 'website_form', label: 'Website Form' },
  { value: 'gbp_call', label: 'GBP Call' },
  { value: 'manual', label: 'Manual' },
]

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

export default function AddLeadModal({ isOpen, onClose, onSuccess }: AddLeadModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [searchingContact, setSearchingContact] = useState(false)

  // Form state
  const [clientId, setClientId] = useState('')
  const [contactId, setContactId] = useState('')
  const [contactSearch, setContactSearch] = useState('')
  const [source, setSource] = useState('manual')
  const [value, setValue] = useState('')
  const [status, setStatus] = useState('new_lead')
  const [nextFollowUpDate, setNextFollowUpDate] = useState('')
  const [notes, setNotes] = useState('')
  const [wonLostReason, setWonLostReason] = useState('')

  // New contact form
  const [createNewContact, setCreateNewContact] = useState(false)
  const [newContactName, setNewContactName] = useState('')
  const [newContactEmail, setNewContactEmail] = useState('')
  const [newContactPhone, setNewContactPhone] = useState('')

  const supabase = getSupabase()

  // Load clients when modal opens
  useEffect(() => {
    if (isOpen) {
      loadClients()
      resetForm()
    }
  }, [isOpen])

  // Search contacts when selected client changes or search changes
  useEffect(() => {
    if (clientId && contactSearch.trim().length >= 2) {
      searchContacts(contactSearch)
    }
  }, [clientId, contactSearch])

  const loadClients = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('clients')
        .select('id, name, industry')
        .eq('user_id', user.id)
        .order('name')

      if (!error && data) {
        setClients(data)
        if (data.length > 0 && !clientId) {
          setClientId(data[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to load clients:', err)
    }
  }

  const searchContacts = async (query: string) => {
    setSearchingContact(true)
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, email, phone, client_id')
        .eq('client_id', clientId)
        .ilike('name', `%${query}%`)
        .limit(10)

      if (!error && data) {
        setContacts(data)
      }
    } catch (err) {
      console.error('Failed to search contacts:', err)
    } finally {
      setSearchingContact(false)
    }
  }

  const resetForm = () => {
    setClientId('')
    setContactId('')
    setContactSearch('')
    setSource('manual')
    setValue('')
    setStatus('new_lead')
    setNextFollowUpDate('')
    setNotes('')
    setWonLostReason('')
    setCreateNewContact(false)
    setNewContactName('')
    setNewContactEmail('')
    setNewContactPhone('')
    setError(null)
    setContacts([])
  }

  const handleCreateContact = async () => {
    if (!newContactName.trim() || !clientId) {
      setError('Contact name and client are required')
      return
    }

    try {
      const { data: contact, error } = await supabase
        .from('contacts')
        .insert([
          {
            client_id: clientId,
            name: newContactName.trim(),
            email: newContactEmail.trim() || null,
            phone: newContactPhone.trim() || null,
          }
        ])
        .select()
        .single()

      if (error) throw error

      setContactId(contact.id)
      setCreateNewContact(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create contact')
    }
  }

  const handleSubmit = async () => {
    if (!clientId) {
      setError('Client is required')
      return
    }

    if (!contactId) {
      setError('Contact is required (search existing or create new)')
      return
    }

    if (['won', 'lost'].includes(status) && !wonLostReason) {
      setError('Won/Lost reason is required when marking a lead as won or lost')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Build the lead record
      const leadData: any = {
        contact_id: contactId,
        client_id: clientId,
        source,
        value: value ? parseFloat(value) : 0,
        status,
        notes: notes.trim() || '',
        won_lost_reason: wonLostReason || '',
      }

      if (nextFollowUpDate) {
        leadData.next_follow_up_date = new Date(nextFollowUpDate).toISOString()
      }

      const { data: lead, error } = await supabase
        .from('leads')
        .insert([leadData])
        .select()
        .single()

      if (error) throw error

      // Log activity for the new lead
      await supabase.rpc('log_activity', {
        p_client_id: clientId,
        p_activity_type: 'lead_created',
        p_title: `New lead: ${contactName()}`,
        p_description: `Lead created manually - ${LEAD_SOURCES.find(s => s.value === source)?.label}`,
        p_activity_category: 'sales',
        p_contact_id: contactId,
        p_details: JSON.stringify({ source, value: leadData.value })
      })

      // Reset and close
      resetForm()
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lead')
      setLoading(false)
    }
  }

  const contactName = () => {
    const contact = contacts.find(c => c.id === contactId)
    return contact?.name || newContactName || 'Unknown'
  }

  if (!isOpen) return null

  const selectedClient = clients.find(c => c.id === clientId)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold">Add Lead</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client *
            </label>
            <select
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); setContactId(''); setContacts([]) }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select a client</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name}{client.industry ? ` (${client.industry})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Contact */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact *
            </label>

            {!createNewContact ? (
              <>
                {/* Search existing */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search by name..."
                    className="w-full pl-9 rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Search results */}
                {contactSearch.trim().length >= 2 && (
                  <div className="mt-2 border rounded-md max-h-40 overflow-y-auto">
                    {searchingContact ? (
                      <div className="px-3 py-2 text-sm text-gray-500">Searching...</div>
                    ) : contacts.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">No contacts found</div>
                    ) : (
                      contacts.map(contact => (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => { setContactId(contact.id); setContactSearch(contact.name) }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-0 ${contactId === contact.id ? 'bg-indigo-50' : ''}`}
                        >
                          <div className="font-medium">{contact.name}</div>
                          <div className="text-gray-500 text-xs">
                            {contact.email || ''} {contact.phone ? `• ${contact.phone}` : ''}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Selected contact */}
                {contactId && (
                  <div className="mt-2 p-2 bg-gray-50 rounded-md">
                    <span className="text-sm text-gray-600">Selected: </span>
                    <span className="text-sm font-medium">{contactName()}</span>
                  </div>
                )}

                {/* Create new contact */}
                <button
                  type="button"
                  onClick={() => setCreateNewContact(true)}
                  className="mt-2 text-sm text-indigo-600 hover:text-indigo-900"
                >
                  + Create new contact
                </button>
              </>
            ) : (
              /* New contact form */
              <div className="space-y-3 p-3 border rounded-md bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">New Contact</span>
                  <button
                    type="button"
                    onClick={() => setCreateNewContact(false)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
                <input
                  type="text"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="Name *"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <input
                  type="email"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <input
                  type="tel"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  placeholder="Phone"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleCreateContact}
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Create Contact
                </button>
              </div>
            )}
          </div>

          {/* Source and Value row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {LEAD_SOURCES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Value (£)</label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0"
                min="0"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Status and Follow-up date row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); if (e.target.value !== 'won' && e.target.value !== 'lost') setWonLostReason('') }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="new_lead">New Lead</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="quoted">Quoted</option>
                <option value="follow_up">Follow-up</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Date</label>
              <input
                type="date"
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Won/Lost reason */}
          {['won', 'lost'].includes(status) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {status === 'won' ? 'Won Reason' : 'Lost Reason'} *
              </label>
              <select
                value={wonLostReason}
                onChange={(e) => setWonLostReason(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select a reason...</option>
                {(WON_LOST_REASONS as any)[status]?.map((reason: string) => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
              {/* Custom reason */}
              <input
                type="text"
                value={wonLostReason}
                onChange={(e) => setWonLostReason(e.target.value)}
                placeholder="Or type a custom reason..."
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context..."
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {loading ? 'Creating...' : 'Create Lead'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
