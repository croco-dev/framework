# @croco/features-core

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
