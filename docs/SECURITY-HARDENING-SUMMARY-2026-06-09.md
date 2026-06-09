# Security hardening summary — 2026-06-09

Project: taskifiai-dashboard
Supabase project: nmebpawvnhrokouksvir

## Applied migrations

### 006_enable_rls_for_activity_types_and_lead_creation_rules
Applied in production as:
- 20260609055838 enable_rls_for_activity_types_and_lead_creation_rules

Changes:
- enabled RLS on public.activity_types
- added authenticated read policy for public.activity_types
- enabled RLS on public.lead_creation_rules
- added user-scoped CRUD policies on public.lead_creation_rules using auth.uid()

Result:
- fixed the original Priority 2 RLS-disabled findings for activity_types and lead_creation_rules

### 007_harden_activity_views_and_function_grants
Applied in production as:
- 20260609060819 harden_activity_views_and_function_grants

Changes:
- removed overly permissive INSERT policy on public.activities
- added authenticated SELECT policy on public.activities scoped by owned/staff-accessible clients
- rebuilt public.recent_activities and public.client_activity_summary as security_invoker views
- preserved recent_activities.user_email as a compatibility column, but now returns NULL instead of joining auth.users
- tightened grants on SECURITY DEFINER functions:
  - public.log_activity(...)
  - public.auto_create_lead_from_activity()
- set search_path on flagged functions:
  - public.log_activity(...)
  - public.auto_create_lead_from_activity()
  - public.update_updated_at_column()
  - public.update_leads_updated_at()

Result:
- removed view exposure warnings
- removed SECURITY DEFINER grant warnings for the activity logging path
- made activity views obey underlying RLS

### 008_add_rls_policies_for_content_and_posting_tables
Applied in production as:
- 20260609064738 add_rls_policies_for_content_and_posting_tables

Changes:
- added authenticated SELECT/INSERT/UPDATE/DELETE policies for:
  - public.brand_profiles
  - public.posts
  - public.preferences
  - public.posting_jobs
  - public.posting_job_results
- access model follows existing CRM tenancy rules:
  - client owner, or
  - client_staff_access member
- posting_job_results inherits access through posting_jobs -> client_id

Result:
- cleared all remaining "RLS enabled but no policies" findings on the client-scoped content/posting tables

### 009_drop_public_listing_on_client_images
Applied in production as:
- 20260609075020 drop_public_listing_on_client_images

Changes:
- dropped storage policy:
  - "Public access to client images"
- retained existing storage policies for authenticated upload/delete flows on client-images

Result:
- public object URLs should continue working for known paths
- bucket-wide listing/enumeration warning removed

## Security status after this batch

Resolved:
- RLS disabled on public.activity_types
- RLS disabled on public.lead_creation_rules
- public.recent_activities auth.users exposure warning
- SECURITY DEFINER view warnings on recent_activities and client_activity_summary
- permissive activities INSERT warning
- SECURITY DEFINER function execute grant warnings for log_activity / auto_create_lead_from_activity
- function mutable search_path warnings for the hardening targets
- all remaining public tables with RLS enabled but no policies
- public bucket listing warning on client-images

Remaining warning:
- Leaked Password Protection Disabled

Recommended final action in Supabase UI:
- Auth -> Password Security -> enable leaked password protection

## Notes
- No environment secrets should be committed.
- Local-only files still excluded from commit:
  - .env.local
  - .env.local.before-vercel-pull.bak
- Local migration files should be committed so repo history matches production state:
  - supabase/migrations/007_harden_activity_views_and_function_grants.sql
  - supabase/migrations/008_add_rls_policies_for_content_and_posting_tables.sql
  - supabase/migrations/009_drop_public_listing_on_client_images.sql
