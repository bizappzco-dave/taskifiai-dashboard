-- Harden billing/invoice RLS policies and pin helper function search_path.
-- Follow-up to 011/012 after Supabase advisors flagged auth_rls_initplan
-- on the new billing policies and mutable search_path on update_updated_at_column.

DROP POLICY IF EXISTS "Users can view subscriptions for their clients" ON public.subscriptions;
CREATE POLICY "Users can view subscriptions for their clients"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.user_id = (select auth.uid())
      OR c.id IN (
        SELECT csa.client_id
        FROM public.client_staff_access csa
        WHERE csa.user_id = (select auth.uid())
          AND COALESCE(csa.invitation_accepted, false) = true
      )
    )
  );

DROP POLICY IF EXISTS "Users can view invoices for their clients" ON public.invoices;
CREATE POLICY "Users can view invoices for their clients"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE user_id = (select auth.uid())
      OR id IN (
        SELECT client_id FROM public.client_staff_access
        WHERE user_id = (select auth.uid())
          AND COALESCE(invitation_accepted, false) = true
      )
    )
  );

DROP POLICY IF EXISTS "Users can create invoices for their clients" ON public.invoices;
CREATE POLICY "Users can create invoices for their clients"
  ON public.invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients
      WHERE user_id = (select auth.uid())
      OR id IN (
        SELECT client_id FROM public.client_staff_access
        WHERE user_id = (select auth.uid())
          AND COALESCE(invitation_accepted, false) = true
      )
    )
  );

DROP POLICY IF EXISTS "Users can update invoices for their clients" ON public.invoices;
CREATE POLICY "Users can update invoices for their clients"
  ON public.invoices FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE user_id = (select auth.uid())
      OR id IN (
        SELECT client_id FROM public.client_staff_access
        WHERE user_id = (select auth.uid())
          AND COALESCE(invitation_accepted, false) = true
      )
    )
  );

ALTER FUNCTION public.update_updated_at_column()
  SET search_path = public, extensions, pg_temp;
