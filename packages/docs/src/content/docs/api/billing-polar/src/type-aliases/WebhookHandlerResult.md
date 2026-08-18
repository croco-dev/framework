---
editUrl: false
next: false
prev: false
title: "WebhookHandlerResult"
---

> **WebhookHandlerResult** = `object`

Configuration types and handler results for Polar integration.

## Example

```typescript
import type { PolarConfig, WebhookHandlerResult } from '@croco/billing-polar';

const config: PolarConfig = {
  accessToken: 'polar_access_token',
  environment: 'sandbox',
  webhookSecret: 'whsec_...',
};

const result: WebhookHandlerResult = {
  success: true,
  eventId: 'evt_123'
};
```

## Properties

### error?

> `optional` **error?**: `string`

***

### eventId?

> `optional` **eventId?**: `string`

***

### success

> **success**: `boolean`
