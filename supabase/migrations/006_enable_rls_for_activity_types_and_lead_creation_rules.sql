-- Priority 2 security hardening
-- Enable RLS on reference/config tables that are currently exposed.
-- activity_types is intentionally readable by any authenticated user as a shared catalog.
-- lead_creation_rules remains user-scoped via user_id = auth.uid().

ALTER TABLE public.activity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_creation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read activity types" ON public.activity_types;
CREATE POLICY "Authenticated users can read activity types"
  ON public.activity_types
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can view own lead creation rules" ON public.lead_creation_rules;
CREATE POLICY "Users can view own lead creation rules"
  ON public.lead_creation_rules
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own lead creation rules" ON public.lead_creation_rules;
CREATE POLICY "Users can insert own lead creation rules"
  ON public.lead_creation_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own lead creation rules" ON public.lead_creation_rules;
CREATE POLICY "Users can update own lead creation rules"
  ON public.lead_creation_rules
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own lead creation rules" ON public.lead_creation_rules;
CREATE POLICY "Users can delete own lead creation rules"
  ON public.lead_creation_rules
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
