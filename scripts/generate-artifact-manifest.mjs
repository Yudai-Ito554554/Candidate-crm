import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repositoryRoot = process.cwd();
const platformArgument = process.argv.find((argument) =>
  argument.startsWith("--platform="),
);
const targetPlatform =
  platformArgument?.slice("--platform=".length) ?? process.platform;
const bundleRoot = path.join(
  repositoryRoot,
  "src-tauri",
  "target",
  "release",
  "bundle",
);
const outputDirectory = path.join(repositoryRoot, "artifacts");
const outputPath = path.join(outputDirectory, "sha256-manifest.json");
const packageManifest = JSON.parse(
  await readFile(path.join(repositoryRoot, "package.json"), "utf8"),
);

const distributableExtensions = new Set([".dmg", ".exe", ".msi"]);

async function collectArtifacts(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const artifacts = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      artifacts.push(...(await collectArtifacts(entryPath)));
      continue;
    }

    const normalizedPath = entryPath.split(path.sep).join("/");
    const isMacAppExecutable =
      normalizedPath.includes(".app/Contents/MacOS/") &&
      !path.extname(entry.name);
    if (
      entry.isFile() &&
      !entry.name.startsWith("rw.") &&
      (distributableExtensions.has(path.extname(entry.name).toLowerCase()) ||
        isMacAppExecutable)
    ) {
      artifacts.push(entryPath);
    }
  }

  return artifacts;
}

async function hashFile(filePath) {
  const contents = await readFile(filePath);
  return createHash("sha256").update(contents).digest("hex");
}

let artifactPaths;
try {
  artifactPaths = await collectArtifacts(bundleRoot);
} catch (error) {
  if (error instanceof Error && "code" in error && error.code === "ENOENT") {
    process.stderr.write(
      "Tauri配布物が見つかりません。先にnpm run tauri buildを実行してください。\n",
    );
    process.exit(1);
  }
  throw error;
}

if (artifactPaths.length === 0) {
  process.stderr.write("ハッシュ対象のTauri配布物が見つかりません。\n");
  process.exit(1);
}

const normalizedArtifactPaths = artifactPaths.map((filePath) =>
  filePath.split(path.sep).join("/"),
);
const requiredArtifactChecks =
  targetPlatform === "darwin"
    ? [
        {
          label: "macOSアプリ",
          present: normalizedArtifactPaths.some((filePath) =>
            filePath.includes(".app/Contents/MacOS/"),
          ),
        },
        {
          label: "macOS DMG",
          present: normalizedArtifactPaths.some((filePath) =>
            filePath.endsWith(".dmg"),
          ),
        },
      ]
    : targetPlatform === "win32"
      ? [
          {
            label: "Windows MSI",
            present: normalizedArtifactPaths.some((filePath) =>
              filePath.endsWith(".msi"),
            ),
          },
          {
            label: "Windows NSISセットアップ",
            present: normalizedArtifactPaths.some((filePath) =>
              filePath.endsWith("-setup.exe"),
            ),
          },
        ]
      : [];
const missingArtifacts = requiredArtifactChecks
  .filter((requirement) => !requirement.present)
  .map((requirement) => requirement.label);

if (missingArtifacts.length > 0) {
  process.stderr.write(
    `必要な配布物が不足しています: ${missingArtifacts.join("、")}\n`,
  );
  process.exit(1);
}

const artifacts = await Promise.all(
  artifactPaths.sort().map(async (filePath) => {
    const fileStat = await stat(filePath);
    return {
      path: path.relative(repositoryRoot, filePath).split(path.sep).join("/"),
      bytes: fileStat.size,
      sha256: await hashFile(filePath),
    };
  }),
);

const manifest = {
  application: packageManifest.name,
  version: packageManifest.version,
  platform: targetPlatform,
  architecture: process.arch,
  sourceRevision: /^[a-f0-9]{40}$/i.test(process.env.GITHUB_SHA ?? "")
    ? process.env.GITHUB_SHA
    : null,
  artifacts,
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(
  `配布物マニフェストを作成しました: ${path.relative(repositoryRoot, outputPath)}\n`,
);
