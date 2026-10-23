# TypeScript compiler support

Repository typechecks use exactly `tsrs@0.18.0-ts7.1.0-dev.20260929`, which targets a TypeScript 7.1 development
build. The pinned prerelease has been checked against all 179 workspace typecheck tasks. Upgrades must rerun
the full task graph and strict contract diagnostic baseline before changing the pin.

TypeScript 6.0.3 remains the Compiler API and emission baseline. The workspace pins `typescript` to that exact
version and forces dependencies on it to the same version through the pnpm override. DI compilation, code
generation, repository AST/config analysis, tsup declaration builds, TypeDoc and tests that use the Compiler API
continue to load TypeScript 6. Generated `create-croco-app` projects declare `^6.0.3` and keep their `tsc`
commands, so published consumer support remains on TypeScript 6 with compatible patch updates.

Protocol project analysis and temporary emission use the TypeScript 6.0.2 compiler embedded in pinned
`ts-morph` 28.0.0; pnpm's `typescript` override cannot replace an embedded compiler. Protocol regression tests
check that actual compiler identity and compare Node18, Node20 and NodeNext analysis/emission with the workspace
TypeScript 6.0.3 CLI, including ESM and CommonJS package boundaries. Updating this dependency requires rerunning
those tests; accepting unknown compiler options or suppressing diagnostics is not a compatibility strategy.

## Typecheck commands and CI

- `pnpm typecheck`, `pnpm --filter <workspace> typecheck`, pre-push, and CI's guarded Turbo typecheck task
  run the same workspace `tsrs --noEmit` scripts. Quick-start Lambda keeps its generated build preparation.
- Example build scripts that only check types also use tsrs. JavaScript and declaration emit retain the existing
  TypeScript 6/tsup pipeline and decorator configuration.
- `pnpm strict-contract-typecheck` uses tsrs against the existing strict configs and diagnostic baseline.
- CI installs the exact compiler from `pnpm-lock.yaml` with `--frozen-lockfile`. Turbo retains build dependencies,
  tracked-file mutation checks and lockfile cache invalidation.
- Packed consumer and decorator emission smokes deliberately invoke TypeScript 6 to verify the supported
  consumer ABI. Their compiler identity and diagnostics remain separate from native repository typechecking.

The pinned tsrs package supplies macOS ARM64 and Linux ARM64/x64 binaries; the repository's local macOS and
Ubuntu CI paths use those binaries. It does not supply a Windows binary. See the
[upstream compatibility contract](https://github.com/oxc-project/tsrs/blob/main/docs/COMPATIBILITY.md).

## Decorator contract

Croco 1.x continues to use the legacy decorator ABI. Applications that use Croco decorators must enable
`experimentalDecorators` and `emitDecoratorMetadata`, load `reflect-metadata` before decorated classes, and use a
compiler pipeline that preserves decorator metadata used by routes, GraphQL schemas, tracing, and other non-DI
features. Dependency injection is compiled from TypeScript symbols into explicit factories and does not consume
`design:paramtypes` or `design:type` at runtime. This is not a migration to standard ECMAScript decorators.

The workspace base configuration keeps both legacy options enabled. Package builds and packed ESM/CJS consumer
smokes verify non-DI decorator metadata, while DI consumer smokes verify generated graph installation and explicit
factory resolution.

## Configuration contract

- Package configs extend `tsconfig/tsconfig.base.json`.
- Path mappings are relative to the config that declares them; the removed `baseUrl` option is not supported.
- The shared config explicitly owns the repository `rootDir`, uses bundler module resolution, and declares Node
  ambient types. Runtime-specific configs such as Cloudflare may replace that `types` list.
- `ignoreDeprecations` is prohibited. Removed or deprecated compiler options must be migrated instead of hidden.
- `pnpm compiler-baseline:check` enforces the tsrs and TypeScript 6 pins and installed identities, workspace
  typecheck commands, decorator settings, generated-project range, and tsconfig migration rules.

## Contract-bound decorator signatures

The TypeScript 6 feasibility decision for strict legacy REST decorators is recorded in
[`architecture/legacy-decorator-signature-spike.md`](./architecture/legacy-decorator-signature-spike.md). Run
`pnpm decorator-signature-spike:check` to verify compile fixtures, diagnostics, declaration emit, packed consumption,
and the type-instantiation budget without changing public decorator exports.

## Temporary tsup compatibility exception

Owner: Croco release engineering.

Reason: tsup 8.5.1 injects deprecated `baseUrl: "."` into its declaration-bundling compiler options even when the
project tsconfig has migrated away from `baseUrl`. TypeScript 6 rejects that injected option. The pnpm patch at
`patches/tsup@8.5.1.patch` removes only the injected option; it does not suppress TypeScript diagnostics. Generated
workspaces carry the same checked patch so their declaration builds use the identical compiler contract.

Removal condition: remove the patch as soon as the pinned tsup release no longer injects `baseUrl` and the full
build, typecheck, publish verification, and packed decorator metadata smoke pass without it.
