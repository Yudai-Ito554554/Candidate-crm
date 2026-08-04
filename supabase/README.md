# Supabase development

The database schema is managed by migrations in `supabase/migrations`.

## Local stack

Docker-compatible container runtime and the Supabase CLI are required.

```sh
npx supabase start
npx supabase db reset
```

Generate the TypeScript database type after applying schema changes:

```sh
npx supabase gen types typescript --local > src/types/database.generated.ts
```

The checked-in `src/types/database.ts` mirrors the initial migration so the application can be developed before a remote project is linked. Replace it with generated output after the first local database reset and review the resulting diff.

## Remote project

Do not commit project credentials. Link and deploy interactively:

```sh
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Only the project URL and publishable key belong in the desktop app. Never expose the `service_role` key in Vite or Tauri client code.
