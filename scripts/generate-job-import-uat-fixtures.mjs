// Builds the three rejection fixtures used by the S3-6 hardware UAT.
//
//   job-import-fake.pdf                  .pdf name, not a PDF at all
//   job-import-truncated.pdf             starts with %PDF- but has no %%EOF
//   job-import-password-protected.pdf    real RC4-40 encrypted PDF
//   job-import-company-conflict.txt      name and website match two companies
//   cache-variant-a/…, cache-variant-b/… same file name, same size, different
//
// All content is fictional. Run: node scripts/generate-job-import-uat-fixtures.mjs

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIRECTORY = path.resolve(process.cwd(), "docs/fixtures");
/** Same file name in both, so the panel sees one name and two contents. */
const CACHE_VARIANT_NAME = "job-import-cache-variant.pdf";

const USER_PASSWORD = "uat-test-password";
const OWNER_PASSWORD = "uat-owner-password";
// Fixed so the fixture is byte-identical on every run.
const DOCUMENT_ID = Buffer.from("candidatecrmuat0", "latin1");

const PAD = Buffer.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff,
  0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c,
  0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

const SALARY_LINE = "Salary: 6,000,000 - 8,500,000 JPY";

const PAGE_LINES = [
  "Candidate CRM - UAT fixture (fictional)",
  "",
  "Company: Medical Frontier Inc. (fictional company)",
  "Job: Orthopaedic medical device sales",
  "Location: Tokyo / Osaka",
  SALARY_LINE,
  "",
  "This is a fictional job posting written for Candidate CRM acceptance",
  "testing. It describes no real company, job, or person.",
];

/** RC4. Node's OpenSSL 3 build no longer exposes it as a cipher. */
function rc4(key, data) {
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) s[i] = i;

  let j = 0;
  for (let i = 0; i < 256; i += 1) {
    j = (j + s[i] + key[i % key.length]) & 0xff;
    [s[i], s[j]] = [s[j], s[i]];
  }

  const out = Buffer.alloc(data.length);
  let a = 0;
  let b = 0;
  for (let k = 0; k < data.length; k += 1) {
    a = (a + 1) & 0xff;
    b = (b + s[a]) & 0xff;
    [s[a], s[b]] = [s[b], s[a]];
    out[k] = data[k] ^ s[(s[a] + s[b]) & 0xff];
  }
  return out;
}

function md5(...parts) {
  const hash = createHash("md5");
  for (const part of parts) hash.update(part);
  return hash.digest();
}

function padPassword(password) {
  const raw = Buffer.from(password, "latin1");
  return Buffer.concat([raw, PAD], 32);
}

function hex(buffer) {
  return `<${buffer.toString("hex").toUpperCase()}>`;
}

/** Standard security handler, revision 2, 40-bit key. */
function buildEncryption(permissions) {
  const ownerEntry = rc4(
    md5(padPassword(OWNER_PASSWORD)).subarray(0, 5),
    padPassword(USER_PASSWORD),
  );

  const permissionBytes = Buffer.alloc(4);
  permissionBytes.writeInt32LE(permissions);
  const key = md5(
    padPassword(USER_PASSWORD),
    ownerEntry,
    permissionBytes,
    DOCUMENT_ID,
  ).subarray(0, 5);

  return { key, ownerEntry, userEntry: rc4(key, PAD) };
}

function objectKey(key, objectNumber) {
  const suffix = Buffer.alloc(5);
  suffix.writeUIntLE(objectNumber, 0, 3);
  suffix.writeUInt16LE(0, 3);
  return md5(key, suffix).subarray(0, key.length + 5);
}

function buildPdf({ encryption, salary = SALARY_LINE }) {
  const permissions = -4;
  if (salary.length !== SALARY_LINE.length)
    throw new Error("salary override must keep the byte length identical");
  const contentLines = PAGE_LINES.map((line) =>
    line === SALARY_LINE ? salary : line,
  )
    .map(
      (line, index) =>
        `BT /F1 11 Tf 60 ${760 - index * 18} Td (${line.replace(/([()\\])/g, "\\$1")}) Tj ET`,
    )
    .join("\n");
  const content = Buffer.from(`${contentLines}\n`, "latin1");
  const stream = encryption
    ? rc4(objectKey(encryption.key, 5), content)
    : content;

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    null, // object 5 is the content stream, assembled below
  ];

  if (encryption) {
    objects.push(
      "<< /Filter /Standard /V 1 /R 2 " +
        `/O ${hex(encryption.ownerEntry)} /U ${hex(encryption.userEntry)} ` +
        `/P ${permissions} >>`,
    );
  }

  const chunks = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  const offsets = [];
  let position = chunks[0].length;

  objects.forEach((body, index) => {
    const number = index + 1;
    const piece =
      body === null
        ? Buffer.concat([
            Buffer.from(
              `${number} 0 obj\n<< /Length ${stream.length} >>\nstream\n`,
              "latin1",
            ),
            stream,
            Buffer.from("\nendstream\nendobj\n", "latin1"),
          ])
        : Buffer.from(`${number} 0 obj\n${body}\nendobj\n`, "latin1");

    offsets.push(position);
    chunks.push(piece);
    position += piece.length;
  });

  const size = objects.length + 1;
  const xref = [`xref\n0 ${size}\n0000000000 65535 f \n`];
  for (const offset of offsets)
    xref.push(`${String(offset).padStart(10, "0")} 00000 n \n`);

  const trailer =
    `trailer\n<< /Size ${size} /Root 1 0 R` +
    (encryption ? " /Encrypt 6 0 R" : "") +
    ` /ID [${hex(DOCUMENT_ID)} ${hex(DOCUMENT_ID)}] >>\n` +
    `startxref\n${position}\n%%EOF\n`;

  return {
    complete: Buffer.concat([
      ...chunks,
      Buffer.from(xref.join(""), "latin1"),
      Buffer.from(trailer, "latin1"),
    ]),
    // Everything before the cross-reference table: a plausible partial write.
    truncated: Buffer.concat(chunks),
  };
}

const fake = Buffer.from(
  [
    "This file is named .pdf but it is plain text, not a PDF document.",
    "",
    "Candidate CRM UAT fixture. It exists to confirm that a file whose",
    "extension claims PDF is rejected before any AI quota is spent.",
    "It describes no real company, job, or person.",
    "",
    "架空データ。実在する企業・求人とは関係ありません。",
    "",
  ].join("\n"),
  "utf8",
);

const plain = buildPdf({ encryption: null });
const protectedPdf = buildPdf({ encryption: buildEncryption(-4) });

const outputs = [
  ["job-import-fake.pdf", fake],
  ["job-import-truncated.pdf", plain.truncated],
  ["job-import-password-protected.pdf", protectedPdf.complete],
];

for (const [name, contents] of outputs) {
  await writeFile(path.join(OUTPUT_DIRECTORY, name), contents);
  console.log(`${name}: ${contents.length} bytes`);
}

// The company name carries no parenthetical. A suffix like "（架空企業）" reads
// as an annotation, and the extractor drops it, which makes the extracted name
// stop matching the company registered under the full string. The fictional
// marking moves to the notes instead, where nothing is extracted from.
const COMPANY_CONFLICT_TEXT = [
  "株式会社メディカルフロンティア",
  "",
  "業種：医療機器",
  "Webサイト：https://medical-frontier.example/recruit",
  "",
  "求人名：脊椎領域 医療機器営業",
  "事業部：スパイン事業部",
  "職種：医療機器営業",
  "雇用形態：正社員",
  "勤務地：東京都",
  "想定年収：650万円から900万円",
  "募集開始日：2026年9月1日",
  "募集終了日：2026年11月30日",
  "",
  "仕事内容",
  "脊椎領域の医療機器について、基幹病院へ製品提案、手術立ち会い、導入後フォローを行います。",
  "",
  "必須条件",
  "法人営業経験3年以上。普通自動車運転免許。",
  "",
  "注記",
  "本書はCandidate CRMの動作確認用に作成した架空の求人票です。",
  "上記の企業名・Webサイトはいずれも架空で、実在する企業・求人とは関係ありません。",
  "企業照合の競合を再現するため、企業名とWebサイトを両方記載しています。",
  "",
].join("\n");

const cacheVariantA = buildPdf({ encryption: null }).complete;
const cacheVariantB = buildPdf({
  encryption: null,
  salary: "Salary: 7,000,000 - 9,500,000 JPY",
}).complete;

if (cacheVariantA.length !== cacheVariantB.length)
  throw new Error("cache variants must stay the same size");
if (cacheVariantA.equals(cacheVariantB))
  throw new Error("cache variants must differ in content");

for (const [folder, contents] of [
  ["cache-variant-a", cacheVariantA],
  ["cache-variant-b", cacheVariantB],
]) {
  const directory = path.join(OUTPUT_DIRECTORY, folder);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, CACHE_VARIANT_NAME), contents);
  console.log(`${folder}/${CACHE_VARIANT_NAME}: ${contents.length} bytes`);
}

await writeFile(
  path.join(OUTPUT_DIRECTORY, "job-import-company-conflict.txt"),
  COMPANY_CONFLICT_TEXT,
  "utf8",
);
console.log(
  `job-import-company-conflict.txt: ${Buffer.byteLength(COMPANY_CONFLICT_TEXT)} bytes`,
);
