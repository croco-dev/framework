---
editUrl: false
next: false
prev: false
title: "LifecycleDiagnosticsDetails"
---

> **LifecycleDiagnosticsDetails** = `object`

## Properties

### activeVersions

> `readonly` **activeVersions**: readonly [`LifecycleRuleInspection`](/api/lifecycle-core/src/type-aliases/lifecycleruleinspection/)[]

***

### expiredMonetizationThresholdClaimCount

> `readonly` **expiredMonetizationThresholdClaimCount**: `number`

***

### failedActionCount

> `readonly` **failedActionCount**: `number`

***

### failedRunCount

> `readonly` **failedRunCount**: `number`

***

### latestMonetizationRecovery

> `readonly` **latestMonetizationRecovery**: \{ `completedAt`: `string`; `signalId?`: `string`; `status`: [`LifecycleRunStatus`](/api/lifecycle-core/src/type-aliases/lifecyclerunstatus/); \} \| `null`

***

### latestRuns

> `readonly` **latestRuns**: readonly [`LifecycleDiagnosticsRunDetails`](/api/lifecycle-core/src/type-aliases/lifecyclediagnosticsrundetails/)[]

***

### monetizationCapabilityDiagnostics

> `readonly` **monetizationCapabilityDiagnostics**: readonly [`MonetizationRecipeCapabilityDiagnostic`](/api/lifecycle-core/src/type-aliases/monetizationrecipecapabilitydiagnostic/)[]

***

### monetizationOperationalDiagnostics

> `readonly` **monetizationOperationalDiagnostics**: readonly [`LifecycleMonetizationOperationalDiagnostic`](/api/lifecycle-core/src/type-aliases/lifecyclemonetizationoperationaldiagnostic/)[]

***

### monetizationSignalsByType

> `readonly` **monetizationSignalsByType**: `Readonly`\<`Partial`\<`Record`\<[`MonetizationSignalType`](/api/lifecycle-core/src/type-aliases/monetizationsignaltype/), `number`\>\>\>

***

### pausedRules

> `readonly` **pausedRules**: readonly [`LifecycleRuleInspection`](/api/lifecycle-core/src/type-aliases/lifecycleruleinspection/)[]

***

### recentDryRuns

> `readonly` **recentDryRuns**: readonly [`LifecycleDiagnosticsDryRunDetails`](/api/lifecycle-core/src/type-aliases/lifecyclediagnosticsdryrundetails/)[]

***

### runCount

> `readonly` **runCount**: `number`

***

### runsByStatus

> `readonly` **runsByStatus**: `Record`\<[`LifecycleRunStatus`](/api/lifecycle-core/src/type-aliases/lifecyclerunstatus/), `number`\>

***

### suppressedMonetizationCrossingCount

> `readonly` **suppressedMonetizationCrossingCount**: `number`

***

### unavailableRegistrations

> `readonly` **unavailableRegistrations**: readonly [`LifecycleRuleInspection`](/api/lifecycle-core/src/type-aliases/lifecycleruleinspection/)[]

***

### versionMismatchCount

> `readonly` **versionMismatchCount**: `number`
