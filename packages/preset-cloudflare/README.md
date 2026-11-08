# @croco/preset-cloudflare

Cloudflare Workers host and build-target compatibility facade.

`@croco/preset-cloudflare` is host-primary: it binds an application to the Workers
`fetch(request, env, ctx)` lifecycle and creates the corresponding runtime context. It also exposes
a Workers build target for compatibility with existing `preset-*` configuration. HTTP protocol
execution remains separate.

## Public API

- `createCloudflareWorkersHost` - creates the canonical Workers fetch host.
- `createCloudflareBuildTarget` - creates the Workers build target.
- `CloudflareBuildTargetOptions` - canonical build-target options.
- `createWorkerFetchHandler` - deprecated compatibility adapter with the legacy runtime-context shape.
- `createCloudflarePreset` - deprecated compatibility alias for `createCloudflareBuildTarget`.
- `CloudflarePresetOptions` - deprecated compatibility alias for `CloudflareBuildTargetOptions`.
- `createRawHonoWorkerFetchHandler` - explicit compatibility path for raw Hono forwarding.
- Worker fetch and runtime context types.

## Usage

```typescript
import { createCloudflareBuildTarget } from "@croco/preset-cloudflare";

export default createCloudflareBuildTarget({
  entry: "./src/fetch.ts",
});
```

Runtime composition is independent of the build target:

```typescript
import { createApplicationRuntime } from "@croco/framework-module";
import { createCloudflareWorkersHost } from "@croco/preset-cloudflare";
import { createApp } from "@croco/transports-http";

const runtime = createApplicationRuntime();
await runtime.initialize();

const app = runtime.run(() => createApp({ controllers: [] }));
const fetch = runtime.bindHostCallback(createCloudflareWorkersHost(app));

export default { fetch };
```

For a raw Hono application, select Hono argument forwarding explicitly:

```typescript
const fetch = createCloudflareWorkersHost(honoApp, { mode: "raw-hono" });
export default { fetch };
```

Raw mode forwards `request`, `env`, and `ctx` directly, preserving `c.env` bindings and
`c.executionCtx.waitUntil()`. Croco routes mounted in the Hono application infer the
`cloudflare-workers` runtime from the execution context. The default mode accepts a Croco
application's `fetch(request, runtimeContext, options)` contract; it must not receive a raw
Hono dispatcher. The deprecated `createWorkerFetchHandler` also supports `{ mode: "raw-hono" }`,
and `createRawHonoWorkerFetchHandler(honoApp)` selects that forwarding path directly.

The preset facade owns the Workers lifecycle, `@croco/transports-http` owns HTTP execution, and
`createCloudflareBuildTarget()` only describes the deployable artifact.

## Verification

```bash
pnpm --filter @croco/preset-cloudflare test
pnpm --filter @croco/preset-cloudflare typecheck
```

## Native Worker application bindings

`cloudflareWorkersHost(env)` from `@croco/preset-cloudflare/application` installs `CLOUDFLARE_ENV_TOKEN` in an application-owned
module. Compose it with `defineCrocoApplication`, initialize `createApplicationRuntime`,
and bind callbacks with that runtime before calling `createCloudflareWorkersHost`.
Create one runtime for each native env identity; never copy secrets into `process.env`.
The plugin is alpha and provides only `runtime.host`. It selects no SaaS providers and
does not certify auth, persistence, billing, metering, storage, tasks, telemetry or webhooks.
Native Workers execution still requires `nodejs_compat` for framework AsyncLocalStorage.

The application subpath also exports `createCloudflareWorkersHost`. Its ESM module
can be loaded by the generated CommonJS tooling on Node.js 24. The existing fetch
entrypoint keeps its independent dependency boundary.

## Native scheduled callbacks

`@croco/preset-cloudflare/scheduled` exports `compileCloudflareCrons`,
`normalizeCloudflareCron` and `createCloudflareScheduledHandler`. The compiler selects
`@Cron` methods only from the application's generated DI graph and emits deterministic
provider/method bindings plus deduplicated schedules. The handler verifies this manifest
against the current graph before accepting invocations.

The `saas-cloudflare` scaffold supplies a separate `src/worker` scan root, the native
`scheduled(event, env, ctx)` entry and `worker:crons:write` / `worker:crons:check` commands.
Add a Worker-compatible `@Component` service under that root and annotate its method with
`@Cron`. No second service, dependency or handler list is required. Inject
`CLOUDFLARE_ENV_TOKEN` for native bindings. Select an application-owned `ExecutionManager`
in `workerScheduling.ts` before enabling a schedule; the scaffold supplies no default store.

The generated Worker API package is ESM. Keep services, codegen and the ESM-only scheduled
entrypoint on that module boundary: mixing CommonJS and ESM copies of the metadata registry
cannot discover the same decorators. The separate Worker build configuration scans only its
native services and preserves the `dist/worker.mjs` artifact. Node/Lambda generation is unchanged.

`worker:crons:write` updates the reviewed `worker-crons.manifest.json` and the owned
Wrangler `[triggers].crons` block. The check rebuilds DI/runtime artifacts and fails when
the declaration or Wrangler output is stale. Build, development and smoke run this check;
they never adopt changed schedules automatically. Runtime imports start no scheduler.

The supported syntax is five-field UTC cron with wildcards, lists, ascending ranges and
positive steps, including named months and weekdays. It follows Cloudflare's native weekday
numbering, **1=Sunday through 7=Saturday**; use names when migrating from another dialect.
Non-UTC timezones, seconds fields, `L`, `W`, `#`, `?`, duplicate/blank binding names and
static/symbol methods fail with `CLOUDFLARE_CRON_UNSUPPORTED` before deployment. Disabled Cron
methods are omitted. See the [Cloudflare Cron contract](https://developers.cloudflare.com/workers/configuration/cron-triggers/).

A Cron method receives `{ cron, scheduledTime }` and the common `TaskExecutionContext`.
The adapter binds the callback to its `ApplicationRuntime`, forwards completion to
`waitUntil`, and uses TaskRunner for identity, attempt fencing, exceptions and timeouts.
Repeated firings share identity by application id, binding id, cron and scheduled time.
Independent applications need distinct stable ids or stores. Atomic durable identity and
attempt fencing remain the selected execution store's responsibility; local fixtures do not
prove distributed persistence or exactly-once effects.

The default timeout is 30 seconds. An optional `@Task` on the same method retains its
`maxAttempts`, retry classifier and timeout/recovery policy. Timeouts must be positive and
at most 15 minutes. Abort is cooperative and cannot undo external effects. Long work should
dispatch through the common task/workflow transport. Retryable failures follow TaskRunner's
existing retry state; terminal failures and indeterminate timeouts require its existing recovery
policy. There is no separate host retry loop or ledger.

The returned scheduled callback also exposes `retry(executionId)` and
`recoverTimeout(executionId, reason)`. Call these from an application-owned operator or
transport boundary after inspecting the execution; the native entry exposes no HTTP recovery
route. Both reuse the original Cron registry, task options and application DI scope, and reject
executions from another application namespace before changing recovery state. Timeout recovery
records the operator's reason through the common execution manager before retrying.

The native scheduled adapter is Workers-only with `nodejs_compat`; Node and Lambda do not
gain a scheduler. Local workerd tests cover DI/env forwarding, repeated firings, exception and
timeout evidence, generated drift and the existing fetch path. Live Cloudflare deployment,
execution-store certification and full SaaS provider integration remain unverified.
