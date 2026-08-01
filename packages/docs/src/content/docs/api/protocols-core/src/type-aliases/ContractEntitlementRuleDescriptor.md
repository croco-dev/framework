---
editUrl: false
next: false
prev: false
title: "ContractEntitlementRuleDescriptor"
---

> **ContractEntitlementRuleDescriptor** = \{ `featureKey`: `string`; `type`: `"boolean"`; \} \| \{ `featureKey`: `string`; `type`: `"static"`; `value`: `number`; \} \| \{ `featureKey`: `string`; `meterBilling?`: `"local"` \| `"required"`; `meterId?`: `string`; `overagePolicy?`: `"BLOCK"` \| `"WARN"` \| `"ALLOW_WITH_OVERAGE"`; `quota`: `number`; `type`: `"metered"`; \}
