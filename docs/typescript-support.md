# TypeScript compiler support

Croco 1.x is built, typechecked, tested, and published with TypeScript 6.0.3. The workspace pins that exact
compiler and forces every workspace tool invocation to the same version through the pnpm override. Generated
`create-croco-app` projects declare `^6.0.3`, so consumers receive TypeScript 6 while retaining compatible patch
updates.

## Decorator contract

Croco 1.x continues to use the legacy decorator ABI. Applications that use Croco decorators must enable
`experimentalDecorators` and `emitDecoratorMetadata`, load `reflect-metadata` before decorated classes, and use a
compiler pipeline that preserves parameter decorators and `design:paramtypes`/`design:type` metadata. This is not a
migration to standard ECMAScript decorators.

The workspace base configuration keeps both legacy options enabled. Package builds and packed ESM/CJS consumer
smokes verify the emitted metadata and implicit DI behavior.

## Configuration contract

- Package configs extend `tsconfig/tsconfig.base.json`.
- Path mappings are relative to the config that declares them; the removed `baseUrl` option is not supported.
- The shared config explicitly owns the repository `rootDir`, uses bundler module resolution, and declares Node
  ambient types. Runtime-specific configs such as Cloudflare may replace that `types` list.
- `ignoreDeprecations` is prohibited. Removed or deprecated compiler options must be migrated instead of hidden.
- `pnpm compiler-baseline:check` enforces the compiler pin, decorator settings, generated-project range, and
  tsconfig migration rules.

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
