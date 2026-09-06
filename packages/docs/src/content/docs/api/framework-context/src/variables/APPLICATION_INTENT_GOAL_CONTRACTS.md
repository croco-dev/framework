---
editUrl: false
next: false
prev: false
title: "APPLICATION_INTENT_GOAL_CONTRACTS"
---

> `const` **APPLICATION_INTENT_GOAL_CONTRACTS**: `object`

## Type Declaration

### internal-tool

> `readonly` **internal-tool**: `object`

#### internal-tool.auth

> `readonly` **auth**: `"admin-demo"` = `"admin-demo"`

#### internal-tool.billing

> `readonly` **billing**: `"none"` = `"none"`

#### internal-tool.deploymentPreset

> `readonly` **deploymentPreset**: `"lambda-spa"` = `"lambda-spa"`

#### internal-tool.goal

> `readonly` **goal**: `"internal-tool"` = `"internal-tool"`

#### internal-tool.preset

> `readonly` **preset**: `"admin-console"` = `"admin-console"`

#### internal-tool.protocol

> `readonly` **protocol**: `"rest-rpc-client"` = `"rest-rpc-client"`

#### internal-tool.providers

> `readonly` **providers**: readonly \[`"in-memory-admin-data"`, `"generated-rpc-client"`\]

#### internal-tool.qualityGates

> `readonly` **qualityGates**: readonly \[`"install"`, `"admin:smoke"`, `"lint"`, `"test"`, `"typecheck"`, `"build"`, `"contract:verify"`\]

#### internal-tool.runtimeTarget

> `readonly` **runtimeTarget**: `"node"` = `"node"`

#### internal-tool.schemaVersion

> `readonly` **schemaVersion**: `1` = `1`

#### internal-tool.storage

> `readonly` **storage**: readonly \[`"in-memory-demo"`\]

#### internal-tool.telemetry

> `readonly` **telemetry**: `"opentelemetry-otlp"` = `"opentelemetry-otlp"`

### saas-api

> `readonly` **saas-api**: `object`

#### saas-api.auth

> `readonly` **auth**: `"better-auth"` = `"better-auth"`

#### saas-api.billing

> `readonly` **billing**: `"polar"` = `"polar"`

#### saas-api.deploymentPreset

> `readonly` **deploymentPreset**: `"node-api"` = `"node-api"`

#### saas-api.goal

> `readonly` **goal**: `"saas-api"` = `"saas-api"`

#### saas-api.preset

> `readonly` **preset**: `"saas"` = `"saas"`

#### saas-api.protocol

> `readonly` **protocol**: `"rest"` = `"rest"`

#### saas-api.providers

> `readonly` **providers**: readonly \[`"in-memory-tenant"`, `"in-memory-metering"`, `"in-memory-events"`, `"better-auth"`, `"drizzle-transaction"`, `"polar-billing"`, `"qstash-tasks"`, `"cloudinary-storage"`, `"node-telemetry"`\]

#### saas-api.qualityGates

> `readonly` **qualityGates**: readonly \[`"install"`, `"typecheck"`, `"build"`, `"test"`, `"contract:verify"`, `"demo:smoke"`, `"failure-drill:smoke"`\]

#### saas-api.runtimeTarget

> `readonly` **runtimeTarget**: `"node"` = `"node"`

#### saas-api.schemaVersion

> `readonly` **schemaVersion**: `1` = `1`

#### saas-api.storage

> `readonly` **storage**: readonly \[`"cloudinary"`\]

#### saas-api.telemetry

> `readonly` **telemetry**: `"opentelemetry-otlp"` = `"opentelemetry-otlp"`

#### saas-api.tenantModel

> `readonly` **tenantModel**: `"org"` = `"org"`

### spa-backend-split

> `readonly` **spa-backend-split**: `object`

#### spa-backend-split.auth

> `readonly` **auth**: `"none"` = `"none"`

#### spa-backend-split.billing

> `readonly` **billing**: `"none"` = `"none"`

#### spa-backend-split.deploymentPreset

> `readonly` **deploymentPreset**: `"lambda-spa"` = `"lambda-spa"`

#### spa-backend-split.goal

> `readonly` **goal**: `"spa-backend-split"` = `"spa-backend-split"`

#### spa-backend-split.preset

> `readonly` **preset**: `"production-app"` = `"production-app"`

#### spa-backend-split.protocol

> `readonly` **protocol**: `"rest-rpc-client"` = `"rest-rpc-client"`

#### spa-backend-split.providers

> `readonly` **providers**: readonly \[`"in-memory-repository"`, `"in-memory-events"`, `"generated-rpc-client"`\]

#### spa-backend-split.qualityGates

> `readonly` **qualityGates**: readonly \[`"install"`, `"dev:smoke"`, `"lint"`, `"test"`, `"typecheck"`, `"build"`, `"contract:verify"`\]

#### spa-backend-split.runtimeTarget

> `readonly` **runtimeTarget**: `"node"` = `"node"`

#### spa-backend-split.schemaVersion

> `readonly` **schemaVersion**: `1` = `1`

#### spa-backend-split.storage

> `readonly` **storage**: readonly \[`"in-memory-demo"`\]

#### spa-backend-split.telemetry

> `readonly` **telemetry**: `"opentelemetry-otlp"` = `"opentelemetry-otlp"`

### worker

> `readonly` **worker**: `object`

#### worker.auth

> `readonly` **auth**: `"none"` = `"none"`

#### worker.billing

> `readonly` **billing**: `"none"` = `"none"`

#### worker.deploymentPreset

> `readonly` **deploymentPreset**: `"cloudflare-workers"` = `"cloudflare-workers"`

#### worker.goal

> `readonly` **goal**: `"worker"` = `"worker"`

#### worker.preset

> `readonly` **preset**: `"ddd-vike-fullstack"` = `"ddd-vike-fullstack"`

#### worker.protocol

> `readonly` **protocol**: `"rest"` = `"rest"`

#### worker.providers

> `readonly` **providers**: readonly \[`"cloudflare-workers"`, `"meta-vite"`\]

#### worker.qualityGates

> `readonly` **qualityGates**: readonly \[`"install"`, `"typecheck"`, `"build"`, `"ssr-worker:presentation:smoke"`\]

#### worker.runtimeTarget

> `readonly` **runtimeTarget**: `"cloudflare-workers"` = `"cloudflare-workers"`

#### worker.schemaVersion

> `readonly` **schemaVersion**: `1` = `1`

#### worker.storage

> `readonly` **storage**: readonly \[\] = `[]`

#### worker.telemetry

> `readonly` **telemetry**: `"none"` = `"none"`
