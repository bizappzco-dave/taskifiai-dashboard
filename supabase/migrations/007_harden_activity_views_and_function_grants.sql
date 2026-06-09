-- Security hardening follow-up
-- Goals:
-- 1) make CRM views obey underlying RLS instead of bypassing it via SECURITY DEFINER
-- 2) stop exposing auth.users email through recent_activities
-- 3) remove public/anon access to the views
-- 4) revoke RPC execution on SECURITY DEFINER helper functions that are not needed by clients
-- 5) remove the permissive direct INSERT policy on activities and replace it with a user-scoped SELECT policy
-- 6) pin search_path on functions flagged by the advisor

-- Activities should be readable by authenticated users for clients they own or can access via staff membership.
DROP POLICY IF EXISTS "Users can view activities for their clients" ON public.activities;
CREATE POLICY "Users can view activities for their clients"
  ON public.activities
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id
      FROM public.clients c
      WHERE c.user_id = auth.uid()
         OR c.id IN (
           SELECT csa.client_id
           FROM public.client_staff_access csa
           WHERE csa.user_id = auth.uid()
         )
    )
  );

-- Webhook/server writes use the service role directly; do not expose open inserts through the Data API.
DROP POLICY IF EXISTS "System can insert activities" ON public.activities;

-- Recreate views as security invoker so underlying RLS applies to authenticated users.
-- Keep the legacy user_email column shape for compatibility, but stop joining auth.users.
CREATE OR REPLACE VIEW public.recent_activities
WITH (security_invoker = true) AS
SELECT
  a.id,
  a.client_id,
  a.product,
  a.activity_type,
  a.title,
  a.description,
  a.details,
  a.created_at,
  a.contact_id,
  a.user_id,
  a.activity_category,
  a.source,
  a.external_id,
  a.occurred_at,
  c.name AS client_name,
  ct.name AS contact_name,
  NULL::character varying(255) AS user_email,
  at.description AS activity_description
FROM public.activities a
LEFT JOIN public.clients c ON a.client_id = c.id
LEFT JOIN public.contacts ct ON a.contact_id = ct.id
LEFT JOIN public.activity_types at ON a.activity_type = at.type_name
ORDER BY a.occurred_at DESC;

CREATE OR REPLACE VIEW public.client_activity_summary
WITH (security_invoker = true) AS
SELECT
  c.id AS client_id,
  c.name AS client_name,
  COUNT(a.id) AS total_activities,
  COUNT(CASE WHEN a.activity_category = 'communication' THEN 1 END) AS communications,
  COUNT(CASE WHEN a.activity_category = 'marketing' THEN 1 END) AS marketing_activities,
  COUNT(CASE WHEN a.activity_category = 'sales' THEN 1 END) AS sales_activities,
  COUNT(CASE WHEN t.status = 'completed' THEN 1 END) AS completed_tasks
FROM public.clients c
LEFT JOIN public.activities a ON c.id = a.client_id
  AND a.occurred_at >= NOW() - INTERVAL '7 days'
LEFT JOIN public.tasks t ON c.id = t.client_id
  AND t.status = 'completed'
  AND t.completed_at >= NOW() - INTERVAL '7 days'
GROUP BY c.id, c.name;

-- Restrict the views to authenticated users and service role only.
REVOKE ALL ON TABLE public.recent_activities FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.client_activity_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.recent_activities TO authenticated, service_role;
GRANT SELECT ON TABLE public.client_activity_summary TO authenticated, service_role;

-- SECURITY DEFINER functions in public should not be callable from the Data API unless explicitly needed.
REVOKE EXECUTE ON FUNCTION public.log_activity(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_create_lead_from_activity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_create_lead_from_activity() TO service_role;

-- Pin search_path on functions flagged by the advisor.
ALTER FUNCTION public.log_activity(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB)
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.auto_create_lead_from_activity()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.update_updated_at_column()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_leads_updated_at()
  SET search_path = public, pg_temp;
