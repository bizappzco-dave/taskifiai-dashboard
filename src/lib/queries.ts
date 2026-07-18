import { getSupabaseAdmin } from './supabase'

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function parseBillingCycle(value: unknown): 'monthly' | 'one_off' {
  const normalized = String(value || '').toLowerCase().replace(/[\s_-]/g, '')
  return normalized === 'oneoff' || normalized === 'onetime' || normalized === 'onetimesetup' || normalized === 'once'
    ? 'one_off'
    : 'monthly'
}

// ==================== CLIENTS ====================

export async function getClients() {
  const supabaseAdmin = getSupabaseAdmin() as any
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

function clientWithOnboardingFields(client: any, contact?: any, brandContext?: any, products: any[] = []) {
  const features = client?.features || {}
  const contactDetails = features.contact || {}
  const social = features.social || {}
  const onboarding = features.onboarding || {}

  return {
    ...client,
    business_name: client?.business_name || client?.name,
    subscription_tier: client?.subscription_tier || client?.tier,
    contact_name: contact?.name || contactDetails.name,
    email: contact?.email || contactDetails.email,
    phone: contact?.phone || contactDetails.phone,
    website: contactDetails.website,
    instagram_handle: social.instagram_handle,
    facebook_handle: social.facebook_handle,
    linkedin_handle: social.linkedin_handle,
    brand_tone: brandContext?.brand_voice || onboarding.brand_tone,
    target_audience: onboarding.target_audience,
    usps: onboarding.usps,
    competitors: onboarding.competitors,
    content_goals: onboarding.content_goals,
    posting_frequency: onboarding.posting_frequency,
    subscription_description: client?.subscription_description,
    subscription_billing_cycle: client?.billing_cycle,
    subscription_price: client?.monthly_revenue,
    products,
  }
}

export async function getClient(id: string) {
  const supabaseAdmin = getSupabaseAdmin() as any
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error

  const [{ data: contact }, { data: brandContext }, products] = await Promise.all([
    (supabaseAdmin as any)
      .from('contacts')
      .select('*')
      .eq('client_id', id)
      .eq('is_primary', true)
      .maybeSingle(),
    (supabaseAdmin as any)
      .from('brand_contexts')
      .select('*')
      .eq('client_id', id)
      .maybeSingle(),
    getClientProducts(id),
  ])

  const features = normalizeClientFeatures(data, products)
  return clientWithOnboardingFields({ ...data, features }, contact, brandContext, products)
}

export async function createClientRecord(data: any, userId: string) {
  const supabaseAdmin = getSupabaseAdmin() as any
  const features = {
    contact: {
      name: data.contact_name || null,
      email: data.email || null,
      phone: data.phone || null,
      website: data.website || null,
    },
    social: {
      instagram_handle: data.instagram_handle || null,
      facebook_handle: data.facebook_handle || null,
      linkedin_handle: data.linkedin_handle || null,
    },
    onboarding: {
      brand_tone: data.brand_tone || null,
      target_audience: data.target_audience || null,
      usps: data.usps || null,
      competitors: data.competitors || null,
      content_goals: data.content_goals || null,
      posting_frequency: data.posting_frequency || null,
    },
  }

  const { data: client, error } = await supabaseAdmin
    .from('clients')
    .insert([{
      user_id: userId,
      name: data.business_name,
      industry: data.industry,
      tier: data.subscription_tier || 'starter',
      billing_cycle: parseBillingCycle(data.billing_cycle || data.subscription_billing_cycle),
      monthly_revenue: parseNumber(data.monthly_revenue || data.subscription_price),
      subscription_description: data.subscription_description || null,
      features,
    }])
    .select()
    .single()
  
  if (error) throw error

  const contactPayload = {
    client_id: client.id,
    name: data.contact_name || data.business_name,
    email: data.email || null,
    phone: data.phone || null,
    role: 'owner',
    is_primary: true,
    company_name: data.business_name,
    metadata: {
      source: 'client_onboarding',
      website: data.website || null,
    },
  }

  const { data: contact, error: contactError } = await (supabaseAdmin as any)
    .from('contacts')
    .insert([contactPayload] as any)
    .select()
    .single()

  if (contactError) throw contactError

  const brandContextPayload = {
    client_id: client.id,
    brand_voice: data.brand_tone || null,
    content_styles: data.brand_tone ? [{ label: 'Onboarding tone', value: data.brand_tone }] : [],
    hashtag_strategy: {},
    caption_library: [],
    posting_cadence: data.posting_frequency ? { frequency: data.posting_frequency } : {},
    image_matching: [],
    assets_reference: data.website || null,
  }

  const { data: brandContext, error: brandContextError } = await (supabaseAdmin as any)
    .from('brand_contexts')
    .insert([brandContextPayload] as any)
    .select()
    .single()

  if (brandContextError) throw brandContextError
  
  // Log activity
  await logActivity({
    client_id: client.id,
    product: 'taskifiai',
    activity_type: 'client_created',
    title: 'Client created',
    description: `${client.name} added to TaskifiAI`
  })
  
  return clientWithOnboardingFields(client, contact, brandContext)
}

export async function updateClient(id: string, updates: any) {
  const supabaseAdmin = getSupabaseAdmin() as any
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
  const supabaseAdmin = getSupabaseAdmin() as any
  const uploadToken = accountData.upload_token || accountData.uploadToken || null
  const reviewToken = accountData.review_token || accountData.reviewToken || null
  const { data, error } = await supabaseAdmin
    .from('clients')
    .update({
      upload_token: uploadToken,
      review_token: reviewToken,
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
    description: 'Upload and review links enabled',
    details: {
      upload_url: accountData.upload_url || (uploadToken ? `https://socialdrive-ai.vercel.app/upload/${uploadToken}` : null),
      review_url: accountData.dashboard_url || (reviewToken ? `https://socialdrive-ai.vercel.app/review?token=${reviewToken}` : null),
    }
  })
  
  return data
}

export async function enableDMChamp(clientId: string, accountData: any) {
  const supabaseAdmin = getSupabaseAdmin() as any
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

const ULTRA_MARKETING_WORKFLOWS = [
  'marketing_analysis',
  'social_content_drafts',
  'email_campaign_drafts',
  'gbp_post_drafts',
  'review_response_drafts',
  'paid_ads_intelligence',
  'approval_queue',
]

function objectOrEmpty(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
}

function withProductFeature(
  client: any,
  productKey: string,
  feature: Record<string, any>
): Record<string, any> {
  const features = objectOrEmpty(client?.features)
  const products = objectOrEmpty(features.products)

  return {
    ...features,
    products: {
      ...products,
      [productKey]: {
        ...objectOrEmpty(products[productKey]),
        ...feature,
      },
    },
  }
}

function productFeatureKey(slug: string): string {
  return slug.replace(/-/g, '_')
}

function normalizeClientFeatures(client: any, products: any[] = []): Record<string, any> {
  const features = objectOrEmpty(client?.features)
  const existingProducts = objectOrEmpty(features.products)

  const productFeatures = products.reduce((acc: Record<string, any>, product: any) => {
    if (!product?.slug) return acc

    const key = productFeatureKey(product.slug)
    const existingProduct = objectOrEmpty(existingProducts[key])
    acc[key] = {
      ...existingProduct,
      status: product.status || 'active',
      product_id: product.id,
      subscription_id: product.subscription_id,
      tier: product.plan || existingProduct.tier || null,
      enabled_at: product.started_at || existingProduct.enabled_at || null,
    }

    return acc
  }, {})

  return {
    ...features,
    products: {
      ...existingProducts,
      ...productFeatures,
    },
  }
}

export async function enableUltraMarketing(clientId: string, options: { tier?: string; enabled_by?: string | null } = {}) {
  const client = await getClient(clientId)
  const now = new Date().toISOString()
  const existingFeature = objectOrEmpty(client?.features?.products?.ultra_marketing || client?.features?.ultra_marketing)
  const tier = options.tier || existingFeature.tier || client?.subscription_tier || client?.tier || 'growth'
  const features = withProductFeature(client, 'ultra_marketing', {
    status: 'active',
    tier,
    enabled_at: existingFeature.enabled_at || now,
    enabled_by: options.enabled_by || existingFeature.enabled_by || null,
    approval_policy: existingFeature.approval_policy || 'approval_required_for_external_actions',
    allowed_workflows: Array.isArray(existingFeature.allowed_workflows)
      ? existingFeature.allowed_workflows
      : ULTRA_MARKETING_WORKFLOWS,
    connected_account_status: objectOrEmpty(existingFeature.connected_account_status),
  })

  await updateClient(clientId, { features })

  await logActivity({
    client_id: clientId,
    product: 'ultra-marketing',
    activity_type: 'ultra_marketing_enabled',
    title: 'Ultra Marketing enabled',
    description: '24/7 AI Marketing Assistant workspace access enabled',
    activity_category: 'operations',
    details: {
      tier,
      approval_policy: 'approval_required_for_external_actions',
    },
  })

  return getClient(clientId)
}

export async function disableUltraMarketing(clientId: string, options: { disabled_by?: string | null } = {}) {
  const client = await getClient(clientId)
  const now = new Date().toISOString()
  const existingFeature = objectOrEmpty(client?.features?.products?.ultra_marketing || client?.features?.ultra_marketing)
  const features = withProductFeature(client, 'ultra_marketing', {
    ...existingFeature,
    status: 'paused',
    paused_at: now,
    disabled_by: options.disabled_by || existingFeature.disabled_by || null,
  })

  const updatedClient = await updateClient(clientId, { features })

  await logActivity({
    client_id: clientId,
    product: 'ultra-marketing',
    activity_type: 'ultra_marketing_paused',
    title: 'Ultra Marketing paused',
    description: 'Ultra Marketing Assistant workspace access paused',
    activity_category: 'operations',
  })

  return updatedClient
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
  const supabaseAdmin = getSupabaseAdmin() as any
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
  const supabaseAdmin = getSupabaseAdmin() as any
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
  const supabaseAdmin = getSupabaseAdmin() as any
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
  const supabaseAdmin = getSupabaseAdmin() as any

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
  const supabaseAdmin = getSupabaseAdmin() as any
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
  const supabaseAdmin = getSupabaseAdmin() as any
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
  const supabaseAdmin = getSupabaseAdmin() as any
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
  const supabaseAdmin = getSupabaseAdmin() as any
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
  const supabaseAdmin = getSupabaseAdmin() as any
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
  const supabaseAdmin = getSupabaseAdmin() as any
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('active', true)
  
  if (error) throw error
  return data
}

export async function getProductBySlug(slug: string) {
  const supabaseAdmin = getSupabaseAdmin() as any
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getClientProducts(clientId: string) {
  const supabaseAdmin = getSupabaseAdmin() as any
  const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .order('started_at', { ascending: false })

  if (subscriptionsError) throw subscriptionsError
  if (!subscriptions?.length) return []

  const productIds = Array.from(new Set(
    subscriptions.map((subscription: any) => subscription.product_id).filter(Boolean)
  ))

  if (!productIds.length) return []

  const { data: products, error: productsError } = await supabaseAdmin
    .from('products')
    .select('id, name, slug, description, active')
    .in('id', productIds)

  if (productsError) throw productsError

  const productsById = new Map((products || []).map((product: any) => [product.id, product]))

  return subscriptions
    .map((subscription: any) => {
      const product = productsById.get(subscription.product_id) as Record<string, any> | undefined
      if (!product) return null

      return {
        ...product,
        subscription_id: subscription.id,
        status: subscription.status,
        plan: subscription.plan,
        billing_model: subscription.billing_model,
        monthly_price: subscription.monthly_price,
        external_login_url: subscription.external_login_url,
        started_at: subscription.started_at,
        cancelled_at: subscription.cancelled_at,
      }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => String(a.slug).localeCompare(String(b.slug)))
}

export async function hasClientProduct(clientId: string, productSlug: string) {
  const products = await getClientProducts(clientId)
  return products.some((product: any) => product.slug === productSlug)
}

export async function getClientFeatures(clientId: string) {
  const supabaseAdmin = getSupabaseAdmin() as any
  const [{ data: client, error }, products] = await Promise.all([
    supabaseAdmin
      .from('clients')
      .select('features')
      .eq('id', clientId)
      .single(),
    getClientProducts(clientId),
  ])

  if (error) throw error
  return normalizeClientFeatures(client, products)
}

// ==================== SUBSCRIPTIONS ====================

export async function createSubscription(data: any) {
  const supabaseAdmin = getSupabaseAdmin() as any

  if (data.client_id && data.product_id && data.status !== 'cancelled') {
    const { data: existing } = await (supabaseAdmin as any)
      .from('subscriptions')
      .select('*')
      .eq('client_id', data.client_id)
      .eq('product_id', data.product_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      return existing
    }
  }

  const { data: subscription, error } = await supabaseAdmin
    .from('subscriptions')
    .insert([{
      client_id: data.client_id,
      product_id: data.product_id,
      plan: data.plan || 'standard',
      status: 'active',
      monthly_price: parseNumber(data.monthly_price),
      plan_description: data.plan_description || data.subscription_description || null,
      billing_model: data.billing_model || data.billing_cycle || 'monthly',
      currency: data.currency || 'EUR',
      external_payment_id: data.external_payment_id || null,
      setup_fee_paid: data.setup_fee_paid || 0,
      external_account_id: data.external_account_id,
      external_login_url: data.external_login_url,
      metadata: data.metadata || {},
      started_at: new Date().toISOString()
    }])
    .select()
    .single()
  
  if (error) throw error
  return subscription
}

export async function cancelActiveSubscriptionsForProductSlug(clientId: string, productSlug: string) {
  const supabaseAdmin = getSupabaseAdmin() as any
  const product: { id?: string } | null = await getProductBySlug(productSlug) as { id?: string } | null
  if (!product?.id) return []

  const cancelledAt = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: cancelledAt,
      updated_at: cancelledAt,
    })
    .eq('client_id', clientId)
    .eq('product_id', product.id)
    .eq('status', 'active')
    .select()

  if (error) throw error
  return data || []
}

export async function createInvoice(data: any) {
  const supabaseAdmin = getSupabaseAdmin() as any

  const paymentReference = data.provider_payment_id
  if (paymentReference) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('provider_payment_id', paymentReference)
      .maybeSingle()

    if (existingError) throw existingError
    if (existing) return existing
  }

  const invoiceNumber = data.invoice_number || `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`

  const { data: invoice, error } = await supabaseAdmin
    .from('invoices')
    .insert([{
      client_id: data.client_id,
      subscription_id: data.subscription_id || null,
      product_id: data.product_id || null,
      invoice_number: invoiceNumber,
      status: data.status || 'issued',
      billing_model: data.billing_model || 'monthly',
      amount: parseNumber(data.amount) || 0,
      currency: data.currency || 'EUR',
      provider: data.provider || 'revolut',
      provider_payment_id: paymentReference || null,
      description: data.description || 'Subscription fee',
      document_html: data.document_html || null,
      issued_at: data.issued_at || new Date().toISOString(),
      paid_at: data.paid_at || null,
      metadata: data.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }])
    .select()
    .single()

  if (error) throw error
  return invoice
}

export async function getInvoicesForClient(clientId: string) {
  const supabaseAdmin = getSupabaseAdmin() as any
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('client_id', clientId)
    .order('issued_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getInvoiceByProviderPaymentId(providerPaymentId: string) {
  const supabaseAdmin = getSupabaseAdmin() as any
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('provider_payment_id', providerPaymentId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getInvoiceById(invoiceId: string) {
  const supabaseAdmin = getSupabaseAdmin() as any
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single()

  if (error) throw error
  return data
}

export async function setInvoiceDocument(invoiceId: string, documentHtml: string) {
  const supabaseAdmin = getSupabaseAdmin() as any
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .update({
      document_html: documentHtml,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
    .select()
    .single()

  if (error) throw error
  return data
}

// ==================== WEBHOOKS ====================

export async function logWebhook(data: {
  source_product: string
  event_type: string
  payload: any
}) {
  const supabaseAdmin = getSupabaseAdmin() as any
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
  const supabaseAdmin = getSupabaseAdmin() as any
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
  const supabaseAdmin = getSupabaseAdmin() as any
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
  const supabaseAdmin = getSupabaseAdmin() as any

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
