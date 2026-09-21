# PaperFlow — going live, step by step

This takes PaperFlow from a folder on your laptop to a live website:

- the code in a **private GitHub repository**
- a **Supabase** database (Postgres + sign-in), in Mumbai
- **sign-in with a username and password** (Google sign-in optional, later)
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
3. [Google sign-in (optional — skip it)](#3-google-sign-in-optional--skip-it)
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
| [Google Cloud](https://console.cloud.google.com) | *Optional:* a "Continue with Google" button | Free |

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
| Google Client ID *(optional)* | Google Cloud → Clients | 3.5 |
| Google Client secret *(optional)* | Google Cloud → Clients (**shown once**) | 3.5 |
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

PaperFlow signs people in with a **username and password**. Supabase does
password sign-in through its **Email** provider, so it must stay on:

1. **Authentication** → **Sign In / Providers** (may be called
   **Providers**).
2. **Email:** leave it **on**. Leave **Confirm email** **on** too: PaperFlow
   creates accounts on the server and marks them confirmed itself, and this
   setting stops anyone registering through the public API from signing in.
3. Leave **Allow new users to sign up** **on**.

Nobody gets a role by signing up: a new account belongs to no institute until
it enters a batch join code, accepts an invitation, or has an access request
approved.

---

## 3. Google sign-in (optional — skip it)

**You do not need this.** Username and password sign-in works out of the box.
Come back here only if you want a "Continue with Google" button as well;
after setting it up, add `NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN=1` to `.env.local`
and to Vercel.

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

### 3.3 Scopes

**Data Access** → **Add or remove scopes** → tick `.../auth/userinfo.email`,
`.../auth/userinfo.profile` and `openid` → **Update** → **Save**. These are
basic scopes, so Google does not require an app review.

### 3.4 Test users

While the app is in **Testing** mode, only listed people can use Google
sign-in (up to 100). **Audience** → **Test users** → **+ Add users** → add
them → **Save**. Section 9 opens it to everyone.

### 3.5 Create the sign-in credentials

1. **Clients** → **+ Create client** → **Web application**, name
   `PaperFlow web`.
2. **Authorized JavaScript origins:** `http://localhost:3005` (the Vercel
   address is added in 6.6).
3. **Authorized redirect URIs:** `https://<DEV_REF>.supabase.co/auth/v1/callback`
   — Supabase's address, exactly.
4. **Create**, then **copy the Client ID and Client secret immediately** (or
   **Download JSON**); Google may not show the secret again.

### 3.6 Give the credentials to Supabase

Supabase (dev) → **Authentication** → **Sign In / Providers** → **Google** →
**Enable** → paste Client ID and secret → check the **Callback URL** shown
matches 3.5 step 3 → **Save**.

### 3.7 Tell Supabase where your site lives

**Authentication** → **URL Configuration** → **Site URL**
`http://localhost:3005` → **Redirect URLs** add `http://localhost:3005/**`.

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

### 4.2 Create your account

1. Open **http://localhost:3005**. You are sent to `/login`.
2. Click **Create an account**. Enter your full name, a **username** (letters,
   numbers, dots and underscores — e.g. `sanskar`) and a password (8+
   characters, with a letter and a number).
3. You land on **`/welcome`**: *"You're signed in. Now your institute lets you
   in."* That's correct. An account never grants a role by itself.

### 4.3 Make yourself the platform owner

This is done once, by hand, because nobody exists yet who could grant it.
**Easiest: tell Claude your username and ask it to make you platform owner**
— it has access to the dev database (section 10). Or do it yourself:
Supabase (dev) → **SQL Editor** → **New query** → put in **your** username →
**Run**:

```sql
insert into public.institute_members (institute_id, user_id, role)
select public.platform_institute_id(), id, 'owner'
from public.profiles where username = '<YOUR_USERNAME>'
on conflict (institute_id, user_id) do update set role = 'owner';
```

- Expect **1 row** affected. **0 rows** means the username doesn't match.

### 4.4 Check

Open **http://localhost:3005** again. You should now land on **`/platform`**,
the platform console. The left rail has **Change password** under your name.

---

## 5. Load test data and walk through the app (40 min)

The question bank is empty, so there is nothing to make a paper from yet. The
**staging seed** fills the **dev** database with synthetic data:

- three pretend institutes (Sunrise, Riverside, Hilltop), each with an admin,
  3 teachers and 24 students — **all of them real username accounts you can
  sign in as**
- about 2,000 questions: **Class 10 Maths** is the main one — real
  chapter-by-chapter questions (HCF, polynomials, quadratics, AP, trigonometry,
  mensuration, probability…) with worked answers — plus filler Class 10
  Science and Class 12 Biology
- batches, papers, logged attempts, flags and a review queue

It **refuses to run on any database that has real institutes**, so it cannot
touch production. (Claude can run this whole section for you — just ask.)

### 5.1 Load the class/subject lists and paper patterns

In the **second** PowerShell window:

```powershell
$env:SUPABASE_DB_URL = "<dev session pooler connection string>"
npx tsx scripts/seed-taxonomy.ts
npx tsx scripts/seed-patterns.ts
```

Each prints what it seeded and ends with `… complete.`

### 5.2 Load the staging data

Pick a password that every pretend person will share (testing only):

```powershell
$env:STAGING_PASSWORD = "<a test password, 8+ characters>"
$env:STAGING_OWNER = "<YOUR_USERNAME>"
npx tsx scripts/seed-staging.ts --i-know-this-is-staging
```

It ends with a summary and `staging seed complete.` Now you can sign in as any
of these with `STAGING_PASSWORD`:

| Username | Role |
|---|---|
| `sunrise.admin` | Institute admin of Staging Sunrise Academy |
| `sunrise.teacher1` … `sunrise.teacher3` | Teachers (1 and 2 teach Class 10 Maths, 3 teaches Class 12 Biology) |
| `sunrise.student1` … `sunrise.student24` | Students |
| `riverside.*`, `hilltop.*` | The same, at the other two institutes |

### 5.3 Walk through as platform owner

Signed in as **yourself**. Tick each item as it works; note anything that
looks wrong (URL + screenshot) for Claude.

- [ ] **Institutes** lists three staging institutes.
- [ ] **Review queue** shows staged questions, with maths rendered.
- [ ] **Activation**: Science fails the gate, Maths and Biology pass.
- [ ] **Subject requests** has one pending request.
- [ ] **Support** → look up `sunrise.student1`; try **Reset password…**.
- [ ] **Health** and **Audit log** load.

### 5.4 Walk through as an institute admin and a teacher

**Sign out**, then sign in as **`sunrise.admin`**:

- [ ] **Institute console** loads: Members, Teacher subjects, Subjects, Export.
- [ ] **Members**: the members table shows usernames; try **Reset password**
      on a student.
- [ ] Open **`/teacher/generate`** and set a paper:
  - [ ] **Class and subject:** Class 10 · Mathematics.
  - [ ] **Pattern:** **Staging Unit Test (25 marks)** (the CBSE board patterns
        need question types the synthetic data doesn't have).
  - [ ] A paper appears, formulas rendered. Try **Lock**, **Swap**, a different
        difficulty mix, and **2 printed sets**.
  - [ ] **Save and print** → each set on its own pages, answer keys, mapping
        sheet.
- [ ] **`/teacher/batches`**: note the 6-character **join code** of the **10-Mathematics A** batch.

### 5.5 Walk through as a student, and the approval queue

In a **private/incognito window** (so you stay signed in in the first):

- [ ] Sign in as **`sunrise.student1`** → the student app lists **Staging Unit
      Test 1** and **2**. Open one → **choose a set** → confirm question 1 →
      tap a few as wrong → **Save** → a practice set is built. **Practice** and
      **Weak spots** show content.
- [ ] Sign out, then **Create an account** as a brand-new person (e.g.
      `test.newteacher`). On `/welcome`, **ask Staging Sunrise Academy for
      access** with a note like "Physics teacher".
- [ ] Back in the first window as `sunrise.admin` (or as yourself): a notice
      says **1 person is asking to join** → **Review** → **Approve as Teacher**.
- [ ] The new account refreshes into the teacher console.
- [ ] Also try: a new account entering the **join code** from 5.4 becomes a
      student straight away.

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
| `NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN` | `1` | **Only** if you set up section 3; leave it out otherwise |

Do **not** add `SUPABASE_DB_URL` to Vercel. The website doesn't use it; only
your scripts do.

### 6.5 Deploy

Click **Deploy** and wait 2–4 minutes. When it finishes, open **Project →
Settings → Domains** and copy your production domain, e.g.
`paperflow-xyz.vercel.app`. This is `<VERCEL_DOMAIN>` below.

> Environment variables are read at build time. Whenever you change one
> later, redeploy: **Deployments** → newest → **⋯** → **Redeploy**.

### 6.6 Tell Google and Supabase about the new address

1. *(Only if you set up Google, section 3.)* **Google Cloud** → Google Auth
   Platform → **Clients** → `PaperFlow web` → **Authorized JavaScript
   origins** → **+ Add URI** → `https://<VERCEL_DOMAIN>` → **Save**.
2. **Supabase (dev)** → **Authentication** → **URL Configuration**:
   - **Site URL:** `https://<VERCEL_DOMAIN>`
   - **Redirect URLs** → add `https://<VERCEL_DOMAIN>/**`
   - Optionally add `https://*-<YOUR_VERCEL_TEAM_SLUG>.vercel.app/**` so
     Vercel's **preview** deployments (one per branch) can sign in too. The
     team slug is in your Vercel dashboard URL.
   - Keep `http://localhost:3005/**` so your laptop still works.

### 6.7 Test the live site

- [ ] `https://<VERCEL_DOMAIN>` → sign in with your username → `/platform`.
- [ ] On your **phone** (Chrome on Android): open the site → sign in as
      `sunrise.student1` → open it a second time → Chrome offers **Install
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

1. **Supabase (prod)** → Authentication → **Sign In / Providers**: leave
   **Email on** (with **Confirm email** on). Only if you use Google: turn it on
   with the **same** Client ID and secret as dev.
2. **Supabase (prod)** → **URL Configuration**: **Site URL**
   `https://<VERCEL_DOMAIN>`; **Redirect URLs**
   `https://<VERCEL_DOMAIN>/**`.
3. *(Google only.)* **Google Cloud** → **Clients** → `PaperFlow web` →
   **Authorized redirect URIs** → add
   `https://<PROD_REF>.supabase.co/auth/v1/callback` → **Save**. Keep the dev
   one.

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

1. `https://<VERCEL_DOMAIN>` → **Create an account** (prod is a separate
   database, so your dev account doesn't exist there) → you land on
   `/welcome`.
2. **Supabase (prod)** → **SQL Editor** → run the owner query from 4.3 with
   your username. (Claude has no access to prod — do this one yourself.)
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

## 9. Let anyone use Google sign-in (only if you set up section 3)

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
| **Wrong username or password** | Typo, or the account doesn't exist in *this* database (dev and prod are separate) | Check the username; an institute admin or the platform can **Reset password** |
| **Email logins are disabled** when signing in | The Email provider was switched off | Supabase → Authentication → Sign In / Providers → **Email on** (2.7) |
| **That username is taken** on sign-up | Someone has it | Pick another |
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
- [ ] Your account created on `localhost:3005`, and you are platform owner in dev
- [ ] Staging data loaded; teacher and student walkthroughs done
- [ ] Website live on Vercel, sign-in working there and on your phone
- [ ] (When ready) Prod Supabase project, migrations applied, owner set,
      Vercel Production pointed at prod
- [ ] Keep-alive enabled with `SUPABASE_PROD_DB_URL`
- [ ] (Only if using Google) Google app published
- [ ] `SUPABASE_DEV_REF` set and the Supabase MCP authorised (optional)
