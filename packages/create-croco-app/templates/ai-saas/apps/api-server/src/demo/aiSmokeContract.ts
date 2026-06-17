import { AiSaasSmokeProblem } from "../aiProblems";
import {
  AI_SAAS_SMOKE_CONTRACT_VERSION,
  buildAiIdempotencyKey,
  DEFAULT_AI_MODEL_ID,
  DEFAULT_AI_PROVIDER,
  type AiSaasDemoSnapshot,
} from "../aiSaas";

export function assertAiSaasSmokeContract(snapshot: AiSaasDemoSnapshot): void {
  const expectedIdempotencyKey = buildAiIdempotencyKey(snapshot.tenant.id, snapshot.request.id);
  const failures = [
    snapshot.contract.version !== AI_SAAS_SMOKE_CONTRACT_VERSION
      ? "AI smoke contract version mismatch"
      : undefined,
    snapshot.contract.providerProfile !== DEFAULT_AI_PROVIDER
      ? "AI smoke did not use the zero-credential in-memory provider"
      : undefined,
    snapshot.tenant.planId !== "team" ? "AI tenant did not use the team plan" : undefined,
    snapshot.generation.modelId !== DEFAULT_AI_MODEL_ID
      ? "AI generation did not use the default deterministic model"
      : undefined,
    snapshot.generation.provider !== DEFAULT_AI_PROVIDER
      ? "AI generation did not use the in-memory provider"
      : undefined,
    snapshot.generation.text.length === 0 ? "AI generation returned empty text" : undefined,
    snapshot.generation.usage.promptTokens <= 0 ? "prompt tokens were not recorded" : undefined,
    snapshot.generation.usage.completionTokens <= 0
      ? "completion tokens were not recorded"
      : undefined,
    snapshot.generation.costUsd <= 0 ? "LLM cost was not recorded" : undefined,
    snapshot.generation.idempotencyKey !== expectedIdempotencyKey
      ? "AI usage did not use the deterministic idempotency key"
      : undefined,
    snapshot.usage.usage.promptTokens !== snapshot.generation.usage.promptTokens
      ? "prompt token usage state does not match generation usage"
      : undefined,
    snapshot.usage.usage.completionTokens !== snapshot.generation.usage.completionTokens
      ? "completion token usage state does not match generation usage"
      : undefined,
    snapshot.usage.usage.costUsd !== snapshot.generation.costUsd
      ? "cost usage state does not match generation usage"
      : undefined,
    snapshot.usage.quota.status !== "ok" ? "happy path quota status is not ok" : undefined,
    snapshot.usage.quota.remainingTokens >= snapshot.usage.quota.monthlyTokenBudget
      ? "remaining token quota did not decrease"
      : undefined,
    snapshot.evalLog.count !== 1
      ? "AI eval log did not record exactly one happy-path call"
      : undefined,
    snapshot.evalLog.last.promptMetadata.rawPromptStored
      ? "AI eval log stored the raw prompt by default"
      : undefined,
    snapshot.evalLog.last.responseMetadata.rawResponseStored
      ? "AI eval log stored the raw response by default"
      : undefined,
    snapshot.evalLog.last.status !== "completed" ? "AI eval log did not complete" : undefined,
    snapshot.quotaFailure.code !== "ai-saas/quota-exceeded"
      ? "AI quota exhaustion did not return an explicit quota Problem"
      : undefined,
  ].filter((failure): failure is string => failure !== undefined);

  if (failures.length > 0) {
    throw new AiSaasSmokeProblem(failures);
  }
}
