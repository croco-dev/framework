---
editUrl: false
next: false
prev: false
title: "PlanEntitlementDefinition"
---

> **PlanEntitlementDefinition** = \{ `featureKey`: `string`; `type`: `"boolean"`; \} \| \{ `featureKey`: `string`; `type`: `"static"`; `value`: `number`; \} \| \{ `featureKey`: `string`; `meterKey`: `string`; `overagePolicy`: `"BLOCK"` \| `"WARN"` \| `"ALLOW_WITH_OVERAGE"`; `quota`: `number`; `type`: `"metered"`; \}

Defines a boolean, static-value, or metered entitlement granted by a plan version.
