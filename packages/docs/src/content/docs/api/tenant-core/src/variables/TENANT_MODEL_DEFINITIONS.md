---
editUrl: false
next: false
prev: false
title: "TENANT_MODEL_DEFINITIONS"
---

> `const` **TENANT\_MODEL\_DEFINITIONS**: `object`

Tenant model manifest, compatibility, playbook, and migration helpers.

## Type Declaration

### org

> `readonly` **org**: `object`

#### org.displayName

> `readonly` **displayName**: `"Organization"` = `"Organization"`

#### org.isolation

> `readonly` **isolation**: `"membership"` = `"membership"`

#### org.migrationHints

> `readonly` **migrationHints**: readonly \[`"Create organization records for each existing account owner or billing account."`, `"Backfill memberships before enforcing tenant-required routes."`, `"Run cross-tenant leak fixtures before removing single-tenant fallbacks."`\]

#### org.name

> `readonly` **name**: `"org"` = `"org"`

#### org.requiredAdapters

> `readonly` **requiredAdapters**: readonly \[`"TenantManager"`, `"MembershipManager"`, `"InvitationManager"`\]

#### org.requiredCapabilities

> `readonly` **requiredCapabilities**: readonly \[`"tenant-context"`, `"tenant-identity"`, `"membership"`, `"migration-plan"`\]

#### org.requiredPackages

> `readonly` **requiredPackages**: readonly \[`"@croco/tenant-core"`, `"@croco/membership-core"`, `"@croco/invitation-core"`\]

#### org.schemaHints

> `readonly` **schemaHints**: readonly \[`"Create an organizations table or provider-backed organization mapping."`, `"Store membership and invitation records by organization id."`, `"Bind request context from an explicit organization selector, auth claim, header, or route segment."`\]

#### org.summary

> `readonly` **summary**: `"A SaaS organization owns memberships, invitations, billing, and default tenant context for most B2B apps."` = `"A SaaS organization owns memberships, invitations, billing, and default tenant context for most B2B apps."`

#### org.supportedRuntimeTargets

> `readonly` **supportedRuntimeTargets**: readonly \[`"node"`, `"cloudflare-workers"`, `"lambda"`\]

#### org.tenantKey

> `readonly` **tenantKey**: `"organizationId"` = `"organizationId"`

#### org.unsafeMigrationWarnings

> `readonly` **unsafeMigrationWarnings**: readonly \[`"Do not infer organization ownership only from email domains without an explicit admin review."`\]

### rls-backed

> `readonly` **rls-backed**: `object`

#### rls-backed.displayName

> `readonly` **displayName**: `"RLS-backed"` = `"RLS-backed"`

#### rls-backed.isolation

> `readonly` **isolation**: `"postgres-rls"` = `"postgres-rls"`

#### rls-backed.migrationHints

> `readonly` **migrationHints**: readonly \[`"Add tenant id columns and indexes before enabling RLS."`, `"Create policies in report-only or locked maintenance windows first."`, `"Verify adapter-provided TenantRlsEvidence matches the active tenant before release."`\]

#### rls-backed.name

> `readonly` **name**: `"rls-backed"` = `"rls-backed"`

#### rls-backed.requiredAdapters

> `readonly` **requiredAdapters**: readonly \[`"TenantContextProvider"`, `"DrizzleTenantSession"`, `"TenantRlsEvidence"`\]

#### rls-backed.requiredCapabilities

> `readonly` **requiredCapabilities**: readonly \[`"tenant-context"`, `"tenant-identity"`, `"tenant-discriminator"`, `"tenant-query-filter"`, `"postgres-rls"`, `"migration-plan"`\]

#### rls-backed.requiredPackages

> `readonly` **requiredPackages**: readonly \[`"@croco/tenant-core"`, `"@croco/tx-core"`, `"@croco/tx-drizzle"`, `"drizzle-orm"`\]

#### rls-backed.schemaHints

> `readonly` **schemaHints**: readonly \[`"Use Postgres tables with non-null tenant id columns for tenant-owned rows."`, `"Set the current tenant through a transaction-scoped database setting before queries run."`, `"Enable and force RLS policies before treating the provider as production-ready."`\]

#### rls-backed.summary

> `readonly` **summary**: `"Postgres row-level security enforces tenant isolation in the database in addition to application-level tenant context."` = `"Postgres row-level security enforces tenant isolation in the database in addition to application-level tenant context."`

#### rls-backed.supportedRuntimeTargets

> `readonly` **supportedRuntimeTargets**: readonly \[`"node"`\]

#### rls-backed.tenantKey

> `readonly` **tenantKey**: `"tenantId"` = `"tenantId"`

#### rls-backed.unsafeMigrationWarnings

> `readonly` **unsafeMigrationWarnings**: readonly \[`"Do not enable RLS without proving every write path sets the current tenant database setting."`, `"Do not deploy RLS-backed mode on runtimes without a Postgres transaction boundary."`\]

### shared-schema

> `readonly` **shared-schema**: `object`

#### shared-schema.displayName

> `readonly` **displayName**: `"Shared schema"` = `"Shared schema"`

#### shared-schema.isolation

> `readonly` **isolation**: `"tenant-column"` = `"tenant-column"`

#### shared-schema.migrationHints

> `readonly` **migrationHints**: readonly \[`"Classify every table as global, tenant-owned, or join data before adding columns."`, `"Backfill tenant ids in a locked or dual-write phase."`, `"Fail reads and writes that omit tenant predicates."`\]

#### shared-schema.name

> `readonly` **name**: `"shared-schema"` = `"shared-schema"`

#### shared-schema.requiredAdapters

> `readonly` **requiredAdapters**: readonly \[`"TenantContextProvider"`, `"TenantFilteredRepository"`\]

#### shared-schema.requiredCapabilities

> `readonly` **requiredCapabilities**: readonly \[`"tenant-context"`, `"tenant-identity"`, `"tenant-discriminator"`, `"tenant-query-filter"`, `"migration-plan"`\]

#### shared-schema.requiredPackages

> `readonly` **requiredPackages**: readonly \[`"@croco/tenant-core"`, `"@croco/tx-core"`\]

#### shared-schema.schemaHints

> `readonly` **schemaHints**: readonly \[`"Add a non-null tenant id column to every tenant-owned table."`, `"Index tenant id with hot-path lookup keys."`, `"Require repository/query helpers to prove tenant predicates before execution."`\]

#### shared-schema.summary

> `readonly` **summary**: `"All tenants share the same database schema and every tenant-owned table carries a tenant discriminator column."` = `"All tenants share the same database schema and every tenant-owned table carries a tenant discriminator column."`

#### shared-schema.supportedRuntimeTargets

> `readonly` **supportedRuntimeTargets**: readonly \[`"node"`, `"cloudflare-workers"`, `"lambda"`\]

#### shared-schema.tenantKey

> `readonly` **tenantKey**: `"tenantId"` = `"tenantId"`

#### shared-schema.unsafeMigrationWarnings

> `readonly` **unsafeMigrationWarnings**: readonly \[`"A nullable tenant discriminator is an unsafe intermediate state unless writes are frozen."`, `"Global tables must be explicitly marked global instead of silently skipping tenant checks."`\]

### single

> `readonly` **single**: `object`

#### single.displayName

> `readonly` **displayName**: `"Single tenant"` = `"Single tenant"`

#### single.isolation

> `readonly` **isolation**: `"none"` = `"none"`

#### single.migrationHints

> `readonly` **migrationHints**: readonly \[`"Create one tenant record that represents the current deployment."`, `"Backfill future tenant-owned rows with that tenant id before enabling scoped queries."`\]

#### single.name

> `readonly` **name**: `"single"` = `"single"`

#### single.requiredAdapters

> `readonly` **requiredAdapters**: readonly \[`"TenantManager"`\]

#### single.requiredCapabilities

> `readonly` **requiredCapabilities**: readonly \[`"tenant-context"`, `"migration-plan"`\]

#### single.requiredPackages

> `readonly` **requiredPackages**: readonly \[`"@croco/tenant-core"`\]

#### single.schemaHints

> `readonly` **schemaHints**: readonly \[`"Do not add tenant discriminator columns to domain tables."`, `"Keep admin-only data export available so the app can move to an org or workspace model later."`\]

#### single.summary

> `readonly` **summary**: `"One logical tenant for the whole application. Use this while product-market fit matters more than tenant administration."` = `"One logical tenant for the whole application. Use this while product-market fit matters more than tenant administration."`

#### single.supportedRuntimeTargets

> `readonly` **supportedRuntimeTargets**: readonly \[`"node"`, `"cloudflare-workers"`, `"lambda"`\]

#### single.tenantKey

> `readonly` **tenantKey**: `"none"` = `"none"`

#### single.unsafeMigrationWarnings

> `readonly` **unsafeMigrationWarnings**: readonly \[\] = `[]`

### workspace

> `readonly` **workspace**: `object`

#### workspace.displayName

> `readonly` **displayName**: `"Workspace"` = `"Workspace"`

#### workspace.isolation

> `readonly` **isolation**: `"membership"` = `"membership"`

#### workspace.migrationHints

> `readonly` **migrationHints**: readonly \[`"Choose a deterministic default workspace for each existing organization."`, `"Backfill workspace ids onto tenant-owned resources before exposing workspace switching."`, `"Keep an audit trail for rows moved between workspaces."`\]

#### workspace.name

> `readonly` **name**: `"workspace"` = `"workspace"`

#### workspace.requiredAdapters

> `readonly` **requiredAdapters**: readonly \[`"TenantManager"`, `"MembershipManager"`, `"InvitationManager"`, `"WorkspaceSelectionAdapter"`\]

#### workspace.requiredCapabilities

> `readonly` **requiredCapabilities**: readonly \[`"tenant-context"`, `"tenant-identity"`, `"membership"`, `"workspace-selection"`, `"migration-plan"`\]

#### workspace.requiredPackages

> `readonly` **requiredPackages**: readonly \[`"@croco/tenant-core"`, `"@croco/membership-core"`, `"@croco/invitation-core"`\]

#### workspace.schemaHints

> `readonly` **schemaHints**: readonly \[`"Create workspaces beneath organizations or accounts."`, `"Persist the active workspace id separately from user authentication state."`, `"Scope feature flags, entitlement checks, and generated RPC clients to the active workspace."`\]

#### workspace.summary

> `readonly` **summary**: `"A user can belong to multiple workspaces inside an organization. Use this when collaboration spaces need isolated configuration or data."` = `"A user can belong to multiple workspaces inside an organization. Use this when collaboration spaces need isolated configuration or data."`

#### workspace.supportedRuntimeTargets

> `readonly` **supportedRuntimeTargets**: readonly \[`"node"`, `"cloudflare-workers"`, `"lambda"`\]

#### workspace.tenantKey

> `readonly` **tenantKey**: `"workspaceId"` = `"workspaceId"`

#### workspace.unsafeMigrationWarnings

> `readonly` **unsafeMigrationWarnings**: readonly \[`"Moving historical rows between workspaces can change entitlement and audit semantics."`\]
