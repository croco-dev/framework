---
editUrl: false
next: false
prev: false
title: "MeilisearchDiagnosticsProvider"
---

## Implements

- [`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/)

## Constructors

### Constructor

> **new MeilisearchDiagnosticsProvider**(`config`, `options?`): `MeilisearchDiagnosticsProvider`

#### Parameters

##### config

`Partial`\<[`MeilisearchEngineOptions`](/api/search-meilisearch/src/type-aliases/meilisearchengineoptions/)\>

##### options?

[`MeilisearchDiagnosticsOptions`](/api/search-meilisearch/src/type-aliases/meilisearchdiagnosticsoptions/) = `{}`

#### Returns

`MeilisearchDiagnosticsProvider`

## Properties

### name

> `readonly` **name**: `"search-meilisearch"` = `"search-meilisearch"`

#### Implementation of

[`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/).[`name`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/#name)

## Methods

### getHealth()

> **getHealth**(`signal?`): `Promise`\<[`HealthStatus`](/api/diagnostics-core/src/type-aliases/healthstatus/)\>

#### Parameters

##### signal?

`AbortSignal`

#### Returns

`Promise`\<[`HealthStatus`](/api/diagnostics-core/src/type-aliases/healthstatus/)\>

#### Implementation of

[`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/).[`getHealth`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/#gethealth)
