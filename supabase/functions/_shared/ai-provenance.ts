// Shared by generate-candidate-summary and extract-job-posting so both
// functions hash the exact byte string they send to the AI provider.
// Design of record: docs/fable5-design-batch6a-and-cross-cutting-2026-08-15.md
// section 2.4 (canonical serialization rules) and 2.3 (HMAC key handling).
//
// This module intentionally uses only Web-standard APIs (crypto.subtle,
// TextEncoder, String.prototype.normalize) so it runs unmodified under the
// Deno Edge Function runtime and under Vitest/Node.

export class CanonicalSerializationError extends Error {
  constructor(reason: string) {
    super(`canonical_serialization_failed:${reason}`);
    this.name = "CanonicalSerializationError";
  }
}

const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;

function normalizeString(value: string): string {
  return value.normalize("NFC").replace(/\r\n|\r/g, "\n");
}

// Object keys are sorted by Unicode code point, not UTF-16 code unit, so
// astral-plane keys (surrogate pairs) sort the same way a code-point-aware
// reader would expect. String iteration yields one code point per step.
function compareByCodePoint(left: string, right: string): number {
  const leftIterator = left[Symbol.iterator]();
  const rightIterator = right[Symbol.iterator]();
  for (;;) {
    const nextLeft = leftIterator.next();
    const nextRight = rightIterator.next();
    if (nextLeft.done && nextRight.done) return 0;
    if (nextLeft.done) return -1;
    if (nextRight.done) return 1;
    const codeLeft = nextLeft.value.codePointAt(0) ?? 0;
    const codeRight = nextRight.value.codePointAt(0) ?? 0;
    if (codeLeft !== codeRight) return codeLeft - codeRight;
  }
}

function serializeValue(value: unknown, seen: Set<object>): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new CanonicalSerializationError("non_finite_number");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(normalizeString(value));
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new CanonicalSerializationError("circular_reference");
    }
    seen.add(value);
    const items = value.map((item) =>
      item === undefined ? "null" : serializeValue(item, seen),
    );
    seen.delete(value);
    return `[${items.join(",")}]`;
  }
  if (typeof value === "object") {
    if (seen.has(value)) {
      throw new CanonicalSerializationError("circular_reference");
    }
    seen.add(value);
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== null && record[key] !== undefined)
      .sort(compareByCodePoint);
    const entries = keys.map((key) => {
      const serializedKey = JSON.stringify(normalizeString(key));
      return `${serializedKey}:${serializeValue(record[key], seen)}`;
    });
    seen.delete(value);
    return `{${entries.join(",")}}`;
  }
  throw new CanonicalSerializationError("unsupported_type");
}

/**
 * Produces the exact byte string sent to the AI provider and hashed for
 * provenance. Callers must use this same string for both purposes; a
 * separate re-serialization would break the fingerprint's guarantee.
 */
export function canonicalSerialize(value: unknown): string {
  if (value === undefined) {
    throw new CanonicalSerializationError("undefined_root_value");
  }
  return serializeValue(value, new Set());
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * HMAC-SHA-256 over a canonical-serialized string, returned as 64 lowercase
 * hex characters. Raw SHA-256 is deliberately not used: without a
 * server-only key, a leaked DB dump would let an attacker confirm whether a
 * specific document was sent to the AI provider (see design 2.3).
 */
export async function computeHmacSha256Fingerprint(
  canonicalInput: string,
  hmacKey: string,
): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(hmacKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(canonicalInput),
  );
  const fingerprint = toHex(signature);
  if (!FINGERPRINT_PATTERN.test(fingerprint)) {
    throw new CanonicalSerializationError("fingerprint_format_invalid");
  }
  return fingerprint;
}
