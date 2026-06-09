-- Security hardening batch 3
-- Purpose: clear the remaining RLS-enabled-without-policies findings on client-scoped tables.
-- This migration intentionally follows the existing CRM tenant model:
-- - owners and staff can read/write rows tied to their accessible clients
-- - posting_job_results inherits access through posting_jobs -> client_id
-- - no broad public read/write access

-- ---------------------------------------------------------------------
-- Helper shape used throughout: client rows accessible to owner or staff
-- ---------------------------------------------------------------------

-- brand_profiles --------------------------------------------------------
DROP POLICY IF EXISTS "Users can view brand profiles for their clients" ON public.brand_profiles;
DROP POLICY IF EXISTS "Users can insert brand profiles for their clients" ON public.brand_profiles;
DROP POLICY IF EXISTS "Users can update brand profiles for their clients" ON public.brand_profiles;
DROP POLICY IF EXISTS "Users can delete brand profiles for their clients" ON public.brand_profiles;

CREATE POLICY "Users can view brand profiles for their clients"
  ON public.brand_profiles
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

CREATE POLICY "Users can insert brand profiles for their clients"
  ON public.brand_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
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

CREATE POLICY "Users can update brand profiles for their clients"
  ON public.brand_profiles
  FOR UPDATE
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

CREATE POLICY "Users can delete brand profiles for their clients"
  ON public.brand_profiles
  FOR DELETE
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

-- posts -----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view posts for their clients" ON public.posts;
DROP POLICY IF EXISTS "Users can insert posts for their clients" ON public.posts;
DROP POLICY IF EXISTS "Users can update posts for their clients" ON public.posts;
DROP POLICY IF EXISTS "Users can delete posts for their clients" ON public.posts;

CREATE POLICY "Users can view posts for their clients"
  ON public.posts
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

CREATE POLICY "Users can insert posts for their clients"
  ON public.posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
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

CREATE POLICY "Users can update posts for their clients"
  ON public.posts
  FOR UPDATE
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

CREATE POLICY "Users can delete posts for their clients"
  ON public.posts
  FOR DELETE
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

-- preferences -----------------------------------------------------------
DROP POLICY IF EXISTS "Users can view preferences for their clients" ON public.preferences;
DROP POLICY IF EXISTS "Users can insert preferences for their clients" ON public.preferences;
DROP POLICY IF EXISTS "Users can update preferences for their clients" ON public.preferences;
DROP POLICY IF EXISTS "Users can delete preferences for their clients" ON public.preferences;

CREATE POLICY "Users can view preferences for their clients"
  ON public.preferences
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

CREATE POLICY "Users can insert preferences for their clients"
  ON public.preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (
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

CREATE POLICY "Users can update preferences for their clients"
  ON public.preferences
  FOR UPDATE
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

CREATE POLICY "Users can delete preferences for their clients"
  ON public.preferences
  FOR DELETE
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

-- posting_jobs ----------------------------------------------------------
DROP POLICY IF EXISTS "Users can view posting jobs for their clients" ON public.posting_jobs;
DROP POLICY IF EXISTS "Users can insert posting jobs for their clients" ON public.posting_jobs;
DROP POLICY IF EXISTS "Users can update posting jobs for their clients" ON public.posting_jobs;
DROP POLICY IF EXISTS "Users can delete posting jobs for their clients" ON public.posting_jobs;

CREATE POLICY "Users can view posting jobs for their clients"
  ON public.posting_jobs
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

CREATE POLICY "Users can insert posting jobs for their clients"
  ON public.posting_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
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

CREATE POLICY "Users can update posting jobs for their clients"
  ON public.posting_jobs
  FOR UPDATE
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

CREATE POLICY "Users can delete posting jobs for their clients"
  ON public.posting_jobs
  FOR DELETE
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

-- posting_job_results ---------------------------------------------------
DROP POLICY IF EXISTS "Users can view posting job results for their clients" ON public.posting_job_results;
DROP POLICY IF EXISTS "Users can insert posting job results for their clients" ON public.posting_job_results;
DROP POLICY IF EXISTS "Users can update posting job results for their clients" ON public.posting_job_results;
DROP POLICY IF EXISTS "Users can delete posting job results for their clients" ON public.posting_job_results;

CREATE POLICY "Users can view posting job results for their clients"
  ON public.posting_job_results
  FOR SELECT
  TO authenticated
  USING (
    posting_job_id IN (
      SELECT pj.id
      FROM public.posting_jobs pj
      WHERE pj.client_id IN (
        SELECT c.id
        FROM public.clients c
        WHERE c.user_id = auth.uid()
           OR c.id IN (
             SELECT csa.client_id
             FROM public.client_staff_access csa
             WHERE csa.user_id = auth.uid()
           )
      )
    )
  );

CREATE POLICY "Users can insert posting job results for their clients"
  ON public.posting_job_results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    posting_job_id IN (
      SELECT pj.id
      FROM public.posting_jobs pj
      WHERE pj.client_id IN (
        SELECT c.id
        FROM public.clients c
        WHERE c.user_id = auth.uid()
           OR c.id IN (
             SELECT csa.client_id
             FROM public.client_staff_access csa
             WHERE csa.user_id = auth.uid()
           )
      )
    )
  );

CREATE POLICY "Users can update posting job results for their clients"
  ON public.posting_job_results
  FOR UPDATE
  TO authenticated
  USING (
    posting_job_id IN (
      SELECT pj.id
      FROM public.posting_jobs pj
      WHERE pj.client_id IN (
        SELECT c.id
        FROM public.clients c
        WHERE c.user_id = auth.uid()
           OR c.id IN (
             SELECT csa.client_id
             FROM public.client_staff_access csa
             WHERE csa.user_id = auth.uid()
           )
      )
    )
  );

CREATE POLICY "Users can delete posting job results for their clients"
  ON public.posting_job_results
  FOR DELETE
  TO authenticated
  USING (
    posting_job_id IN (
      SELECT pj.id
      FROM public.posting_jobs pj
      WHERE pj.client_id IN (
        SELECT c.id
        FROM public.clients c
        WHERE c.user_id = auth.uid()
           OR c.id IN (
             SELECT csa.client_id
             FROM public.client_staff_access csa
             WHERE csa.user_id = auth.uid()
           )
      )
    )
  );
