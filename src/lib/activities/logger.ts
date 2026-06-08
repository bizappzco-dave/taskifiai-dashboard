/**
 * Activity Logger — Unified activity logging for TaskifiAI
 * 
 * Usage:
 *   import { logActivity } from '@/lib/activities/logger'
 *   
 *   await logActivity({
 *     clientId,
 *     type: 'review_received',
 *     title: 'New 5-star review',
 *     details: { rating: 5, author: 'John' }
 *   })
 */

import { getSupabase } from '@/lib/supabase'

export interface ActivityLog {
  clientId: string
  type: string
  title: string
  description?: string
  category?: 'communication' | 'marketing' | 'support' | 'sales' | 'operations' | 'reputation'
  source?: string
  externalId?: string
  contactId?: string
  details?: Record<string, any>
}

/**
 * Log an activity to the unified activity feed
 */
export async function logActivity(activity: ActivityLog): Promise<string | null> {
  try {
    const supabase = getSupabase()
    
    const { data, error } = await supabase.rpc('log_activity', {
      p_client_id: activity.clientId,
      p_activity_type: activity.type,
      p_title: activity.title,
      p_description: activity.description || null,
      p_activity_category: activity.category || null,
      p_source: activity.source || null,
      p_external_id: activity.externalId || null,
      p_contact_id: activity.contactId || null,
      p_details: activity.details ? JSON.stringify(activity.details) : null
    })
    
    if (error) {
      console.error('Failed to log activity:', error)
      return null
    }
    
    return data
  } catch (error) {
    console.error('Error logging activity:', error)
    return null
  }
}

/**
 * Get recent activities for a client
 */
export async function getRecentActivities(clientId: string, limit = 50) {
  try {
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('recent_activities')
      .select('*')
      .eq('client_id', clientId)
      .order('occurred_at', { ascending: false })
      .limit(limit)
    
    if (error) {
      console.error('Failed to fetch activities:', error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Error fetching activities:', error)
    return []
  }
}

/**
 * Get activity summary for a client (last 7 days)
 */
export async function getActivitySummary(clientId: string) {
  try {
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('client_activity_summary')
      .select('*')
      .eq('client_id', clientId)
      .single()
    
    if (error) {
      console.error('Failed to fetch activity summary:', error)
      return null
    }
    
    return data
  } catch (error) {
    console.error('Error fetching activity summary:', error)
    return null
  }
}

/**
 * Activity type helpers for consistent logging
 */
export const ActivityTypes = {
  // Communication
  EMAIL_RECEIVED: 'email_received',
  EMAIL_SENT: 'email_sent',
  WHATSAPP_RECEIVED: 'whatsapp_received',
  WHATSAPP_SENT: 'whatsapp_sent',
  FACEBOOK_DM_RECEIVED: 'facebook_dm_received',
  FACEBOOK_DM_SENT: 'facebook_dm_sent',
  INSTAGRAM_DM_RECEIVED: 'instagram_dm_received',
  INSTAGRAM_DM_SENT: 'instagram_dm_sent',
  CALL_RECEIVED: 'call_received',
  CALL_MADE: 'call_made',
  
  // Marketing
  GBP_POST_PUBLISHED: 'gbp_post_published',
  SOCIAL_POST_PUBLISHED: 'social_post_published',
  CONTENT_UPLOADED: 'content_uploaded',
  
  // Reputation
  REVIEW_RECEIVED: 'review_received',
  REVIEW_REPLIED: 'review_replied',
  REVIEW_FLAGGED: 'review_flagged',
  
  // Sales
  LEAD_CREATED: 'lead_created',
  QUOTE_REQUESTED: 'quote_requested',
  QUOTE_SENT: 'quote_sent',
  DEAL_WON: 'deal_won',
  DEAL_LOST: 'deal_lost',
  
  // Operations
  SITE_VISIT_SCHEDULED: 'site_visit_scheduled',
  SERVICE_COMPLETED: 'service_completed',
  TASK_CREATED: 'task_created',
  TASK_COMPLETED: 'task_completed',
  STAFF_LOGIN: 'staff_login'
} as const

/**
 * Category helpers
 */
export const ActivityCategories = {
  COMMUNICATION: 'communication',
  MARKETING: 'marketing',
  SUPPORT: 'support',
  SALES: 'sales',
  OPERATIONS: 'operations',
  REPUTATION: 'reputation'
} as const
