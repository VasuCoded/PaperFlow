# PaperFlow — going live, step by step

This takes PaperFlow from a folder on your laptop to a live website:

- the code in a **private GitHub repository**
- a **Supabase** database (Postgres + sign-in), in Mumbai
- **Google sign-in** ("Continue with Google")
- the website on **Vercel**, redeployed automatically every time you push
- **Claude** able to work on the test database directly, so it can run
  migrations and fix things without you copying and pasting

Do the steps **in order** — later steps use values from earlier ones. Budget
about **3 hours** in total. Sections 1–6 get you a working test site; section 7
(the production database) can wait until you are ready for real institutes.

> **Commands are for Windows PowerShell.** Open it in the project folder
> (`C:\Users\Sanskar\Documents\..Projects\PaperFlow`). Where you see
> `<SOMETHING>` in angle brackets, replace it — angle brackets included — with
> your value.

---

## Contents

0. [Before you start](#0-before-you-start)
1. [Put the code on GitHub](#1-put-the-code-on-github-15-min)
2. [Create the test database on Supabase](#2-create-the-test-database-on-supabase-25-min)
3. [Set up Google sign-in](#3-set-up-google-sign-in-25-min)
4. [First sign-in on your laptop](#4-first-sign-in-on-your-laptop-15-min)
5. [Load test data and walk through the app](#5-load-test-data-and-walk-through-the-app-40-min)
6. [Put the website on Vercel](#6-put-the-website-on-vercel-25-min)
7. [Create the production database](#7-create-the-production-database-40-min)
8. [Custom domain (optional)](#8-custom-domain-optional-20-min)
9. [Let anyone sign in](#9-let-anyone-sign-in-5-min)
10. [Give Claude direct access to the test database](#10-give-claude-direct-access-to-the-test-database-10-min)
11. [Troubleshooting](#11-troubleshooting)
12. [Hand over to the next Claude session](#12-hand-over-to-the-next-claude-session)

---

## 0. Before you start

### 0.1 Accounts

Use **one dedicated Google account for the platform** (for example
`paperflow.platform@gmail.com`), with 2-step verification on and recovery
codes stored where a second trusted person can reach them. Every other account
below is created by signing in with it.

| Service | Used for | Cost |
|---|---|---|
| Google account | Owning everything; the Google Cloud project for sign-in | Free |
| [GitHub](https://github.com) | Hosting the code (private repository) | Free |
| [Supabase](https://supabase.com) | Database + sign-in | Free for 2 projects. A free project **pauses after 7 days without use**; unpause it from the dashboard |
| [Vercel](https://vercel.com) | Hosting the website | Hobby is free but **for personal, non-commercial use only**. Once institutes pay you, move to Pro (about $20/month) |
| [Google Cloud](https://console.cloud.google.com) | The "Continue with Google" button | Free |

### 0.2 Your values sheet

You will collect these as you go. Keep them in your **password manager** —
never in a chat, a document you share, or a file you commit.

| Value | Where it comes from | Step |
|---|---|---|
| Dev project ref (e.g. `abcdefghijklmnopqrst`) | Supabase dev project URL | 2.3 |
| Dev database password | You generate it | 2.2 |
| Dev Project URL | Supabase → Connect | 2.3 |
| Dev anon (publishable) key | Supabase → Connect | 2.3 |
| Dev service_role (secret) key | Supabase → Project Settings → API Keys | 2.3 |
| Dev session pooler connection string | Supabase → Connect | 2.3 |
| Google Client ID | Google Cloud → Clients | 3.5 |
| Google Client secret | Google Cloud → Clients (**shown once**) | 3.5 |
| Vercel domain (e.g. `paperflow-xyz.vercel.app`) | Vercel after first deploy | 6.5 |
| Prod: ref, password, URL, keys, connection string | Supabase prod project | 7 |

### 0.3 Check your tools

In PowerShell:

```powershell
git --version     # any recent version
node -v           # v20 or newer; v22 recommended
npm -v
```

If `node` is missing or older than 20, install the **LTS** version from
[nodejs.org](https://nodejs.org), then close and reopen PowerShell.

### 0.4 Check the project works on your machine

```powershell
cd "C:\Users\Sanskar\Documents\..Projects\PaperFlow"
npm install
npm test
```

Expect `Tests  282 passed` (or more) at the end.

```powershell
npm run build:check
```

Expect it to finish with a list of routes and no errors. If either fails, stop
and give the output to Claude.

---

## 1. Put the code on GitHub (15 min)

### 1.1 Create an empty private repository

1. Go to [github.com](https://github.com) and sign in.
2. Top right **+** → **New repository**.
3. **Owner:** your account. **Repository name:** `paperflow`.
4. **Visibility:** **Private**.
5. Leave **Add a README**, **.gitignore** and **license** all **off**. The
   repository must be empty, or the push in 1.3 is refused.
6. **Create repository**. Keep the page open; it shows the repository's URL,
   `https://github.com/<YOUR_GITHUB_USERNAME>/paperflow.git`.

### 1.2 Make sure no secrets are about to be uploaded

```powershell
git status
git ls-files | Select-String "env"
```

- `git status` should say `nothing to commit, working tree clean`.
- The second command should list **only** `.env.local.example`. If you ever
  see `.env.local`, stop — it holds keys and must never be pushed (it is
  already in `.gitignore`, so this is only a check).

### 1.3 Connect and push

```powershell
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/paperflow.git
git push -u origin main
git push origin --tags
```

- The first push opens a **browser window to sign in to GitHub** (Git
  Credential Manager). Sign in and authorise; the push continues on its own.
- Before uploading, the project's safety check runs and prints something like
  `db-guard: 21 .sql file(s) clean.` That is expected. It refuses pushes
  containing dangerous SQL (`DROP TABLE`, `TRUNCATE`, or `DELETE` without
  `WHERE`).

### 1.4 Check it arrived, and switch off two workflows for now

1. Refresh the repository page: all folders (`src`, `docs`, `supabase`, …)
   should be there.
2. Open the **Actions** tab. A **CI** run has started:
   - the **build** job (typecheck, lint, tests) should pass;
   - the **db** job runs older SQL test files against a local Supabase and
     **may fail** on its first run. That is a known item for the next Claude
     session and does not affect the website.
3. Two scheduled workflows need secrets you don't have yet, and would email
   you a failure every day. Turn them off until section 7:
   - **Actions** → left sidebar **Nightly backup** → **⋯** (top right) →
     **Disable workflow**
   - **Actions** → **Keep-alive** → **⋯** → **Disable workflow**

---

## 2. Create the test database on Supabase (25 min)

You will have **two** Supabase projects: **dev** (for testing, safe to break)
and **prod** (real institutes, section 7). Start with dev.

### 2.1 Sign in and create an organisation

1. Go to [supabase.com](https://supabase.com) → **Start your project** → sign
   in with your platform Google account (or GitHub).
2. Create an **organisation**, e.g. `PaperFlow`, on the **Free** plan.

### 2.2 Create the dev project

1. **New project**.
2. **Name:** `paperflow-dev`.
3. **Database password:** click **Generate a password**, then **copy it into
   your password manager now**. You need it in 2.3 and cannot view it again
   (you can only reset it).
4. **Region:** **South Asia (Mumbai)**. This **cannot be changed later**, and
   the website is pinned to Mumbai too (`vercel.json`), so the two sit next to
   each other.
5. If you are shown security/API options, keep the **Data API enabled** — the
   app talks to the database through it.
6. **Create new project** and wait 1–2 minutes until it shows as healthy.

### 2.3 Collect the dev values

1. **Project ref:** your browser's address bar reads
   `supabase.com/dashboard/project/<DEV_REF>`. That 20-letter code is the
   project ref.
2. **URL and public key:** click **Connect** (top of the page) → **App
   Frameworks** → framework **Next.js**. It shows two lines:
   - `NEXT_PUBLIC_SUPABASE_URL=https://<DEV_REF>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=…` (it may be labelled a *publishable*
     key, starting `sb_publishable_`; either works)

   Copy both.
3. **Server key:** **Project Settings** (gear icon) → **API Keys**.
   - If there is a **Legacy API keys** tab, use the **`service_role`** key
     (**Reveal** → copy).
   - Otherwise use the **Secret key** (`sb_secret_…`).

   This key **bypasses every security rule**. Treat it like a root password:
   it only ever goes into `.env.local` (for dev) and Vercel's settings.
4. **Connection string:** **Connect** → **Connection String** tab → **Type:
   URI** → **Method: Session pooler**. It looks like:
   ```
   postgresql://postgres.<DEV_REF>:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
   ```
   Replace `[YOUR-PASSWORD]` (brackets included) with the password from 2.2.
   Use **Session pooler**, not "Direct connection": the direct one needs IPv6,
   which many Indian home connections don't have.

   > If your password contains `@ # / : ? %`, the URL breaks. Easiest fix:
   > **Project Settings → Database → Reset database password**, and generate
   > one with only letters and digits.

### 2.4 Create `.env.local`

This file holds your **dev** settings on your laptop. It is git-ignored and is
never uploaded.

```powershell
Copy-Item .env.local.example .env.local
notepad .env.local
```

Replace its contents with (your values, no quotes, no spaces around `=`):

```ini
NEXT_PUBLIC_SUPABASE_URL=https://<DEV_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<dev anon or publishable key>
SUPABASE_SERVICE_ROLE_KEY=<dev service_role or secret key>
SUPABASE_DB_URL=postgresql://postgres.<DEV_REF>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
SUPABASE_DEV_REF=<DEV_REF>
PLATFORM_INSTITUTE_ID=11111111-1111-1111-1111-111111111111
```

Save and close Notepad. **Never put production values in this file** —
production keys live only in Vercel (section 7).

### 2.5 Create the tables (apply the migrations)

The files in `supabase/migrations` (18 at the time of writing) build the whole database: tables,
security rules and functions.

```powershell
npx supabase db push --db-url "<dev session pooler connection string>"
```

- It lists every migration not yet applied and asks to confirm → type `Y` and press Enter.
- Success ends with `Finished supabase db push.`
- **If it fails:** copy the **whole** output and stop here. Give it to Claude
  (section 12). This is the first time these migrations meet real Supabase,
  and a small difference is possible.

### 2.6 Check the database

1. Supabase → **Table Editor**: tables such as `institutes`, `questions`,
   `papers` and `batches` are listed.
2. **SQL Editor** → **New query** → paste and **Run**:
   ```sql
   select id, name, kind from public.institutes;
   ```
   Expect exactly one row: `PaperFlow Platform`, kind `platform`.

### 2.7 Sign-in settings

1. **Authentication** → **Sign In / Providers** (may be called
   **Providers**).
2. **Email:** turn it **off**. PaperFlow signs in with Google only. Leaving
   email on would let anyone create password accounts through the public API.
   Harmless, since they would get no role, but unnecessary.
3. Leave **Allow new users to sign up** **on**. Google sign-in needs it to
   create the account on first sign-in; roles still come only from
   invitations and join codes.

---

## 3. Set up Google sign-in (25 min)

**How it fits together:** your site sends the user to Google → Google sends
them to **Supabase** (`https://<DEV_REF>.supabase.co/auth/v1/callback`) →
Supabase sends them back to **your site** (`/auth/callback`). So Google must
know Supabase's address, and Supabase must know your site's address.

### 3.1 Create a Google Cloud project

1. [console.cloud.google.com](https://console.cloud.google.com), signed in with
   the platform account. Accept the terms if asked.
2. Project picker (top bar) → **New project** → name `PaperFlow` → **Create**.
   Then make sure `PaperFlow` is the selected project.

### 3.2 Describe the app to Google (consent screen)

1. Search the top bar for **Google Auth Platform** (older menus call it **APIs
   & Services → OAuth consent screen**) → **Get started**.
2. **App information:** App name `PaperFlow`; User support email: your
   platform email → **Next**.
3. **Audience:** **External** → **Next**.
4. **Contact information:** your email → **Next**.
5. Tick the agreement → **Continue** → **Create**.

### 3.3 Scopes (what the app asks Google for)

1. **Data Access** → **Add or remove scopes**.
2. Tick `.../auth/userinfo.email`, `.../auth/userinfo.profile` and `openid` →
   **Update** → **Save**.

These are basic scopes, so Google does not require an app review.

### 3.4 Test users

While the app is in **Testing** mode, **only people on this list can sign
in** (up to 100). That's ideal until section 9.

1. **Audience** → **Test users** → **+ Add users**.
2. Add every Google account you will test with: your platform account, a
   second Google account to play a student, and any friends helping.
3. **Save**.

### 3.5 Create the sign-in credentials

1. **Clients** → **+ Create client**.
2. **Application type:** **Web application**. **Name:** `PaperFlow web`.
3. **Authorized JavaScript origins** → **+ Add URI** → `http://localhost:3005`
   (you add the Vercel address in 6.6).
4. **Authorized redirect URIs** → **+ Add URI** →
   `https://<DEV_REF>.supabase.co/auth/v1/callback`
   This is **Supabase's** address, not your website's. Copy it exactly.
5. **Create**.
6. **Copy the Client ID and the Client secret immediately** (or click
   **Download JSON**). Google may never show the secret again; if you lose it,
   you would create a new secret.

### 3.6 Give the credentials to Supabase

1. Supabase (dev) → **Authentication** → **Sign In / Providers** → **Google**.
2. **Enable** it. Paste the **Client ID** (into "Client IDs") and the **Client
   secret**. Leave other options at their defaults.
3. The panel shows a **Callback URL (for OAuth)**. Check it matches exactly
   what you entered in 3.5 step 4.
4. **Save**.

### 3.7 Tell Supabase where your site lives

1. **Authentication** → **URL Configuration**.
2. **Site URL:** `http://localhost:3005` for now (changed in 6.6).
3. **Redirect URLs** → **Add URL** → `http://localhost:3005/**` → save.

---

## 4. First sign-in on your laptop (15 min)

### 4.1 Start the app

```powershell
npx next dev -p 3005
```

Wait for `Ready`. Leave this window running; open a **second** PowerShell
window (in the same folder) for any other commands.

> Use `npx next dev -p 3005`, not `npm run dev -- -p 3005`. In PowerShell,
> npm's wrapper can swallow the `--`, and the port setting is lost.

### 4.2 Sign in

1. Open **http://localhost:3005**. You are sent to `/login`.
2. **Continue with Google** → choose the **platform account** → allow.
3. You land on **`/welcome`**: *"You're signed in. Now you need an invite or a
   code."* That's correct. Signing in never grants a role by itself.

### 4.3 Make yourself the platform owner

This is done once, by hand, because nobody exists yet who could grant it.

Supabase (dev) → **SQL Editor** → **New query** → paste, put in **your**
platform email, and **Run**:

```sql
insert into public.institute_members (institute_id, user_id, role)
select public.platform_institute_id(), id, 'owner'
from auth.users where email = '<YOUR_PLATFORM_EMAIL>'
on conflict (institute_id, user_id) do update set role = 'owner';
```

- Expect **1 row** affected.
- **0 rows** means the email doesn't match. Check **Authentication → Users**
  for the exact address and run it again.

### 4.4 Check

Open **http://localhost:3005** again. You should now land on **`/platform`**,
the platform console.

---

## 5. Load test data and walk through the app (40 min)

The question bank is empty, so there is nothing to make a paper from yet. The
**staging seed** fills the **dev** database with synthetic data:

- three pretend institutes
- about 2,000 made-up questions in Class 10 Science, Class 10 Maths and
  Class 12 Biology
- batches, papers and logged attempts

It **refuses to run on any database that has real institutes**, so it cannot
touch production.

### 5.1 Load the class/subject lists and paper patterns

In the **second** PowerShell window:

```powershell
$env:SUPABASE_DB_URL = "<dev session pooler connection string>"
npx tsx scripts/seed-taxonomy.ts
npx tsx scripts/seed-patterns.ts
```

Each prints what it seeded and ends with `… complete.`

### 5.2 Load the staging data, and invite yourself into it

In the same window:

```powershell
$env:STAGING_OWNER_EMAIL = "<YOUR_PLATFORM_EMAIL>"
$env:STAGING_TESTERS = '[{"email":"<YOUR_PLATFORM_EMAIL>","role":"institute_admin","institute":"sunrise"}]'
npx tsx scripts/seed-staging.ts --i-know-this-is-staging
```

It ends with a summary (3 institutes, about 2,000 approved questions, papers,
attempts) and `staging seed complete.` This invites you as admin of the
pretend "Staging Sunrise Academy".

### 5.3 Walk through as owner and admin

Refresh **http://localhost:3005**. Tick each item as it works; note anything
that looks wrong (URL + screenshot) for Claude.

- [ ] A notice says **an invitation is waiting from Staging Sunrise Academy**
      → **Review it** → **Accept**.
- [ ] **Platform console** (`/platform`):
  - [ ] **Institutes** lists three staging institutes.
  - [ ] **Review queue** shows staged questions, with maths rendered.
  - [ ] **Activation** shows the matrix: Maths fails the gate, Science and
        Biology pass.
  - [ ] **Requests** has one pending request.
  - [ ] **Support** → look up `sunrise.student1@staging.paperflow.test`.
  - [ ] **Health** and **Audit log** load.
- [ ] In the left rail under **Your institutes**, click **Staging Sunrise
      Academy →** to open the **institute console**. Members, Teacher
      subjects, Subjects and Export all load.
- [ ] Open **`/teacher/generate`** (the address bar works) and set a paper:
  - [ ] **Class and subject:** Class 10 · Science.
  - [ ] **Pattern:** **Staging Unit Test (25 marks)**. The CBSE board
        patterns need question types the synthetic data doesn't have.
  - [ ] A paper appears on the right, formulas rendered. Try **Lock**,
        **Swap**, a different difficulty mix, and **2 printed sets**.
  - [ ] **Save and print** → the print view shows each set on its own pages,
        answer keys and the mapping sheet.
- [ ] **`/teacher/batches`**: write down the 6-character **join code** of the
      batch **10-A Science**.

### 5.4 Walk through as a student

Use the **second Google account** (it must be a test user, from 3.4), in a
**private/incognito window** so you don't sign out of the first:

- [ ] Open **http://localhost:3005** → **Continue with Google** → second
      account → `/welcome`.
- [ ] Enter the **join code** → it shows the institute and batch → **Join**.
- [ ] The student app lists **Staging Unit Test 1** and **2** (and any paper
      you saved).
- [ ] Open one → **choose a set** → it shows the start of question 1 → **Yes**
      → tap a few questions as wrong → **Save** → a practice set is built.
- [ ] **Practice** and **Weak spots** tabs show content.

---

## 6. Put the website on Vercel (25 min)

For now the website uses the **dev** database. Section 7 switches the
production site to its own database.

### 6.1 Create the Vercel account

[vercel.com](https://vercel.com) → **Sign Up** → **Continue with GitHub**
(sign in to GitHub with the account that owns the repository).

### 6.2 Import the repository

1. Dashboard → **Add New…** → **Project**.
2. Under **Import Git Repository**, find `paperflow` → **Import**.
   - If it isn't listed: **Adjust GitHub App Permissions** → install the
     Vercel app on your account → **Only select repositories** → choose
     `paperflow` → **Save**, then return and import.

### 6.3 Project settings

- **Framework Preset:** Next.js (detected automatically).
- **Root Directory:** `./`
- **Build, Output and Install commands:** leave the defaults.

### 6.4 Environment variables

Expand **Environment Variables** and add these **before** the first deploy
(all pointing at **dev** for now):

| Key | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<DEV_REF>.supabase.co` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | dev anon/publishable key | |
| `SUPABASE_SERVICE_ROLE_KEY` | dev service_role/secret key | Mark **Sensitive** if offered. **Never** put this in a `NEXT_PUBLIC_…` variable: those are sent to every browser |
| `PLATFORM_INSTITUTE_ID` | `11111111-1111-1111-1111-111111111111` | Fixed value; do not change |
| `HUSKY` | `0` | Skips a developer-only git hook during Vercel's install |

Do **not** add `SUPABASE_DB_URL` to Vercel. The website doesn't use it; only
your scripts do.

### 6.5 Deploy

Click **Deploy** and wait 2–4 minutes. When it finishes, open **Project →
Settings → Domains** and copy your production domain, e.g.
`paperflow-xyz.vercel.app`. This is `<VERCEL_DOMAIN>` below.

> Environment variables are read at build time. Whenever you change one
> later, redeploy: **Deployments** → newest → **⋯** → **Redeploy**.

### 6.6 Tell Google and Supabase about the new address

1. **Google Cloud** → Google Auth Platform → **Clients** → `PaperFlow web` →
   **Authorized JavaScript origins** → **+ Add URI** →
   `https://<VERCEL_DOMAIN>` → **Save**.
2. **Supabase (dev)** → **Authentication** → **URL Configuration**:
   - **Site URL:** `https://<VERCEL_DOMAIN>`
   - **Redirect URLs** → add `https://<VERCEL_DOMAIN>/**`
   - Optionally add `https://*-<YOUR_VERCEL_TEAM_SLUG>.vercel.app/**` so
     Vercel's **preview** deployments (one per branch) can sign in too. The
     team slug is in your Vercel dashboard URL.
   - Keep `http://localhost:3005/**` so your laptop still works.

### 6.7 Test the live site

- [ ] `https://<VERCEL_DOMAIN>` → sign in as the platform account →
      `/platform`.
- [ ] On your **phone** (Chrome on Android): open the site → sign in as the
      student account → open it a second time → Chrome offers **Install
      PaperFlow**. Install it; it opens like an app.
- [ ] Turn on airplane mode → the test list still opens, and logging says
      clearly that it needs a connection.
- [ ] `https://<VERCEL_DOMAIN>/demo` shows **404**. The demo prototype is
      switched off in production on purpose.

### 6.8 Check the region

Vercel → **Project → Settings → Functions**: the region should be **Mumbai
(bom1)** (set by `vercel.json`).

---

## 7. Create the production database (40 min)

Do this when you are ready for **real institutes**. Real students' data then
never mixes with test data, and the staging seed can never reach it.

### 7.1 Create the project

Supabase → **New project** → **Name:** `paperflow-prod` → a **new** generated
password (store it) → **Region: South Asia (Mumbai)** → **Free** → create.

### 7.2 Collect the prod values

Exactly as in 2.3: ref, URL, anon/publishable key, service_role/secret key,
session pooler connection string. Store them in your password manager.

> **The production server key never goes into `.env.local` or any file on
> your laptop.** Only into Vercel (7.6).

### 7.3 Create the tables in prod

Run this yourself. Type or paste the URL straight into the command; don't
save it anywhere.

```powershell
npx supabase db push --db-url "<PROD session pooler connection string>"
```

Confirm with `Y`. Then check as in 2.6 (one row: `PaperFlow Platform`).

### 7.4 Load the class/subject lists and patterns (NOT the staging seed)

```powershell
$env:SUPABASE_DB_URL = "<PROD session pooler connection string>"
npx tsx scripts/seed-taxonomy.ts
npx tsx scripts/seed-patterns.ts
Remove-Item Env:SUPABASE_DB_URL
```

The last line forgets the prod URL in this window, so nothing run afterwards
touches prod by accident.

### 7.5 Sign-in for prod

1. **Supabase (prod)** → Authentication → **Sign In / Providers**: turn
   **Email off** and **Google on**, with the **same** Client ID and secret as
   dev.
2. **Supabase (prod)** → **URL Configuration**: **Site URL**
   `https://<VERCEL_DOMAIN>`; **Redirect URLs**
   `https://<VERCEL_DOMAIN>/**`.
3. **Google Cloud** → **Clients** → `PaperFlow web` → **Authorized redirect
   URIs** → add `https://<PROD_REF>.supabase.co/auth/v1/callback` → **Save**.
   Keep the dev one.

### 7.6 Point the live site at prod (and previews at dev)

Vercel → **Project → Settings → Environment Variables**. For each of
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`:

- edit the existing entry so it applies to **Preview** and **Development**
  only (it keeps the **dev** value);
- **Add** a new entry with the same name, the **prod** value, applied to
  **Production** only.

Then redeploy: **Deployments** → newest production deployment → **⋯** →
**Redeploy**.

### 7.7 Become owner in prod

1. `https://<VERCEL_DOMAIN>` → sign in with the platform account → you land on
   `/welcome` (a fresh database, so no role yet).
2. **Supabase (prod)** → **SQL Editor** → run the owner query from 4.3 with
   your email.
3. Reload → `/platform`. It is empty: no institutes, no questions. That is
   correct for production.

### 7.8 Keep-alive and backups

1. GitHub → repository → **Settings** → **Secrets and variables** →
   **Actions** → **New repository secret**:
   - **Name:** `SUPABASE_PROD_DB_URL`
   - **Secret:** the prod session pooler connection string.
2. **Actions** → **Keep-alive** → **Enable workflow** → **Run workflow** →
   check it turns green. It runs daily so the free project never pauses.
3. **Nightly backup** stays disabled until you set up Cloudflare R2 storage
   (secrets `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`,
   `R2_BUCKET`, and optionally `ALERT_WEBHOOK`). Ask Claude to walk you through
   it. Until then, check what Supabase itself keeps under **Database →
   Backups** for your plan.

---

## 8. Custom domain (optional, 20 min)

1. Buy a domain (e.g. `paperflow.in`) from any registrar.
2. Vercel → **Project → Settings → Domains** → **Add** → enter it → follow
   the DNS instructions shown (records to add at your registrar). Wait until
   Vercel shows it as valid.
3. Update the three places that know your address:
   - **Google Cloud** → Clients → **Authorized JavaScript origins**: add
     `https://paperflow.in`.
   - **Supabase (prod)** → URL Configuration: **Site URL**
     `https://paperflow.in`; add `https://paperflow.in/**` to **Redirect
     URLs**.
   - The same in **Supabase (dev)** if you will test on that domain.

---

## 9. Let anyone sign in (5 min)

While Google's app is in **Testing**, only your listed test users can sign
in. Before inviting real teachers and students:

Google Cloud → Google Auth Platform → **Audience** → **Publish app** →
**Confirm**.

With only the basic email/profile scopes, Google does not require a review.

---

## 10. Give Claude direct access to the test database (10 min)

With this, Claude can run migrations, seed data, query tables and debug
problems itself instead of asking you to copy and paste. Access is to the
**dev** database only.

### 10.1 The connection string (required)

Already done in **2.4**: `SUPABASE_DB_URL` in `.env.local` points at **dev**.
Claude reads `.env.local` from the project folder, and with it can:

- apply new migrations: `npx supabase db push --db-url …`
- run the seed scripts
- query and inspect data, and check what the app wrote

It gives full read/write access to **dev** and nothing else. If dev ever gets
into a bad state, Claude (or you) can rebuild it from the migrations and the
seeds.

### 10.2 The Supabase MCP server (recommended)

The project already includes `.mcp.json`, which connects Claude Code to
Supabase's official tool server, **scoped to the dev project**. It gives
Claude tools to list tables, run SQL, apply migrations, read logs and run
Supabase's security advisors.

1. Store your dev project ref as a Windows environment variable:
   ```powershell
   setx SUPABASE_DEV_REF "<DEV_REF>"
   ```
   `setx` only affects programs started afterwards.
2. **Quit Claude completely** (including from the system tray) and reopen it.
3. Start the new session **with the PaperFlow folder as the project**
   (`C:\Users\Sanskar\Documents\..Projects\PaperFlow`), not VasuPortfolio.
   Claude Code only reads `.mcp.json` from the folder it is opened in.
4. When Claude Code asks whether to trust the project's MCP server
   **supabase-dev**, approve it.
5. The first time Claude uses a Supabase tool, a browser window asks you to
   **authorise Supabase access**. Sign in to Supabase, choose your
   organisation, and approve.

### 10.3 What not to give

- **Not** a Supabase **personal access token**. It controls *every* project
  on your account, production included.
- **Not** production keys or the production connection string as standing
  access. For production changes: Claude writes and tests the migration
  against dev; you read what will be applied and run it yourself:
  ```powershell
  npx supabase migration list --db-url "<PROD connection string>"
  npx supabase db push --db-url "<PROD connection string>"
  ```
  If you ever do paste a production credential into a session, reset it
  afterwards (**Project Settings → Database → Reset database password**, or
  roll the API key).
- **Never paste keys into the chat.** Claude reads what it needs from
  `.env.local`.

---

## 11. Troubleshooting

| What you see | Likely cause | Fix |
|---|---|---|
| Google: **Error 400: redirect_uri_mismatch** | The Supabase callback URL isn't in the Google client's **Authorized redirect URIs**, or has a typo | Copy the exact **Callback URL** from Supabase → Google provider into Google → Clients (3.5 / 7.5) |
| Google: **Access blocked: PaperFlow has not completed the Google verification process** or "app is in testing" | That account isn't a test user | Add it in Audience → Test users (3.4), or publish the app (section 9) |
| After Google you land on `/login?error=exchange` | Your site's address isn't in Supabase's **Redirect URLs**, or you started on a different address than you finished on (e.g. `127.0.0.1` vs `localhost`) | Add `https://<your domain>/**` in Supabase URL Configuration; always use the same address |
| `/login` says **"Not configured yet"** | Environment variables missing | Laptop: check `.env.local` and restart `npx next dev`. Vercel: add them (6.4) and **redeploy** |
| Signed in, but always on `/welcome` | You have no membership yet | Platform owner: run the SQL in 4.3. Everyone else: needs an invite or a join code. This is by design |
| Owner SQL says **0 rows** | Email typed differently | Copy the exact email from Authentication → Users |
| `db push` / seed: **password authentication failed** | Wrong password in the connection string | Reset the database password (letters and digits only) and rebuild the string |
| `db push` / seed: **ENETUNREACH** / **could not translate host name** / IPv6 errors | Using the Direct connection | Use the **Session pooler** string (2.3) |
| Seed: **SSL required** / `no pg_hba.conf entry … SSL off` | SSL enforcement is on | Add `?sslmode=require` to the end of the connection string |
| `seed-staging` says **refusing to seed** | You pointed it at a database with real institutes (e.g. prod) | Correct — it must only run on dev |
| Supabase dashboard: **project paused** | Free project unused for 7 days | Click **Restore**. For prod, the Keep-alive workflow (7.8) prevents this |
| Vercel build fails at `npm install` mentioning husky | The git hook installer | Add `HUSKY=0` (6.4) and redeploy |
| Vercel build fails elsewhere | Usually a missing env var, or a real bug | Copy the build log (Deployments → the failed one → **Build Logs**) and give it to Claude |
| Chrome never offers **Install** | It only offers from the second visit, over HTTPS, and not while already installed | Use the Vercel URL, visit twice, or Chrome menu → **Add to Home screen** |

---

## 12. Hand over to the next Claude session

1. Open Claude **with the PaperFlow folder as the project** (see 10.2).
2. Open `docs/HANDOFF.md`, scroll to **7. Prompt for the next session**, tick
   the setup items you completed, and paste the whole block as your first
   message.
3. Tell it anything from the walkthroughs (5.3, 5.4, 6.7) that looked wrong,
   with the URL and a screenshot.
4. Decide the open privacy question in HANDOFF section 4: should students be
   able to see classmates' emails through the API?

### Final checklist

- [ ] Code on GitHub (private), CI **build** job green
- [ ] Dev Supabase project in Mumbai, all migrations applied
- [ ] Google sign-in working on `localhost:3005`
- [ ] You are platform owner in dev
- [ ] Staging data loaded; teacher and student walkthroughs done
- [ ] Website live on Vercel, sign-in working there and on your phone
- [ ] (When ready) Prod Supabase project, migrations applied, owner set,
      Vercel Production pointed at prod
- [ ] Keep-alive enabled with `SUPABASE_PROD_DB_URL`
- [ ] Google app published (before real users)
- [ ] `SUPABASE_DEV_REF` set and the Supabase MCP authorised (optional)
