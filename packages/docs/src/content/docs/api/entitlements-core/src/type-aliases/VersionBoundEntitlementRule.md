---
editUrl: false
next: false
prev: false
title: "VersionBoundEntitlementRule"
---

> **VersionBoundEntitlementRule** = \{ `featureKey`: `string`; `type`: `"boolean"`; \} \| \{ `featureKey`: `string`; `type`: `"static"`; `value`: `number`; \} \| \{ `featureKey`: `string`; `meterBilling?`: `"local"` \| `"required"`; `meterId?`: `string`; `overagePolicy?`: [`OveragePolicy`](/api/entitlements-core/src/type-aliases/overagepolicy/); `quota`: `number`; `type`: `"metered"`; \}
