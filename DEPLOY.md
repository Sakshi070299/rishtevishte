# Deploy RishteNate (frontend + backend on Vercel, DB on Neon)

This is the **all-Vercel + Neon free tier** edition of the project. No Railway, no Docker host, no paid Postgres needed.

## Target architecture

| Part     | Platform | Notes |
|----------|----------|-------|
| Frontend | **Vercel** (Next.js) | Same project, root dir `frontend` |
| Backend  | **Vercel serverless** (NestJS via `serverless-http`) | Separate Vercel project, root dir `backend`, entrypoint `backend/api/index.ts` |
| Database | **Neon** (free Postgres, ~0.5 GB) | Pooled connection string, `pgbouncer=true` |
| File uploads | `/tmp` (dev) → S3 / Cloudflare R2 (prod) | Vercel filesystem is read-only outside `/tmp`; R2 has a free 10 GB tier |

---

## 0) Prerequisite

Push this folder to GitHub (or GitLab / Bitbucket).

---

## 1) Create the Neon database

1. Sign up at [console.neon.tech](https://console.neon.tech) — free tier, no credit card.
2. **Create project** → name it `rishtenate`, region close to your Vercel region (e.g. `aws-ap-south-1`).
3. Open **Connection details** and copy the **Pooled connection** string. It looks like:

   ```
   postgresql://USER:PASSWORD@ep-xxxxx-pooler.REGION.aws.neon.tech/rishtenate?sslmode=require
   ```

4. Append the serverless-friendly params:

   ```
   ?sslmode=require&pgbouncer=true&connect_timeout=15
   ```

5. (Optional) From the same page copy the **Direct connection** string (host without `-pooler`) — you only need this if you plan to run `prisma migrate deploy` from CI.

---

## 2) Push the schema to Neon (one-time)

From your laptop:

```bash
cd backend
cp .env.example .env       # then edit DATABASE_URL with the Neon URL above
pnpm install
pnpm prisma:generate
pnpm prisma:push           # creates all tables on Neon
pnpm prisma:seed           # optional: seed admin/team accounts
```

`prisma db push` is fine for the free-tier path. If you want migration history, use `pnpm prisma:migrate:deploy` against the **direct** (non-pooled) URL instead.

---

## 3) Deploy the backend on Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
2. **Root Directory:** `backend`
3. **Framework preset:** *Other* (Vercel will read `backend/vercel.json`).
4. Leave Build Command and Install Command blank — `backend/vercel.json` already pins:
   - install: `cd .. && pnpm install --frozen-lockfile --filter rishtenate-backend...`
   - build: `pnpm exec prisma generate && pnpm exec nest build`
5. **Environment Variables** (Project Settings → Environment Variables):

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | the pooled Neon URL from step 1 |
   | `JWT_SECRET` | long random string |
   | `JWT_EXPIRY` | `5h` |
   | `NODE_ENV` | `production` |
   | `FRONTEND_URL` | will be set after step 4 (e.g. `https://rishtenate-frontend.vercel.app`) |
   | `OTP_PROVIDER` | `mock` (or your real provider) |
   | `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | from Razorpay dashboard |
   | `UPLOAD_PROVIDER` | `local` (uses `/tmp`, ephemeral) or `r2` / `s3` for persistence |

6. Click **Deploy**.
7. After it finishes, open `https://<your-backend>.vercel.app/api/docs` — Swagger should load.

> **Cold-start tip:** the first request after idle takes ~2–4 s while Nest boots. The handler caches the app instance for warm requests.

---

## 4) Deploy the frontend on Vercel

1. **Add New → Project** → same repo, but **Root Directory:** `frontend`.
2. **Framework preset:** *Next.js* (auto-detected).
3. **Environment Variables:**

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_API_URL` | `https://<your-backend>.vercel.app/api/v1` |
   | `NEXT_PUBLIC_RAZORPAY_KEY_ID` | client-side Razorpay key |

4. **Deploy**, copy the resulting `https://rishtenate-frontend.vercel.app` URL.

---

## 5) Wire CORS

Go back to the **backend** project on Vercel → Environment Variables → set:

```
FRONTEND_URL=https://rishtenate-frontend.vercel.app
```

(or comma-separate multiple origins, e.g. preview + prod). Then **Redeploy** the backend so the new env takes effect.

---

## 6) File uploads on Vercel (important)

Vercel's lambda filesystem is read-only except for `/tmp`. With `UPLOAD_PROVIDER=local`, anything written disappears between cold starts. For real persistence on the free tier, use **Cloudflare R2**:

1. Cloudflare → R2 → create bucket `rishtenate-photos`, enable **Public Access**.
2. Create an R2 API token (read & write).
3. On the backend Vercel project, set:

   ```
   UPLOAD_PROVIDER=r2
   R2_ACCOUNT_ID=...
   R2_BUCKET_NAME=rishtenate-photos
   R2_ACCESS_KEY=...
   R2_SECRET_KEY=...
   R2_PUBLIC_DOMAIN=pub-xxxx.r2.dev
   ```

4. Redeploy.

---

## 7) Cron / scheduled cleanup

`@nestjs/schedule` (used by `CleanupService`) only runs while a Nest process is alive. On Vercel serverless, that's only inside an active request. If you need scheduled cleanup, use **Vercel Cron Jobs** (free tier: 2 jobs):

```json
// backend/vercel.json
"crons": [
  { "path": "/api/v1/admin/cleanup", "schedule": "0 3 * * *" }
]
```

(then expose a small admin route guarded by a header secret).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `P1001` / can't reach DB | Make sure `DATABASE_URL` uses the `-pooler` host with `sslmode=require&pgbouncer=true`. Direct host hits Neon's auto-suspend cold start more aggressively. |
| `Cannot find module 'express'` on backend | `express` must stay in `dependencies` (not devDeps). |
| CORS error in browser | `FRONTEND_URL` on the backend must exactly match the browser origin (scheme + host, no trailing slash). |
| 504 / 500 on first hit | Cold start; retry. If it persists, check the function log in Vercel → Deployments → Functions. |
| Uploads disappear after a few minutes | `local` provider stores in `/tmp` (ephemeral on Vercel). Switch to `r2` or `s3`. |
| Prisma engine error on Vercel | `binaryTargets` already includes `rhel-openssl-3.0.x` in `schema.prisma`. Re-run a deploy so `prisma generate` runs in the Vercel build. |

---

**।। जय श्री राम ।।**
