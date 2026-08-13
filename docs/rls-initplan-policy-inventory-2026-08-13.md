# RLS InitPlan policy inventory

- Date: 2026-08-13
- Batch: 3
- Source branch: `fable5-rls-initplan-batch3`
- Scope: policies whose predicates call the row-independent
  `public.current_profile_role()` helper

## Mechanical inventory result

The final migration state contains 51 active role-dependent policies. The
inventory was derived from the policy creation/replacement migrations and was
validated after a clean local migration application by querying `pg_policies`.
The executable assertion is
`supabase/tests/002_rls_initplan.test.sql`; it fails if the count changes or if
any target predicate is not represented as an InitPlan subquery.

| Schema / table                      | Policies | Commands               |
| ----------------------------------- | -------: | ---------------------- |
| `public.profiles`                   |        1 | SELECT                 |
| `public.candidates`                 |        3 | SELECT, INSERT, UPDATE |
| `public.candidate_experiences`      |        3 | SELECT, INSERT, UPDATE |
| `public.companies`                  |        3 | SELECT, INSERT, UPDATE |
| `public.company_contacts`           |        3 | SELECT, INSERT, UPDATE |
| `public.jobs`                       |        3 | SELECT, INSERT, UPDATE |
| `public.applications`               |        3 | SELECT, INSERT, UPDATE |
| `public.activities`                 |        3 | SELECT, INSERT, UPDATE |
| `public.tasks`                      |        3 | SELECT, INSERT, UPDATE |
| `public.files`                      |        3 | SELECT, INSERT, UPDATE |
| `public.email_threads`              |        2 | SELECT, UPDATE         |
| `public.email_messages`             |        1 | SELECT                 |
| `public.tags`                       |        3 | SELECT, INSERT, UPDATE |
| `public.candidate_tags`             |        3 | SELECT, INSERT, UPDATE |
| `public.company_tags`               |        3 | SELECT, INSERT, UPDATE |
| `public.job_tags`                   |        3 | SELECT, INSERT, UPDATE |
| `public.application_status_history` |        1 | SELECT                 |
| `public.candidate_views`            |        1 | SELECT                 |
| `public.ai_summaries`               |        2 | SELECT, UPDATE         |
| `public.audit_logs`                 |        1 | SELECT                 |
| `storage.objects`                   |        3 | SELECT, INSERT, DELETE |
| **Total**                           |   **51** |                        |

## Before / after definition rule

All 66 occurrences use this single mechanical rewrite. Surrounding boolean
operators, role allow-lists, ownership checks, review-state checks, storage
bucket checks, and storage-folder checks are unchanged.

```sql
-- Before
public.current_profile_role()

-- After
(select public.current_profile_role())
```

Examples of retained compound predicates:

```sql
-- profiles SELECT
id = (select auth.uid())
or (select public.current_profile_role()) in ('admin', 'agent', 'viewer')

-- files INSERT
(select public.current_profile_role()) in ('admin', 'agent')
and (select auth.uid()) = owner_id

-- ai_summaries UPDATE WITH CHECK
(select public.current_profile_role()) in ('admin', 'agent')
and reviewed_by = (select auth.uid())
and reviewed_at is not null

-- storage.objects INSERT
bucket_id = 'crm-files'
and (select public.current_profile_role()) in ('admin', 'agent')
and (storage.foldername(name))[1] = (select auth.uid())::text
```

The complete post-rewrite definitions are explicit in
`supabase/migrations/20260813024735_optimize_rls_role_initplan.sql`; no dynamic
SQL or wildcard policy discovery is used during migration application.

## Verification evidence

- Clean local migration application: success.
- `supabase/tests/000_schema_security.test.sql`: 30 assertions passed unchanged.
- `supabase/tests/001_batch1_account_lifecycle.test.sql`: 14 assertions passed
  unchanged.
- `supabase/tests/002_rls_initplan.test.sql`: target count and wrapping assertion
  passed.
- `supabase/tests/003_rls_initplan_explain.test.sql`: authenticated candidates
  list plan contains `InitPlan`.
- Total pgTAP assertions: 46.
- `src/test/rls-initplan-migration.test.ts`: verifies 51 explicit policy alters,
  66 wrapped calls, no direct calls, and no mixed schema/auth/audit/grant changes.

No production or staging connection was used.
