# Supplier Quote System

Internal tool for a car wrecker business to collect supplier quotes.

## Setup

### 1. Create a Supabase project

Go to supabase.com, create a new project.

### 2. Run the database schema

In your Supabase dashboard → SQL Editor, paste and run the contents of `supabase-schema.sql`.

### 3. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```
cp .env.local.example .env.local
```

Find your credentials in Supabase → Project Settings → API:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. Install and run

```bash
npm install
npm run dev
```

Open http://localhost:3000 — redirects to /admin.

---

## Pages

| Page | URL | Who uses it |
|------|-----|-------------|
| Admin Dashboard | /admin | You (internal) |
| Request Detail | /admin/[id] | You (internal) |
| Supplier Quote Form | /quote/[id] | Suppliers (shared link) |

## How it works

1. Go to /admin → click **New Request**
2. Fill in title + description → submit
3. A share link appears: /quote/[uuid]
4. Send that link to suppliers
5. Suppliers fill in their name, price, condition, notes
6. Return to /admin/[id] to see all quotes sorted by price (lowest first)
7. Close the request when done

## Deploy to Vercel

```bash
npx vercel
```

Add your environment variables in Vercel → Project → Settings → Environment Variables.
