# 🙏 RishteNate — Temple Matrimony Platform

> Vercel + Neon (free DB) edition of the RishteNate matrimony platform for मंदिर, Geeta Colony, Delhi.

## Architecture

```
rishtenate/
├── backend/                    # NestJS API Server
│   ├── prisma/
│   │   └── schema.prisma       # PostgreSQL schema (9 tables)
│   ├── src/
│   │   ├── main.ts             # Bootstrap + Swagger
│   │   ├── app.module.ts       # Root module
│   │   ├── auth/               # OTP login (User + Team + Admin)
│   │   ├── users/              # User CRUD
│   │   ├── profiles/           # Bride/Groom registration + biodata
│   │   ├── search/             # Profile search + weekly limits
│   │   ├── teams/              # Temple volunteer panel
│   │   ├── admin/              # Admin control panel + settings
│   │   ├── donations/          # Registration + general donations
│   │   ├── reports/            # Analytics & reporting
│   │   ├── notifications/      # SMS / WhatsApp / Email
│   │   └── common/             # Guards, decorators, DTOs, filters
│   └── package.json
│
├── frontend/                   # Next.js 14 App Router
│   ├── src/
│   │   ├── app/
│   │   │   ├── auth/           # Login + OTP verification
│   │   │   ├── dashboard/      # User dashboard
│   │   │   ├── register/       # New bride/groom registration
│   │   │   ├── profiles/       # View/edit submitted profiles
│   │   │   ├── search/         # Search matches with filters
│   │   │   ├── team/           # Team volunteer panel
│   │   │   ├── admin/          # Admin control panel
│   │   │   ├── donation/       # Donation page
│   │   │   └── (public)/       # Public pages (about, gallery, events, contact)
│   │   ├── components/         # UI + Layout + Forms + Cards
│   │   ├── lib/                # API client, auth helpers
│   │   ├── types/              # TypeScript interfaces
│   │   ├── hooks/              # Custom React hooks
│   │   └── constants/          # App-wide constants
│   └── package.json
│
└── README.md
```

## Database Schema (9 Tables)

| Table | Purpose |
|-------|---------|
| `User` | Mobile-authenticated users |
| `Profile` | Bride/groom matrimony biodata |
| `Donation` | Registration + general donations |
| `SearchLog` | Weekly search tracking + fairness |
| `TeamMember` | Temple volunteer accounts |
| `AdminUser` | Admin accounts with full control |
| `SiteSettings` | Configurable system settings |
| `GalleryImage` | Temple gallery management |
| `Notification` | SMS/WhatsApp/Email log |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend | NestJS + TypeScript + Prisma ORM (Express adapter on Vercel via `serverless-http`) |
| Database | **Neon** — free serverless Postgres (pooled, `pgbouncer=true`) |
| Auth | Mobile OTP (mock → MSG91/Twilio) |
| Payment | Razorpay |
| File Storage | `/tmp` (dev) → Cloudflare R2 (free 10 GB) for prod |
| Hosting | **Vercel** for *both* frontend and backend — see [`DEPLOY.md`](./DEPLOY.md) |

## Quick Start (local)

```bash
# 0) one-time
pnpm install                     # at repo root — pnpm workspace installs both apps

# 1) backend
cd backend
cp .env.example .env             # paste your Neon DATABASE_URL
pnpm prisma:generate
pnpm prisma:push                 # creates tables on Neon
pnpm prisma:seed                 # optional
pnpm start:dev                   # http://localhost:4000/api/docs

# 2) frontend (in another shell)
cd frontend
cp .env.example .env.local       # NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
pnpm dev                         # http://localhost:3000
```

## Deploy

Both apps go to Vercel as **two separate projects** (root dir `frontend` and root dir `backend`). DB is Neon free tier. Full step-by-step in [`DEPLOY.md`](./DEPLOY.md).

## API Endpoints Summary

### Auth
- `POST /auth/send-otp` — Send OTP to mobile
- `POST /auth/verify-otp` — Verify OTP, return JWT
- `GET /auth/me` — Current user profile

### Profiles
- `POST /profiles` — Create bride/groom profile
- `GET /profiles` — List user's profiles
- `GET /profiles/:id` — Get profile detail
- `PATCH /profiles/:id` — Edit profile
- `PATCH /profiles/:id/settle` — Mark as settled

### Search
- `POST /search` — Search profiles with filters
- `GET /search/remaining` — Check weekly limit

### Team
- `GET /team/profiles` — Search all profiles
- `PATCH /team/profiles/:id` — Edit any profile
- `GET /team/export` — Export profiles (5 per batch)
- `GET /team/print` — Print registrations (date range)

### Admin
- `GET /admin/team` — List team members
- `POST /admin/team` — Add team member
- `DELETE /admin/team/:id` — Remove team member
- `PATCH /admin/settings` — Update system settings
- `POST /admin/gallery` — Upload gallery image
- `DELETE /admin/gallery/:id` — Delete gallery image
- `GET /admin/reports/registrations` — Registration reports
- `GET /admin/reports/donations` — Donation reports
- `GET /admin/reports/team-activity` — Team activity logs

### Donations
- `POST /donations` — Create donation
- `POST /donations/verify` — Verify Razorpay payment
- `GET /donations` — Donation history

---
**।। जय श्री राम ।।**


# 🧠 SYSTEM DESIGN PROMPT — MATRIMONY CRM PLATFORM (ADMIN + TEAM + MANAGER)

## 🎯 Objective
Build a role-based Matrimony CRM platform with Admin, Manager, and Team dashboards to handle user registrations, profile management, reporting, exports, and payments.

---

## 👥 User Roles
Define three roles with strict access control:

1. Admin (Super Admin)
2. Manager
3. Team Member

---

## 🔐 Authentication System
- Login via Mobile Number + OTP
- OTP verification required
- Use JWT/session after login

---

## 🧑‍💼 ADMIN PANEL FEATURES

### 1. Banner Management
- Add banner
- Delete banner

### 2. Data Export
- Export user/profile data with filters
- Export by:
  - Manager
  - Team

### 3. Gallery Management
- Add images
- Delete images

### 4. User & Team Management
- Add users (Manager/Team)
- Delete users
- Assign roles

### 5. Profile Limits Control
- Set weekly profile creation limits per team/manager

### 6. Content Management
- Edit static sections (Terms & Conditions, etc.)

### 7. Password Control
- Reset passwords for any user

---

## 📊 REPORTS & ANALYTICS

### Registration Reports:
- New registrations:
  - Weekly
  - Monthly
  - Yearly

### Sales Reports:
- Track payments/invoices
- Total sales:
  - Weekly
  - Monthly
  - Yearly

---

## 👤 USER PROFILE MODULE
- Create/Edit profile
- Store personal, family, and optional details
- Profile validity system (default: 8 months)
- Profile status:
  - Active
  - Inactive
  - Deactivated

---

## 👥 TEAM PANEL (STAFF DASHBOARD)

### Registration Features:
- Create new registrations:
  - Online
  - Offline

### Profile Management:
- Edit profile
- Deactivate profile

### Search System:
Search users by:
- Name
- Mobile number
- Registration date
- Registration number

### Actions:
- Print form
- Print card
- Download profile

### Export Rules:
- Limited export access
- Controlled by Admin

### Printing:
- Max ~10 profiles per print batch

---

## 🧑‍💼 MANAGER PANEL

- All Team panel features
- Additional permissions:
  - Export unlimited data
  - Access all profiles (Active + Inactive)

---

## 🔐 ROLE-BASED PERMISSIONS

| Feature              | Admin | Manager | Team |
|---------------------|------|--------|------|
| Add/Delete Users    | ✅   | ❌     | ❌   |
| Export Data         | ✅   | ✅ (Full) | ✅ (Limited) |
| Set Profile Limits  | ✅   | ❌     | ❌   |
| View All Profiles   | ✅   | ✅     | Limited |
| Edit Profile        | ✅   | ✅     | ✅   |

---

## ⚙️ SYSTEM RULES

- Profile validity: default 8 months
- Weekly profile creation limits enforced
- Export limits configurable
- Role-based access strictly enforced

---

## 🚀 OPTIONAL (RECOMMENDED ENHANCEMENTS)

- Audit logs (track all actions)
- Notification system (SMS/WhatsApp)
- Payment gateway integration (Stripe/Razorpay)
- Profile approval workflow
- Profile completion percentage system

---


# 🧠 SYSTEM DESIGN PROMPT — MATRIMONY PLATFORM (USER SIDE + FLOW + SEARCH)

## 🎯 Objective
Build a user-facing matrimony platform with OTP-based authentication, profile registration, search functionality, and limited profile access system.

---

## 🌐 HOME PAGE FEATURES

### Authentication Flow
- Sign Up / Sign In
  - Enter Mobile Number
  - OTP Verification
  - Redirect to User Dashboard

---

### Static Sections
- Contact Us:
  - Temple Location
  - Contact Number
  - Address  

- Other Sections:
  - Donation  
  - Upcoming Events  
  - Gallery  

---

## 🆕 USER REGISTRATION FLOW

### Step-by-Step Flow:
1. User clicks New Registration
2. Redirect to Form Page
3. Fill profile details
4. Upload photo
5. Proceed to Online Payment
6. On success → Registration Complete

---

## 📂 PROFILE MANAGEMENT (USER / TEAM SIDE)

### Submitted Profiles Section:
- View all submitted profiles

### Actions Available:
- Edit Profile → Save
- Deactivate Profile → Confirm → Save
- Print Form
- Download Form
- Print Card

---

## 🔍 SEARCH PROFILES MODULE

### Access Rule:
- User can view maximum 10 profiles per week

---

### Search Filters:

#### 1. Marital Status
- Yes  
- No  
- Annulled  

#### 2. Gender Category
- Bride  
- Groom  

#### 3. Age Filter
- Range:
  - From → To (e.g., 18–24, 24–26)

#### 4. Caste / Community
- Multi-select:
  - Punjabi  
  - Saini  
  - Hindu  
  - Others  

#### 5. Package / Budget Filter
- Range:
  - From → To (e.g., 50,000 – 70,000)

#### 6. Disability Filter
- Yes  
- No  

---

## ⚙️ SYSTEM RULES

- OTP-based login mandatory
- Profile creation requires payment
- Profile actions allowed post submission
- Weekly profile view limit: 10 profiles
- Filters must support multi-select and range queries

---

## 💳 PAYMENT SYSTEM

- Payment required during registration
- Online payment flow
- Mark profile as active only after successful payment

---

## 📄 PROFILE OUTPUT FEATURES

- Printable profile form
- Downloadable profile PDF
- Printable ID card

---

## 🚀 UX / PRODUCT REQUIREMENTS

- Keep onboarding simple (minimum required fields)
- Allow profile editing after submission
- Provide clear success confirmation after payment
- Optimize search filters for fast matchmaking
- Enforce weekly viewing limits at backend level

---

## 🔒 ACCESS CONTROL (USER SIDE)

- Logged-in users only can:
  - Search profiles
  - View limited profiles
  - Manage their profiles

---

## 📦 OUTPUT REQUIREMENTS

Generate:
1. User dashboard UI structure
2. Profile form schema
3. Search API with filters
4. Weekly usage limit logic
5. Payment integration flow
6. PDF/Print service for profiles

---

## ⚠️ NOTES

- Focus on performance for search queries
- Implement pagination + limit enforcement
- Ensure secure OTP authentication
- Avoid exposing sensitive user data

--