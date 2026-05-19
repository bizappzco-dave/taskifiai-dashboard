# Client Onboarding Form

**Use this to capture all client details before creating in TaskifiAI**

---

## Form Fields (Google Form / Typeform / Web Form)

### Business Information
- **Business Name** (required)
  - Example: "No Label Academy"
  
- **Industry** (dropdown)
  - Barber/Beauty
  - Fitness/Gym
  - Restaurant/Cafe
  - Retail
  - Professional Services
  - Real Estate
  - Education
  - Other

- **Website** (optional)
  - Example: "https://nolabel.ie"

---

### Contact Information
- **Your Name** (required)
  - Example: "Glenn Smith"

- **Email Address** (required)
  - Example: "glenn@nolabel.ie"

- **Phone Number** (required)
  - Example: "+353 87 123 4567"

---

### Social Media
- **Instagram Handle** (optional but recommended)
  - Example: "@nolabelacademy"

- **Facebook Page** (optional)
  - Example: "NoLabelAcademy"

- **LinkedIn URL** (optional)
  - Example: "linkedin.com/company/nolabel"

---

### Brand Profile
- **Brand Voice** (dropdown)
  - Professional & Polished
  - Friendly & Approachable
  - Bold & Edgy
  - Luxurious & Exclusive
  - Fun & Playful

- **Target Audience** (text)
  - Example: "Aspiring barbers, students aged 18-35, industry professionals"

- **Main Services** (text)
  - Example: "Barber training courses, certification programs, advanced workshops"

- **Key Competitors** (text, optional)
  - Example: "Other barber academies in Dublin"

---

### Product Selection
- **Which products do you want?** (checkboxes)
  - ☐ Lite-Sites (€49/mo)
  - ☐ SocialDrive AI (€99/mo)
  - ☐ DM Champ (€179/mo)

- **Subscription Tier** (dropdown)
  - Starter (€49-99/mo depending on products)
  - Pro (€149-249/mo)
  - Enterprise (€299+/mo)

---

### Additional Notes
- **Anything else we should know?** (text, optional)
  - Example: "Launching new course in June, want to focus on student recruitment"

---

## After Submission

**What happens:**

1. ✅ Client created in TaskifiAI database
2. ✅ Activity logged: "Client onboarded"
3. ✅ Welcome email sent to client
4. ✅ If SocialDrive selected → Auto-provision sub-account
5. ✅ If DM Champ selected → Auto-provision sub-account
6. ✅ Dashboard updated with new client

**Time:** < 30 seconds (fully automated)

---

## Manual Entry (Alternative)

If not using a form, create client via API:

```bash
curl -X POST http://localhost:3000/api/clients \
  -H "Content-Type: application/json" \
  -d '{
    "business_name": "No Label Academy",
    "contact_name": "Glenn",
    "email": "glenn@nolabel.ie",
    "phone": "+353871234567",
    "instagram_handle": "@nolabelacademy",
    "industry": "Education",
    "brand_profile": {
      "voice": "Professional, aspirational",
      "target_audience": "Aspiring barbers, students",
      "services": "Barber training courses"
    }
  }'
```

---

## Quick Add (For You)

**Minimal info to get started:**
- Business name
- Email
- Phone

**Add the rest later** via dashboard or API.
