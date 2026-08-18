---
editUrl: false
next: false
prev: false
title: "PlanReleaseServiceDependencies"
---

> **PlanReleaseServiceDependencies** = `object`

## Properties

### clock?

> `readonly` `optional` **clock?**: `object`

#### now

> `readonly` **now**: () => `Date`

##### Returns

`Date`

***

### eventPublisher

> `readonly` **eventPublisher**: [`PlanReleaseEventPublisher`](/api/billing-core/src/interfaces/planreleaseeventpublisher/)

***

### impactAnalyzer

> `readonly` **impactAnalyzer**: [`PlanReleaseImpactAnalyzer`](/api/billing-core/src/interfaces/planreleaseimpactanalyzer/)

***

### planRegistry

> `readonly` **planRegistry**: [`PlanRegistry`](/api/billing-core/src/interfaces/planregistry/)

***

### store

> `readonly` **store**: [`PlanReleaseStore`](/api/billing-core/src/interfaces/planreleasestore/)

***

### validator

> `readonly` **validator**: [`PlanReleaseValidator`](/api/billing-core/src/interfaces/planreleasevalidator/)
