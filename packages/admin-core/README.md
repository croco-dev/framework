# @croco/admin-core

`@croco/admin-core` defines UI-agnostic admin resource and action contracts for
Croco admin surfaces. Admin packages can describe resources, list/detail fields,
permissions, audit evidence, declared Problems, and recovery semantics without
depending on React or a transport adapter.

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
