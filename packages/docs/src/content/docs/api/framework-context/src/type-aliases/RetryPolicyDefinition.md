---
editUrl: false
next: false
prev: false
title: "RetryPolicyDefinition"
---

> **RetryPolicyDefinition** = `object`

## Properties

### backoffMs?

> `readonly` `optional` **backoffMs?**: `number`

***

### kind

> `readonly` **kind**: `"retry"`

***

### maxAttempts

> `readonly` **maxAttempts**: `number`

***

### onExhausted?

> `readonly` `optional` **onExhausted?**: `"throw-last-error"` \| `"throw-problem"`

***

### retryOn?

> `readonly` `optional` **retryOn?**: readonly `string`[]
