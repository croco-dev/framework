---
"@croco/ai-usage": patch
"@croco/metering-core": minor
"create-croco-app": minor
"@croco/testing": major
"@croco/problems-core": major
---

Generated applications now call tenant-scoped vendor SDK clients through an application-owned text-generation function, preserve provider results and usage receipts across downstream delivery failures, and refuse automatic re-inference when provider acceptance is unknown.

Replace the retired generic LLM engine, model registry, decorators, provider facade, and provider conformance helper with `@croco/ai-usage` for SDK-independent token, pricing, quota, event, and telemetry ingestion. Existing `llm.*` meter identifiers remain unchanged for stored-usage compatibility.

`MeteringService.getRecordStatus` exposes missing, active, retryable, persistence-uncertain, delivery-pending, rejected, and completed states so receipt recovery can replay idempotent persistence and resume persisted deliveries without reapplying quota or treating quota rejection as a successful charge.

Problem code migration:

- Replace `llm-metering/cost-limit-exceeded`, `llm-metering/pricing-not-found`, `llm-metering/pricing-registry-conflict`, `llm-metering/quota-exceeded`, and `llm-metering/record-failed` with their `ai-usage/*` equivalents.
- Remove branches for `ai-saas/model-not-found`, `EMBEDDING_ERROR`, `GENERATION_ERROR`, `LLM_PROVIDER_NOT_FOUND`, `LLM_SERVICE_ERROR`, `MODEL_NOT_FOUND`, `STRUCTURED_OUTPUT_ERROR`, `TOKEN_LIMIT_EXCEEDED`, and `TOOL_EXECUTION_ERROR`; feature code now validates its own SDK call contract.
- Remove branches for `llm-core/completion-event-publication-failed`, `llm-core/invalid-llm-prompt`, `llm-core/invalid-llm-response`, `llm-core/llm-service-not-initialized`, `llm-core/operation-aborted`, and `llm-core/rate-limit-exceeded`; there is no framework engine replacement.
- Remove branches for `llm-metering/service-required`; applications inject `AiUsageIngestService` explicitly.
- Remove branches for `llm-openai/aborted`, `llm-openai/authentication-failed`, `llm-openai/invalid-response`, `llm-openai/missing-config`, `llm-openai/rate-limited`, `llm-openai/retryable-upstream`, `llm-openai/terminal-upstream`, and `llm-openai/validation-failed`; map vendor SDK failures at the feature boundary.
