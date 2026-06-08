-- TaskifiAI CRM Phase 1: Unified Activity Feed + CRM Foundation
-- Purpose: Create unified activity logging layer and basic CRM tables
-- Date: 2026-06-08

-- ============================================
-- 1. ENHANCE ACTIVITIES TABLE
-- ============================================

-- Add missing columns to existing activities table
ALTER TABLE public.activities 
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id),
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS activity_category TEXT CHECK (activity_category IN ('communication', 'marketing', 'support', 'sales', 'operations')),
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMP;

-- Add index for fast activity feed queries
CREATE INDEX IF NOT EXISTS idx_activities_client_occurred 
  ON public.activities(client_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_activities_type 
  ON public.activities(activity_type);

CREATE INDEX IF NOT EXISTS idx_activities_contact 
  ON public.activities(contact_id);

-- ============================================
-- 2. CREATE CONTACTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT CHECK (role IN ('owner', 'manager', 'staff', 'customer', 'lead', 'supplier')),
  is_primary BOOLEAN DEFAULT false,
  company_name TEXT,  -- For B2B contacts
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contacts_client ON public.contacts(client_id);
CREATE INDEX idx_contacts_email ON public.contacts(email);

-- ============================================
-- 3. CREATE TASKS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id),
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  activity_id UUID REFERENCES public.activities(id),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tasks_client ON public.tasks(client_id);
CREATE INDEX idx_tasks_assigned ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_due ON public.tasks(due_date);

-- ============================================
-- 4. CREATE NOTES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id),
  author_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  is_ai_generated BOOLEAN DEFAULT false,
  activity_id UUID REFERENCES public.activities(id),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notes_client ON public.notes(client_id);
CREATE INDEX idx_notes_contact ON public.notes(contact_id);
CREATE INDEX idx_notes_author ON public.notes(author_id);

-- ============================================
-- 5. CREATE MESSAGES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id),
  direction TEXT CHECK (direction IN ('inbound', 'outbound')) NOT NULL,
  channel TEXT CHECK (channel IN ('email', 'whatsapp', 'facebook', 'instagram', 'linkedin', 'sms', 'call')) NOT NULL,
  subject TEXT,
  content TEXT NOT NULL,
  external_id TEXT,  -- Gmail message ID, WhatsApp message ID, etc.
  metadata JSONB,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_client ON public.messages(client_id);
CREATE INDEX idx_messages_contact ON public.messages(contact_id);
CREATE INDEX idx_messages_channel ON public.messages(channel);
CREATE INDEX idx_messages_sent ON public.messages(sent_at DESC);

-- ============================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on new tables
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Contacts policies
CREATE POLICY "Users can view contacts for their clients"
  ON public.contacts FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients 
      WHERE user_id = auth.uid() 
      OR id IN (SELECT client_id FROM public.client_staff_access WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert contacts for their clients"
  ON public.contacts FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients 
      WHERE user_id = auth.uid() 
      OR id IN (SELECT client_id FROM public.client_staff_access WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can update contacts for their clients"
  ON public.contacts FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM public.clients 
      WHERE user_id = auth.uid() 
      OR id IN (SELECT client_id FROM public.client_staff_access WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can delete contacts for their clients"
  ON public.contacts FOR DELETE
  USING (
    client_id IN (
      SELECT id FROM public.clients 
      WHERE user_id = auth.uid() 
      OR id IN (SELECT client_id FROM public.client_staff_access WHERE user_id = auth.uid())
    )
  );

-- Tasks policies
CREATE POLICY "Users can view tasks for their clients"
  ON public.tasks FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients 
      WHERE user_id = auth.uid() 
      OR id IN (SELECT client_id FROM public.client_staff_access WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can create tasks for their clients"
  ON public.tasks FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients 
      WHERE user_id = auth.uid() 
      OR id IN (SELECT client_id FROM public.client_staff_access WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can update tasks assigned to them or their clients"
  ON public.tasks FOR UPDATE
  USING (
    assigned_to = auth.uid() 
    OR client_id IN (
      SELECT id FROM public.clients 
      WHERE user_id = auth.uid() 
      OR id IN (SELECT client_id FROM public.client_staff_access WHERE user_id = auth.uid())
    )
  );

-- Notes policies
CREATE POLICY "Users can view notes for their clients"
  ON public.notes FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients 
      WHERE user_id = auth.uid() 
      OR id IN (SELECT client_id FROM public.client_staff_access WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can create notes for their clients"
  ON public.notes FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients 
      WHERE user_id = auth.uid() 
      OR id IN (SELECT client_id FROM public.client_staff_access WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can update their own notes"
  ON public.notes FOR UPDATE
  USING (author_id = auth.uid());

CREATE POLICY "Users can delete their own notes"
  ON public.notes FOR DELETE
  USING (author_id = auth.uid());

-- Messages policies
CREATE POLICY "Users can view messages for their clients"
  ON public.messages FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients 
      WHERE user_id = auth.uid() 
      OR id IN (SELECT client_id FROM public.client_staff_access WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert messages for their clients"
  ON public.messages FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients 
      WHERE user_id = auth.uid() 
      OR id IN (SELECT client_id FROM public.client_staff_access WHERE user_id = auth.uid())
    )
  );

-- ============================================
-- 7. FIX SUBMISSIONS RLS (CRITICAL SECURITY)
-- ============================================

-- Enable RLS on submissions table
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Submissions policies
CREATE POLICY "Users can view submissions for their clients"
  ON public.submissions FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients 
      WHERE user_id = auth.uid() 
      OR id IN (SELECT client_id FROM public.client_staff_access WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert submissions for their clients"
  ON public.submissions FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients 
      WHERE user_id = auth.uid() 
      OR id IN (SELECT client_id FROM public.client_staff_access WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can update submissions for their clients"
  ON public.submissions FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM public.clients 
      WHERE user_id = auth.uid() 
      OR id IN (SELECT client_id FROM public.client_staff_access WHERE user_id = auth.uid())
    )
  );

-- ============================================
-- 8. CREATE ACTIVITY LOGGING FUNCTION
-- ============================================

-- Helper function to log activities easily
CREATE OR REPLACE FUNCTION public.log_activity(
  p_client_id UUID,
  p_activity_type TEXT,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_activity_category TEXT DEFAULT NULL,
  p_source TEXT DEFAULT NULL,
  p_external_id TEXT DEFAULT NULL,
  p_contact_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO public.activities (
    client_id,
    activity_type,
    title,
    description,
    activity_category,
    source,
    external_id,
    occurred_at,
    contact_id,
    details
  ) VALUES (
    p_client_id,
    p_activity_type,
    p_title,
    p_description,
    p_activity_category,
    p_source,
    p_external_id,
    COALESCE(CLOCK_TIMESTAMP(), NOW()),
    p_contact_id,
    p_details
  ) RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. SEED EXAMPLE ACTIVITY TYPES
-- ============================================

-- Create a reference table for activity types (optional but useful for documentation)
CREATE TABLE IF NOT EXISTS public.activity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_name TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  default_title_template TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert standard activity types
INSERT INTO public.activity_types (type_name, category, description, default_title_template) VALUES
  -- Communication
  ('email_received', 'communication', 'Email received from contact', 'Email received from {{contact_name}}'),
  ('email_sent', 'communication', 'Email sent to contact', 'Email sent to {{contact_name}}'),
  ('whatsapp_received', 'communication', 'WhatsApp message received', 'WhatsApp message from {{contact_name}}'),
  ('whatsapp_sent', 'communication', 'WhatsApp message sent', 'WhatsApp message to {{contact_name}}'),
  ('facebook_dm_received', 'communication', 'Facebook DM received', 'Facebook DM from {{contact_name}}'),
  ('facebook_dm_sent', 'communication', 'Facebook DM sent', 'Facebook DM to {{contact_name}}'),
  ('instagram_dm_received', 'communication', 'Instagram DM received', 'Instagram DM from {{contact_name}}'),
  ('instagram_dm_sent', 'communication', 'Instagram DM sent', 'Instagram DM to {{contact_name}}'),
  ('call_received', 'communication', 'Phone call received', 'Call received from {{contact_name}}'),
  ('call_made', 'communication', 'Phone call made', 'Call made to {{contact_name}}'),
  
  -- Marketing
  ('gbp_post_published', 'marketing', 'Google Business Profile post published', 'GBP post published'),
  ('social_post_published', 'marketing', 'Social media post published', 'Social post published to {{platform}}'),
  ('content_uploaded', 'marketing', 'Content/assets uploaded', 'Content uploaded: {{filename}}'),
  
  -- Reputation
  ('review_received', 'reputation', 'New review received', 'New {{rating}}-star review from {{author_name}}'),
  ('review_replied', 'reputation', 'Review replied to', 'Replied to review from {{author_name}}'),
  ('review_flagged', 'reputation', 'Review flagged for removal', 'Review flagged for removal'),
  
  -- Sales
  ('lead_created', 'sales', 'New lead created', 'New lead: {{contact_name}}'),
  ('quote_requested', 'sales', 'Quote requested', 'Quote requested by {{contact_name}}'),
  ('quote_sent', 'sales', 'Quote sent to contact', 'Quote sent to {{contact_name}}'),
  ('deal_won', 'sales', 'Deal won', 'Deal won: {{contact_name}}'),
  ('deal_lost', 'sales', 'Deal lost', 'Deal lost: {{contact_name}}'),
  
  -- Operations
  ('site_visit_scheduled', 'operations', 'Site visit scheduled', 'Site visit scheduled for {{date}}'),
  ('service_completed', 'operations', 'Service completed', 'Service completed for {{contact_name}}'),
  ('task_created', 'operations', 'Task created', 'Task created: {{task_title}}'),
  ('task_completed', 'operations', 'Task completed', 'Task completed: {{task_title}}'),
  ('staff_login', 'operations', 'Staff member logged in', 'Staff login: {{user_email}}')

ON CONFLICT (type_name) DO NOTHING;

-- ============================================
-- 10. CREATE VIEWS FOR COMMON QUERIES
-- ============================================

-- Recent activity feed view
CREATE OR REPLACE VIEW public.recent_activities AS
SELECT 
  a.*,
  c.name AS client_name,
  ct.name AS contact_name,
  u.email AS user_email,
  at.description AS activity_description
FROM public.activities a
LEFT JOIN public.clients c ON a.client_id = c.id
LEFT JOIN public.contacts ct ON a.contact_id = ct.id
LEFT JOIN auth.users u ON a.user_id = u.id
LEFT JOIN public.activity_types at ON a.activity_type = at.type_name
ORDER BY a.occurred_at DESC;

-- Client activity summary (last 7 days)
CREATE OR REPLACE VIEW public.client_activity_summary AS
SELECT 
  c.id AS client_id,
  c.name AS client_name,
  COUNT(a.id) AS total_activities,
  COUNT(CASE WHEN a.activity_category = 'communication' THEN 1 END) AS communications,
  COUNT(CASE WHEN a.activity_category = 'marketing' THEN 1 END) AS marketing_activities,
  COUNT(CASE WHEN a.activity_category = 'sales' THEN 1 END) AS sales_activities,
  COUNT(CASE WHEN a.status = 'completed' THEN 1 END) AS completed_tasks
FROM public.clients c
LEFT JOIN public.activities a ON c.id = a.client_id 
  AND a.occurred_at >= NOW() - INTERVAL '7 days'
LEFT JOIN public.tasks t ON c.id = t.client_id 
  AND t.status = 'completed'
  AND t.completed_at >= NOW() - INTERVAL '7 days'
GROUP BY c.id, c.name;

COMMENT ON MIGRATION IS 'TaskifiAI CRM Phase 1: Unified Activity Feed + CRM Foundation

This migration creates the foundation for the Client Intelligence Layer:

1. Enhanced activities table with contact_id, user_id, category, source, external_id
2. New contacts table for people at client businesses
3. New tasks table for action items
4. New notes table for manual/AI-generated notes
5. New messages table for stored conversations
6. RLS policies on all new tables + fixed submissions RLS (was disabled!)
7. log_activity() helper function for easy activity logging
8. activity_types reference table with standard activity types
9. Views: recent_activities, client_activity_summary

Key architectural decisions:
- Everything resolves to client_id + contact_id (no duplicate records)
- Activities table is the central stream for all events
- RLS ensures users only see data for their clients
- Flexible metadata JSONB fields for future expansion

Next phases:
- Phase 2: Activity Feed UI component
- Phase 3: Google Workspace integration (Gmail, Calendar, Drive sync)
- Phase 4: Growth Score computation
- Phase 5: AI Business Assistant insights
';
