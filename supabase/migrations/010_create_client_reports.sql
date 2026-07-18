-- Client reports autoload pipeline
-- Generic report metadata table for SEO, ads, GBP, reviews, site-health and future monthly reports.
-- Reports are client-scoped; files live in the private `client-reports` storage bucket.

CREATE TABLE IF NOT EXISTS public.client_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  report_type text NOT NULL DEFAULT 'seo',
  period_start date NOT NULL,
  period_end date NOT NULL,
  title text NOT NULL,
  summary text,
  score numeric,
  status text NOT NULL DEFAULT 'ready',
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  pdf_url text,
  storage_path text,
  source text NOT NULL DEFAULT 'taskifiai',
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_reports_report_type_check CHECK (report_type IN ('seo', 'ads', 'gbp', 'reviews', 'site_health', 'monthly', 'custom')),
  CONSTRAINT client_reports_status_check CHECK (status IN ('processing', 'ready', 'failed')),
  CONSTRAINT client_reports_score_check CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  CONSTRAINT client_reports_period_check CHECK (period_end >= period_start)
);

CREATE UNIQUE INDEX IF NOT EXISTS client_reports_client_type_period_unique
  ON public.client_reports (client_id, report_type, period_start, period_end);

CREATE INDEX IF NOT EXISTS client_reports_client_period_idx
  ON public.client_reports (client_id, period_end DESC);

CREATE INDEX IF NOT EXISTS client_reports_type_status_idx
  ON public.client_reports (report_type, status);

ALTER TABLE public.client_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view reports for their clients" ON public.client_reports;
DROP POLICY IF EXISTS "Users can insert reports for their clients" ON public.client_reports;
DROP POLICY IF EXISTS "Users can update reports for their clients" ON public.client_reports;
DROP POLICY IF EXISTS "Users can delete reports for their clients" ON public.client_reports;

CREATE POLICY "Users can view reports for their clients"
  ON public.client_reports
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

CREATE POLICY "Users can insert reports for their clients"
  ON public.client_reports
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

CREATE POLICY "Users can update reports for their clients"
  ON public.client_reports
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
  )
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

CREATE POLICY "Users can delete reports for their clients"
  ON public.client_reports
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

-- Private report-file bucket. Marketing automation can upload using service role;
-- clients receive short-lived signed URLs generated server-side.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-reports',
  'client-reports',
  false,
  10485760,
  ARRAY['application/pdf', 'text/html', 'text/markdown', 'application/json']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users can view report files for their clients" ON storage.objects;

CREATE POLICY "Users can view report files for their clients"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-reports'
    AND (storage.foldername(name))[1] IN (
      SELECT c.id::text
      FROM public.clients c
      WHERE c.user_id = auth.uid()
         OR c.id IN (
           SELECT csa.client_id
           FROM public.client_staff_access csa
           WHERE csa.user_id = auth.uid()
         )
    )
  );
