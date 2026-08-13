# Fable 5 review request: Batch 3 RLS InitPlan optimization

- Request date: 2026-08-13
- Review role: Fable 5 performs design/security review only
- Implementation role: Codex
- Branch: `fable5-rls-initplan-batch3`
- Base: `main` at `f248410fc346ce5fac0e3d74910e6c297320dadd`
- Implementation review HEAD: `459bbc1777495b613f8017c18bd2e3a678649fe0`
- GitHub Actions Run ID: `31685999087`
- GitHub Actions result: all 3 jobs passed
- GitHub Actions URL:
  https://github.com/Yudai-Ito554554/Candidate-crm/actions/runs/31685999087
- Production/staging operations: none

## 1. Review objective

Confirm that the Batch 3 implementation follows the design accepted in the
Batch 2 review: cache row-independent `public.current_profile_role()` RLS
lookups using PostgreSQL InitPlans without changing authorization truth values.

## 2. Implemented files

- `supabase/migrations/20260813024735_optimize_rls_role_initplan.sql`
- `supabase/tests/002_rls_initplan.test.sql`
- `supabase/tests/003_rls_initplan_explain.test.sql`
- `src/test/rls-initplan-migration.test.ts`
- `docs/rls-initplan-policy-inventory-2026-08-13.md`
- this review request

## 3. Implementation summary

- Explicitly alters all 51 active policies whose predicates call
  `public.current_profile_role()`.
- Rewrites all 66 occurrences from a direct call to
  `(select public.current_profile_role())`.
- Retains every original `USING` / `WITH CHECK` operator, role allow-list,
  ownership condition, review-state condition, bucket condition, and folder
  condition.
- Does not create/drop tables, functions, or policies.
- Does not modify Auth, audit functions, grants, revokes, profile roles, or
  business data.
- Uses explicit statements rather than dynamic SQL so unexpected database state
  fails closed on a missing policy.

Supabase documents the `(select auth.uid())` / `(select security_definer_fn())`
shape as an InitPlan optimization for row-independent policy functions:
https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

## 4. Verification completed

### Database

- Clean local migration application succeeded.
- pgTAP: 4 files / 46 assertions passed.
  - Existing `000`: 30 unchanged assertions.
  - Existing `001`: 14 unchanged assertions.
  - New `002`: `pg_policies` target count is exactly 51 and every target
    predicate contains the subquery form.
  - New `003`: an authenticated candidates-list `EXPLAIN` contains `InitPlan`.

### Static/application checks

- Migration-specific Vitest: 2/2 passed.
- Format, format check, typecheck, and lint passed before the full-suite run.
- A local single-worker full Vitest rerun passed: 67 files / 353 tests.
- GitHub Actions Run `31685999087` verified the implementation review HEAD and
  passed all jobs:
  - Quality checks (`macos-latest`): passed.
  - Quality checks (`windows-latest`): passed.
  - Supabase migration and policy checks: passed, including clean migration
    reapplication and database tests.

## 5. Requested review points

1. Confirm the 51-policy inventory is complete and no row-dependent function was
   wrapped.
2. Confirm all authorization truth values are unchanged.
3. Confirm explicit `ALTER POLICY` is preferable to dynamic catalog rewriting.
4. Confirm the `pg_policies` assertion is sufficiently fail-closed against future
   direct `current_profile_role()` additions.
5. Confirm the authenticated candidates-list `EXPLAIN` test is an adequate
   evidence example for InitPlan creation.
6. Identify any Blocker/High/Medium issues before main merge.

## 6. Out of scope

- Audit actor attribution (Batch 4)
- Keychain credential storage (Batch 5)
- Auth/RLS role model changes
- Production/staging migration application

This document records the green CI run for the implementation review HEAD. The
subsequent documentation-only commit that adds this evidence does not alter the
implementation under review.
