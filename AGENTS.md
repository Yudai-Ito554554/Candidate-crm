# AGENTS.md

## Project scope

Candidate CRM is a cross-platform Tauri 2 desktop application for macOS and Windows. Phase 3 adds an optional Supabase authentication boundary, a multi-tenant CRM schema, and typed repository functions while retaining typed mock data when Supabase is not configured.

## Working agreements

- Keep all application code in TypeScript or Rust; do not introduce untyped `any` without a documented reason.
- Preserve macOS and Windows compatibility. Use Node.js APIs or cross-platform packages instead of OS-specific shell commands in npm scripts.
- Do not add absolute local filesystem paths to tracked files.
- Keep the dependency set focused. Discuss large frameworks or infrastructure additions before installing them.
- Do not suppress TypeScript, ESLint, test, Rust, or build failures to make checks pass.
- Keep secrets out of Git. Only document variable names in `.env.example`.
- Keep mock data in `src/data`, domain types in `src/types`, and Supabase access behind `src/services` or `src/lib/supabase`.
- Keep all public-schema tables protected by RLS and organization-scoped policies.
- Never place a Supabase `service_role` key or other server secret in Vite client code.

## Required checks

Run these before handing off a change:

```sh
npm run typecheck
npm run lint
npm test
npm run format:check
npm run build
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
- `src/lib`: shared utilities
- `src/styles`: global Tailwind CSS styles
- `src/test`: shared test setup
- `src-tauri`: Rust and Tauri desktop configuration
