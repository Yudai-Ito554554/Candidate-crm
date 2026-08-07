import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = path.resolve(
  process.cwd(),
  "scripts/generate-artifact-manifest.mjs",
);
const temporaryDirectories: string[] = [];

async function createTemporaryRepository() {
  const repository = await mkdtemp(
    path.join(tmpdir(), "candidate-crm-artifacts-"),
  );
  temporaryDirectories.push(repository);
  await writeFile(
    path.join(repository, "package.json"),
    JSON.stringify({ name: "candidate-crm", version: "0.1.0" }),
    "utf8",
  );
  return repository;
}

async function createArtifact(
  repository: string,
  relativePath: string,
  contents: string,
) {
  const artifactPath = path.join(repository, relativePath);
  await mkdir(path.dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, contents, "utf8");
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("generate-artifact-manifest", () => {
  it("macOS配布物を記録し、一時DMGを除外する", async () => {
    const repository = await createTemporaryRepository();
    const artifacts = [
      {
        path: "src-tauri/target/release/bundle/macos/Candidate CRM.app/Contents/MacOS/candidate-crm",
        contents: "mac-app",
      },
      {
        path: "src-tauri/target/release/bundle/dmg/Candidate CRM_0.1.0_aarch64.dmg",
        contents: "mac-dmg",
      },
    ];

    await Promise.all(
      artifacts.map((artifact) =>
        createArtifact(repository, artifact.path, artifact.contents),
      ),
    );
    await createArtifact(
      repository,
      "src-tauri/target/release/bundle/macos/rw.123.Candidate CRM.dmg",
      "temporary-dmg",
    );

    const sourceRevision = "a".repeat(40);
    const result = spawnSync(
      process.execPath,
      [scriptPath, "--platform=darwin"],
      {
        cwd: repository,
        encoding: "utf8",
        env: { ...process.env, GITHUB_SHA: sourceRevision },
      },
    );

    expect(result.status).toBe(0);
    const manifest = JSON.parse(
      await readFile(
        path.join(repository, "artifacts/sha256-manifest.json"),
        "utf8",
      ),
    ) as {
      application: string;
      version: string;
      platform: string;
      sourceRevision: string | null;
      artifacts: Array<{ path: string; bytes: number; sha256: string }>;
    };

    expect(manifest.application).toBe("candidate-crm");
    expect(manifest.version).toBe("0.1.0");
    expect(manifest.platform).toBe("darwin");
    expect(manifest.sourceRevision).toBe(sourceRevision);
    expect(manifest.artifacts.map((artifact) => artifact.path)).toEqual(
      artifacts.map((artifact) => artifact.path).sort(),
    );

    for (const artifact of artifacts) {
      const manifestArtifact = manifest.artifacts.find(
        (entry) => entry.path === artifact.path,
      );
      expect(manifestArtifact).toEqual({
        path: artifact.path,
        bytes: Buffer.byteLength(artifact.contents),
        sha256: createHash("sha256").update(artifact.contents).digest("hex"),
      });
    }
  });

  it("WindowsのMSIとNSISセットアップを記録する", async () => {
    const repository = await createTemporaryRepository();
    const artifacts = [
      {
        path: "src-tauri/target/release/bundle/msi/Candidate CRM_0.1.0_x64.msi",
        contents: "windows-msi",
      },
      {
        path: "src-tauri/target/release/bundle/nsis/Candidate CRM_0.1.0_x64-setup.exe",
        contents: "windows-exe",
      },
    ];
    await Promise.all(
      artifacts.map((artifact) =>
        createArtifact(repository, artifact.path, artifact.contents),
      ),
    );

    const result = spawnSync(
      process.execPath,
      [scriptPath, "--platform=win32"],
      {
        cwd: repository,
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    const manifest = JSON.parse(
      await readFile(
        path.join(repository, "artifacts/sha256-manifest.json"),
        "utf8",
      ),
    ) as {
      platform: string;
      sourceRevision: string | null;
      artifacts: Array<{ path: string }>;
    };

    expect(manifest.platform).toBe("win32");
    expect(manifest.sourceRevision).toBeNull();
    expect(manifest.artifacts.map((artifact) => artifact.path)).toEqual(
      artifacts.map((artifact) => artifact.path).sort(),
    );
  });

  it("OSごとの必須成果物が不足している場合は失敗する", async () => {
    const repository = await createTemporaryRepository();
    await createArtifact(
      repository,
      "src-tauri/target/release/bundle/macos/Candidate CRM.app/Contents/MacOS/candidate-crm",
      "mac-app",
    );

    const result = spawnSync(
      process.execPath,
      [scriptPath, "--platform=darwin"],
      {
        cwd: repository,
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("必要な配布物が不足しています: macOS DMG");
  });

  it("配布物が存在しない場合は失敗する", async () => {
    const repository = await createTemporaryRepository();
    await mkdir(path.join(repository, "src-tauri/target/release/bundle"), {
      recursive: true,
    });

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: repository,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "ハッシュ対象のTauri配布物が見つかりません。",
    );
  });
});
