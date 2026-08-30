---
"@croco/framework-context": minor
"@croco/dataloader-core": patch
"@croco/tasks-core": patch
"@croco/testing": patch
"@croco/transports-http": patch
"create-croco-app": patch
---

Expose fatal logging through the shared `ILogger` and `LOGGER_TOKEN` contract, including child loggers and Error context,
while keeping generated bootstrap and built-in no-op loggers contract-complete.
