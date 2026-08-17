import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260817030000_ai_provenance_columns.sql",
  ),
  "utf8",
).toLowerCase();

const databaseTest = readFileSync(
  resolve(process.cwd(), "supabase/tests/006_ai_provenance.test.sql"),
  "utf8",
).toLowerCase();

const generatedTypes = readFileSync(
  resolve(process.cwd(), "src/types/database.generated.ts"),
  "utf8",
);

const PROVENANCE_TABLES = [
  "ai_generation_requests",
  "job_import_requests",
] as const;

const PROVENANCE_COLUMN_TYPES: Record<string, string> = {
  input_fingerprint: "string | null",
  hash_algorithm: "string | null",
  hash_key_version: "number | null",
  redaction_version: "string | null",
  input_schema_version: "string | null",
};

function typeBlock(table: string, section: "Row" | "Insert" | "Update") {
  const tableIndex = generatedTypes.indexOf(`${table}: {`);
  const sectionIndex = generatedTypes.indexOf(`${section}: {`, tableIndex);
  const end = generatedTypes.indexOf("};", sectionIndex);
  return generatedTypes.slice(sectionIndex, end);
}

describe("AI provenance migration", () => {
  it("adds the same five nullable columns to both server-only request tables", () => {
    for (const table of PROVENANCE_TABLES) {
      expect(migration).toContain(`alter table public.${table}`);
    }
    expect(migration).toContain("add column input_fingerprint text");
    expect(migration).toContain("add column hash_algorithm text");
    expect(migration).toContain("add column hash_key_version integer");
    expect(migration).toContain("add column redaction_version text");
    expect(migration).toContain("add column input_schema_version text");
  });

  it("constrains the fingerprint, algorithm, key version, and namespaces", () => {
    expect(migration).toContain("input_fingerprint ~ '^[0-9a-f]{64}$'");
    expect(migration).toContain("hash_algorithm in ('hmac-sha256')");
    expect(migration).toContain("hash_key_version >= 1");
    expect(migration).toContain("redaction_version ~ '^[a-z0-9-]+/[0-9]+$'");
    expect(migration).toContain("input_schema_version ~ '^[a-z0-9-]+/[0-9]+$'");
  });

  it("requires provenance to be all NULL or all present on both tables", () => {
    for (const table of PROVENANCE_TABLES) {
      const constraintStart = migration.indexOf(
        `${table}_provenance_complete_check`,
      );
      expect(constraintStart).toBeGreaterThan(-1);
      const constraint = migration.slice(
        constraintStart,
        migration.indexOf(`comment on column public.${table}`, constraintStart),
      );

      // Both branches must name all five columns, or a row could carry a
      // fingerprint without the key version needed to verify it.
      for (const column of Object.keys(PROVENANCE_COLUMN_TYPES)) {
        expect(constraint).toContain(`${column} is null`);
        expect(constraint).toContain(`${column} is not null`);
      }
    }
  });

  it("does not backfill existing rows and says why", () => {
    expect(migration).not.toContain("update public.ai_generation_requests set");
    expect(migration).not.toContain("update public.job_import_requests set");
    expect(migration).toContain("cannot be computed");
    expect(migration).toContain("must\n-- not be backfilled");
  });

  it("re-asserts that desktop clients still cannot reach either table", () => {
    for (const table of PROVENANCE_TABLES) {
      expect(migration).toContain(
        `revoke all on table public.${table} from anon`,
      );
      expect(migration).toContain(
        `revoke all on table public.${table} from authenticated`,
      );
    }
    expect(migration).not.toMatch(/grant[^\n]*\bto (anon|authenticated)\b/);
  });

  it("never stores the AI input itself", () => {
    expect(migration).not.toMatch(
      /\b(prompt_text|provider_output|source_text|source_url|file_name|input_body)\b/,
    );
  });
});

describe("AI provenance database test coverage", () => {
  it("covers the all-or-nothing constraint on both tables", () => {
    expect(databaseTest).toContain(
      "rejects a partially-populated provenance row",
    );
    expect(
      databaseTest.match(/rejects a partially-populated provenance row/g),
    ).toHaveLength(2);
  });

  it("covers non-hex, short, and uppercase fingerprint rejection", () => {
    expect(databaseTest).toContain("rejects a non-hex fingerprint");
    expect(databaseTest).toContain("rejects a 63-character fingerprint");
    expect(databaseTest).toContain("rejects an uppercase-hex fingerprint");
    expect(databaseTest).toContain(
      "rejects an unsupported hash_algorithm value",
    );
  });

  it("re-fixes the server-only privilege boundary after the column addition", () => {
    for (const table of PROVENANCE_TABLES) {
      expect(databaseTest).toContain(
        `not has_table_privilege('anon', 'public.${table}', 'select')`,
      );
      expect(databaseTest).toContain(
        `not has_table_privilege('authenticated', 'public.${table}', 'select')`,
      );
    }
  });
});

// The generated types are produced by `supabase gen types`. This ties them to
// the migration so a regeneration or a hand edit cannot silently drop one of
// the five columns while the application still compiles.
describe("generated database types", () => {
  it.each(PROVENANCE_TABLES)(
    "exposes the five provenance columns on %s",
    (table) => {
      const row = typeBlock(table, "Row");
      const insert = typeBlock(table, "Insert");
      const update = typeBlock(table, "Update");

      for (const [column, tsType] of Object.entries(PROVENANCE_COLUMN_TYPES)) {
        expect(row).toContain(`${column}: ${tsType};`);
        expect(insert).toContain(`${column}?: ${tsType};`);
        expect(update).toContain(`${column}?: ${tsType};`);
      }
    },
  );

  it("keeps every provenance column nullable, matching the migration", () => {
    for (const table of PROVENANCE_TABLES) {
      const row = typeBlock(table, "Row");
      for (const column of Object.keys(PROVENANCE_COLUMN_TYPES)) {
        // A non-null column here would contradict the all-or-nothing
        // constraint, which permits every column to be NULL together.
        expect(row).not.toMatch(new RegExp(`${column}: (string|number);`));
      }
    }
  });
});
