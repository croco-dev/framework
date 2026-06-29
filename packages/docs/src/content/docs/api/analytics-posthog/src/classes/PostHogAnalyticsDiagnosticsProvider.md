---
editUrl: false
next: false
prev: false
title: "PostHogAnalyticsDiagnosticsProvider"
---

PostHog 기반 분석 진단 제공자 구현체를 내보냅니다.

## Implements

- [`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/)

## Constructors

### Constructor

> **new PostHogAnalyticsDiagnosticsProvider**(`config`, `options?`): `PostHogAnalyticsDiagnosticsProvider`

#### Parameters

##### config

`Partial`\<[`PostHogConfig`](/api/integrations-posthog/src/interfaces/posthogconfig/)\>

##### options?

[`PostHogAnalyticsDiagnosticsOptions`](/api/analytics-posthog/src/type-aliases/posthoganalyticsdiagnosticsoptions/) = `{}`

#### Returns

`PostHogAnalyticsDiagnosticsProvider`

## Properties

### name

> `readonly` **name**: `"analytics-posthog"` = `"analytics-posthog"`

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
