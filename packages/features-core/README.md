# @croco/features-core

## Experiments

`ExperimentRuntime` registers code-owned variant handlers and eligibility predicates,
then assigns stable subjects through the injected `ExperimentStore`. Authorization is
mandatory: construct the runtime with a server-owned `ExperimentAuthorization` that
checks actor, app, environment, explicit tenant and subject ownership for each action.
An omitted tenant is invalid; explicit app-wide scope is a separate permission decision.
The existing `FeatureManager` API remains compatible.

Definitions declare an immutable revision, unit (`user`, `tenant`, or stable
`anonymous`), login policy, salt, `sha256-v1` allocator version and weights in basis
points. Weights sum to allocation in the range 0–10000. JSON key encoding fixes field
boundaries, and deterministic golden vectors lock the allocation algorithm. A request
ID is never an anonymous identity. Applications issue and validate stable anonymous
identities and explicitly preserve or switch identity during login and logout; histories
are never automatically merged.

Register a definition with its exact variant handlers and eligibility function, then
`start` it with actor, reason, expected state version and idempotency key. `assign`
returns the store's unique winner or an explicit `not_assigned`, `unavailable` or
`evaluation_failed` result. A legitimate false variant remains an assigned value.
`preview` checks eligibility and uses the local allocator or the provider's explicit
side-effect-free preview capability. A provider without that capability is unavailable.
Preview never changes state, assignments, exposures or calls handlers. Every evaluated
`DetailedEvaluation` requires a typed `appRevision` field. Providers must return the
application revision they actually verified; optional `providerMetadata` contains only
additional evidence. The runtime requires a matching revision and a registered value;
drift cannot silently become control.

`configure` creates a new draft revision from a registered template. Operator changes
never replace existing assignments or enable an unregistered handler. Start, pause,
stop and configure use optimistic state versions and atomic command receipts; reusing
a key for another payload fails. Stopped revisions cannot resume.

`treat` executes only the stored assignment's private handler after current eligibility
and atomic store admission. `pause` blocks new assignments and treatment admission;
already admitted handlers may finish and delivered screens are not recalled. There is
no state cache, so policy delay is limited to work admitted before the pause transaction
commits. Period checks use the runtime admission-request timestamp supplied to the store;
database lock queuing and already admitted work may finish after `endsAt`. There is no
finite lock-wait bound in this adapter; deployments must bound database waits when their
application requires a maximum scheduling delay. Record `recordExposure` only after actual display or successful server
treatment, using the original assignment and a server-owned delivery identity. Retrying
that delivery deduplicates; another real delivery records another exposure, including
late receipts after pause. An exposure timestamp must be at or after its original
assignment timestamp. Assignment and feature-call events do not count as exposure.

Eligibility is injected, so a local predicate needs no cohort or warehouse. The
`examples/experiment-runtime` cohort profile adapts the existing `PublishedCohortReader`:
scope, subject kind, revisions, schema, expiry, content hash and current privacy checks
remain at that trusted publication boundary, and the exact snapshot reference is stored
with the assignment. Source outages do not require a request-time source fetch. Invalid
or withdrawn publications deny new treatment without redrawing or reclassifying old
assignment and exposure history. Operational purchase and security checks remain the
application's responsibility.

Use `InMemoryExperimentStore` for a single process; multi-worker or durable deployments
use `@croco/features-drizzle`. Server treatment is the executable example's exposure
boundary. A browser display integration must use the existing experience SSR/browser
bridge and record after actual display; this runtime does not infer display from SSR
prefetch or assignment.

Register the trusted code template and every named eligibility predicate in each worker.
Serving binds a requested persisted revision against that code on first use, so already
running workers can serve newly configured revisions. After a process restart,
`restore(templateTarget, actor)` can bind all persisted configured
revisions only after checking their definition hash, allocator, salt and variant whitelist
against that template. Persisted `codeRevision` identifies the original trusted template,
including revisions configured from an already configured revision. Missing code predicates or incompatible definitions fail explicitly;
restoration never replaces the stored assignment or reruns allocation for it.

Feature flag abstraction for Croco applications.

`@croco/features-core` exposes the stable `FeatureManager` contract for boolean
feature checks and multivariate flag evaluation. Applications depend on this package
while concrete providers integrate with LaunchDarkly, PostHog, configuration stores, or
custom rollout logic.

## Public API

- `FeatureManager` - abstract manager for `isEnabled` and `getVariant`.

## Usage

```typescript
import { FeatureManager } from "@croco/features-core";

class StaticFeatureManager extends FeatureManager {
  async isEnabled(key: string): Promise<boolean> {
    return key === "new-dashboard";
  }

  async getVariant(): Promise<string> {
    return "control";
  }
}
```

## Verification

```bash
pnpm --filter @croco/features-core test
pnpm --filter @croco/features-core typecheck
```

## Parameterized policy releases

`PolicyReleaseService` registers code-owned schemas, field descriptors, evaluators and
`codeRegistrationId` values. Persisted revisions contain values and registration
fingerprints; a process must register the matching code before evaluating them.

Each policy is isolated by `{ app, environment, tenantId }`. Inject a
`PolicyAuthorizationPolicy` to authorize each operation for that scope. `tenantId` must
be a tenant identifier or explicit `null` for app-wide scope; omission is rejected.
The default service permits trusted local calls; server compositions must inject
authorization before exposing operations to operators. Draft edits
append immutable revisions and invalidate review. `review` binds validation and
semantic differences to the value hash; `publish` requires that reviewed hash and an
expected revision. `PolicyReleaseStore.recordPublication` atomically records the next
revision, activation and command receipt. Retrying the same publish command and
idempotency key returns its original revision, even when the server clock advances.

`pause` requires a reason and returns an unavailable resolution unless code declares
a validated fallback on the policy. Operator commands cannot supply fallback values.
It atomically records a pause receipt and preserves a newer editable draft as a new
immutable revision. `expectedRevision` is the latest revision, including that draft.
Code can declare `reviewRequirements` with `risk: "financial"` or
`independentReviewer: true`; publishing then requires a reviewer other than the last
draft editor. Low-risk policies can retain same-operator review. `rollback` appends a new publication using a
previous published value. Future rollback effective times are rejected; rollback applies immediately. `resolve({ version })` exposes historical versions;
`evaluate` binds the resolved value to its registered evaluator and returns version,
hash and reference evidence alongside the result.

Use `InMemoryPolicyReleaseStore` for local execution and tests. Durable providers
implement the exported `PolicyReleaseStore` contract, including schedule delivery
leases and command receipts. The existing `FeatureManager` flag API remains available.

When registering multiple schema versions, the most recently registered version is the
current version for new drafts. Historical resolution uses each immutable revision’s
recorded schema version.
