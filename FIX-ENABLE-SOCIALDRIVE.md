# Fix: "Client name is required" Error When Enabling SocialDrive

**Date:** 2026-05-19  
**Issue:** When trying to enable SocialDrive AI for a client in TaskifiAI dashboard, error appeared: "Client name is required"

---

## Root Cause

The TaskifiAI dashboard was sending the wrong field names to the SocialDrive AI API:

### ❌ What Was Being Sent (WRONG)
```json
{
  "business_name": "Kitchens Direct",
  "contact_name": "Liam",
  "email": "liam@kitchensdirect.ie",
  "phone": "+353 87 123 4567",
  "instagram_handle": "@kitchensdirect",
  "brand_profile": {},
  "tier": "pro"
}
```

### ✅ What SocialDrive AI Expects (CORRECT)
```json
{
  "name": "Kitchens Direct",
  "industry": "Retail",
  "tier": "pro"
}
```

The SocialDrive AI API checks specifically for `name` field:
```typescript
if (!name || !name.trim()) {
  return NextResponse.json(
    { error: 'Client name is required' },
    { status: 400 }
  )
}
```

---

## Changes Made

### File: `/home/dpmcg/.openclaw/workspace/taskifiai-dashboard/src/app/api/clients/[id]/enable-socialdrive/route.ts`

**1. Fixed Request Body**
```typescript
// BEFORE
body: JSON.stringify({
  business_name: client.business_name,
  contact_name: client.contact_name,
  email: client.email,
  phone: client.phone,
  instagram_handle: client.instagram_handle,
  brand_profile: client.brand_profile,
  tier: client.subscription_tier
})

// AFTER
body: JSON.stringify({
  name: client.business_name,  // SocialDrive expects 'name'
  industry: client.industry || 'General',
  tier: client.subscription_tier
})
```

**2. Fixed Response Parsing**
```typescript
// BEFORE
const updatedClient = await enableSocialDrive(clientId, {
  account_id: accountData.client_id,
  upload_url: accountData.upload_url,
  dashboard_url: accountData.dashboard_url
})

// AFTER
const updatedClient = await enableSocialDrive(clientId, {
  account_id: accountData.client.id,  // SocialDrive returns nested 'client.id'
  upload_url: accountData.client.upload_url,
  dashboard_url: accountData.client.review_url  // Using review_url as dashboard
})
```

**3. Cleaned Up Unused Code**
- Removed `createSubscription` import (billing not implemented yet)
- Removed `getProductId` helper function
- Added TODO comment for future billing implementation

---

## Testing

### How to Test
1. Go to https://taskifiai-dashboard.vercel.app/
2. Click on any existing client (or create a new one)
3. In the "Active Products" sidebar, click **"Enable"** next to SocialDrive AI
4. Should successfully enable and show "Active" status
5. Quick links should appear for dashboard access

### Expected Result
- ✅ Client created in SocialDrive AI
- ✅ Upload link generated
- ✅ Review link generated
- ✅ TaskifiAI client record updated with `socialdrive_enabled: true`
- ✅ No errors shown

---

## API Endpoints Involved

**TaskifiAI → SocialDrive AI**
```
POST https://socialdrive-ai.vercel.app/api/agency/clients
```

**Response Format (SocialDrive AI)**
```json
{
  "success": true,
  "client": {
    "id": "uuid-here",
    "name": "Kitchens Direct",
    "industry": "Retail",
    "upload_url": "https://socialdrive-ai.vercel.app/upload/token123",
    "review_url": "https://socialdrive-ai.vercel.app/review/token456"
  }
}
```

---

## Related Files

- `/home/dpmcg/.openclaw/workspace/taskifiai-dashboard/src/app/api/clients/[id]/enable-socialdrive/route.ts` (FIXED)
- `/home/dpmcg/.openclaw/workspace/socialdrive-ai/src/app/api/agency/clients/route.ts` (API reference)
- `/home/dpmcg/.openclaw/workspace/taskifiai-dashboard/.env.local` (contains SOCIALDRIVE_API_URL)

---

## Next Steps

1. ✅ Fix deployed to Vercel
2. ⏳ Test with existing client
3. ⏳ Verify SocialDrive account creation
4. ⏳ Test upload link functionality
5. ⏳ Implement billing/subscription tracking (TODO)

---

**Status:** ✅ FIXED - Ready to test
