export const ULTRA_MARKETING_PRODUCT_KEY = 'ultra_marketing'
export const ULTRA_MARKETING_PRODUCT_SLUG = 'ultra-marketing'
export const ULTRA_MARKETING_ASSISTANT_LABEL = 'Ultra Marketing Assistant'
export const ULTRA_MARKETING_WORKSPACE_TYPE = 'tenant_scoped_marketing_workspace'
export const ULTRA_MARKETING_ACCESS_MODEL = 'shared_tenant_isolated_runtime'
export const ULTRA_MARKETING_APPROVAL_POLICY = 'approval_required_for_external_actions'

export const ULTRA_MARKETING_WORKFLOWS = [
  'marketing_analysis',
  'social_content_drafts',
  'email_campaign_drafts',
  'gbp_post_drafts',
  'review_response_drafts',
  'paid_ads_intelligence',
  'approval_queue',
]

export type UltraMarketingWorkspace = {
  id: string
  client_id: string
  display_name: string
  assistant_label: string
  status: string
  workspace_type: string
  access_model: string
  approval_policy: string
  allowed_workflows: string[]
  connected_account_status: Record<string, unknown>
  provisioned_at: string | null
  provisioned_by: string | null
  paused_at?: string | null
}

export type UltraMarketingFeature = {
  enabled?: boolean
  status?: string
  tier?: string | null
  enabled_at?: string | null
  enabled_by?: string | null
  paused_at?: string | null
  disabled_by?: string | null
  approval_policy?: string | null
  allowed_workflows?: string[] | null
  connected_account_status?: Record<string, unknown> | null
  workspace?: UltraMarketingWorkspace | Record<string, unknown> | null
}

export function objectOrEmpty(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
}

function clientDisplayName(client: any): string {
  return client?.name || client?.business_name || 'Client'
}

function workspaceIdForClient(clientId: string): string {
  return `umw_${clientId.replace(/-/g, '').slice(0, 24)}`
}

export function getUltraMarketingFeature(client: any): UltraMarketingFeature {
  const features = objectOrEmpty(client?.features)
  const products = objectOrEmpty(features.products)
  const legacyFeature = objectOrEmpty(features[ULTRA_MARKETING_PRODUCT_KEY])
  const productFeature = objectOrEmpty(products[ULTRA_MARKETING_PRODUCT_KEY])

  return {
    ...legacyFeature,
    ...productFeature,
  }
}

export function isUltraMarketingEnabled(client: any): boolean {
  const feature = getUltraMarketingFeature(client)
  const activeSubscription = Array.isArray(client?.products) && client.products.some((product: any) =>
    product?.slug === ULTRA_MARKETING_PRODUCT_SLUG && (!product.status || product.status === 'active')
  )

  return Boolean(
    client?.ultra_marketing_enabled ||
    activeSubscription ||
    feature.enabled === true ||
    feature.status === 'active' ||
    feature.status === 'trial'
  )
}

export function buildUltraMarketingWorkspace(
  client: any,
  options: { status?: string; tier?: string | null; actorId?: string | null; now?: string } = {}
): UltraMarketingWorkspace {
  const feature = getUltraMarketingFeature(client)
  const existingWorkspace = objectOrEmpty(feature.workspace)
  const clientId = String(client?.id || existingWorkspace.client_id || '')
  const now = options.now || new Date().toISOString()
  const allowedWorkflows = Array.isArray(existingWorkspace.allowed_workflows)
    ? existingWorkspace.allowed_workflows
    : Array.isArray(feature.allowed_workflows)
      ? feature.allowed_workflows
      : ULTRA_MARKETING_WORKFLOWS

  return {
    id: String(existingWorkspace.id || workspaceIdForClient(clientId)),
    client_id: clientId,
    display_name: String(existingWorkspace.display_name || `${clientDisplayName(client)} Marketing Workspace`),
    assistant_label: String(existingWorkspace.assistant_label || ULTRA_MARKETING_ASSISTANT_LABEL),
    status: String(options.status || existingWorkspace.status || feature.status || 'active'),
    workspace_type: String(existingWorkspace.workspace_type || existingWorkspace.workspace_model || ULTRA_MARKETING_WORKSPACE_TYPE),
    access_model: String(existingWorkspace.access_model || ULTRA_MARKETING_ACCESS_MODEL),
    approval_policy: String(existingWorkspace.approval_policy || feature.approval_policy || ULTRA_MARKETING_APPROVAL_POLICY),
    allowed_workflows: allowedWorkflows,
    connected_account_status: objectOrEmpty(existingWorkspace.connected_account_status || feature.connected_account_status),
    provisioned_at: String(existingWorkspace.provisioned_at || feature.enabled_at || now),
    provisioned_by: String(existingWorkspace.provisioned_by || options.actorId || feature.enabled_by || '') || null,
    paused_at: existingWorkspace.paused_at ? String(existingWorkspace.paused_at) : null,
  }
}

export function provisionUltraMarketingFeature(
  client: any,
  options: { tier?: string | null; actorId?: string | null; now?: string } = {}
): UltraMarketingFeature {
  const existingFeature = getUltraMarketingFeature(client)
  const now = options.now || new Date().toISOString()
  const tier = options.tier || existingFeature.tier || client?.subscription_tier || client?.tier || 'growth'

  const feature: UltraMarketingFeature = {
    ...existingFeature,
    enabled: true,
    status: 'active',
    tier,
    enabled_at: existingFeature.enabled_at || now,
    enabled_by: options.actorId || existingFeature.enabled_by || null,
    paused_at: null,
    disabled_by: null,
    approval_policy: existingFeature.approval_policy || ULTRA_MARKETING_APPROVAL_POLICY,
    allowed_workflows: Array.isArray(existingFeature.allowed_workflows)
      ? existingFeature.allowed_workflows
      : ULTRA_MARKETING_WORKFLOWS,
    connected_account_status: objectOrEmpty(existingFeature.connected_account_status),
  }

  feature.workspace = buildUltraMarketingWorkspace(
    {
      ...client,
      features: {
        ...objectOrEmpty(client?.features),
        products: {
          ...objectOrEmpty(client?.features?.products),
          [ULTRA_MARKETING_PRODUCT_KEY]: feature,
        },
      },
    },
    { tier, actorId: options.actorId, now, status: 'active' }
  )

  return feature
}

export function pauseUltraMarketingFeature(
  client: any,
  options: { actorId?: string | null; now?: string } = {}
): UltraMarketingFeature {
  const existingFeature = getUltraMarketingFeature(client)
  const now = options.now || new Date().toISOString()
  const feature: UltraMarketingFeature = {
    ...existingFeature,
    enabled: false,
    status: 'paused',
    paused_at: now,
    disabled_by: options.actorId || existingFeature.disabled_by || null,
    approval_policy: existingFeature.approval_policy || ULTRA_MARKETING_APPROVAL_POLICY,
    allowed_workflows: Array.isArray(existingFeature.allowed_workflows)
      ? existingFeature.allowed_workflows
      : ULTRA_MARKETING_WORKFLOWS,
    connected_account_status: objectOrEmpty(existingFeature.connected_account_status),
  }

  feature.workspace = {
    ...buildUltraMarketingWorkspace(
      {
        ...client,
        features: {
          ...objectOrEmpty(client?.features),
          products: {
            ...objectOrEmpty(client?.features?.products),
            [ULTRA_MARKETING_PRODUCT_KEY]: feature,
          },
        },
      },
      { actorId: options.actorId, now, status: 'paused' }
    ),
    status: 'paused',
    paused_at: now,
  }

  return feature
}
