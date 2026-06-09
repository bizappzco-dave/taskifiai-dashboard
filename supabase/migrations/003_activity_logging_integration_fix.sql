-- TaskifiAI CRM Phase 1.1: Activity logging integration fixes
-- Purpose: align webhook activity logging with live schema and restore lead auto-create
-- Date: 2026-06-08

-- 1. Allow reputation activities in the unified feed
ALTER TABLE public.activities
  DROP CONSTRAINT IF EXISTS activities_activity_category_check;

ALTER TABLE public.activities
  ADD CONSTRAINT activities_activity_category_check
  CHECK (
    activity_category = ANY (
      ARRAY[
        'communication'::text,
        'marketing'::text,
        'support'::text,
        'sales'::text,
        'operations'::text,
        'reputation'::text
      ]
    )
  );

-- 2. Align legacy lead auto-create rules with canonical activity types
UPDATE public.lead_creation_rules
SET activity_type = 'whatsapp_received'
WHERE activity_type = 'whatsapp_message_received';

-- 3. Fix lead auto-create trigger to read from the live activities schema
CREATE OR REPLACE FUNCTION public.auto_create_lead_from_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_contact_id uuid;
  v_client_id uuid;
  v_source lead_source;
  v_rule record;
  v_lead_exists boolean;
BEGIN
  SELECT INTO v_rule *
  FROM public.lead_creation_rules
  WHERE activity_type = NEW.activity_type
    AND enabled = true
  LIMIT 1;

  IF v_rule IS NULL THEN
    RETURN NEW;
  END IF;

  v_source := v_rule.source;
  v_contact_id := COALESCE(NEW.contact_id, (NEW.details->>'contact_id')::uuid);

  IF v_contact_id IS NULL THEN
    SELECT id INTO v_contact_id
    FROM public.contacts
    WHERE client_id = NEW.client_id
      AND email = (NEW.details->>'email')
    LIMIT 1;

    IF v_contact_id IS NULL THEN
      SELECT id INTO v_contact_id
      FROM public.contacts
      WHERE client_id = NEW.client_id
        AND phone = (NEW.details->>'phone')
      LIMIT 1;
    END IF;
  END IF;

  IF v_contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT client_id INTO v_client_id
  FROM public.contacts
  WHERE id = v_contact_id
  LIMIT 1;

  v_client_id := COALESCE(v_client_id, NEW.client_id);

  IF v_client_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.leads WHERE activity_id = NEW.id
  ) INTO v_lead_exists;

  IF v_lead_exists THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.leads
    WHERE contact_id = v_contact_id
      AND status = 'new_lead'
      AND created_at > now() - interval '24 hours'
  ) INTO v_lead_exists;

  IF v_lead_exists THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.leads (
    contact_id,
    client_id,
    source,
    activity_id,
    assigned_user_id,
    status
  ) VALUES (
    v_contact_id,
    v_client_id,
    v_source,
    NEW.id,
    CASE
      WHEN v_rule.auto_assign_to_owner THEN
        (
          SELECT c.user_id
          FROM public.clients c
          WHERE c.id = v_client_id
            AND EXISTS (
              SELECT 1
              FROM auth.users u
              WHERE u.id = c.user_id
            )
        )
      ELSE NULL
    END,
    'new_lead'
  );

  RETURN NEW;
END;
$function$;
