import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../..");
const backupScript = join(repoRoot, "scripts/backup/backup-crm.sh");
const rotateScript = join(repoRoot, "scripts/backup/rotate-backups.sh");

function createFixture(root: string, shouldFail = false) {
  const backupRoot = join(root, "backups");
  const workdir = join(root, "workdir");
  const fakeSupabase = join(root, "supabase");
  const config = join(root, "backup.env");
  const pointer = join(root, "pointer");
  mkdirSync(backupRoot, { recursive: true });
  mkdirSync(join(workdir, "supabase"), { recursive: true });
  writeFileSync(
    join(workdir, "supabase/config.toml"),
    "project_id = 'local'\n",
  );
  writeFileSync(
    fakeSupabase,
    `#!/usr/bin/env bash
set -euo pipefail
${shouldFail ? "exit 42" : ""}
if [[ " $* " == *" db dump "* ]]; then
  output=""
  while (($#)); do
    if [[ $1 == "--file" ]]; then output=$2; break; fi
    shift
  done
  printf '%s\n' '-- local fixture dump' >"$output"
elif [[ " $* " == *" storage cp "* ]]; then
  destination=\${!#}
  mkdir -p "$destination/crm-files"
  printf 'fixture' >"$destination/crm-files/fixture.txt"
fi
`,
  );
  chmodSync(fakeSupabase, 0o700);
  writeFileSync(
    config,
    [
      "BACKUP_MODE=local",
      "EXPECTED_PROJECT_REF=local",
      `BACKUP_ROOT=${backupRoot}`,
      `SUPABASE_WORKDIR=${workdir}`,
      `SUPABASE_CLI=${fakeSupabase}`,
      "",
    ].join("\n"),
  );
  chmodSync(config, 0o600);
  writeFileSync(pointer, `${config}\n`);
  chmodSync(pointer, 0o600);
  return { backupRoot, pointer };
}

describe("Candidate CRM backup script definitions", () => {
  it("keeps the macOS backup entry points fail-fast and free of embedded credentials", () => {
    const backupSource = readFileSync(backupScript, "utf8");
    const rotateSource = readFileSync(rotateScript, "utf8");

    for (const source of [backupSource, rotateSource]) {
      expect(source).toMatch(/^#!\/usr\/bin\/env bash/m);
      expect(source).toMatch(/set -E?euo pipefail/);
      expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
    expect(backupSource).toContain("EXPECTED_PROJECT_REF");
    expect(backupSource).toContain(".backup-complete");
    expect(rotateSource).toContain("DAILY_RETENTION=14");
    expect(rotateSource).toContain("WEEKLY_RETENTION=8");
  });
});

describe.skipIf(process.platform === "win32")(
  "Candidate CRM backup script execution",
  () => {
    it("creates database, storage, checksum and metadata artifacts", async () => {
      const root = await mkdtemp(join(tmpdir(), "candidate-crm-backup-"));
      const { backupRoot, pointer } = createFixture(root);
      execFileSync("/bin/bash", [backupScript], {
        env: {
          ...process.env,
          BACKUP_TIMESTAMP_UTC: "20260812T010203Z",
          BACKUP_ISO_WEEK: "2026-W33",
          CANDIDATE_CRM_BACKUP_CONFIG_POINTER: pointer,
        },
      });

      const snapshot = join(backupRoot, "snapshots/20260812T010203Z");
      expect(readFileSync(join(snapshot, "db/schema.sql"), "utf8")).toContain(
        "local fixture dump",
      );
      expect(
        readFileSync(join(snapshot, "storage/crm-files/fixture.txt"), "utf8"),
      ).toBe("fixture");
      expect(
        JSON.parse(readFileSync(join(snapshot, "metadata.json"), "utf8")),
      ).toMatchObject({
        projectRef: "local",
        scriptVersion: 1,
        storage: { bucket: "crm-files", fileCount: 1, bytes: 7 },
      });
      expect(
        readFileSync(join(snapshot, "checksums.sha256"), "utf8"),
      ).toContain("storage/crm-files/fixture.txt");
      expect(readFileSync(join(backupRoot, "backup.log"), "utf8")).toContain(
        "SUCCESS project_ref=local snapshot=20260812T010203Z",
      );
    });

    it("fails closed before calling Supabase when a remote ref is inconsistent", async () => {
      const root = await mkdtemp(join(tmpdir(), "candidate-crm-backup-ref-"));
      const { backupRoot, pointer } = createFixture(root);
      const config = readFileSync(pointer, "utf8").trim();
      writeFileSync(
        config,
        [
          "BACKUP_MODE=remote",
          "EXPECTED_PROJECT_REF=expectedref",
          `BACKUP_ROOT=${backupRoot}`,
          `SUPABASE_WORKDIR=${join(root, "workdir")}`,
          `SUPABASE_CLI=${join(root, "supabase")}`,
          "DATABASE_URL=postgresql://postgres.wrongref:secret@host:6543/postgres",
          "",
        ].join("\n"),
      );
      chmodSync(config, 0o600);
      const result = spawnSync("/bin/bash", [backupScript], {
        encoding: "utf8",
        env: {
          ...process.env,
          CANDIDATE_CRM_BACKUP_CONFIG_POINTER: pointer,
        },
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("project ref does not match");
    });

    it("logs and surfaces a failed backup", async () => {
      const root = await mkdtemp(join(tmpdir(), "candidate-crm-backup-fail-"));
      const { backupRoot, pointer } = createFixture(root, true);
      const result = spawnSync("/bin/bash", [backupScript], {
        encoding: "utf8",
        env: {
          ...process.env,
          BACKUP_TIMESTAMP_UTC: "20260812T020304Z",
          BACKUP_ISO_WEEK: "2026-W33",
          CANDIDATE_CRM_BACKUP_CONFIG_POINTER: pointer,
        },
      });
      expect(result.status).toBe(42);
      expect(readFileSync(join(backupRoot, "backup.log"), "utf8")).toContain(
        "ERROR",
      );
    });

    it("keeps 14 daily generations and one generation from 8 ISO weeks", async () => {
      const root = await mkdtemp(join(tmpdir(), "candidate-crm-rotation-"));
      const backupRoot = join(root, "backups");
      const snapshots = join(backupRoot, "snapshots");
      mkdirSync(snapshots, { recursive: true });
      for (let index = 0; index < 70; index += 1) {
        const day = String(index + 1).padStart(2, "0");
        const snapshot = join(snapshots, `202601${day.slice(-2)}T010203Z`);
        mkdirSync(snapshot);
        writeFileSync(join(snapshot, ".backup-complete"), "");
        writeFileSync(
          join(snapshot, ".iso-week"),
          `2026-W${String(Math.floor(index / 7) + 1).padStart(2, "0")}\n`,
        );
      }

      execFileSync("/bin/bash", [rotateScript, backupRoot]);
      const remaining = execFileSync(
        "/usr/bin/find",
        [snapshots, "-mindepth", "1", "-maxdepth", "1", "-type", "d"],
        { encoding: "utf8" },
      )
        .trim()
        .split("\n")
        .filter(Boolean);
      expect(remaining.length).toBeGreaterThanOrEqual(14);
      expect(remaining.length).toBeLessThanOrEqual(22);
      const weeks = new Set(
        remaining.map((snapshot) =>
          readFileSync(join(snapshot, ".iso-week"), "utf8").trim(),
        ),
      );
      expect(weeks.size).toBe(8);
    });
  },
);
