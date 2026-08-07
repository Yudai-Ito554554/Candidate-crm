import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const repositoryRoot = process.cwd();
const modeArgumentIndex = process.argv.indexOf("--mode");
const mode =
  modeArgumentIndex >= 0 ? process.argv[modeArgumentIndex + 1] : undefined;
const errors = [];
const warnings = [];
const successes = [];

if (mode !== "local" && mode !== "linked") {
  process.stderr.write("--modeにはlocalまたはlinkedを指定してください。\n");
  process.exit(2);
}

function parseEnvironmentFile(filePath) {
  if (!existsSync(filePath)) return new Map();
  const values = new Map();

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const normalized = line.trim();
    if (!normalized || normalized.startsWith("#")) continue;
    const separatorIndex = normalized.indexOf("=");
    if (separatorIndex < 1) continue;
    const key = normalized.slice(0, separatorIndex).trim();
    let value = normalized.slice(separatorIndex + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }

  return values;
}

function resolveSupabaseCommand() {
  const executableName =
    process.platform === "win32" ? "supabase.cmd" : "supabase";
  const localCommand = path.join(
    repositoryRoot,
    "node_modules",
    ".bin",
    executableName,
  );
  if (existsSync(localCommand)) return localCommand;

  const globalCheck = spawnSync(executableName, ["--version"], {
    encoding: "utf8",
    stdio: "ignore",
  });
  return globalCheck.status === 0 ? executableName : null;
}

function commandIsAvailable(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "ignore",
  });
  return result.status === 0;
}

function checkSupabaseAuthentication(command) {
  const result = spawnSync(command, ["projects", "list", "--output", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15_000,
  });
  if (result.status === 0) return { authenticated: true, reason: null };

  const diagnostic = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (/access token not provided|platform auth required/i.test(diagnostic)) {
    return { authenticated: false, reason: "missing_token" };
  }
  return { authenticated: false, reason: "unavailable" };
}

const environmentPath = path.join(repositoryRoot, ".env");
const environment = parseEnvironmentFile(environmentPath);
const supabaseUrlValue = environment.get("VITE_SUPABASE_URL");
const publishableKey = environment.get("VITE_SUPABASE_PUBLISHABLE_KEY");
let supabaseUrl;

if (!existsSync(environmentPath)) {
  errors.push(".envがありません。.env.exampleから作成してください。");
} else {
  successes.push(".envを確認しました。");
}

try {
  supabaseUrl = new URL(supabaseUrlValue ?? "");
  if (supabaseUrl.protocol !== "https:") {
    errors.push("VITE_SUPABASE_URLはHTTPSで設定してください。");
  } else {
    successes.push("Supabase URLの形式を確認しました。");
  }
  if (!supabaseUrl.hostname.endsWith(".supabase.co")) {
    warnings.push(
      "Supabaseカスタムドメインを使用しています。Tauri CSPのconnect-srcを確認してください。",
    );
  }
} catch {
  errors.push("VITE_SUPABASE_URLが未設定またはURL形式ではありません。");
}

if (!publishableKey) {
  errors.push("VITE_SUPABASE_PUBLISHABLE_KEYが未設定です。");
} else {
  successes.push("Supabase Publishable keyの設定を確認しました。");
}

const supabaseCommand = resolveSupabaseCommand();
if (!supabaseCommand) {
  errors.push("Supabase CLIがありません。公式CLIを準備してください。");
} else {
  successes.push("Supabase CLIを確認しました。");
}

if (mode === "local") {
  if (!commandIsAvailable("docker", ["info"])) {
    errors.push(
      "Docker互換ランタイムが起動していません。ローカルDB検証にはDockerが必要です。",
    );
  } else {
    successes.push("Docker互換ランタイムの起動を確認しました。");
  }
}

if (mode === "linked") {
  if (supabaseCommand) {
    const authentication = checkSupabaseAuthentication(supabaseCommand);
    if (authentication.authenticated) {
      successes.push("Supabase CLIの認証を確認しました。");
    } else if (authentication.reason === "missing_token") {
      errors.push(
        "Supabase CLIが未認証です。ローカルの対話可能なターミナルでnpx supabase loginを実行してください。",
      );
    } else {
      errors.push(
        "Supabase CLIの認証状態を確認できません。ネットワーク接続とCLIログイン状態を確認してください。",
      );
    }
  }

  const projectRefPath = path.join(
    repositoryRoot,
    "supabase",
    ".temp",
    "project-ref",
  );
  if (!existsSync(projectRefPath)) {
    errors.push(
      "Supabaseプロジェクトがlinkされていません。非本番project refを確認してlinkしてください。",
    );
  } else {
    const linkedProjectRef = readFileSync(projectRefPath, "utf8").trim();
    const urlProjectRef = supabaseUrl?.hostname.endsWith(".supabase.co")
      ? supabaseUrl.hostname.split(".")[0]
      : null;
    if (urlProjectRef && linkedProjectRef !== urlProjectRef) {
      errors.push(
        ".envのSupabase URLとlink済みproject refが一致しません。適用を停止してください。",
      );
    } else {
      successes.push("link済みproject refとアプリ設定の整合性を確認しました。");
    }
  }
}

for (const message of successes) process.stdout.write(`✓ ${message}\n`);
for (const message of warnings) process.stdout.write(`! ${message}\n`);
for (const message of errors) process.stderr.write(`✗ ${message}\n`);

if (errors.length > 0) {
  process.stderr.write(
    `Supabase ${mode === "local" ? "ローカル" : "linked非本番"}検証の準備が未完了です。\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Supabase ${mode === "local" ? "ローカル" : "linked非本番"}検証を開始できます。\n`,
  );
}
