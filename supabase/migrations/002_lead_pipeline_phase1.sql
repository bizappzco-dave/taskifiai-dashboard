-- Lead Pipeline Module - Phase 1
-- Creates leads table with Kanban stages, auto-creation support, and RLS

-- 1. Create enum for pipeline stages
CREATE TYPE lead_stage AS ENUM (
  'new_lead',
  'contacted',
  'qualified',
  'quoted',
  'follow_up',
  'won',
  'lost'
);

-- 2. Create enum for lead sources
CREATE TYPE lead_source AS ENUM (
  'gmail',
  'whatsapp',
  'instagram_dm',
  'facebook_dm',
  'website_form',
  'gbp_call',
  'manual'
);

-- 3. Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  source lead_source NOT NULL DEFAULT 'manual',
  activity_id uuid REFERENCES activities(id) ON DELETE SET NULL,
  assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  value numeric(10, 2) DEFAULT 0,
  status lead_stage NOT NULL DEFAULT 'new_lead',
  next_follow_up_date timestamptz,
  notes text DEFAULT '',
  won_lost_reason text DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 4. Create indexes for common queries
CREATE INDEX idx_leads_contact ON leads(contact_id);
CREATE INDEX idx_leads_client ON leads(client_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_assigned ON leads(assigned_user_id);
CREATE INDEX idx_leads_follow_up ON leads(next_follow_up_date) WHERE next_follow_up_date IS NOT NULL;
CREATE INDEX idx_leads_activity ON leads(activity_id);
CREATE INDEX idx_leads_created ON leads(created_at DESC);

-- 5. Create index for auto-creation deduplication
CREATE UNIQUE INDEX idx_leads_unique_activity 
ON leads(activity_id) 
WHERE activity_id IS NOT NULL;

-- 6. Create updated_at trigger
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at_trigger
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_updated_at();

-- 7. RLS Policies
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Users can view leads for their clients
CREATE POLICY "Users can view own leads"
  ON leads FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

-- Users can create leads for their clients
CREATE POLICY "Users can create own leads"
  ON leads FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

-- Users can update leads they own
CREATE POLICY "Users can update own leads"
  ON leads FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

-- Users can delete leads they own
CREATE POLICY "Users can delete own leads"
  ON leads FOR DELETE
  USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

-- 8. Create lead_creation_rules table (for auto-creation configuration)
CREATE TABLE IF NOT EXISTS lead_creation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_type text NOT NULL,
  source lead_source NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  auto_assign_to_owner boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, activity_type)
);

-- Index for rule lookups
CREATE INDEX idx_lead_rules_user ON lead_creation_rules(user_id, activity_type) WHERE enabled = true;

-- 9. Insert default rules for all users (will be triggered on user creation)
-- These are the default auto-creation rules
INSERT INTO lead_creation_rules (user_id, activity_type, source)
SELECT 
  id,
  activity_type,
  source
FROM auth.users
CROSS JOIN (
  VALUES 
    ('whatsapp_received', 'whatsapp'::lead_source),
    ('email_received', 'gmail'::lead_source),
    ('instagram_dm_received', 'instagram_dm'::lead_source),
    ('facebook_dm_received', 'facebook_dm'::lead_source),
    ('website_form_submitted', 'website_form'::lead_source),
    ('gbp_call_received', 'gbp_call'::lead_source)
) AS default_rules(activity_type, source)
ON CONFLICT (user_id, activity_type) DO NOTHING;

-- 10. Create function to auto-create leads from activities
CREATE OR REPLACE FUNCTION auto_create_lead_from_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_contact_id uuid;
  v_client_id uuid;
  v_source lead_source;
  v_rule record;
  v_lead_exists boolean;
BEGIN
  -- Find matching rule for this activity type
  SELECT INTO v_rule *
  FROM lead_creation_rules
  WHERE activity_type = NEW.activity_type
    AND enabled = true
  LIMIT 1;

  -- No rule = no auto-create
  IF v_rule IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get source from rule
  v_source := v_rule.source;

  -- Extract contact_id from activity payload
  v_contact_id := COALESCE(NEW.contact_id, (NEW.details->>'contact_id')::uuid);

  -- If no contact_id in details, try to find by email/phone
  IF v_contact_id IS NULL THEN
    -- Try to find contact by email
    SELECT id INTO v_contact_id
    FROM contacts
    WHERE client_id = NEW.client_id
      AND email = (NEW.details->>'email')
    LIMIT 1;

    -- If still not found, try phone
    IF v_contact_id IS NULL THEN
      SELECT id INTO v_contact_id
      FROM contacts
      WHERE client_id = NEW.client_id
        AND phone = (NEW.details->>'phone')
      LIMIT 1;
    END IF;
  END IF;

  -- No contact = can't create lead
  IF v_contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get client_id from contact (fallback to the activity client_id)
  SELECT client_id INTO v_client_id
  FROM contacts
  WHERE id = v_contact_id
  LIMIT 1;

  v_client_id := COALESCE(v_client_id, NEW.client_id);

  -- No client = can't create lead
  IF v_client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if lead already exists for this activity (deduplication)
  SELECT EXISTS(
    SELECT 1 FROM leads WHERE activity_id = NEW.id
  ) INTO v_lead_exists;

  -- Lead already exists = skip
  IF v_lead_exists THEN
    RETURN NEW;
  END IF;

  -- Check if lead already exists for this contact in 'new_lead' stage
  -- (avoid duplicate leads from multiple activities)
  SELECT EXISTS(
    SELECT 1 FROM leads 
    WHERE contact_id = v_contact_id 
      AND status = 'new_lead'
      AND created_at > now() - interval '24 hours'
  ) INTO v_lead_exists;

  -- Recent lead exists = skip
  IF v_lead_exists THEN
    RETURN NEW;
  END IF;

  -- Create the lead!
  INSERT INTO leads (
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
          FROM clients c
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Create trigger on activities table
CREATE TRIGGER auto_create_lead_trigger
  AFTER INSERT ON activities
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_lead_from_activity();

-- 12. Comment tables for documentation
COMMENT ON TABLE leads IS 'CRM Lead Pipeline - tracks prospects from initial contact to won/lost';
COMMENT ON TABLE lead_creation_rules IS 'Configuration for auto-creating leads from activities';

COMMENT ON COLUMN leads.contact_id IS 'Single customer record - links to contacts table';
COMMENT ON COLUMN leads.client_id IS 'Business/client association';
COMMENT ON COLUMN leads.source IS 'Where the lead came from (WhatsApp, Gmail, etc.)';
COMMENT ON COLUMN leads.activity_id IS 'Triggering activity that created this lead';
COMMENT ON COLUMN leads.status IS 'Pipeline stage (new_lead, contacted, qualified, quoted, follow_up, won, lost)';
COMMENT ON COLUMN leads.value IS 'Quote/deal value in GBP';
COMMENT ON COLUMN leads.next_follow_up_date IS 'When to follow up (highlight if overdue in UI)';
COMMENT ON COLUMN leads.won_lost_reason IS 'Why the lead was won or lost (filled when closed)';
