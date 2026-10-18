---
"@croco/ratelimit-upstash": patch
"create-croco-app": patch
---

Workers can enforce Upstash rate limits through an explicit fetch-only client that preserves read-your-writes tokens and HTTP failure status without exposing upstream payloads or retrying consumption.

Generated application guidance explains the explicit Upstash owner selection and the separate Durable Object and full-profile verification boundaries.
