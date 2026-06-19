# @croco/admin-ops

`@croco/admin-ops` provides the core operations timeline contract used by admin
surfaces to inspect audit logs, domain events, task failures, workflow runs, and
lifecycle actions in one ordered model.

The package intentionally uses structural source types. Apps can normalize audit,
events, tasks, workflows, or lifecycle records without forcing every source
package to be installed in every admin app.

## Timeline model

```ts
import {
  createOperationsTimeline,
  normalizeAuditLogEntry,
  normalizeDomainEvent,
  normalizeTaskFailureExecution,
} from "@croco/admin-ops";

const timeline = createOperationsTimeline(
  [
    normalizeAuditLogEntry(auditEntry),
    normalizeDomainEvent(domainEvent),
    normalizeTaskFailureExecution(taskExecution),
  ],
  {
    tenantId: "tenant-1",
    entity: { type: "order", id: "order-1" },
    order: "desc",
  },
);
```

Every normalized event preserves source-specific evidence under its typed
`extension` field while projecting common fields such as `tenantId`, timestamp,
severity, correlation id, Problem metadata, retry metadata, and recovery action.
