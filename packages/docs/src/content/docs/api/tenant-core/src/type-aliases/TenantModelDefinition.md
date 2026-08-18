---
editUrl: false
next: false
prev: false
title: "TenantModelDefinition"
---

> **TenantModelDefinition** = `object`

## Properties

### displayName

> `readonly` **displayName**: `string`

---

### isolation

> `readonly` **isolation**: `"none"` \| `"membership"` \| `"tenant-column"` \| `"postgres-rls"`

---

### migrationHints

> `readonly` **migrationHints**: readonly `string`[]

---

### name

> `readonly` **name**: [`TenantModelName`](/api/tenant-core/src/type-aliases/tenantmodelname/)

---

### requiredAdapters

> `readonly` **requiredAdapters**: readonly `string`[]

---

### requiredCapabilities

> `readonly` **requiredCapabilities**: readonly [`TenantModelCapabilityName`](/api/tenant-core/src/type-aliases/tenantmodelcapabilityname/)[]

---

### requiredPackages

> `readonly` **requiredPackages**: readonly `string`[]

---

### schemaHints

> `readonly` **schemaHints**: readonly `string`[]

---

### summary

> `readonly` **summary**: `string`

---

### supportedRuntimeTargets

> `readonly` **supportedRuntimeTargets**: readonly [`TenantModelRuntimeTarget`](/api/tenant-core/src/type-aliases/tenantmodelruntimetarget/)[]

---

### tenantKey

> `readonly` **tenantKey**: `string`

---

### unsafeMigrationWarnings

> `readonly` **unsafeMigrationWarnings**: readonly `string`[]
