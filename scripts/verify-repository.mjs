import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repositoryRoot = process.cwd();
const ignoredDirectories = new Set([
  ".git",
  "coverage",
  "dist",
  "node_modules",
  "target",
]);
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const errors = [];

const toRelativePath = (filePath) =>
  path.relative(repositoryRoot, filePath).split(path.sep).join("/");

async function collectTextFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTextFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && textExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

async function verifyEnvironmentExample() {
  const expected = "VITE_SUPABASE_URL=\nVITE_SUPABASE_PUBLISHABLE_KEY=\n";
  const actual = (
    await readFile(path.join(repositoryRoot, ".env.example"), "utf8")
  ).replaceAll("\r\n", "\n");

  if (actual !== expected) {
    errors.push(".env.example は公開可能な2変数だけを空値で定義してください。");
  }
}

async function verifyMigrations() {
  const migrationDirectory = path.join(
    repositoryRoot,
    "supabase",
    "migrations",
  );
  const databaseTestPath = path.join(
    repositoryRoot,
    "supabase",
    "tests",
    "000_schema_security.test.sql",
  );
  const migrationFiles = (await readdir(migrationDirectory))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();
  const timestamps = new Set();

  for (const fileName of migrationFiles) {
    const match = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(fileName);
    if (!match) {
      errors.push(`migration名が規約外です: ${fileName}`);
      continue;
    }

    if (timestamps.has(match[1])) {
      errors.push(`migration timestampが重複しています: ${match[1]}`);
    }
    timestamps.add(match[1]);
  }

  if (migrationFiles.length === 0) {
    errors.push("Supabase migrationが見つかりません。");
  }

  try {
    await readFile(databaseTestPath, "utf8");
  } catch {
    errors.push("Supabaseのschema・RLS統合テストが見つかりません。");
  }
}

async function verifyTauriSecurity() {
  const config = JSON.parse(
    await readFile(
      path.join(repositoryRoot, "src-tauri", "tauri.conf.json"),
      "utf8",
    ),
  );
  const csp = config.app?.security?.csp;

  if (typeof csp !== "string" || !csp.includes("object-src 'none'")) {
    errors.push(
      "Tauri本番WebViewのCSPを有効にし、object-srcを禁止してください。",
    );
  }
}

async function verifyApplicationVersion() {
  const packageManifest = JSON.parse(
    await readFile(path.join(repositoryRoot, "package.json"), "utf8"),
  );
  const tauriConfig = JSON.parse(
    await readFile(
      path.join(repositoryRoot, "src-tauri", "tauri.conf.json"),
      "utf8",
    ),
  );
  const cargoManifest = await readFile(
    path.join(repositoryRoot, "src-tauri", "Cargo.toml"),
    "utf8",
  );
  const cargoPackageSection = /^\[package\]\s*\n([\s\S]*?)(?=\n\[|$)/.exec(
    cargoManifest,
  )?.[1];
  const cargoVersion = /^version\s*=\s*"([^"]+)"\s*$/m.exec(
    cargoPackageSection ?? "",
  )?.[1];
  const versions = [packageManifest.version, tauriConfig.version, cargoVersion];

  if (
    versions.some((version) => typeof version !== "string") ||
    new Set(versions).size !== 1
  ) {
    errors.push(
      "package.json、tauri.conf.json、Cargo.tomlのバージョンを一致させてください。",
    );
  }
}

async function verifyOperationalScripts() {
  const readinessScript = path.join(
    repositoryRoot,
    "scripts",
    "check-supabase-readiness.mjs",
  );
  try {
    await readFile(readinessScript, "utf8");
  } catch {
    errors.push("Supabase接続前の安全確認スクリプトが見つかりません。");
  }
}

async function verifyTrackedText() {
  const files = await collectTextFiles(repositoryRoot);
  const secretPatterns = [
    { label: "OpenAI API key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/ },
    { label: "Supabase secret key", pattern: /\bsb_secret_[A-Za-z0-9_-]{16,}/ },
    {
      label: "private key",
      pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    },
  ];
  const localPathPatterns = [
    /(?:^|[\s"'`])\/Users\/[A-Za-z0-9._-]+\//,
    /(?:^|[\s"'`])[A-Za-z]:\\Users\\[^\\\s]+\\/,
  ];

  for (const filePath of files) {
    const relativePath = toRelativePath(filePath);
    if (relativePath === "scripts/verify-repository.mjs") {
      continue;
    }

    const content = await readFile(filePath, "utf8");
    for (const { label, pattern } of secretPatterns) {
      if (pattern.test(content)) {
        errors.push(`${relativePath} に ${label} らしき値があります。`);
      }
    }

    if (localPathPatterns.some((pattern) => pattern.test(content))) {
      errors.push(`${relativePath} にOS固有の絶対ユーザーパスがあります。`);
    }

    if (
      relativePath.startsWith("src/") &&
      !relativePath.startsWith("src/test/") &&
      /\b(?:OPENAI_API_KEY|OPENAI_MODEL|SUPABASE_SERVICE_ROLE_KEY)\b/.test(
        content,
      )
    ) {
      errors.push(
        `${relativePath} がサーバー専用の秘密変数名を参照しています。`,
      );
    }
  }
}

await Promise.all([
  verifyEnvironmentExample(),
  verifyMigrations(),
  verifyTauriSecurity(),
  verifyApplicationVersion(),
  verifyOperationalScripts(),
  verifyTrackedText(),
]);

if (errors.length > 0) {
  for (const error of errors) {
    process.stderr.write(`- ${error}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write("Repository verification passed.\n");
}
