import {
  CanonicalSerializationError,
  canonicalSerialize,
  computeHmacSha256Fingerprint,
} from "../../supabase/functions/_shared/ai-provenance";

describe("canonicalSerialize", () => {
  it("produces the same string for key-order-different equivalent objects", () => {
    const a = canonicalSerialize({ b: 1, a: 2 });
    const b = canonicalSerialize({ a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1}');
  });

  it("sorts object keys by Unicode code point, not insertion order", () => {
    expect(canonicalSerialize({ z: 1, a: 1, A: 1, "0": 1 })).toBe(
      '{"0":1,"A":1,"a":1,"z":1}',
    );
  });

  it("produces a different string when array order differs", () => {
    const a = canonicalSerialize({ list: [1, 2, 3] });
    const b = canonicalSerialize({ list: [3, 2, 1] });
    expect(a).not.toBe(b);
  });

  it("normalizes Unicode strings to NFC", () => {
    const decomposed = "é"; // e + combining acute accent
    const precomposed = "é"; // é
    expect(canonicalSerialize(decomposed)).toBe(
      canonicalSerialize(precomposed),
    );
  });

  it("normalizes CRLF and lone CR to LF", () => {
    expect(canonicalSerialize("a\r\nb\rc\nd")).toBe(
      JSON.stringify("a\nb\nc\nd"),
    );
  });

  it("omits object keys whose value is null or undefined", () => {
    expect(
      canonicalSerialize({
        keep: "value",
        dropNull: null,
        dropUndefined: undefined,
      }),
    ).toBe('{"keep":"value"}');
  });

  it("preserves null values inside arrays (positional, not a key)", () => {
    expect(canonicalSerialize([1, null, 3])).toBe("[1,null,3]");
  });

  it("does not trim or change the case of string content", () => {
    expect(canonicalSerialize("  Mixed CASE  ")).toBe(
      JSON.stringify("  Mixed CASE  "),
    );
  });

  it("emits no whitespace outside JSON separators", () => {
    expect(canonicalSerialize({ a: [1, 2], b: "x" })).toBe(
      '{"a":[1,2],"b":"x"}',
    );
  });

  it("throws on NaN", () => {
    expect(() => canonicalSerialize({ value: Number.NaN })).toThrow(
      CanonicalSerializationError,
    );
  });

  it("throws on Infinity and -Infinity", () => {
    expect(() =>
      canonicalSerialize({ value: Number.POSITIVE_INFINITY }),
    ).toThrow(CanonicalSerializationError);
    expect(() =>
      canonicalSerialize({ value: Number.NEGATIVE_INFINITY }),
    ).toThrow(CanonicalSerializationError);
  });

  it("throws on a circular reference instead of hanging", () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    expect(() => canonicalSerialize(circular)).toThrow(
      CanonicalSerializationError,
    );
  });
});

describe("computeHmacSha256Fingerprint", () => {
  it("matches a known HMAC-SHA-256 test vector", async () => {
    // RFC 4231 test case 1 (truncated key/data scenario replaced with a
    // simple ASCII vector so the expectation is easy to audit by hand):
    // key = "key", data = "The quick brown fox jumps over the lazy dog"
    // Verified against Node's crypto.createHmac("sha256", "key")...
    const fingerprint = await computeHmacSha256Fingerprint(
      "The quick brown fox jumps over the lazy dog",
      "key",
    );
    expect(fingerprint).toBe(
      "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
    );
  });

  it("produces 64 lowercase hex characters", async () => {
    const fingerprint = await computeHmacSha256Fingerprint("input", "key");
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input and key", async () => {
    const first = await computeHmacSha256Fingerprint("same input", "same key");
    const second = await computeHmacSha256Fingerprint("same input", "same key");
    expect(first).toBe(second);
  });

  it("changes fingerprint for a one-character input difference", async () => {
    const first = await computeHmacSha256Fingerprint("input-a", "key");
    const second = await computeHmacSha256Fingerprint("input-b", "key");
    expect(first).not.toBe(second);
  });

  it("changes fingerprint when only the key differs", async () => {
    const first = await computeHmacSha256Fingerprint("same input", "key-1");
    const second = await computeHmacSha256Fingerprint("same input", "key-2");
    expect(first).not.toBe(second);
  });
});

describe("canonicalSerialize + computeHmacSha256Fingerprint integration", () => {
  it("hashes the exact string that would be sent as the request body", async () => {
    const requestBody = {
      model: "gpt-5.6-luna",
      input: JSON.stringify({ b: 1, a: 2 }),
      store: false,
    };
    const canonicalInput = canonicalSerialize(requestBody);
    expect(canonicalInput).toBe(
      '{"input":"{\\"b\\":1,\\"a\\":2}","model":"gpt-5.6-luna","store":false}',
    );
    const fingerprint = await computeHmacSha256Fingerprint(
      canonicalInput,
      "test-key",
    );
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });
});
