'use client'

import { useEffect, useState } from 'react'

interface Activity {
  id: string
  activity_type: string
  activity_category: string
  title: string
  description: string | null
  source: string | null
  details: any
  occurred_at: string
  created_at: string
  contacts: {
    id: string
    name: string
    email: string | null
    phone: string | null
  } | null
}

interface ActivityFeedProps {
  clientId: string
}

// Map activity types to icons and colors
function getActivityIcon(activityType: string): { emoji: string; color: string } {
  const map: Record<string, { emoji: string; color: string }> = {
    // Communication
    'email_received': { emoji: '📥', color: 'bg-blue-100 text-blue-700' },
    'email_sent': { emoji: '📤', color: 'bg-blue-100 text-blue-700' },
    'whatsapp_received': { emoji: '💬', color: 'bg-green-100 text-green-700' },
    'whatsapp_sent': { emoji: '💬', color: 'bg-green-100 text-green-700' },
    'facebook_dm_received': { emoji: '👤', color: 'bg-blue-100 text-blue-700' },
    'facebook_dm_sent': { emoji: '👤', color: 'bg-blue-100 text-blue-700' },
    'instagram_dm_received': { emoji: '📷', color: 'bg-pink-100 text-pink-700' },
    'instagram_dm_sent': { emoji: '📷', color: 'bg-pink-100 text-pink-700' },
    'call_received': { emoji: '📞', color: 'bg-purple-100 text-purple-700' },
    'call_made': { emoji: '📞', color: 'bg-purple-100 text-purple-700' },
    // Marketing
    'social_post_published': { emoji: '📸', color: 'bg-indigo-100 text-indigo-700' },
    'gbp_post_published': { emoji: '📍', color: 'bg-yellow-100 text-yellow-700' },
    'content_uploaded': { emoji: '📁', color: 'bg-gray-100 text-gray-700' },
    'content_generated': { emoji: '✨', color: 'bg-purple-100 text-purple-700' },
    // Reputation
    'review_received': { emoji: '⭐', color: 'bg-yellow-100 text-yellow-700' },
    'review_replied': { emoji: '💬', color: 'bg-yellow-100 text-yellow-700' },
    'review_flagged': { emoji: '🚩', color: 'bg-red-100 text-red-700' },
    // Sales
    'lead_created': { emoji: '🎯', color: 'bg-orange-100 text-orange-700' },
    'quote_requested': { emoji: '💰', color: 'bg-green-100 text-green-700' },
    'quote_sent': { emoji: '📄', color: 'bg-green-100 text-green-700' },
    'deal_won': { emoji: '🏆', color: 'bg-green-100 text-green-700' },
    'deal_lost': { emoji: '❌', color: 'bg-red-100 text-red-700' },
    // Operations
    'contact_created': { emoji: '👤', color: 'bg-gray-100 text-gray-700' },
    'client_created': { emoji: '🏢', color: 'bg-gray-100 text-gray-700' },
    'socialdrive_enabled': { emoji: '🚀', color: 'bg-indigo-100 text-indigo-700' },
    'dmchamp_enabled': { emoji: '💬', color: 'bg-green-100 text-green-700' },
    'onboarding_completed': { emoji: '✅', color: 'bg-green-100 text-green-700' },
    'task_created': { emoji: '📋', color: 'bg-gray-100 text-gray-700' },
    'task_completed': { emoji: '✅', color: 'bg-green-100 text-green-700' },
    'site_visit_scheduled': { emoji: '📅', color: 'bg-blue-100 text-blue-700' },
    'service_completed': { emoji: '🔧', color: 'bg-gray-100 text-gray-700' },
    'staff_login': { emoji: '🔑', color: 'bg-gray-100 text-gray-700' },
  }

  return map[activityType] || { emoji: '📌', color: 'bg-gray-100 text-gray-700' }
}

function timeAgo(date: string): string {
  const now = new Date()
  const then = new Date(date)
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000)

  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(date).toLocaleDateString()
}

function groupByDate(activities: Activity[]): Record<string, Activity[]> {
  const groups: Record<string, Activity[]> = {}
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  activities.forEach(activity => {
    const occurred = new Date(activity.occurred_at)
    const diffDays = Math.floor((today.getTime() - occurred.getTime()) / 86400000)

    let group: string
    if (diffDays === 0) {
      group = 'Today'
    } else if (diffDays === 1) {
      group = 'Yesterday'
    } else if (diffDays < 7) {
      group = 'This Week'
    } else {
      group = 'Older'
    }

    if (!groups[group]) {
      groups[group] = []
    }
    groups[group].push(activity)
  })

  // Maintain order
  const ordered: Record<string, Activity[]> = {}
  for (const key of ['Today', 'Yesterday', 'This Week', 'Older']) {
    if (groups[key]) {
      ordered[key] = groups[key]
    }
  }
  return ordered
}

const categories = [
  { value: null, label: 'All' },
  { value: 'communication', label: 'Communication' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'reputation', label: 'Reputation' },
  { value: 'sales', label: 'Sales' },
  { value: 'operations', label: 'Operations' },
] as const

export default function ActivityFeed({ clientId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchActivities = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        limit: '50',
        ...(category ? { category } : {}),
      })

      const res = await fetch(`/api/clients/${clientId}/activities?${params}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load activities')
      }

      setActivities(data.activities || [])
      setTotal(data.total || 0)
      setHasMore(data.hasMore || false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activities')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActivities()
  }, [clientId, category])

  const groupedActivities = groupByDate(activities)

  if (loading) {
    return (
      <div className="bg-white shadow sm:rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-16 bg-gray-100 rounded"></div>
          <div className="h-16 bg-gray-100 rounded"></div>
          <div className="h-16 bg-gray-100 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white shadow sm:rounded-lg p-6">
        <div className="text-red-600">
          <p>{error}</p>
          <button
            onClick={fetchActivities}
            className="mt-2 text-sm text-indigo-600 hover:text-indigo-900"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="bg-white shadow sm:rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Activity Feed</h3>
        <p className="text-gray-500 text-center py-8">
          No activities yet. Activities from DM Champ, SocialDrive AI, and CRM actions will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white shadow sm:rounded-lg">
      {/* Header */}
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Activity Feed</h3>
            <p className="text-sm text-gray-500">{total} total activities</p>
          </div>
          {/* Category Filter */}
          <select
            value={category || ''}
            onChange={(e) => setCategory(e.target.value || null)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {categories.map(cat => (
              <option key={cat.value || 'all'} value={cat.value || ''}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-4 space-y-6">
        {Object.entries(groupedActivities).map(([dateGroup, groupActivities]) => (
          <div key={dateGroup}>
            {/* Date Header */}
            <div className="sticky top-0 bg-white py-2 pb-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {dateGroup}
              </span>
            </div>

            {/* Activity Cards */}
            <div className="space-y-3">
              {groupActivities.map((activity) => {
                const icon = getActivityIcon(activity.activity_type)
                const contact = activity.contacts

                return (
                  <div
                    key={activity.id}
                    className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full ${icon.color} flex items-center justify-center text-lg`}>
                      {icon.emoji}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">
                          {activity.title}
                        </p>
                        <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                          {timeAgo(activity.occurred_at)}
                        </span>
                      </div>

                      {/* Contact info */}
                      {contact && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {contact.name}
                          {contact.email && (
                            <span className="ml-1">• {contact.email}</span>
                          )}
                        </p>
                      )}

                      {/* Description */}
                      {activity.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {activity.description}
                        </p>
                      )}

                      {/* Metadata badges */}
                      <div className="flex items-center gap-2 mt-2">
                        {activity.activity_category && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                            {activity.activity_category}
                          </span>
                        )}
                        {activity.source && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600 capitalize">
                            {activity.source}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
