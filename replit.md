# Focus Shield Mobile

Focus mode, strict sessions, local usage tracking, app-blocking rules, habits, and analytics for building phone discipline.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` - API server
- `pnpm --filter @workspace/mobile run dev` - Expo mobile app
- `pnpm run typecheck` - full workspace typecheck
- `pnpm run build` - regenerate API clients, typecheck, and build packages
- `pnpm --filter @workspace/db run migrate` - run DB migrations in production
- `pnpm --filter @workspace/db run push` - push DB schema in development only
- Required env for DB code: `DATABASE_URL`
- Optional API env: `PORT`, `FRONTEND_URL`, `NODE_ENV`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo Router + React Native + AsyncStorage
- API: Express 5 + CORS allowlist + Helmet + rate limiting
- DB: PostgreSQL + Drizzle ORM
- Validation/codegen: Zod, OpenAPI, Orval

## Architecture Decisions

- Focus and strict-session state is persisted locally so sessions can recover after app restart.
- The current Expo app cannot enforce true Android app blocking without adding native Android modules through Expo prebuild or moving to bare React Native.
- API routes must be mounted under `/api` and end with the shared error handler.
- `drizzle-kit push` is dev-only; production should use generated migrations.

## Gotchas

- `scripts/post-merge.sh` requires a valid `DATABASE_URL` because it pushes the DB schema.
- Permanent app blocks are enforced in state; users must edit the rule and remove `permanent` before unblocking.
- Current app-blocking UI models rules locally. Real device-level blocking still needs native Android Usage Access/foreground-service implementation.
