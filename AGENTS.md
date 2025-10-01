# Repository Guidelines

## Project Structure & Module Organization
- `packages/` hosts publishable TypeScript libraries: domain modules (`events-core`, `events-inmemory`) expose `src/index.ts` and build to `dist/` with tsup; utilities (`utils-node`, `utils-next-font/pretendard`, `utils-structure/react`) share runtime helpers.
- `packages/shared` stores workspace tooling (`@croco/eslint-config`, `@croco/utils-tsconfig`); depend on these instead of redefining lint/ts defaults.
- Bootstrap new packages from `template/`, updating the metadata before moving it under `packages/`.
- Root configs (`pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`) govern workspace resolution and pipelines—keep adjustments aligned.

## Build, Test, and Development Commands
- `pnpm install` sets up workspace dependencies (Node >=22).
- `pnpm dev` runs Turbo's persistent pipeline for packages that define a `dev` task.
- `pnpm build` invokes `turbo build`, executing each package’s `tsup` bundle in dependency order.
- `pnpm lint` applies the shared ESLint rules; keep the tree clean before committing.
- `pnpm format` rewrites `*.ts`, `*.tsx`, and `*.md` files with Prettier.
- `pnpm run build --filter <pkg>` rebuilds one package when iterating locally.
- `pnpm run deploy -- --otp <otp>` publishes through Turbo after builds pass.

## Coding Style & Naming Conventions
- Keep TypeScript sources under `src/`; Prettier enforces two-space indentation, single quotes, 120-character lines, and ES5 trailing commas.
- Use named exports; PascalCase filenames for class-centric utilities (`EventBus.ts`), camelCase for functions (`apolloServer.ts`).
- Preserve the ESLint import ordering and skip `import type` per `@typescript-eslint/consistent-type-imports`.
- Run `pnpm lint` and `pnpm format` before pushing to confirm style compliance.

## Testing Guidelines
- No shared test runner yet; add package-level `test` scripts (e.g., `pnpm run test --filter @croco/events-core`) and collocate specs near the code (`src/__tests__/` or `*.spec.ts`).
- Cover domain logic (event dispatching, helpers) and note any gaps in the PR description.
- Record the test commands and results in PRs so reviewers can reproduce them.

## Commit & Pull Request Guidelines
- Use the Conventional Commit style found in `git log` (`feat: …`, `chore: …`, `fix: …`).
- Keep commits focused; stage `dist/` output only when releasing.
- PRs should outline scope, affected packages, linked issues, and executed commands; attach screenshots/logs for runtime changes.
- Request review after `pnpm lint`, builds, and tests pass; call out remaining TODOs.

## Security & Configuration Tips
- Turbo watches `**/.env.*local`; keep secrets in local overrides, never in git.
- Generate a fresh OTP before `pnpm run deploy -- --otp <otp>`; do not reuse codes.
