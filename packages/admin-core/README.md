# @croco/admin-core

`@croco/admin-core` defines UI-agnostic admin resource and action contracts for
Croco admin surfaces. Admin packages can describe resources, list/detail fields,
permissions, audit evidence, declared Problems, and recovery semantics without
depending on React or a transport adapter.

## Tenant 360 sources

`TenantBusinessSource<TState>` is a structural, React-independent boundary for
cross-domain tenant workspaces. A host installs only the sources it has and
`loadTenantWorkspace()` preserves each source result independently as `ready`,
`empty`, `stale`, `permission-denied`, `unavailable`, or domain `problem`.

```ts
import {
  createInMemoryTenantBusinessSource,
  loadTenantWorkspace,
  type TenantUsageSummary,
} from "@croco/admin-core";

const usage = createInMemoryTenantBusinessSource<TenantUsageSummary>({
  id: "usage",
  label: "Usage",
  section: "usage",
  requiredPermissions: ["usage:read"],
  result: {
    kind: "ready",
    loadedAt: new Date(),
    state: {
      kind: "usage",
      meters: [],
      warningCount: 0,
      overLimitCount: 0,
    },
  },
});

const snapshot = await loadTenantWorkspace({
  tenantId: "tenant-1",
  sources: [usage],
  grantedPermissions: ["usage:read"],
});
```

Actions reuse `AdminAction`; availability is derived from its permission
requirements before React sees it. Sensitive fields use
`resolveTenantWorkspaceField()` so hosts provide an explicit visible, masked, or
denied result instead of relying on presentation code to guess.

## Resource contracts

```ts
import { assertAdminResourceValid, defineAdminResource } from "@croco/admin-core";

const userResource = defineAdminResource({
  kind: "user",
  label: "User",
  scope: "tenant",
  source: "croco",
  identity: {
    idField: "id",
    labelField: "email",
    tenantField: "tenantId",
    subjectType: "user",
  },
  fields: [
    { id: "id", label: "ID", valueType: "string" },
    { id: "email", label: "Email", valueType: "string", filterable: true },
    { id: "status", label: "Status", valueType: "status", filterable: true },
  ],
  list: {
    fields: ["email", "status"],
    filters: ["status"],
  },
  detail: {
    fields: ["id", "email", "status"],
  },
  actions: [
    {
      id: "disable",
      label: "Disable",
      kind: "disable",
      target: "record",
      mutability: "write",
      permissions: [{ permissions: ["users:disable"], scope: "tenant" }],
      audit: {
        actor: "required",
        eventName: "admin.user.disabled",
        reason: "required",
        subjectIdField: "id",
        subjectType: "user",
      },
      problems: [{ code: "auth/user-not-found", status: 404 }],
    },
  ],
});

assertAdminResourceValid(userResource);
```

## Validation

`validateAdminResource()` returns typed diagnostics for invalid definitions.
`assertAdminResourceValid()` throws `AdminResourceValidationProblem`, preserving
all diagnostics in RFC 7807 extensions so build-time or codegen checks can fail
without guessing at runtime.
