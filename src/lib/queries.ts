import { getSupabaseAdmin } from './supabase'

// ==================== CLIENTS ====================

export async function getClients() {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Supabase error fetching clients:', error)
    throw new Error(`Failed to fetch clients: ${error.message}`)
  }
  
  // Ensure we always return an array, even if null
  return data || []
}

export async function getClient(id: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data
}

export async function createClientRecord(data: any) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: client, error } = await supabaseAdmin
    .from('clients')
    .insert([{
      business_name: data.business_name,
      contact_name: data.contact_name,
      email: data.email,
      phone: data.phone,
      website: data.website,
      instagram_handle: data.instagram_handle,
      facebook_page: data.facebook_page,
      linkedin_url: data.linkedin_url,
      industry: data.industry,
      timezone: data.timezone || 'Europe/Dublin',
      brand_profile: data.brand_profile || {},
      subscription_tier: data.subscription_tier || 'starter',
      status: 'active',
      onboarded_at: new Date().toISOString()
    }])
    .select()
    .single()
  
  if (error) throw error
  
  // Log activity
  await logActivity({
    client_id: client.id,
    product: 'taskifiai',
    activity_type: 'client_created',
    title: 'Client created',
    description: `${client.business_name} added to TaskifiAI`
  })
  
  return client
}

export async function updateClient(id: string, updates: any) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('clients')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function enableSocialDrive(clientId: string, accountData: any) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('clients')
    .update({
      socialdrive_enabled: true,
      socialdrive_account_id: accountData.account_id,
      socialdrive_upload_url: accountData.upload_url,
      socialdrive_dashboard_url: accountData.dashboard_url,
      socialdrive_status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('id', clientId)
    .select()
    .single()
  
  if (error) throw error
  
  // Log activity
  await logActivity({
    client_id: clientId,
    product: 'socialdrive-ai',
    activity_type: 'socialdrive_enabled',
    title: 'SocialDrive AI enabled',
    description: 'Sub-account created and linked'
  })
  
  return data
}

export async function enableDMChamp(clientId: string, accountData: any) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('clients')
    .update({
      dmchamp_enabled: true,
      dmchamp_account_id: accountData.account_id,
      dmchamp_login_url: accountData.login_url || 'https://app.dmchamp.com',
      dmchamp_status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('id', clientId)
    .select()
    .single()
  
  if (error) throw error
  
  // Log activity
  await logActivity({
    client_id: clientId,
    product: 'dm-champ',
    activity_type: 'dmchamp_enabled',
    title: 'DM Champ enabled',
    description: 'Sub-account created and linked'
  })
  
  return data
}

// ==================== ACTIVITIES ====================

export async function logActivity(data: {
  client_id: string
  product: string
  activity_type: string
  title?: string
  description?: string
  activity_category?: 'communication' | 'marketing' | 'support' | 'sales' | 'operations' | 'reputation'
  source?: string
  external_id?: string
  contact_id?: string
  occurred_at?: string
  details?: Record<string, unknown>
}) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: activity, error } = await (supabaseAdmin as any)
    .from('activities')
    .insert([{
      client_id: data.client_id,
      product: data.product,
      activity_type: data.activity_type,
      title: data.title,
      description: data.description,
      details: {
        ...(data.details || {}),
        ...(data.source ? { source: data.source } : {}),
        ...(data.external_id ? { external_id: data.external_id } : {}),
        ...(data.contact_id ? { contact_id: data.contact_id } : {}),
        ...(data.activity_category ? { activity_category: data.activity_category } : {}),
        ...(data.occurred_at ? { occurred_at: data.occurred_at } : {}),
      },
      created_at: new Date().toISOString()
    }] as any)
    .select()
    .single()
  
  if (error) throw error
  return activity
}

export async function findActivityByExternalId(clientId: string, externalId: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('activities')
    .select('*')
    .eq('client_id', clientId)
    .filter('details->>external_id', 'eq', externalId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getClientOwnerInfo(clientId: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('id, user_id')
    .eq('id', clientId)
    .single()

  if (error) throw error
  return data
}

export async function findContactForPromotion(data: {
  client_id: string
  email?: string | null
  phone?: string | null
  business_name?: string | null
}) {
  const supabaseAdmin = getSupabaseAdmin()

  if (data.email) {
    const { data: byEmail, error } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('client_id', data.client_id)
      .eq('email', data.email)
      .maybeSingle()

    if (error) throw error
    if (byEmail) return byEmail
  }

  if (data.phone) {
    const { data: byPhone, error } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('client_id', data.client_id)
      .eq('phone', data.phone)
      .maybeSingle()

    if (error) throw error
    if (byPhone) return byPhone
  }

  if (data.business_name) {
    const { data: byCompany, error } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('client_id', data.client_id)
      .eq('company_name', data.business_name)
      .limit(1)
      .maybeSingle()

    if (error) throw error
    if (byCompany) return byCompany
  }

  return null
}

export async function createContactForPromotion(data: {
  client_id: string
  name: string
  email?: string | null
  phone?: string | null
  business_name?: string | null
  notes?: string | null
  metadata?: Record<string, unknown>
}) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: contact, error } = await (supabaseAdmin as any)
    .from('contacts')
    .insert([{
      client_id: data.client_id,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      role: 'lead',
      company_name: data.business_name || null,
      notes: data.notes || null,
      metadata: data.metadata || {}
    }] as any)
    .select()
    .single()

  if (error) throw error
  return contact
}

export async function findOpenLeadForContact(contactId: string, clientId: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('contact_id', contactId)
    .eq('client_id', clientId)
    .in('status', ['new_lead', 'contacted', 'qualified', 'quoted', 'follow_up'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function findLeadByActivityId(activityId: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('activity_id', activityId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function createLeadRecord(data: {
  contact_id: string
  client_id: string
  source: 'gmail' | 'whatsapp' | 'instagram_dm' | 'facebook_dm' | 'website_form' | 'gbp_call' | 'manual' | 'totalsitedata'
  activity_id?: string | null
  assigned_user_id?: string | null
  status?: 'new_lead' | 'contacted' | 'qualified' | 'quoted' | 'follow_up' | 'won' | 'lost'
  value?: number
  notes?: string
}) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: lead, error } = await (supabaseAdmin as any)
    .from('leads')
    .insert([{
      contact_id: data.contact_id,
      client_id: data.client_id,
      source: data.source,
      activity_id: data.activity_id || null,
      assigned_user_id: data.assigned_user_id || null,
      status: data.status || 'new_lead',
      value: data.value || 0,
      notes: data.notes || ''
    }] as any)
    .select()
    .single()

  if (error) throw error
  return lead
}

export async function getClientActivities(clientId: string, limit = 50) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('activities')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) throw error
  return data
}

// ==================== PRODUCTS ====================

export async function getProducts() {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('active', true)
  
  if (error) throw error
  return data
}

export async function getProductBySlug(slug: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('slug', slug)
    .single()
  
  if (error) throw error
  return data
}

// ==================== SUBSCRIPTIONS ====================

export async function createSubscription(data: any) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: subscription, error } = await supabaseAdmin
    .from('subscriptions')
    .insert([{
      client_id: data.client_id,
      product_id: data.product_id,
      plan: data.plan || 'standard',
      status: 'active',
      monthly_price: data.monthly_price,
      setup_fee_paid: data.setup_fee_paid || 0,
      external_account_id: data.external_account_id,
      external_login_url: data.external_login_url,
      started_at: new Date().toISOString()
    }])
    .select()
    .single()
  
  if (error) throw error
  return subscription
}

// ==================== WEBHOOKS ====================

export async function logWebhook(data: {
  source_product: string
  event_type: string
  payload: any
}) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: webhook, error } = await supabaseAdmin
    .from('webhooks')
    .insert([{
      source_product: data.source_product,
      event_type: data.event_type,
      payload: data.payload,
      status: 'pending',
      created_at: new Date().toISOString()
    }])
    .select()
    .single()
  
  if (error) throw error
  return webhook
}

export async function markWebhookProcessed(webhookId: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from('webhooks')
    .update({
      status: 'processed',
      processed_at: new Date().toISOString()
    })
    .eq('id', webhookId)
  
  if (error) throw error
}

export async function markWebhookFailed(webhookId: string, errorMessage: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from('webhooks')
    .update({
      status: 'failed',
      error_message: errorMessage,
      processed_at: new Date().toISOString()
    })
    .eq('id', webhookId)
  
  if (error) throw error
}

// ==================== ACTIVITIES ====================

interface GetActivitiesOptions {
  limit?: number
  category?: string | null
}

interface ActivityResult {
  activities: any[]
  total: number
  hasMore: boolean
  error?: string
}

export async function getActivitiesByClient(
  clientId: string,
  options: GetActivitiesOptions = {}
): Promise<ActivityResult> {
  const { limit = 50, category = null } = options
  const supabaseAdmin = getSupabaseAdmin()

  let query = supabaseAdmin
    .from('activities')
    .select(
      `
      id,
      activity_type,
      activity_category,
      title,
      description,
      source,
      details,
      occurred_at,
      created_at,
      contacts (
        id,
        name,
        email,
        phone
      )
    `,
      { count: 'exact' }
    )
    .eq('client_id', clientId)
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (category) {
    query = query.eq('activity_category', category)
  }

  const { data: activities, error, count } = await query

  if (error) {
    console.error('Supabase error fetching activities:', error)
    return { activities: [], total: 0, hasMore: false, error: error.message }
  }

  return {
    activities: activities || [],
    total: count || 0,
    hasMore: (count || 0) > limit
  }
}
