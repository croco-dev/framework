---
editUrl: false
next: false
prev: false
title: "DeployTarget"
---

> **DeployTarget** = `object`

Deployment target metadata — describes where and how the output is deployed

## Properties

### output

> `readonly` **output**: [`OutputContract`](/api/presentation-preset/src/type-aliases/outputcontract/)

Output contract this target uses

***

### requiredEnvVars?

> `readonly` `optional` **requiredEnvVars?**: readonly `string`[]

Required environment variables

***

### runtime?

> `readonly` `optional` **runtime?**: `object`

Runtime constraints

#### memory?

> `readonly` `optional` **memory?**: `number`

#### nodeVersion?

> `readonly` `optional` **nodeVersion?**: `string`

#### timeout?

> `readonly` `optional` **timeout?**: `number`

***

### target

> `readonly` **target**: `string`

Target platform (e.g. "node", "lambda", "cloudflare-workers", "static")
