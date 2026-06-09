Batch 3 security prep during Vercel env-var window

Prepared locally only:
- supabase/migrations/008_add_rls_policies_for_content_and_posting_tables.sql

Targets covered
- public.brand_profiles
- public.posts
- public.preferences
- public.posting_jobs
- public.posting_job_results

Policy model chosen
- authenticated users only
- access scoped by client ownership or client_staff_access membership
- posting_job_results inherits access through posting_jobs.client_id

Why this shape
- Matches existing CRM policies on contacts/messages/notes/activities
- Avoids broad public access
- Clears the current "RLS enabled but no policies" findings for these tables once applied

Important caveats before apply
- I could not find app code directly querying these tables in the current repo search, so this is schema-driven hardening rather than code-usage-driven hardening.
- If any background workflow depends on direct authenticated writes to posting_job_results outside client ownership/staff scope, we should verify before applying.
- The client-images bucket warning is separate; I have not changed storage policies yet.

Separate remaining non-table findings after 007
- storage bucket listing policy on client-images
- leaked password protection disabled

Suggested next sequence after your Vercel env update
1. Review/apply migration 008
2. Re-run security advisors
3. Decide whether to tighten the client-images SELECT policy or intentionally keep listing enabled
4. Enable leaked-password protection in Auth settings
