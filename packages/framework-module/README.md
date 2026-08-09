# @croco/framework-module

`@croco/framework-module` defines the runtime contract for Croco feature modules.
Modules group providers, controllers, lifecycle hooks, and imported modules behind
an explicit boundary.

## Module Contract

```ts
import { CrocoModule, defineCrocoModule } from "@croco/framework-module";

const databaseModule = defineCrocoModule({
  name: "database",
  providers: [{ provide: "database.url", useValue: process.env.DATABASE_URL }],
  exports: ["database.url"],
});

CrocoModule.use({
  name: "users",
  imports: [databaseModule],
  providers: [UserService],
  controllers: [UserController],
  setup: (ctx) => {
    const databaseUrl = ctx.get("database.url");
  },
  start: async () => {
    await warmUserCache();
  },
  shutdown: async () => {
    await closeUserResources();
  },
});
```

Supported metadata:

- `name`: stable module identifier used by diagnostics and failure messages.
- `imports`: modules that must initialize first.
- `providers`: tokens, classes, values, classes bound to tokens, or factories owned by the module.
- `exports`: provider tokens visible to direct importers.
- `controllers`: transport-facing controller tokens recorded for diagnostics.
- `setup`, `start`, `shutdown`: lifecycle hooks.

## Provider Visibility

Providers are private to the owning module unless their token appears in
`exports`. A module can resolve its own providers and the exported providers of
its direct imports. Accessing a known but non-exported provider throws
`ModuleProviderVisibilityProblem`.

Module-scoped contexts also reject undeclared class providers. Register class
providers in the module's `providers` metadata, or export them from an imported
module, before resolving them through `ctx.get`.
Token-backed TypeDI classes should be declared as
`{ provide: Token, useClass: ServiceClass }`; exporting a token alone does not
make global `@Service(token)` class metadata part of the module contract.

## Provider Ownership

Each provider token has exactly one declaring module. Croco validates the complete
module graph before provider factories, lifecycle hooks, or global TypeDI
registration run. If unrelated modules declare the same string, symbol, TypeDI
token, or class token, initialization throws `ModuleProviderOwnershipProblem`
with every owner in deterministic name order. Importing an exported provider
grants read access and does not create another owner.

Module metadata is snapshotted when the module is registered. Later mutations to
source `imports`, `providers`, `exports`, or `controllers` arrays do not change
the graph that initialization validates and executes.

`ModuleContext.set()` may only bind a token already listed in the current
module's `providers`. Imported providers are read-only, undeclared writes fail
before container mutation, and the root context returned by initialization does
not have provider-write authority. Use a token-only provider declaration when a
lifecycle hook supplies the value:

```ts
const ConfigToken = Symbol("config");

defineCrocoModule({
  name: "config",
  providers: [ConfigToken],
  exports: [ConfigToken],
  setup: (ctx) => ctx.set(ConfigToken, loadConfig()),
});
```

This package intentionally records controllers but does not bind them to an HTTP,
GraphQL, RPC, or worker transport. Transport packages decide how controller
tokens become routes or handlers.

## Lifecycle Semantics

Initialization is dependency ordered:

1. imported module providers and `setup`
2. importer providers and `setup`
3. imported module `start`
4. importer `start`

Shutdown runs in reverse dependency order. Lifecycle failures are wrapped in
`ModuleLifecycleProblem` with `moduleName` and `phase` extensions. Circular
imports throw `ModuleCircularDependencyProblem`.

Shutdown attempts every initialized module even when individual hooks fail,
then rejects with the first `ModuleLifecycleProblem` and exposes every ordered
failure through its `cleanupFailures` extension. Active runtime state is reset
after all hooks complete, including failed shutdown attempts.

If `setup` or `start` fails, initialization calls `shutdown` for every module
whose setup phase was entered, including the failing module, in reverse
dependency order. Cleanup continues after individual shutdown failures. The
original `ModuleLifecycleProblem` remains the rejected error and exposes any
cleanup errors through its ordered `cleanupFailures` extension. Provider
registrations and overwritten container values are restored to their exact
pre-attempt state, so callers can retry initialization explicitly.

## Dynamic Modules And Presets

Dynamic modules should return `ModuleOptions` from a factory and can be wrapped
with `defineCrocoModule` for a stable, frozen public contract:

```ts
export function createCacheModule(options: CacheOptions) {
  return defineCrocoModule({
    name: "cache",
    providers: [{ provide: CacheOptionsToken, useValue: options }, CacheService],
    exports: [CacheService],
  });
}
```

`@croco/preset-lambda`, `@croco/preset-node`, and
`@croco/preset-cloudflare` are build/runtime entrypoint presets from
`@croco/framework-preset`. They are compatible with module contracts by design:
presets choose the deployment entrypoint while modules own provider visibility
and lifecycle boundaries inside that entrypoint. Preset packages do not need a
runtime dependency on `@croco/framework-module` unless they start registering
application modules directly.
