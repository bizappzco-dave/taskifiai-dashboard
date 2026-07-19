export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type GenericTable<
  Row extends Record<string, unknown> = Record<string, unknown>,
  Insert extends Record<string, unknown> = Partial<Row>,
  Update extends Record<string, unknown> = Partial<Row>,
> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

type GenericView<Row extends Record<string, unknown> = Record<string, unknown>> = {
  Row: Row
  Relationships: []
}

type LeadSource =
  | 'gmail'
  | 'whatsapp'
  | 'instagram_dm'
  | 'facebook_dm'
  | 'website_form'
  | 'gbp_call'
  | 'manual'

type LeadStage =
  | 'new_lead'
  | 'contacted'
  | 'qualified'
  | 'quoted'
  | 'follow_up'
  | 'won'
  | 'lost'

type PlatformType = 'instagram' | 'facebook' | 'linkedin' | 'twitter' | 'tiktok'
type PostStatus = 'draft' | 'scheduled' | 'published' | 'archived'

type ClientRow = {
  id: string
  user_id: string
  name: string
  industry: string | null
  drive_folder_id: string | null
  drive_folder_url: string | null
  rss_feed_url: string | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
  tier: string | null
  features: Json | null
  default_schedule_type: string | null
  default_posting_time: string | null
  schedule_randomization: number | null
  upload_token: string | null
  review_token: string | null
  upload_post_user_id: string | null
  upload_post_jwt: string | null
  upload_post_connected: boolean | null
  upload_post_username: string | null
  subscription_description: string | null
  billing_cycle: string | null
  monthly_revenue: number | null
} & Record<string, unknown>

type ContactRow = {
  id: string
  client_id: string | null
  name: string
  email: string | null
  phone: string | null
  role: string | null
  is_primary: boolean | null
  company_name: string | null
  notes: string | null
  metadata: Json | null
  created_at: string | null
  updated_at: string | null
} & Record<string, unknown>

type LeadRow = {
  id: string
  contact_id: string
  client_id: string
  source: LeadSource
  activity_id: string | null
  assigned_user_id: string | null
  value: number | null
  status: LeadStage
  next_follow_up_date: string | null
  notes: string | null
  won_lost_reason: string | null
  created_at: string
  updated_at: string
} & Record<string, unknown>

type ActivityRow = {
  id: string
  client_id: string
  product: string
  activity_type: string
  title: string | null
  description: string | null
  details: Json | null
  created_at: string | null
  contact_id: string | null
  user_id: string | null
  activity_category: string | null
  source: string | null
  external_id: string | null
  occurred_at: string | null
} & Record<string, unknown>

type TaskRow = {
  id: string
  client_id: string | null
  contact_id: string | null
  assigned_to: string | null
  created_by: string | null
  title: string
  description: string | null
  status: string | null
  priority: string | null
  due_date: string | null
  completed_at: string | null
  activity_id: string | null
  metadata: Json | null
  created_at: string | null
  updated_at: string | null
} & Record<string, unknown>

type AdReportRow = {
  id: string
  client_id: string | null
  report_start_date: string
  report_end_date: string
  google_ads_data: Json | null
  meta_ads_data: Json | null
  total_impressions: number | null
  total_clicks: number | null
  total_cost: number | null
  total_conversions: number | null
  avg_ctr: number | null
  avg_cpc: number | null
  avg_roas: number | null
  ai_summary: string | null
  key_insights: Json | null
  recommendations: Json | null
  alerts_generated: number | null
  status: string | null
  created_at: string | null
  updated_at: string | null
} & Record<string, unknown>

type AdAlertRow = {
  id: string
  client_id: string | null
  alert_type: string | null
  severity: string | null
  platform: string | null
  campaign_id: string | null
  campaign_name: string | null
  title: string
  description: string | null
  recommendation: string | null
  current_value: number | null
  previous_value: number | null
  change_percent: number | null
  is_resolved: boolean | null
  resolved_at: string | null
  resolved_by: string | null
  created_at: string | null
} & Record<string, unknown>

type PostRow = {
  id: string
  client_id: string
  submission_id: string | null
  platform: PlatformType
  caption: string
  hashtags: string[] | null
  image_urls: string[] | null
  status: PostStatus | null
  scheduled_for: string | null
  published_at: string | null
  external_post_id: string | null
  external_post_url: string | null
  analytics: Json | null
  created_at: string | null
  updated_at: string | null
} & Record<string, unknown>

type PostingJobRow = {
  id: string
  client_id: string
  submission_id: string | null
  post_id: string | null
  uploadpost_request_id: string | null
  uploadpost_job_id: string | null
  mode: string
  scheduled_date_utc: string | null
  platform_targets: Json
  media_type: string
  status: string
  error_message: string | null
  posted_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  upload_request_id: string | null
  upload_status: string | null
  instagram_post_url: string | null
  instagram_media_id: string | null
} & Record<string, unknown>

type ClientStaffAccessRow = {
  id: string
  client_id: string | null
  user_id: string | null
  role: string
  created_at: string | null
  updated_at: string | null
  invited_email: string | null
  invitation_accepted: boolean | null
} & Record<string, unknown>

type KnownTables = {
  activities: GenericTable<ActivityRow>
  ad_alerts: GenericTable<AdAlertRow>
  ad_reports: GenericTable<AdReportRow>
  client_staff_access: GenericTable<ClientStaffAccessRow>
  clients: GenericTable<ClientRow>
  contacts: GenericTable<ContactRow>
  leads: GenericTable<LeadRow>
  posts: GenericTable<PostRow>
  posting_jobs: GenericTable<PostingJobRow>
  tasks: GenericTable<TaskRow>
}

type KnownViews = {
  client_activity_summary: GenericView<{
    client_id: string | null
    client_name: string | null
    communications: number | null
    completed_tasks: number | null
    marketing_activities: number | null
    sales_activities: number | null
    total_activities: number | null
  } & Record<string, unknown>>
  recent_activities: GenericView<ActivityRow & {
    activity_description: string | null
    client_name: string | null
    contact_name: string | null
    user_email: string | null
  }>
}

export type Database = {
  public: {
    Tables: KnownTables & Record<string, GenericTable>
    Views: KnownViews & Record<string, GenericView>
    Functions: {
      log_activity: {
        Args: {
          p_client_id: string
          p_activity_type: string
          p_title: string
          p_description?: string | null
          p_activity_category?: string | null
          p_source?: string | null
          p_external_id?: string | null
          p_contact_id?: string | null
          p_details?: Json | null
        }
        Returns: string
      }
    } & Record<string, { Args: Record<string, unknown>; Returns: unknown }>
    Enums: {
      lead_source: LeadSource
      lead_stage: LeadStage
      platform_type: PlatformType
      post_status: PostStatus
      submission_status: 'pending' | 'processing' | 'completed' | 'failed'
    }
    CompositeTypes: Record<string, never>
  }
}
