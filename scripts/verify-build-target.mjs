import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function readArgument(name) {
  const prefix = `--${name}=`;
  return process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const expectedRef = readArgument("expected-ref");
const forbiddenRef = readArgument("forbidden-ref");
const distDirectory = readArgument("dist");

if (!expectedRef || !/^[a-z0-9]{20}$/.test(expectedRef)) {
  fail("expected-ref must be a 20-character Supabase project ref.");
}

if (!forbiddenRef || !/^[a-z0-9]{20}$/.test(forbiddenRef)) {
  fail("forbidden-ref must be a 20-character Supabase project ref.");
}

if (expectedRef === forbiddenRef) {
  fail("Expected and forbidden Supabase project refs must differ.");
}

if (process.env.VITE_APP_ENV !== "production") {
  fail("VITE_APP_ENV must be production for this build.");
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey) {
  fail("Required production Supabase build settings are not configured.");
}

let parsedSupabaseUrl;
try {
  parsedSupabaseUrl = new URL(supabaseUrl);
} catch {
  fail("Production Supabase URL is invalid.");
}

if (
  parsedSupabaseUrl.origin !== `https://${expectedRef}.supabase.co` ||
  parsedSupabaseUrl.pathname !== "/" ||
  parsedSupabaseUrl.search ||
  parsedSupabaseUrl.hash ||
  parsedSupabaseUrl.username ||
  parsedSupabaseUrl.password
) {
  fail("Supabase URL does not match the expected production project ref.");
}

if (supabaseUrl.includes(forbiddenRef)) {
  fail("Staging project ref was found in the production build environment.");
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

if (distDirectory) {
  let files;
  try {
    files = await collectFiles(path.resolve(process.cwd(), distDirectory));
  } catch {
    fail("Built frontend directory could not be read.");
  }

  let expectedRefFound = false;
  for (const file of files) {
    const contents = await readFile(file);
    const text = contents.toString("utf8");
    expectedRefFound ||= text.includes(expectedRef);
    if (text.includes(forbiddenRef)) {
      fail("Staging project ref was found in built frontend assets.");
    }
  }

  if (!expectedRefFound) {
    fail(
      "Expected production project ref was not found in built frontend assets.",
    );
  }
}

process.stdout.write("Production build target verification passed.\n");
