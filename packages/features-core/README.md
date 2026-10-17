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

## Render delivery bridge

`ExperimentDeliveryBridge` binds only registered render regions to an immutable server assignment.
It accepts either the real `ExperimentRuntime` (`assign`, `admitDisplay`, `recordExposure`) or an
application-owned verified assignment reader. `prepare(..., "speculative")` creates no exposure;
`admit(receipt, currentServerIdentity)` rechecks authorization, current eligibility and experiment
state without evaluating the allocator/provider again. It issues a new opaque admitted receipt for
the same delivery and variant. A fallback has no variant or reportable receipt.

Use `render(regions, identity, request, renderCallback)` around the actual `RenderServer` request.
Its callback receives the frozen public decisions and its response is `private, no-store`, including
Flight. The host must overwrite any transport used to pass these decisions to server components;
never accept a browser-supplied decision, subject, actor, target or policy revision as authority.
`examples/experiment-runtime/src/deliveryServer.ts` demonstrates this with an internal request
header and a request-local RenderServer; no receipt is installed in a process-global renderer.
HTML and the browser bootstrap consume the same decision; Node RSC HTML is decoded from official
Flight carrying that decision. Other hosts and client-reference manifests are unverified here.

`experimentRegionFragment(decision)` returns a public cache projection and key based on the region,
policy revision, experiment revision, status, variant and value. Cache only that projection or
markup derived solely from it. Keep `deliveryId`, receipts and the browser bootstrap outside shared
fragments. This bridge does not enable public response caching or replace representation/deployment
manifest negotiation. Fallback and control have distinct keys and measurement semantics.

`expose` takes an admitted receipt, a display instance id and its occurrence time. The server resolves
the original assignment; a client cannot choose a variant. Retransmitting the same delivery/region/
display instance deduplicates in the assignment reader's exposure sink; a new display instance is a
new exposure. Late reports remain historical after pause/expiry/source rollback. Pause and expiry
block new admission, without claiming an already delivered UI or completed command was withdrawn.
The host verifies the current identity on every request and changes the browser session generation
on login/logout/tenant transitions. Every cached navigation must go through `admit` before use;
receipt possession alone does not authorize a new display.

Reuse `PublishedCohortReader` via the existing `cohortExperimentEligibility` example for snapshot
schema/hash/scope/publication/expiry/current privacy validation. Serving reads published data, not
warehouse/GSC/LLM sources. A compatible rollback is a new trusted publication, never a rewrite of
assignment history; the publication owner validates compatibility and current suppression. The
bridge neither publishes snapshots nor decides current prices, eligibility to buy, access or balances.

Reader calls have a hard deadline; timeout/abort yields fallback during preparation and rejects
consumption. A reader may finish its underlying assignment after timeout but cannot create a bridge
receipt for it. `inspect` receives region, status, reason, phase and decision cost, without subjects
or source traits. Inspector failure does not change rendering and increments `getInspectionFailureCount()`. Exposure events distinguish recorded/failed observations without changing the assignment. Exposure sink failure is returned to
the caller and must be handled as an observation failure, independently of completed business
commands; never retry a purchase because measurement failed.

`InMemoryExperimentDeliveryStore` is a single-process reference receipt store, with no restart,
replica or retention guarantee. Production hosts supply private shared persistence with unique tokens,
immutable receipt records and a retention policy that permits their late-report window. Keep public
variant values free of secrets and sensitive traits. These source/fixture guarantees do not establish
provider certification, production deployment or npm publication.
