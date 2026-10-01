---
editUrl: false
next: false
prev: false
title: "EngagementContactPolicyGate"
---

> **EngagementContactPolicyGate** = `Readonly`\<\{ `app`: `string`; `environment`: `string`; `fingerprint`: (`value`) => `string`; \}\> & `Readonly`\<\{ `policy`: [`ContactPolicy`](/api/engagement-core/src/classes/contactpolicy/); `resolvePolicy?`: `never`; \}\> \| `Readonly`\<\{ `policy?`: `never`; `resolvePolicy`: (`scope`) => `Promise`\<[`ContactPolicy`](/api/engagement-core/src/classes/contactpolicy/)\>; \}\>
