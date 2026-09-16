/**
 * Generate src/lib/database.types.ts by introspecting the migrations applied to
 * an in-process Postgres. This is a STAND-IN for
 * `supabase gen types typescript --local`, which needs Docker.
 *
 * Because it reads the real applied schema rather than guessing, the types match
 * the migrations by construction. Once the local Supabase stack exists, run
 * `npm run db:types` — the generated file replaces this one, and any drift shows
 * up immediately as a typecheck failure rather than a runtime surprise.
 *
 *   npm run db:types:local
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { bootstrapDb, repoRoot } from "./schema-harness";

/** Postgres type -> TypeScript type. */
function tsType(pg: string): string {
  const t = pg.replace(/^_/, "").toLowerCase();
  if (pg.startsWith("_")) return `${tsType(t)}[]`;
  switch (t) {
    case "uuid":
    case "text":
    case "citext":
    case "varchar":
    case "character varying":
    case "bpchar":
    case "timestamptz":
    case "timestamp with time zone":
    case "timestamp":
    case "timestamp without time zone":
    case "date":
    case "time":
    case "name":
      return "string";
    case "int2":
    case "int4":
    case "int8":
    case "smallint":
    case "integer":
    case "bigint":
    case "numeric":
    case "float4":
    case "float8":
    case "real":
    case "double precision":
      return "number";
    case "bool":
    case "boolean":
      return "boolean";
    case "json":
    case "jsonb":
      return "Json";
    case "tsvector":
    case "bytea":
      return "unknown";
    case "void":
      return "undefined";
    default:
      return "unknown";
  }
}

interface Col {
  table_name: string;
  column_name: string;
  udt_name: string;
  is_nullable: "YES" | "NO";
  has_default: boolean;
  is_generated: boolean;
}

async function columns(db: PGlite, kind: "r" | "v") {
  const { rows } = await db.query<Col>(
    `
    select c.relname as table_name,
           a.attname as column_name,
           t.typname as udt_name,
           case when a.attnotnull then 'NO' else 'YES' end as is_nullable,
           (ad.adbin is not null) as has_default,
           (a.attidentity <> '' or a.attgenerated <> '') as is_generated
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    join pg_type t on t.oid = a.atttypid
    left join pg_attrdef ad on ad.adrelid = c.oid and ad.adnum = a.attnum
    where n.nspname = 'public' and c.relkind = $1
    order by c.relname, a.attnum
  `,
    [kind],
  );
  const byTable = new Map<string, Col[]>();
  for (const r of rows) {
    const arr = byTable.get(r.table_name) ?? [];
    arr.push(r);
    byTable.set(r.table_name, arr);
  }
  return byTable;
}

function emitTable(name: string, cols: Col[]): string {
  const row = cols
    .map((c) => {
      const t = tsType(c.udt_name);
      return `          ${c.column_name}: ${t}${c.is_nullable === "YES" ? " | null" : ""}`;
    })
    .join("\n");

  const insert = cols
    .map((c) => {
      const t = tsType(c.udt_name);
      // optional when nullable, defaulted or generated
      const optional = c.is_nullable === "YES" || c.has_default || c.is_generated;
      return `          ${c.column_name}${optional ? "?" : ""}: ${t}${c.is_nullable === "YES" ? " | null" : ""}`;
    })
    .join("\n");

  const update = cols
    .map((c) => {
      const t = tsType(c.udt_name);
      return `          ${c.column_name}?: ${t}${c.is_nullable === "YES" ? " | null" : ""}`;
    })
    .join("\n");

  return `      ${name}: {
        Row: {
${row}
        }
        Insert: {
${insert}
        }
        Update: {
${update}
        }
        Relationships: []
      }`;
}

/** Parse "p_name uuid, p_other text DEFAULT NULL::text" into an Args object. */
function emitArgs(argString: string): string {
  const trimmed = argString.trim();
  if (!trimmed) return "Record<string, never>";
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of trimmed) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);

  const fields = parts
    .map((p) => {
      const noDefault = p.split(/\s+default\s+/i)[0]!.trim();
      const tokens = noDefault.split(/\s+/);
      if (tokens.length < 2) return null;
      const optional = /\s+default\s+/i.test(p);
      const name = tokens[0]!;
      const pgt = tokens.slice(1).join(" ");
      return `          ${name}${optional ? "?" : ""}: ${tsType(pgt)}`;
    })
    .filter((x): x is string => x !== null);

  return fields.length === 0 ? "Record<string, never>" : `{\n${fields.join("\n")}\n        }`;
}

function emitReturns(result: string): string {
  const r = result.trim();
  const setof = /^setof\s+/i.test(r);
  const bare = r.replace(/^setof\s+/i, "");

  if (/^TABLE\(/i.test(bare)) {
    const inner = bare.slice(bare.indexOf("(") + 1, bare.lastIndexOf(")"));
    const fields = inner
      .split(",")
      .map((f) => {
        const tokens = f.trim().split(/\s+/);
        if (tokens.length < 2) return null;
        return `          ${tokens[0]}: ${tsType(tokens.slice(1).join(" "))}`;
      })
      .filter((x): x is string => x !== null);
    return `{\n${fields.join("\n")}\n        }[]`;
  }
  const t = tsType(bare);
  return setof ? `${t}[]` : t;
}

async function main() {
  const { db, failure } = await bootstrapDb({ quiet: true });
  if (failure) {
    console.error(`migrations failed in ${failure.file}:\n${failure.error}`);
    process.exit(1);
  }

  const tables = await columns(db, "r");
  const views = await columns(db, "v");

  const funcs = await db.query<{ proname: string; args: string; result: string }>(`
    select p.proname,
           pg_get_function_arguments(p.oid) as args,
           pg_get_function_result(p.oid) as result
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.proname not like 'pg_%'
      -- skip extension-provided functions
      and not exists (
        select 1 from pg_depend d
        join pg_extension e on e.oid = d.refobjid
        where d.objid = p.oid and d.deptype = 'e'
      )
    order by p.proname
  `);

  const tableBlocks = [...tables.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, cols]) => emitTable(name, cols))
    .join("\n");

  const viewBlocks = [...views.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, cols]) => {
      const row = cols
        .map((c) => `          ${c.column_name}: ${tsType(c.udt_name)}${c.is_nullable === "YES" ? " | null" : ""}`)
        .join("\n");
      return `      ${name}: {
        Row: {
${row}
        }
        Relationships: []
      }`;
    })
    .join("\n");

  // de-duplicate overloads by name (last one wins, as supabase does)
  const fnMap = new Map<string, { args: string; result: string }>();
  for (const f of funcs.rows) fnMap.set(f.proname, { args: f.args, result: f.result });

  const fnBlocks = [...fnMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([name, f]) => `      ${name}: {
        Args: ${emitArgs(f.args)}
        Returns: ${emitReturns(f.result)}
      }`,
    )
    .join("\n");

  const out = `/**
 * GENERATED — do not edit by hand.
 *
 * Produced by \`npm run db:types:local\`, which applies supabase/migrations to an
 * in-process Postgres and introspects the result. It therefore matches the
 * migrations by construction.
 *
 * Once the local Supabase stack is running (Docker), regenerate with the real
 * tool instead:  npm run db:types
 * Any drift between the two will surface immediately as a typecheck error.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
${tableBlocks}
    }
    Views: {
${viewBlocks}
    }
    Functions: {
${fnBlocks}
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];
export type Functions<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T];
`;

  const target = join(repoRoot, "src", "lib", "database.types.ts");
  writeFileSync(target, out);
  console.log(
    `wrote ${target}\n  ${tables.size} tables, ${views.size} views, ${fnMap.size} functions`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
