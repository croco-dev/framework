# @croco/governance-core

`@croco/governance-core` defines data governance contracts for Croco domain
resources. Packages can declare data classification tags, retention policies,
subject export/delete capabilities, audit evidence requirements, and deterministic
Data Map artifacts without depending on a storage adapter or transport runtime.

## Resource contracts

```ts
import {
  assertDataGovernanceResourcesValid,
  createDataMapArtifact,
  defineDataGovernanceResource,
} from "@croco/governance-core";

const userGovernance = defineDataGovernanceResource({
  kind: "user",
  label: "User",
  scope: "tenant",
  subject: {
    idField: "id",
    tenantField: "tenantId",
    type: "user",
  },
  fields: [
    { id: "id", classifications: ["operational"] },
    { id: "tenantId", classifications: ["operational"] },
    { id: "email", classifications: ["pii"], retentionPolicyId: "account-retention" },
    { id: "billingCustomerId", classifications: ["billing", "sensitive"] },
  ],
  retentionPolicies: [
    {
      id: "account-retention",
      durationDays: 365,
      disposition: "delete",
      basis: "Account support and compliance window",
    },
  ],
  subjectRequests: {
    export: {
      audit: {
        actor: "required",
        eventName: "governance.user.export",
        idempotencyKey: "required",
        reason: "required",
        subjectType: "user",
      },
      handlerId: "user-export-handler",
      status: "supported",
    },
  },
});

assertDataGovernanceResourcesValid([userGovernance]);
const dataMap = createDataMapArtifact([userGovernance]);
```

## Data Map artifacts

`createDataMapArtifact()` normalizes resources into a stable JSON-safe artifact:
resources, fields, classifications, retention policies, capabilities, Problems,
and validation diagnostics are sorted deterministically. Missing export/delete
capabilities are represented explicitly as `not-supported` entries with stable
Problem codes, so generated governance manifests do not rely on convention.

`createProjectMapDataGovernanceSection()` returns a small Project Map section
that points reviewers and tooling at the generated Data Map artifact.

## Runtime Problems

The package exports typed RFC 7807 Problems for unsupported subject export,
unsupported subject delete, and retention policy violations. Subject export/delete
request contracts require audit evidence so compliance flows keep actor, reason,
idempotency, and ticket metadata attached to the operation boundary.
