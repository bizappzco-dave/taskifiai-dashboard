# TaskifiAI Dashboard - UI Design Handoff for Codex

**Date:** 2026-06-08  
**Project:** TaskifiAI Dashboard (Client Portal)  
**Current State:** Backend functional, UI needs polish  
**Goal:** Professional, consistent design matching SocialDrive AI

---

## 🎨 Design References

### **Existing Designs to Match**

1. **SocialDrive AI Dashboard** (Already designed - use as reference)
   - URL: https://socialdrive-ai.vercel.app
   - Clean, card-based layout
   - Professional, minimal aesthetic
   - Consistent spacing, typography, colors

2. **Brand Guidelines**
   - Primary: Indigo (`#4F46E5` / `bg-indigo-600`)
   - Success: Green (`#10B981` / `bg-green-600`)
   - Background: Light gray (`#F9FAFB` / `bg-gray-50`)
   - Text: Dark gray (`#111827` / `text-gray-900`)

---

## 📄 Pages Needing Design Work

### **1. Main Dashboard** (`/`)
**Current:** Basic card layout, functional but plain  
**Needs:**
- Better visual hierarchy
- Improved card shadows/borders
- Consistent button styling
- Better empty states
- Loading skeletons (not just spinner)

**Reference:** SocialDrive AI main dashboard

---

### **2. Lead Pipeline** (`/pipeline`)
**Current:** Functional Kanban, basic styling  
**Needs:**
- Polished card design
- Better drag-and-drop visual feedback
- Stage headers with better visual distinction
- Improved lead card layout (contact info, value, follow-up)
- Add Lead modal (currently just a button with no action)
- Filter dropdown styling

**Reference:** Linear, Trello, or similar Kanban tools

---

### **3. Auth Pages** (`/auth/signin`, `/auth/callback`)
**Current:** Basic, functional  
**Needs:**
- Professional sign-in page design
- Better error states
- Loading states
- "Forgot password" flow UI
- Branding (logo, colors)

---

### **4. Client Detail Pages** (`/clients/[id]`)
**Current:** Exists but needs design review  
**Needs:**
- Consistent with main dashboard
- Tab navigation (Overview, Team, Settings, etc.)
- Better form styling
- Activity timeline (future feature)

---

### **5. Client Onboarding** (`/clients/new`)
**Current:** Basic form  
**Needs:**
- Multi-step wizard (optional)
- Better form validation UI
- Success/error states
- Tier selection UI (Core/Growth/Pro)

---

## 🧩 Components to Create

### **Shared UI Components** (Reusable)

```
/components/ui/
├── button.tsx          # Primary, secondary, ghost variants
├── card.tsx            # Card with header, content, footer
├── badge.tsx           # Status badges (tier, source, etc.)
├── input.tsx           # Text inputs with labels, validation
├── select.tsx          # Dropdown selects
├── dialog.tsx          # Modal/dialog component
├── tabs.tsx            # Tab navigation
├── skeleton.tsx        # Loading skeletons
├── toast.tsx           # Notification toasts
└── empty-state.tsx     # Empty state illustrations/messages
```

**Note:** Can use shadcn/ui OR build custom - whichever is faster.

---

## 🎯 Priority Order

1. **Main Dashboard** - Most visible, first impression
2. **Lead Pipeline** - New feature, needs polish
3. **Auth Pages** - Professional first touchpoint
4. **Client Detail** - Power user feature
5. **Client Onboarding** - Important but less frequent

---

## 🛠️ Technical Constraints

- **Framework:** Next.js 14.1.0 (App Router)
- **Styling:** Tailwind CSS (already configured)
- **Components:** React (functional components, hooks)
- **Icons:** lucide-react (already installed)
- **State:** React useState/useEffect (no Redux needed)
- **Data:** Supabase (already configured)

**Keep it simple:** No complex state management, no heavy animation libraries.

---

## 📝 Design Principles

1. **Clean over clever** - Simple, professional, no "mad" design elements
2. **Consistent** - Match SocialDrive AI styling
3. **Fast** - No heavy animations, minimal JavaScript
4. **Mobile-friendly** - Many clients check on phone
5. **Accessible** - Proper contrast, keyboard navigation

**What David Hates:**
- ❌ Bouncing pins, overlays, "busy" design
- ❌ Technical jargon visible to clients
- ❌ "Analyzing with AI..." status boxes
- ❌ Complex features when simple works

**What David Loves:**
- ✅ Simple, working solutions
- ✅ Magic happens behind the curtain
- ✅ Client sees: click → done
- ✅ Clean, professional, consistent

---

## 🔗 Existing Code References

- **Main Dashboard:** `/src/app/page.tsx` (card layout, working)
- **Pipeline:** `/src/app/pipeline/page.tsx` (functional, needs polish)
- **Sign In:** `/src/app/auth/signin/page.tsx` (basic, functional)
- **Supabase:** `/src/lib/supabase.ts` (already configured)
- **Tailwind Config:** `/tailwind.config.js` (colors, fonts)

---

## ✅ Definition of Done

A page is "done" when:
- [ ] Looks professional, not like a prototype
- [ ] Consistent with SocialDrive AI design
- [ ] Mobile-responsive (test on phone)
- [ ] Loading states (skeletons, not just spinners)
- [ ] Error states (helpful messages)
- [ ] Empty states (what to do next)
- [ ] Hover states (interactive feedback)
- [ ] Fast (no unnecessary animations)

---

## 🚀 How to Start

1. **Clone the repo:** https://github.com/bizappzco-dave/taskifiai-dashboard
2. **Run locally:** `npm install && npm run dev`
3. **Start with Main Dashboard** (`/src/app/page.tsx`)
4. **Match SocialDrive AI** (open in another tab for reference)
5. **Commit often** - small, testable changes

**First Task:** Redesign main dashboard cards to match SocialDrive AI quality.

---

## 📞 Questions?

- **Backend logic:** Already working, don't break it
- **Design direction:** Match SocialDrive AI
- **Unclear requirements:** Check this doc first, then ask

**David's preference:** Show 2-3 design variants quickly, pick one, iterate. Don't overthink the first version.

---

**Good luck! 🎨**
