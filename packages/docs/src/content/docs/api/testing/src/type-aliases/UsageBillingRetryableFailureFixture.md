---
editUrl: false
next: false
prev: false
title: "UsageBillingRetryableFailureFixture"
---

> **UsageBillingRetryableFailureFixture** = `UsageBillingFailureFixtureBase` & \{ `kind`: `"http-429"`; `status`: `429`; \} \| \{ `kind`: `"http-5xx"`; `status`: `500` \| `502` \| `503` \| `504`; \} \| \{ `kind`: `"timeout"`; `upstreamCode`: `"RequestTimeoutError"`; \}
