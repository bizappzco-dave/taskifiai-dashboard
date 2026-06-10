# Gmail Integration Architecture for TaskifiAI CRM

## Overview

This document outlines the Gmail integration that automatically:
- Connects to business Gmail accounts via OAuth
- Fetches emails and categorizes them with AI
- Creates leads/support tickets from relevant emails
- Logs all communication to the unified activities table

## Architecture

```
Gmail API
    ↓
Webhook Handler (Pub/Sub or Polling)
    ↓
Email Parser + AI Categorizer
    ↓
CRM Actions:
  - Create Lead (if new inquiry)
  - Create Activity (log email)
  - Create Task (if follow-up needed)
    ↓
Supabase Database
```

## Components

### 1. OAuth Connection
- Google OAuth 2.0 flow
- Scopes: `gmail.readonly`, `gmail.modify`, `gmail.labels`
- Refresh token storage (encrypted)

### 2. Email Fetching
- Option A: Gmail Pub/Sub (real-time push)
- Option B: Periodic polling (simpler)
- Starting with Option B for MVP

### 3. AI Categorization
Categories from crm.md:
- **Lead** - New business inquiry
- **Support** - Existing client issue
- **Review** - Review-related
- **Quote** - Pricing/quote request
- **Urgent** - Needs immediate attention
- **Spam** - Ignore

### 4. CRM Actions
Based on category:
- Lead → Create lead record
- Support → Create task for support team
- Quote → Create lead + mark as hot
- Urgent → Create task + send alert

## Database Schema

```sql
-- Gmail credentials table (already exists: gmb_credentials, can extend)
-- Add gmail-specific columns or create separate table

-- Email categorization log
CREATE TABLE email_categorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id),
    gmail_message_id TEXT NOT NULL,
    from_email TEXT,
    from_name TEXT,
    subject TEXT,
    category TEXT CHECK (category IN ('lead', 'support', 'review', 'quote', 'urgent', 'spam')),
    confidence DECIMAL(3,2), -- AI confidence 0.00-1.00
    summary TEXT, -- AI-generated summary
    action_taken TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Implementation Phases

### Phase 1: OAuth Setup
- [ ] Google Cloud Console app registration
- [ ] OAuth consent screen
- [ ] Callback handler
- [ ] Token storage

### Phase 2: Email Fetching
- [ ] Polling job (every 5 minutes)
- [ ] Message parsing
- [ ] Deduplication (by message ID)

### Phase 3: AI Categorization
- [ ] Claude API integration
- [ ] Prompt engineering
- [ ] Confidence threshold (e.g., 0.7)

### Phase 4: CRM Integration
- [ ] Create leads from emails
- [ ] Log activities
- [ ] Create tasks for urgent items

## Security Considerations

1. **Token Storage**: Encrypt refresh tokens in database
2. **Scope Minimization**: Only request necessary Gmail scopes
3. **Data Retention**: Don't store email content, only metadata
4. **PII Handling**: Mask personal information in logs

## Next Steps

1. Register Google Cloud app
2. Implement OAuth flow
3. Build polling worker
4. Test with sample emails

---

## Quick Start (When Ready)

```bash
# Set up environment
export GOOGLE_CLIENT_ID="your-client-id"
export GOOGLE_CLIENT_SECRET="your-secret"

# Run OAuth setup
python3 scripts/setup_gmail_oauth.py

# Start email worker
python3 workers/gmail_poller.py
```
