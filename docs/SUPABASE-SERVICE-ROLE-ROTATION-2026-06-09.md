# Supabase Service Role Key Rotation — 2026-06-09

## Why this needs doing
The current `SUPABASE_SERVICE_ROLE_KEY` must be treated as compromised because it was exposed during live troubleshooting.

## Supabase project
- Project ref: `nmebpawvnhrokouksvir`
- URL: `https://nmebpawvnhrokouksvir.supabase.co`

## What was hardened before rotation
### TaskifiAI Dashboard
- `/src/app/api/test-env/route.ts`
  - now returns 404 outside development
  - no longer exposes env-string lengths
- Removed one-off local password reset script:
  - `/home/dpmcg/.openclaw/workspace/taskifiai-dashboard/scripts/reset-supabase-password.mjs`

### SocialDrive AI
- `/src/lib/supabase/admin.ts`
  - removed hardcoded fallback URL/key pattern
  - now requires real env vars
- These routes now return 404 outside development and no longer expose key metadata:
  - `/src/app/api/debug-env/route.ts`
  - `/src/app/api/test-env/route.ts`
  - `/src/app/api/check-env/route.ts`
  - `/src/app/api/test-supabase-admin/route.ts`
  - `/src/app/api/debug-anthropic/route.ts`
  - `/src/app/api/test-minimal/route.ts`

## Confirmed deployment surfaces that need the new key
### 1) Vercel — taskifiai-dashboard
Confirmed by `npx vercel env ls`:
- `SUPABASE_SERVICE_ROLE_KEY` → Preview
- `SUPABASE_SERVICE_ROLE_KEY` → Production

Also present there:
- `NEXT_PUBLIC_SUPABASE_URL` → Development, Preview, Production
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Development, Preview, Production

### 2) Vercel — socialdrive-ai
Confirmed by `npx vercel env ls`:
- `SUPABASE_SERVICE_ROLE_KEY` → Production
- `SUPABASE_URL` → Production
- `NEXT_PUBLIC_SUPABASE_URL` → Production
- `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` also present

Note: only Production showed for `SUPABASE_SERVICE_ROLE_KEY` in this project at the time checked.

### 3) Local repos / scripts that may still expect the key
These are code references, not proof the key is stored locally:
- `/home/dpmcg/.openclaw/workspace/taskifiai-dashboard/src/lib/supabase.ts`
- `/home/dpmcg/.openclaw/workspace/taskifiai-dashboard/src/app/api/clients/[id]/staff/route.ts`
- `/home/dpmcg/.openclaw/workspace/taskifiai-dashboard/src/app/api/clients/[id]/brand-context/route.ts`
- `/home/dpmcg/.openclaw/workspace/taskifiai-dashboard/src/app/api/clients/[id]/connect-upload-post/route.ts`
- `/home/dpmcg/.openclaw/workspace/socialdrive-ai/src/lib/supabase/admin.ts`
- `/home/dpmcg/.openclaw/workspace/socialdrive-ai/src/app/api/agency/clients/route.ts`
- `/home/dpmcg/.openclaw/workspace/socialdrive-ai/src/app/api/agency/submissions/[id]/route.ts`
- `/home/dpmcg/.openclaw/workspace/socialdrive-ai/src/app/api/upload/image/route.ts`
- `/home/dpmcg/.openclaw/workspace/socialdrive-ai/src/app/api/submissions/upload/[token]/submit/route.ts`

### 4) Other possible local/runtime consumers to check manually
Not verified as active, but docs/workspaces indicate they may use Supabase credentials:
- `/home/dpmcg/.openclaw/workspace/projects/socialdrive-ai-processor/.env`
- Railway-hosted MCP / processor services tied to SocialDrive infrastructure
- Any local shell history, scratch files, or temporary `.env` copies created during troubleshooting

## Exact rotation sequence
### Step 1 — Rotate in Supabase
In Supabase Dashboard:
1. Open project `nmebpawvnhrokouksvir`
2. Go to Settings / API
3. Rotate the `service_role` key
4. Copy the new key once

Do not rotate first unless you are ready to immediately update dependent services below.

### Step 2 — Update Vercel: taskifiai-dashboard
Set the new `SUPABASE_SERVICE_ROLE_KEY` in:
- Production
- Preview

Then redeploy the project.

### Step 3 — Update Vercel: socialdrive-ai
Set the new `SUPABASE_SERVICE_ROLE_KEY` in:
- Production
- Preview too if you add/use it there

If `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` are both in use, leave them unchanged unless the project URL also changed.

Then redeploy the project.

### Step 4 — Update Railway / other processors
Any Railway service, background processor, or local `.env` using the old key must be updated before those jobs run again.
Likely places to check:
- SocialDrive MCP / processor service env vars
- `projects/socialdrive-ai-processor/.env`
- any shell exports in deployment scripts or service configs

### Step 5 — Remove stale local values
Check and replace/remove old values in:
- local `.env` files
- temporary notes
- shell history if the key was pasted directly
- any scratch scripts created for debugging

### Step 6 — Verify after propagation
After updating all services:
1. Taskifiai-dashboard: load a page that hits an admin API route
2. Socialdrive-ai: test one route that requires server-side Supabase access
3. Confirm no 401/403 errors in Vercel logs
4. Re-test login and one write path if possible

## Recommended verification commands
### Taskifiai-dashboard Vercel env names
```bash
cd /home/dpmcg/.openclaw/workspace/taskifiai-dashboard
npx vercel env ls
```

### Socialdrive-ai Vercel env names
```bash
cd /home/dpmcg/.openclaw/workspace/socialdrive-ai
npx vercel env ls
```

### Git status after hardening
```bash
git -C /home/dpmcg/.openclaw/workspace/taskifiai-dashboard status --short
git -C /home/dpmcg/.openclaw/workspace/socialdrive-ai status --short
```

## Current status at time of writing
- Key not rotated yet in Supabase by this doc alone
- Repo hardening completed for the most obvious leaks / debug surfaces
- One-off password reset helper removed locally
- Remaining work is primarily dashboard/env rotation and redeploy propagation
