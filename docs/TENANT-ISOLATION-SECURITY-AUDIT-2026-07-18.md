# Tenant isolation and security audit — 2026-07-18

Project: `taskifiai-dashboard`

Repo audited: `/home/dpmcg/workspace/repos/taskifiai-dashboard`

Baseline checked:
- Branch: `main`
- HEAD: `a1c70d0 feat: add Ad Reports link to dashboard and client detail page`
- Working tree at audit time was not clean: `git status --short | wc -l` returned `41`. These were pre-existing local changes/untracked paths. This audit intentionally did not change implementation files.

## Executive summary

The dashboard has a clear intended tenant model: each client row belongs to an owner user and can also be visible to users listed in `client_staff_access`. Several newer read paths use that model correctly, and multiple migrations add RLS policies for client-scoped tables.

However, the current baseline is **not ready for Ultra Marketing dashboard access or broader multi-tenant client login**. The biggest issue is that many API routes use the Supabase service-role client and accept a URL/body `client_id` without first proving that the caller has access to that client. Because service-role bypasses RLS, these routes create cross-tenant read/write and product-provisioning risks.

Do not add the Ultra Marketing assistant workspace, approval queue, or connector controls until the P0/P1 items below are fixed and regression-tested.

## Current tenant model observed

### Auth/session

- Browser/dashboard pages call `requireDashboardUser()`, which reads the current Supabase auth user from the publishable-key client (`src/lib/dashboard-data.ts:63-66`).
- Shared client loading uses `loadAccessibleClients(userId)`, combining:
  - owned clients where `clients.user_id = userId` (`src/lib/dashboard-data.ts:72-76`), and
  - staff-linked clients through `client_staff_access.user_id = userId` (`src/lib/dashboard-data.ts:80-83`).
- Route-level auth helper `getClientAccessFromRequest(request, clientId)` validates a bearer token with Supabase auth, then checks owned-client access followed by `client_staff_access` membership (`src/lib/client-access.ts:22-60`).
- Role ordering exists in `roleAtLeast()` (`viewer < staff < editor < manager < owner`) (`src/lib/client-access.ts:10-20`). It is only used by a small subset of content/posting API routes.

### Supabase clients

- `getSupabase()` uses URL + publishable/anon key and should respect RLS (`src/lib/supabase.ts:25-31`).
- `getSupabaseAdmin()` uses `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` and bypasses RLS (`src/lib/supabase.ts:33-44`). This is necessary for server automation, but every route using it must perform explicit app-layer auth/authorization first.

### RLS/migrations

Positive baseline:
- CRM tables `contacts`, `tasks`, `notes`, `messages`, and `submissions` have owner/staff-scoped RLS policies in `supabase/migrations/001_unified_crm_phase1.sql:126-290`.
- Activities were hardened to authenticated owner/staff reads; webhook/server writes are intended to use service role only (`supabase/migrations/007_harden_activity_views_and_function_grants.sql:10-31`).
- Activity views were rebuilt as `security_invoker` and grants tightened (`supabase/migrations/007_harden_activity_views_and_function_grants.sql:32-89`).
- Content/posting tables have owner/staff-scoped RLS policies (`supabase/migrations/008_add_rls_policies_for_content_and_posting_tables.sql:18-158` and continued for preferences/jobs/results).
- `client_reports` has RLS policies and private `client-reports` storage bucket access based on the first path segment matching an accessible `client_id` (`supabase/migrations/010_create_client_reports.sql:38-158`).
- Public listing for `client-images` was dropped (`supabase/migrations/009_drop_public_listing_on_client_images.sql:1-7`).

Important gap:
- RLS is not a sufficient protection for routes using `getSupabaseAdmin()`. Service-role bypasses the RLS policies above, so app-layer access checks are mandatory.

## API route risk map

### Routes with explicit client-access guard

These are closest to the desired pattern:

- `POST /api/client/posts/create` checks `getClientAccessFromRequest()` and requires at least `editor` (`src/app/api/client/posts/create/route.ts:18-60`).
- `POST /api/client/posting/publish` checks `getClientAccessFromRequest()` and requires at least `editor` before selecting posts for the requested client (`src/app/api/client/posting/publish/route.ts:63-124`).
- `GET /api/client/reports` checks `getClientAccessFromRequest()` before listing reports and generating signed URLs (`src/app/api/client/reports/route.ts:23-59`).
- `GET /api/clients/[id]/invoices` checks `getClientAccessFromRequest()` (`src/app/api/clients/[id]/invoices/route.ts:11-37`).
- `GET /api/clients/[id]/invoices/[invoiceId]` checks `getClientAccessFromRequest()` and verifies `invoice.client_id === params.id` (`src/app/api/clients/[id]/invoices/[invoiceId]/route.ts:11-40`).

### P0 routes with missing explicit auth/authorization

These routes should be treated as blockers before Ultra Marketing access work:

1. `GET /api/clients`
   - Calls `getClients()`, which uses service-role and returns all clients (`src/app/api/clients/route.ts:5-15`; `src/lib/queries.ts:21-35`).
   - Risk: unauthenticated/global client listing if exposed.

2. `GET /api/clients/[id]` and `PATCH /api/clients/[id]`
   - Directly call `getClient(params.id)` and `updateClient(params.id, body)` with no caller check (`src/app/api/clients/[id]/route.ts:4-33`; `src/lib/queries.ts:66-90`, `src/lib/queries.ts:187-200`).
   - Risk: IDOR read/write across client records.

3. `GET /api/clients/[id]/activities`
   - Loads activities by URL client id with no caller check (`src/app/api/clients/[id]/activities/route.ts:4-28`).
   - Risk: cross-tenant activity feed disclosure.

4. `GET/PATCH /api/clients/[id]/brand-context`
   - Uses service-role, selects/updates/inserts by URL client id with no caller check (`src/app/api/clients/[id]/brand-context/route.ts:8-87`).
   - Risk: cross-tenant brand data read/write. This is especially sensitive for AI caption/assistant context.

5. `GET/POST /api/clients/[id]/staff`
   - Uses service-role, lists staff and inserts staff/invitation rows without caller check (`src/app/api/clients/[id]/staff/route.ts:8-177`).
   - Risk: unauthorized staff enumeration and membership grants.

6. Product enable/disable routes
   - `POST /api/clients/[id]/enable-socialdrive` updates tokens/subscriptions without caller check (`src/app/api/clients/[id]/enable-socialdrive/route.ts:10-72`).
   - `POST /api/clients/[id]/disable-socialdrive` clears tokens without caller check (`src/app/api/clients/[id]/disable-socialdrive/route.ts:4-27`).
   - `POST /api/clients/[id]/enable-dmchamp` can create external DM Champ subaccounts and create subscriptions without caller check (`src/app/api/clients/[id]/enable-dmchamp/route.ts:4-86`).
   - `POST /api/clients/[id]/disable-dmchamp` clears DM Champ fields without caller check (`src/app/api/clients/[id]/disable-dmchamp/route.ts:4-29`).
   - Risk: unauthorized product provisioning/deprovisioning and external side effects.

7. `GET/POST /api/clients/[id]/connect-upload-post`
   - Uses service-role by URL client id, can create an Upload-Post user, stores `upload_post_jwt`, and returns the raw JWT/connect URL without caller check (`src/app/api/clients/[id]/connect-upload-post/route.ts:11-150`).
   - Risk: social-account connection takeover and credential/token exposure.

8. `GET /api/agency/health`
   - Uses service-role and returns health metrics for all active clients without caller check (`src/app/api/agency/health/route.ts:32-87`).
   - Risk: global cross-client visibility from a public route.

### Webhook/internal ingress

- `POST /api/internal/reports/seo/upsert` is fail-closed on `TOTALSITEDATA_INTERNAL_SECRET` / `INTERNAL_API_SECRET`, validates a bearer/header secret, verifies target client exists, then uses service-role (`src/app/api/internal/reports/seo/upsert/route.ts:65-99`). This is a reasonable internal-ingress pattern.
- `POST /api/internal/totalsitedata/promote` is similarly guarded by an internal secret (`src/app/api/internal/totalsitedata/promote/route.ts:49-95`).
- `POST /api/webhooks/revolut` verifies an HMAC only if a webhook secret is configured; if not configured, verification returns without error (`src/app/api/webhooks/revolut/route.ts:36-49`). This should fail closed in production.
- `POST /api/webhooks/socialdrive` and `POST /api/webhooks/dmchamp` accept arbitrary JSON and log webhook/activity data with no signature/shared secret (`src/app/api/webhooks/socialdrive/route.ts:5-46`; `src/app/api/webhooks/dmchamp/route.ts:5-46`). These should not be public-write routes without verification.
- `webhooks` table RLS allows all authenticated users all operations (`supabase/migrations/005_create_webhooks_table.sql:19-26`). Direct client access may be unlikely if only service-role code uses it, but the policy itself is broader than needed.

## Product/access model findings

Current product access is inferred from client fields and subscriptions:

- SocialDrive presence is inferred from booleans/tokens/URLs (`src/lib/dashboard-data.ts:48-56`).
- DM Champ presence is inferred from boolean/login URL (`src/lib/dashboard-data.ts:59-60`).
- Product enable routes create subscriptions opportunistically but do not use a central entitlement check before route actions (`src/app/api/clients/[id]/enable-socialdrive/route.ts:44-56`; `src/app/api/clients/[id]/enable-dmchamp/route.ts:59-76`).

For Ultra Marketing, this is not enough. The assistant workspace needs an explicit entitlement/access model that can answer:

- Is Ultra Marketing enabled for this client?
- Which authenticated user can access this client’s Ultra Marketing workspace?
- Which role can view reports, request content, approve posts, connect accounts, or manage staff?
- Is the subscription/payment state active, trialing, suspended, cancelled, or draft?

Recommended direction: add a normalized entitlement layer, or formalize `subscriptions` as the source of truth with status/role-aware checks, before exposing assistant controls.

## Storage findings

Positive:
- `client-reports` is private and uses server-generated signed URLs after app-layer client-access checks (`src/app/api/client/reports/route.ts:9-59`; `supabase/migrations/010_create_client_reports.sql:125-158`).
- `client-reports` paths are designed as `<client_id>/...`, enabling storage policy checks on the first folder segment (`supabase/migrations/010_create_client_reports.sql:142-158`).
- Public listing on `client-images` was removed (`supabase/migrations/009_drop_public_listing_on_client_images.sql:1-7`).

Risks:
- Any route that returns connect URLs/JWTs or signed URLs must have explicit app-layer access checks before using service-role. `connect-upload-post` currently does not.
- Ultra Marketing generated files should follow the `client-reports` pattern: private bucket, first folder segment as `client_id`, short-lived signed URLs, and no public listing.

## Read-only verification results

Commands run from `/home/dpmcg/workspace/repos/taskifiai-dashboard`:

1. `npm run`
   - Result: only `dev`, `build`, and `start` scripts are defined.

2. `npm run build`
   - Result: failed with exit code `1` because local build-time Supabase env was not available to prerender `/pipeline`.
   - Important output: `NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is not set`.

3. `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=dummy SUPABASE_SECRET_KEY=dummy npm run build`
   - Result: passed with exit code `0`.
   - Note: build logged expected fetch failures against the dummy Supabase host, but completed route/page optimization.

4. `npx tsc --noEmit --pretty false`
   - Result: failed with exit code `2`.
   - Main failure class: Supabase typed-schema inference producing `never` for tables/routes, plus test imports ending with `.ts` and a missing declaration for side-effect CSS import.
   - Build currently hides this because `next.config.mjs` disables TypeScript and ESLint checks during build (`next.config.mjs:3-10`).

5. `npm test`
   - Result: failed with `Missing script: "test"`.

## Priority remediation plan

### P0 — must fix before Ultra Marketing dashboard integration

1. Add a mandatory route guard for every client-scoped API route.
   - Reuse/extend `getClientAccessFromRequest()`.
   - Required shape: `requireClientRouteAccess(request, clientId, { minimumRole })`.
   - Fail closed with `401` for no/invalid token and `403` for authenticated users without access.

2. Replace all unauthenticated service-role reads/writes on client-scoped routes.
   - Minimum routes: `/api/clients`, `/api/clients/[id]`, activities, brand-context, staff, product enable/disable, connect-upload-post, agency health.
   - After guard passes, service-role may be used only for operations that cannot be done through RLS, and only on the already-authorized `clientId`.

3. Protect staff management.
   - List/add/remove/invite staff only for owner/manager roles.
   - Validate `role` input against an allowlist.
   - Prevent privilege escalation such as non-owner adding another owner.
   - Include `invitation_accepted = true` in access checks where applicable.

4. Lock down external side-effect routes.
   - Product provisioning, Upload-Post connection, and account/token routes should require at least manager/owner.
   - Never return long-lived JWTs/tokens to a caller unless the caller is authorized and the token is truly intended for that user.

5. Fail closed on webhooks.
   - Revolut: reject if production webhook secret is missing.
   - SocialDrive/DM Champ: require signature or shared secret, verify source, and validate payload schema before logging activity.

### P1 — required for safe Ultra Marketing pilot

1. Introduce an explicit Ultra Marketing entitlement.
   - Either formalize `subscriptions` as entitlement source or add `client_product_entitlements`.
   - Include `client_id`, `product_slug`, `status`, `enabled_at`, `disabled_at`, `billing_state`, and audit metadata.

2. Add role-aware permissions.
   - Suggested minimum:
     - `owner`: billing, staff, connectors, approvals, all reports.
     - `manager`: connectors, approvals, reports, content management.
     - `editor`: draft/create content and submit for approval.
     - `viewer`: read-only reports/status.
   - Encode this once and use it in API routes and UI gates.

3. Tighten RLS policies to account for role/status.
   - Existing owner/staff policies are a good base, but most policies treat any staff membership as broad CRUD.
   - Add `invitation_accepted = true` where membership grants access.
   - For high-risk tables, prefer role-aware policies or restrict writes to service-role-backed route handlers after explicit app auth.

4. Add audit logging for security-relevant actions.
   - Product enabled/disabled, connector linked/unlinked, staff invited/changed, report uploaded, approval accepted/rejected, assistant action requested.
   - Store actor user id, client id, action, target, source route, and timestamp.

5. Add automated tenant-isolation tests.
   - User A cannot list/read/update User B clients.
   - Staff viewer cannot mutate client/brand/connectors.
   - Editor can create drafts but cannot connect external accounts.
   - Owner/manager can invite staff and manage connectors.
   - Internal routes reject missing/bad secrets.
   - Webhooks reject missing/bad signatures.

### P2 — quality gates

1. Re-enable or replace hidden build checks.
   - `next.config.mjs` currently skips TypeScript and ESLint during build.
   - Add explicit scripts such as `typecheck`, `lint`, and `test`.

2. Fix TypeScript schema/type drift.
   - Generate Supabase types or loosen the immediate generic usage deliberately.
   - Ensure `npx tsc --noEmit` can pass before treating the dashboard as pilot-ready.

3. Avoid build-time data fetching against production services.
   - Routes/pages that require Supabase should be dynamic or guarded so local build does not depend on live env/data.

## Ultra Marketing implementation gate

Proceed only after this checklist is green:

- [ ] Every client-scoped API route has an explicit auth/access guard.
- [ ] Agency/global routes require an authenticated agency/admin role or internal secret.
- [ ] Webhooks fail closed and validate signatures/secrets.
- [ ] Staff access checks include accepted membership and role-aware permissions.
- [ ] Product entitlement is centralized and can represent Ultra Marketing status.
- [ ] Private storage paths start with `client_id` and signed URLs are issued only after authorization.
- [ ] Cross-tenant regression tests exist and pass.
- [ ] `npm run build` and a standalone typecheck pass in the intended environment.

## Recommended next build sequence

1. Security patch batch: add shared API auth helpers and apply them route-by-route.
2. Tenant test batch: add route-level authorization regression tests.
3. Entitlement batch: add Ultra Marketing product/entitlement state without UI exposure.
4. Workspace shell batch: add Ultra Marketing dashboard pages as read-only, guarded by entitlement.
5. Report bridge batch: expose Brain/SEO/client reports through existing private report patterns.
6. Approval queue batch: add draft/approval actions with strict roles and audit logs.
7. Connector batch: add email/social/GBP/ads connectors one at a time, behind owner/manager gates.
