---
"@croco/webhooks-core": patch
---

Publish outbound webhook events independently of older failed dispatch intents. Duplicate event publication retries only that event's unpublished intents, while retained failures remain available through the explicit backlog drain.
