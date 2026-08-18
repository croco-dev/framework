---
editUrl: false
next: false
prev: false
title: "WebhookOptions"
---

> **WebhookOptions** = `object`

Options for webhook triggers.

## Properties

### auth?

> `readonly` `optional` **auth?**: `boolean`

Whether to require authentication (default: false).

---

### cors?

> `readonly` `optional` **cors?**: `object`

CORS configuration for the webhook endpoint.

#### allowedHeaders?

> `readonly` `optional` **allowedHeaders?**: `string`[]

#### methods?

> `readonly` `optional` **methods?**: `string`[]

#### origin?

> `readonly` `optional` **origin?**: `string` \| `string`[]

---

### description?

> `readonly` `optional` **description?**: `string`

Description of what this webhook handler does.

---

### enabled?

> `readonly` `optional` **enabled?**: `boolean`

Whether the handler is enabled (default: true).

---

### name?

> `readonly` `optional` **name?**: `string`

Human-readable name for this webhook handler.
