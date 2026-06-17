---
"@croco/execution-core": patch
"@croco/cli": patch
"@croco/triggers-qstash": patch
"@croco/batch-core": patch
"create-croco-app": patch
---

- Expose Jobs v1 operations for listing, inspecting, logging, cancelling, and replaying executions.
- Add `croco jobs` commands for Jobs v1 operator inspection and recovery flows.
- Support QStash schedule sync dry-runs before applying schedule changes.
- Make batch chunk execution completion explicit for multi-step checkpoint flows.
- Include a smoke-tested billing sync background job in the SaaS app preset.
