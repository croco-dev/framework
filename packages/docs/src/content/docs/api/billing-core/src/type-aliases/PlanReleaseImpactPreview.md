---
editUrl: false
next: false
prev: false
title: "PlanReleaseImpactPreview"
---

> **PlanReleaseImpactPreview** = `object`

## Properties

### audience

> `readonly` **audience**: `"new_subscriptions"` \| `"grandfathered_subscriptions"` \| \{ `migrationCohortId`: `string`; \}

***

### calculatedFacts

> `readonly` **calculatedFacts**: readonly [`PlanReleaseImpactFact`](/api/billing-core/src/type-aliases/planreleaseimpactfact/)[]

***

### estimates

> `readonly` **estimates**: readonly [`PlanReleaseImpactEstimate`](/api/billing-core/src/type-aliases/planreleaseimpactestimate/)[]

***

### providerCapabilitiesRequired

> `readonly` **providerCapabilitiesRequired**: readonly `string`[]

***

### providerPreflightFacts

> `readonly` **providerPreflightFacts**: readonly [`PlanReleaseImpactFact`](/api/billing-core/src/type-aliases/planreleaseimpactfact/)[]
