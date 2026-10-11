---
editUrl: false
next: false
prev: false
title: "ShellRenderOptions"
---

> **ShellRenderOptions** = `object`

Per-request shell streaming options.

## Properties

### deadlineMs?

> `readonly` `optional` **deadlineMs?**: `number`

Overall render deadline in milliseconds. The render AbortSignal aborts
when the request signal aborts or this deadline elapses.

---

### maxBufferedBytes?

> `readonly` `optional` **maxBufferedBytes?**: `number`

Maximum total bytes buffered for one slow consumer before the render aborts.
Bounds the complete buffered response on the Lambda delivery path; stream
delivery applies pull-based backpressure (`desiredSize` + `highWaterMark: 1`)
instead of a cumulative cap so full-size shells are not cut off mid-stream.

---

### onSettle?

> `readonly` `optional` **onSettle?**: (`summary`) => `void`

Aggregate observability only. Individual timings or payload contents are
never exposed to the client through this hook.

#### Parameters

##### summary

[`ShellSettleSummary`](/api/meta-vite/src/type-aliases/shellsettlesummary/)

#### Returns

`void`

---

### regionTimeoutMs?

> `readonly` `optional` **regionTimeoutMs?**: `number`

Per-region timeout in milliseconds applied when a region does not declare
its own timeoutMs.
