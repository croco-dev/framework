# Scheduled application services

Put Worker-compatible `@Component` classes here. Add `@Cron` to a string-named method;
the Worker compiler discovers it without a second handler/provider list.
Inject `CLOUDFLARE_ENV_TOKEN` from `@croco/preset-cloudflare/application` for native bindings.
The method receives `{ cron, scheduledTime }` and the common `TaskExecutionContext`.

Schedules use Cloudflare's five-field UTC syntax: numeric weekdays are **1=Sunday through
7=Saturday**. Named weekdays avoid ambiguity with other schedulers. The supported subset
is wildcards, lists, ranges and steps, with named months/weekdays; Quartz extensions are rejected.
Use `@Task({ timeout, maxAttempts, timeoutRetry })` on the same method to select common task
policy. The default timeout is 30 seconds; zero/unbounded or over-15-minute timeouts fail.
Long work belongs on a durable task/workflow transport, not inside a scheduled invocation.

Before enabling a Cron, implement `createWorkerExecutionManager` in `workerScheduling.ts`
using an explicitly selected Worker-compatible durable execution store. No in-memory store is
selected by this template. The shared store must implement atomic identity/attempt fencing.
Keep `applicationId` stable across replicas and different across independent applications.
Duplicate deliveries share identity by application, binding, Cron and scheduled time; this
does not guarantee exactly-once side effects. Failures and timeouts remain in the common
execution ledger; use the existing task retry/recovery API instead of automatic host retries.
Cooperative abort does not undo or forcibly stop an external effect.

Run `pnpm worker:crons:write` after changing declarations; review the manifest and
Wrangler `[triggers].crons` diff. Build, dev and smoke run `worker:crons:check` and refuse stale
output. Unsupported timezones/expressions and duplicate identities fail before deployment.
The scaffold remains bootstrap-only for SaaS capabilities. Local scheduled execution does
not certify a live Cloudflare deployment or a persistence provider.
