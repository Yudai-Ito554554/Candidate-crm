# Fable 5 review request: Batch 6A AI input provenance

- Request date: 2026-08-17
- Review role: Fable 5 performs design/security review only
- Implementation role: Codex
- Branch: `fable5-ai-provenance-batch6a`
- Base: `main` at `c34a9b6a0184c42d28294f2df9b24a56bf7cd182`
- Initial review HEAD: `8df59ab89cbfc8631f975a89e72d2eb4311700ff`
  (Run `31992846913`, all 3 jobs passed)
- Review outcome: Approve with recommendations (no Blocker, no High;
  M-1 Medium, Low-1)
- Production/staging operations: none
- Edge Function deployments: none

M-1 and Low-1 are addressed in this branch; see sections 3 and 5. The
post-review HEAD and its CI run are recorded in section 8.

## 1. Review objective

Confirm that the Batch 6A implementation follows section 2 of
`docs/fable5-design-batch6a-and-cross-cutting-2026-08-15.md`: identify that the
same input was sent to the AI provider, and under which redaction rules and
input schema, without storing the input itself.

## 2. Implemented files

| Commit    | File                                                                              |
| --------- | --------------------------------------------------------------------------------- |
| `7b3cd30` | `supabase/functions/_shared/ai-provenance.ts`                                     |
| `7b3cd30` | `src/test/ai-provenance.test.ts`                                                  |
| `d1daaad` | `supabase/migrations/20260817030000_ai_provenance_columns.sql`                    |
| `d1daaad` | `supabase/tests/006_ai_provenance.test.sql`                                       |
| `43ec627` | `supabase/functions/generate-candidate-summary/index.ts`                          |
| `43ec627` | `supabase/functions/extract-job-posting/index.ts`                                 |
| `43ec627` | `src/test/ai-provenance-dispatch.test.ts`                                         |
| `43ec627` | `src/types/database.generated.ts`, `tsconfig.edge.json`                           |
| `43ec627` | `src/test/ai-generation-function.test.ts`, `src/test/job-import-function.test.ts` |
| `22ae891` | `docs/backup-runbook.md`, `supabase/README.md`, `HANDOFF.md`                      |
| `8df59ab` | `src/test/ai-provenance-migration.test.ts`                                        |

## 3. Implementation summary

### Canonical serialization and HMAC (design 2.3, 2.4)

- One shared module is imported by both Edge Functions; there is no second
  implementation to drift.
- Rules implemented: UTF-8, NFC normalization, CRLF/CR to LF, object keys
  sorted by Unicode code point, array order preserved, keys with `null` or
  `undefined` values omitted, no whitespace outside JSON separators, shortest
  JSON number form, and no trimming or case folding of string content.
- NaN, Infinity, and circular references raise an error rather than producing
  a fingerprint.
- Key sorting iterates code points rather than UTF-16 code units, so
  astral-plane keys sort as a code-point-aware reader expects.
- HMAC-SHA-256 via Web Crypto, output as 64 lowercase hex characters, key read
  from the `AI_FINGERPRINT_HMAC_KEY_V1` Edge Function secret.

**The string this module returns is used directly as the provider request
body.** No separate serialization exists for hashing versus sending, so the
fingerprint cannot describe anything other than what was transmitted.

### Data model (design 2.5)

- Five nullable columns added to both `ai_generation_requests` and
  `job_import_requests`.
- Constraints per table: fingerprint matches `^[0-9a-f]{64}$`, `hash_algorithm`
  restricted to `hmac-sha256`, `hash_key_version >= 1`, both version columns
  match `^[a-z0-9-]+/[0-9]+$`, and an all-or-nothing constraint so the five
  columns read as a single fact.
- No backfill. The migration comment states that rows predating it have no
  recorded canonical input, so their fingerprint is not computable and must not
  be filled with a guessed value.
- The migration re-issues `revoke all ... from anon` and `from authenticated` on
  both tables. Column additions do not change table-level GRANTs, but the
  additive nature of PostgreSQL GRANTs caused an incident in migrations
  `20260808003737` and `20260808043603`, so the boundary is restated rather
  than assumed.

### Dispatch ordering (design 2.6)

Existing claim, input construction, and redaction are unchanged. After
redaction, the body is canonical-serialized once, that exact string is HMACed,
the five columns are written to the request row, and only then is the provider
called. Recording before dispatch means a crash after sending still leaves
evidence of what was sent.

Version values are domain-namespaced: `candidate-summary/1` and `job-import/1`,
so one function's redaction rules can change without moving the other's
version. Following review finding Low-1, each function holds
`AI_REDACTION_VERSION` and `AI_INPUT_SCHEMA_VERSION` as two separate constants
rather than one shared value, so changing what is redacted cannot silently
advance the input schema version with it.

### Fail-closed behavior (design 2.9)

The provider is not called when the HMAC key is missing or empty, when
canonical serialization fails, or when the provenance write fails. Error
responses contain no input text, no fingerprint, and no key material.

### Cache hits (design 2.6 item 5)

Job-import caching is client-side (`src/features/applications/job-import-panel.tsx`).
A cache hit never reaches the Edge Function, so no request row and no
provenance exist for it. No new flag was added. The existing panel test
"reuses one of the recent import results after switching sources" asserts the
service is called twice for three imports; the server-side complement asserts
provenance is written exactly once per dispatch.

## 4. Verification completed

### Database

- Clean local migration application succeeded in CI.
- pgTAP: 7 files / 82 assertions passed (existing 70 plus new `006` with 12).
  - New `006`: five columns exist with expected types on both tables;
    partially-populated rows rejected on both tables; non-hex, 63-character,
    and uppercase fingerprints rejected; unsupported `hash_algorithm` rejected;
    fully-populated rows accepted on both tables; `anon` and `authenticated`
    still denied SELECT/INSERT/UPDATE on both tables after the column addition.

### Static/application checks

- Vitest: 74 files / 413 tests passed (9 pre-existing skips).
- Fail-closed paths assert the provider mock was called exactly **0** times:

  | Path                      | Candidate summary | Job import |
  | ------------------------- | ----------------- | ---------- |
  | HMAC key unset            | asserted          | asserted   |
  | HMAC key empty/whitespace | asserted          | —          |
  | Provenance write fails    | asserted          | asserted   |

  Canonical serialization failure is covered by module unit tests (NaN,
  Infinity, circular reference).

- Dispatch ordering is asserted on recorded call order, not on source text:
  the provenance write immediately precedes the provider call with nothing
  between them.
- The fingerprint recorded is recomputed from the body the mock actually
  received and compared, proving hash and payload are the same string.
- Error responses are asserted not to contain the key, the fixture input text,
  any 64-character hex run, or the string `hmac`.
- Format, format check, typecheck, lint, build, `verify:repo`, and
  `git diff --check` passed locally and in CI.
- GitHub Actions Run `31992846913` verified the implementation review HEAD:
  Quality checks (`macos-latest`) passed, Quality checks (`windows-latest`)
  passed, Supabase migration and policy checks passed.

## 5. Deviations and judgement calls

No deviation from the design. Three points, the first of which was missed in
the original submission and added after the Batch 6A review:

0. **The effective prompt changed (review finding M-1, Medium).** This section
   originally claimed no behavior change, which was wrong. Adopting canonical
   serialization altered what the provider actually receives:

   - `generate-candidate-summary`: the inner `input` string moved from
     `JSON.stringify(promptContext)` to `canonicalSerialize(promptContext)`,
     so object keys arrive sorted, text is NFC-normalized with LF line
     endings, and **keys whose value is `null` are dropped entirely**. Model
     output can differ from v2 for identical candidate data.
   - `extract-job-posting`: the inner value stays a string, but the source
     text now passes through NFC normalization and CRLF/CR to LF conversion.
     The change is far smaller than above, but it is not zero.

   Resolution: option (a) from the review. `PROMPT_VERSION` moves to
   `candidate-summary-v3` with a comment recording what changed and why,
   so provenance cannot show a stable prompt version across a changed
   effective prompt. Option (b) — keeping `JSON.stringify` inside and making
   only the outer body canonical — was rejected because the inner string
   would then depend on PostgREST column ordering, and identical candidate
   data could produce different fingerprints, weakening design 2.1's goal of
   identifying that the same input was sent.

   Go/No-Go item 3 in design 2.12 now carries an added visual check that AI
   output has not changed substantially.

1. **Secret name documentation.** The Codex instructions offered
   `.env.example` or the secrets documentation. `scripts/verify-repository.mjs`
   pins `.env.example` to exactly the two public variables, so adding a name
   there would fail `verify:repo`. The name is recorded in the new secrets table
   in `supabase/README.md`, with the operational rules in `docs/backup-runbook.md`.

2. **Hand-written generated types.** `npx supabase gen types --local` could not
   be run (see section 7), so the five columns were added to
   `src/types/database.generated.ts` by hand following the generator's
   alphabetical convention. To keep this from being unverified, commit `8df59ab`
   adds a test tying the types to the migration across Row/Insert/Update on both
   tables. The assertion was mutation-checked: removing `hash_key_version` from
   one Row block makes it fail. Column presence and nullability are therefore
   machine-verified; only agreement with the generator's output ordering remains
   unconfirmed, and a regeneration would show it as a formatting-only diff.

## 6. Requested review points

1. Confirm the canonical serialization rules match design 2.4, in particular
   that dropping `null`-valued keys from the payload actually sent to the
   provider is intended and acceptable for both prompts.
2. Confirm that using the canonical string as the request body (rather than
   `JSON.stringify`) is the intended reading of design 2.2, including the
   changed byte content now sent to the provider.
3. Confirm the all-or-nothing constraint plus no-backfill gives the intended
   two-valued reading of the five columns.
4. Confirm the three fail-closed paths are complete, and that aborting before
   dispatch on a provenance write failure is preferable to sending unrecorded.
5. Confirm that treating client-side cache hits as "no row, therefore all NULL"
   satisfies design 2.6 item 5 without a new flag.
6. Confirm the key policy in `docs/backup-runbook.md` states the irreversibility
   correctly, especially that rows recorded before a key leak cannot be rescued.
7. Identify any Blocker/High/Medium issues before main merge.

## 7. Out of scope / not performed

- Setting `AI_FINGERPRINT_HMAC_KEY_V1` in staging or production secrets.
- Deploying either Edge Function.
- Staging execution of the two AI features and confirmation of recorded values.
- Staging demonstration of fail-closed behavior with the key removed.
- Production migration application.
- Local `supabase db reset` / `supabase test db`: the implementation host has no
  WSL2, so Docker Desktop cannot start. All database verification in section 4
  comes from the CI Ubuntu job, which runs the same two commands.
- Batches 6B–6E, which await the external decisions in section 3 of the design
  document.

The Go/No-Go conditions in design section 2.12 remain the authority for
production application; items 2 through 4 of that list are owner actions still
outstanding.

## 8. Review response (2026-08-17)

Fable 5 returned **Approve with recommendations**: no Blocker, no High, one
Medium (M-1) and one Low (Low-1). Merge was gated on deciding and recording an
M-1 approach.

| Finding | Resolution                                                                                                                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M-1     | Option (a) adopted. `PROMPT_VERSION` moved to `candidate-summary-v3` with a comment stating what changed. Rationale for rejecting (b) is in section 5 item 0.                                          |
| M-1     | Design 2.12 Go/No-Go item 3 now requires a visual check that AI output has not changed substantially, covering both functions.                                                                         |
| Low-1   | `AI_PROVENANCE_VERSION` split into `AI_REDACTION_VERSION` and `AI_INPUT_SCHEMA_VERSION` in both functions, with a comment that they advance independently and share a value today only by coincidence. |

One correction to the review's scoping: M-1 is described as affecting the
candidate summary only. That is where the material change is, but
`extract-job-posting` prompt text also now passes through NFC normalization
and CRLF/CR to LF conversion, because those rules apply to every string the
canonical serializer emits. No prompt version exists for job import to bump,
and the change is limited to line endings and Unicode composition, so no code
change was made — but the added Go/No-Go visual check covers both functions
rather than the candidate summary alone.

- Post-review HEAD: `POST_REVIEW_HEAD_PLACEHOLDER`
- Post-review CI Run: `POST_REVIEW_RUN_PLACEHOLDER`
