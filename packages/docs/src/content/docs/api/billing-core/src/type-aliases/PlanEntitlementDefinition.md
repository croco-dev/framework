---
editUrl: false
next: false
prev: false
title: "PlanEntitlementDefinition"
---

> **PlanEntitlementDefinition** = \{ `featureKey`: `string`; `type`: `"boolean"`; \} \| \{ `featureKey`: `string`; `type`: `"static"`; `value`: `number`; \} \| \{ `featureKey`: `string`; `meterKey`: `string`; `overagePolicy`: `"BLOCK"` \| `"WARN"` \| `"ALLOW_WITH_OVERAGE"`; `quota`: `number`; `type`: `"metered"`; \}

billing account, invoice, order, plan, subscription 도메인 타입입니다.
