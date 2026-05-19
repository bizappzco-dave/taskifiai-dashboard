# TaskifiAI Dashboard

**Master client management system for all products**

---

## Quick Start

### 1. Run Database Migration

1. Go to https://supabase.com/dashboard/project/dqhnxzaktnejasqlfrjf/sql/new
2. Copy the SQL from `/taskifiai-migration.sql`
3. Click "Run"
4. Verify tables created: `clients`, `products`, `subscriptions`, `activities`, `webhooks`

### 2. Set Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://dqhnxzaktnejasqlfrjf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Product APIs
SOCIALDRIVE_API_URL=https://socialdrive-ai.vercel.app/api
DMCHAMP_API_URL=https://api.dmchamp.com/v1
DMCHAMP_API_KEY=your-dmchamp-api-key
```

### 3. Install & Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

---

## Features

- ✅ Master client database (all products in one place)
- ✅ Auto-provision to SocialDrive AI
- ✅ Auto-provision to DM Champ (when API ready)
- ✅ Lite-Sites tracking
- ✅ Unified activity feed
- ✅ Webhook handling from both products

---

## API Endpoints

### `POST /api/clients`
Create new client

### `POST /api/clients/:id/enable-socialdrive`
Provision SocialDrive AI sub-account

### `POST /api/clients/:id/enable-dmchamp`
Provision DM Champ sub-account

### `POST /api/webhooks/socialdrive`
Receive webhooks from SocialDrive AI

### `POST /api/webhooks/dmchamp`
Receive webhooks from DM Champ

---

## Architecture

```
TaskifiAI (Master DB)
    ├── SocialDrive AI (auto-provisioned)
    ├── DM Champ (auto-provisioned)
    └── Lite-Sites (tracked)
```

**All clients created here first**, then enabled for products as needed.
