---
editUrl: false
next: false
prev: false
title: "useEntitlements"
---

## Current Entitlements Signature

> **useEntitlements**(): [`FrontendEntitlementState`](/api/frontend-react/src/type-aliases/frontendentitlementstate/)

### Returns

[`FrontendEntitlementState`](/api/frontend-react/src/type-aliases/frontendentitlementstate/)

## Gate Evaluation Signature

> **useEntitlements**(`entitlements`, `options?`): [`FrontendAuthGateState`](/api/frontend-react/src/type-aliases/frontendauthgatestate/)

### Parameters

#### entitlements

`string` | readonly `string`[]

#### options?

`Pick`\<[`FrontendAuthGateRequirements`](/api/frontend-react/src/type-aliases/frontendauthgaterequirements/), `"tenantRequired"`\>

### Returns

[`FrontendAuthGateState`](/api/frontend-react/src/type-aliases/frontendauthgatestate/)
