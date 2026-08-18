---
editUrl: false
next: false
prev: false
title: "TenantModelManifest"
---

> **TenantModelManifest** = `object`

## Properties

### compatibility

> `readonly` **compatibility**: `object`

#### currentVersion

> `readonly` **currentVersion**: *typeof* [`TENANT_MODEL_MANIFEST_SCHEMA_VERSION`](/api/tenant-core/src/variables/tenant_model_manifest_schema_version/)

#### generatedArtifacts

> `readonly` **generatedArtifacts**: `object`

##### generatedArtifacts.manifest

> `readonly` **manifest**: `"croco-tenant-model.manifest.json"`

##### generatedArtifacts.playbook

> `readonly` **playbook**: `"docs/tenant-model-playbook.md"`

##### generatedArtifacts.schema

> `readonly` **schema**: `"croco-tenant-model.schema.json"`

##### generatedArtifacts.source

> `readonly` **source**: `"apps/api-server/src/generatedTenantModel.ts"`

#### migration

> `readonly` **migration**: `object`

##### migration.guidance

> `readonly` **guidance**: readonly `string`[]

##### migration.requiredForVersionChange

> `readonly` **requiredForVersionChange**: `true`

#### rules

> `readonly` **rules**: *typeof* [`TENANT_MODEL_MANIFEST_COMPATIBILITY_RULES`](/api/tenant-core/src/variables/tenant_model_manifest_compatibility_rules/)

#### schemaId

> `readonly` **schemaId**: *typeof* [`TENANT_MODEL_MANIFEST_SCHEMA_ID`](/api/tenant-core/src/variables/tenant_model_manifest_schema_id/)

#### supportedVersions

> `readonly` **supportedVersions**: *typeof* [`SUPPORTED_TENANT_MODEL_MANIFEST_SCHEMA_VERSIONS`](/api/tenant-core/src/variables/supported_tenant_model_manifest_schema_versions/)

***

### currentModel

> `readonly` **currentModel**: [`TenantModelName`](/api/tenant-core/src/type-aliases/tenantmodelname/)

***

### defaultModel

> `readonly` **defaultModel**: [`TenantModelName`](/api/tenant-core/src/type-aliases/tenantmodelname/)

***

### diagnostics

> `readonly` **diagnostics**: readonly `object`[]

***

### migration

> `readonly` **migration**: [`TenantMigrationPlan`](/api/tenant-core/src/type-aliases/tenantmigrationplan/)

***

### models

> `readonly` **models**: readonly [`TenantModelDefinition`](/api/tenant-core/src/type-aliases/tenantmodeldefinition/)[]

***

### qualityGates

> `readonly` **qualityGates**: readonly `string`[]

***

### schema

> `readonly` **schema**: `object`

#### file

> `readonly` **file**: `"croco-tenant-model.schema.json"`

#### version

> `readonly` **version**: *typeof* [`TENANT_MODEL_MANIFEST_SCHEMA_VERSION`](/api/tenant-core/src/variables/tenant_model_manifest_schema_version/)

***

### schemaVersion

> `readonly` **schemaVersion**: [`TenantModelManifestSchemaVersion`](/api/tenant-core/src/type-aliases/tenantmodelmanifestschemaversion/)

***

### selected

> `readonly` **selected**: [`TenantModelDefinition`](/api/tenant-core/src/type-aliases/tenantmodeldefinition/)
