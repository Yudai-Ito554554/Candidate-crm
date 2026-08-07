# AGENTS.md

## Project scope

Candidate CRM is a cross-platform Tauri 2 desktop application for macOS and Windows. Phase 4D connects candidate, its persistent accessible status pipeline, per-user candidate-view history, experience, normalized candidate/company/job tags, company and its detail/file view, company-contact, job, application, immutable application-status history and its candidate UI, candidate/job/company activity views, task, private file, Inbox, home, report aggregation, profile/role management, role-aware read-only UI, server-generated reviewable AI summaries, RLS-aware global search, immutable administrative audit metadata, and app-wide failure recovery UI to Supabase. It also removes legacy mock-backed routes and enforces release checks for repository hygiene, frontend quality, Tauri security configuration, cross-platform Rust compilation, clean-database migration and policy integration tests, fail-closed serialized administrator role changes, aligned application versions, and short-lived unsigned macOS/Windows QA artifacts.

## Working agreements

- Keep all application code in TypeScript or Rust; do not introduce untyped `any` without a documented reason.
- Preserve macOS and Windows compatibility. Use Node.js APIs or cross-platform packages instead of OS-specific shell commands in npm scripts.
- Do not add absolute local filesystem paths to tracked files.
- Keep the dependency set focused. Discuss large frameworks or infrastructure additions before installing them.
- Do not suppress TypeScript, ESLint, test, Rust, or build failures to make checks pass.
- Keep secrets out of Git. Only document variable names in `.env.example`.
- Keep package, Tauri, and Cargo versions aligned; QA artifact workflows must fail before building when required public Supabase configuration is absent.
- Treat unsigned desktop artifacts as short-lived internal QA outputs, never as public releases.
- Keep mock data in `src/data`, domain types in `src/types`, authentication code in `src/features/auth`, and repositories in `src/services`.
- Keep candidate query keys, mutations, form validation, and database-to-view mapping in `src/features/candidates`.
- Archive candidates through `archived_at`; do not add client-side candidate DELETE operations.
- Archive candidate experiences and tag relations through `archived_at`; do not add client-side DELETE operations for them.
- Archive applications through `archived_at`; terminal applications may be followed by a later reapplication, but active candidate/job pairs must remain unique.
- Archive activities and tasks through `archived_at`; complete tasks through `completed_at` and never physically delete their business history.
- Archive file metadata through `archived_at`; do not expose a normal UI operation that physically deletes completed Storage uploads.
- Store CRM files only in a private bucket. Never use public URLs for candidate documents or place file contents in localStorage.
- Keep candidate, company, and job uploads on the shared private file service; isolate each entity in its own owner/entity Storage path.
- Treat email messages as immutable synced facts. Desktop clients may update thread workflow status but must not insert, rewrite, or delete synced email bodies.
- Build home summaries from domain query data through pure aggregation functions; do not duplicate operational records in browser storage.
- Keep report aggregation pure and document metrics derived from current state rather than audited transition history.
- Treat application status history as immutable DB-triggered audit data; desktop clients may read it but must not write or delete it.
- Keep candidate view history in Supabase under per-user RLS; never persist candidate views or candidate information in localStorage.
- Never place Gmail or Outlook OAuth client secrets, refresh tokens, or provider credentials in Vite client code.
- A job contact must belong to the job's company. Keep this invariant in both form filtering and database validation.
- Do not archive companies, contacts, or jobs while active records still reference them.
- New candidates default to the current authenticated user as `owner_id` unless the UI explicitly supports reassignment.
- Persist pipeline moves through the candidate status mutation with optimistic rollback; provide a keyboard-accessible stage selector and never give viewers change controls or draggable cards.
- Every schema change must be represented by an ordered file in `supabase/migrations`.
- Keep live schema and RLS assertions in `supabase/tests`; every migration must pass from a clean local Supabase reset.
- Do not change the schema only through the Supabase Dashboard.
- Never create a business table without enabling and reviewing RLS.
- When adding a status, update the SQL CHECK constraint, manual TypeScript union, UI mapping, and tests together.
- Business `owner_id` columns reference `auth.users(id)`; `profiles` stores display-only user metadata and roles.
- Keep candidate-only internal notes in `private_notes`; do not introduce an ambiguous candidate `notes` column.
- Store reusable candidate, company, and job classifications through normalized tag tables, not JSON arrays.
- AI-created activities must set `ai_generated`; do not infer provenance from activity text.
- Derive job activity history from the shared `activities` table by `job_id`; do not duplicate activity records for job views.
- Derive company activity history from the shared `activities` table by `company_id`; do not duplicate activity records for company views.
- Review every migration and its target project before applying it.
- Run the appropriate Supabase readiness check before local resets or linked operations, and stop on an app URL/project-ref mismatch.
- Never use production candidate or company data in fixtures, tests, screenshots, or local seeds.
- Never place a Supabase `service_role` key or other server secret in Vite client code.
- Treat Supabase RLS as the role boundary: admin and agent may write business data, while viewer is read-only.
- New Auth users must remain pending and unable to read CRM data until an administrator approves their workspace role.
- Paginate client-side collection queries or aggregate in PostgreSQL; never assume a single PostgREST response contains every row.
- Keep viewer write controls hidden and protect editor routes, but never treat client-side hiding as a substitute for RLS.
- Change `profiles.role` only through the admin-checked `set_profile_role` RPC; never grant direct role-column updates to desktop clients.
- Role authorization must fail closed when a profile is missing, and final-admin protection must remain correct under concurrent role changes.
- Never implement user invitations directly in the Vite/Tauri client; use Supabase Dashboard or a reviewed server-side function.
- Generate and archive AI summaries only in reviewed server-side code; desktop clients may read summaries and record human review metadata but must not rewrite AI text.
- Preserve AI provenance fields (`model`, `prompt_version`, source activity cutoff, generation time) and require human review before operational use.
- Keep global search behind an authenticated, security-invoker RPC so existing table RLS remains authoritative.
- Search normalized tag relations directly; do not copy tags or search results into localStorage.
- Record important CRM writes through database audit triggers, not optional client-side calls.
- Audit field names and operational metadata only; do not duplicate candidate text, email bodies, AI output, or before/after values into audit logs.
- Keep audit logs immutable to desktop clients and visible only to administrators through RLS.
- Keep `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` exclusively in Edge Function secrets; never expose them through Vite variables. Keep the reviewed OpenAI model identifier in server-side Edge Function code, never in Vite client code.
- Require an authenticated admin or agent before invoking AI generation, and keep generation request state server-only.
- Minimize AI input: exclude direct candidate identifiers and `private_notes`, redact contact-like text, disable provider response storage, and use strict structured output.
- Replace active AI summaries atomically through the server-only database function so failed generations do not archive the last usable summary.
- Never expose raw render exceptions, route errors, database errors, authentication details, or candidate content in recovery screens.
- Preserve distinct recovery paths for fatal render errors, route-loading failures, 404s, and offline status; all must remain usable without OS-specific APIs.

## Required checks

Run these before handing off a change:

```sh
npm run typecheck
npm run lint
npm test
npm run format:check
npm run build
npm run verify:repo
```

For changes under `src-tauri`, also run:

```sh
npm run tauri build
```

## Structure

- `src/components/ui`: shadcn/ui primitives
- `src/components/common`: reusable CRM presentation components
- `src/components/layout`: shared application shell and navigation
- `src/pages`: routed application pages
- `src/data`: typed mock data
- `src/types`: domain models and status unions
- `src/services`: typed repositories and common database error handling
- `src/lib`: shared utilities
- `src/styles`: global Tailwind CSS styles
- `src/test`: shared test setup
- `src-tauri`: Rust and Tauri desktop configuration
- `supabase/migrations`: reviewed, ordered PostgreSQL migrations
