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
  details?: any
}) {
  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from('activities')
    .insert([{
      client_id: data.client_id,
      product: data.product,
      activity_type: data.activity_type,
      title: data.title,
      description: data.description,
      details: data.details || {},
      created_at: new Date().toISOString()
    }])
  
  if (error) throw error
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
