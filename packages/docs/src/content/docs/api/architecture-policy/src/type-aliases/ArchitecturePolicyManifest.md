---
editUrl: false
next: false
prev: false
title: "ArchitecturePolicyManifest"
---

> **ArchitecturePolicyManifest** = `object`

## Properties

### ignore?

> `readonly` `optional` **ignore?**: readonly `string`[]

---

### include?

> `readonly` `optional` **include?**: readonly `string`[]

---

### packageCatalogGroupOverrides?

> `readonly` `optional` **packageCatalogGroupOverrides?**: `unknown`

---

### packageGroups?

> `readonly` `optional` **packageGroups?**: `Readonly`\<`Record`\<`string`, [`ArchitecturePolicyPackageGroup`](/api/architecture-policy/src/type-aliases/architecturepolicypackagegroup/)\>\>

---

### packageRoots?

> `readonly` `optional` **packageRoots?**: readonly `string`[]

---

### policyName?

> `readonly` `optional` **policyName?**: `string`

---

### rules?

> `readonly` `optional` **rules?**: `object`

#### allowedGroupImports?

> `readonly` `optional` **allowedGroupImports?**: readonly [`ArchitectureAllowedGroupImportRule`](/api/architecture-policy/src/type-aliases/architectureallowedgroupimportrule/)[]

#### forbiddenImports?

> `readonly` `optional` **forbiddenImports?**: readonly [`ArchitectureForbiddenImportRule`](/api/architecture-policy/src/type-aliases/architectureforbiddenimportrule/)[]

#### publicEntrypoints?

> `readonly` `optional` **publicEntrypoints?**: [`ArchitecturePublicEntrypointRule`](/api/architecture-policy/src/type-aliases/architecturepublicentrypointrule/)

---

### schemaVersion

> `readonly` **schemaVersion**: _typeof_ [`ARCHITECTURE_POLICY_SCHEMA_VERSION`](/api/architecture-policy/src/variables/architecture_policy_schema_version/)
