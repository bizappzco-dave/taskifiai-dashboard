-- Allow the shared tasks table to carry Ultra Marketing approval-queue lifecycle states.
-- The queue is still identified by metadata.kind = 'ultra_marketing_approval'.

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'in_progress'::text,
        'completed'::text,
        'cancelled'::text,
        'draft'::text,
        'pending_approval'::text,
        'approved'::text,
        'rejected'::text,
        'published'::text
      ]
    )
  );
