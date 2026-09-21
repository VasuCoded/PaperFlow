/**
 * In-process Postgres (PGlite = Postgres compiled to WASM) with our migrations
 * applied. Lets us execute the real schema without Docker, which is what turns
 * `supabase/migrations` from grammar-checked into actually-executed.
 *
 * It is NOT a substitute for the local Supabase stack: the auth schema, the
 * anon/authenticated roles and the default grants are shimmed here to match what
 * Supabase provides, so behaviour could drift. Run the real suites via
 * `supabase db reset` + psql once Docker exists (docs/SETUP.md §A).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(__dirname, "..");
export const migrationsDir = join(repoRoot, "supabase", "migrations");

/**
 * What Supabase gives you before your first migration runs. Kept deliberately
 * small: only what our migrations actually depend on.
 */
const SUPABASE_SHIM = `
-- roles PostgREST uses
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

-- the columns our trigger and tests touch
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid,
  aud text default 'authenticated',
  role text default 'authenticated',
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz default now(),
  raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{}'::jsonb,
  -- no default, as in Supabase; its auth server cannot read a NULL here either
  created_at timestamptz,
  updated_at timestamptz,
  is_sso_user boolean default false,
  is_anonymous boolean default false,
  -- nullable in Supabase too, but its auth server cannot read a NULL here;
  -- anything that inserts users directly must set them to ''
  confirmation_token varchar(255),
  recovery_token varchar(255),
  email_change_token_new varchar(255),
  email_change varchar(255)
);

-- password sign-in needs an 'email' identity per user, as Supabase creates on sign-up
create table if not exists auth.identities (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  identity_data jsonb not null,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  unique (provider_id, provider)
);

-- auth.uid() as Supabase defines it: the sub claim of the request JWT
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub'
    ), ''
  )::uuid
$$;

create or replace function auth.role() returns text language sql stable as $$
  select coalesce(
    current_setting('request.jwt.claim.role', true),
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role'
  )
$$;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase grants table privileges to the API roles by default; RLS policies
-- then decide which ROWS are visible. Default privileges cover tables our
-- migrations are about to create, so migration 0004's column-level REVOKE still
-- takes effect afterwards.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export function migrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

export interface ApplyResult {
  db: PGlite;
  applied: string[];
  failure?: { file: string; error: string };
}

/** Boot Postgres, shim Supabase, apply every migration in order. */
export async function bootstrapDb(opts: { quiet?: boolean } = {}): Promise<ApplyResult> {
  const db = await PGlite.create({ extensions: { citext, pg_trgm, pgcrypto } });
  await db.exec(SUPABASE_SHIM);

  const applied: string[] = [];
  for (const file of migrationFiles()) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    try {
      await db.exec(sql);
      applied.push(file);
      if (!opts.quiet) console.log(`  applied  ${file}`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { db, applied, failure: { file, error } };
    }
  }
  return { db, applied };
}

/** Become an authenticated user, the way the RLS tests do. */
export async function actAs(db: PGlite, uid: string): Promise<void> {
  await db.exec(`
    select set_config('role', 'authenticated', false);
    select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', false);
  `);
}

export async function actAsOwner(db: PGlite): Promise<void> {
  await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
}
