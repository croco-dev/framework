import { planVersionRef } from "@croco/billing-core";
import { InMemoryLlmModel, InMemoryLlmRegistry, LlmService, type LlmUsage } from "@croco/llm-core";
import {
  COMPLETION_TOKENS,
  COST_USD_NANOS,
  EMBEDDING_TOKENS,
  LlmMeteringService,
  PROMPT_TOKENS,
  type LlmUsageRecord,
} from "@croco/llm-metering";
import { Problem } from "@croco/problems-core";
import {
  AiModelNotFoundProblem,
  AiModelRequiredProblem,
  AiProviderUnavailableProblem,
  AiQuotaExceededProblem,
  AiRateLimitExceededProblem,
  AiTenantNotFoundProblem,
  AiTenantRequiredProblem,
} from "./aiProblems";
import { InMemoryEventBus } from "./inMemoryAdapters";
import { createSaasDemoRuntime, defaultSaasRuntime } from "./saasDemo";
import type { SaasRuntime } from "./saasDemo";

export const AI_SAAS_SMOKE_CONTRACT_VERSION = "ai-saas-smoke-contract/v1";
export const DEFAULT_AI_MODEL_ID = "demo-deterministic";
export const DEFAULT_AI_PROVIDER = "in-memory";

export const AI_PROVIDER_PROFILES = {
  "in-memory": {
    name: "in-memory",
    status: "supported",
    description: "Zero-credential deterministic LLM provider for generated app smoke tests.",
    packages: ["@croco/llm-core", "@croco/llm-metering"],
    env: ["AI_PROVIDER_PROFILE", "AI_DEFAULT_MODEL_ID"],
  },
  openai: {
    name: "openai",
    status: "documented-seam",
    description: "Adapter seam for an OpenAI-compatible LlmModel implementation.",
    packages: ["@ai-sdk/openai", "@croco/llm-core", "@croco/llm-metering"],
    env: ["OPENAI_API_KEY", "OPENAI_BASE_URL", "AI_DEFAULT_MODEL_ID"],
  },
  anthropic: {
    name: "anthropic",
    status: "documented-seam",
    description: "Adapter seam for an Anthropic-compatible LlmModel implementation.",
    packages: ["@ai-sdk/anthropic", "@croco/llm-core", "@croco/llm-metering"],
    env: ["ANTHROPIC_API_KEY", "AI_DEFAULT_MODEL_ID"],
  },
} as const;

export type AiProviderProfileName = keyof typeof AI_PROVIDER_PROFILES;

export function getAiProviderProfile(name: AiProviderProfileName = "in-memory") {
  return AI_PROVIDER_PROFILES[name];
}

export const AI_PLAN_CATALOG = {
  free: {
    id: "free",
    monthlyTokenBudget: 16,
    monthlyCostBudgetUsd: 0.00005,
    rateLimitPerMinute: 5,
  },
  pro: {
    id: "pro",
    monthlyTokenBudget: 250_000,
    monthlyCostBudgetUsd: 25,
    rateLimitPerMinute: 60,
  },
  team: {
    id: "team",
    monthlyTokenBudget: 1_000_000,
    monthlyCostBudgetUsd: 100,
    rateLimitPerMinute: 120,
  },
} as const;

export type AiPlanId = keyof typeof AI_PLAN_CATALOG;
export type AiPlan = (typeof AI_PLAN_CATALOG)[AiPlanId];

export type AiUsageState = {
  tenantId: string;
  planId: AiPlanId;
  modelId: string;
  provider: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    embeddingTokens: number;
    totalTokens: number;
    costUsd: number;
  };
  quota: {
    monthlyTokenBudget: number;
    monthlyCostBudgetUsd: number;
    remainingTokens: number;
    remainingCostUsd: number;
    status: "ok" | "over_quota";
  };
};

export type AiInvocationLog = {
  id: string;
  tenantId: string;
  requestId: string;
  modelId: string;
  provider: string;
  promptMetadata: {
    length: number;
    rawPromptStored: boolean;
  };
  responseMetadata: {
    length: number;
    rawResponseStored: boolean;
  };
  latencyMs: number;
  usage: LlmUsage;
  costUsd: number;
  status: "completed" | "over_quota" | "failed";
  errorCategory: string | null;
  createdAt: string;
};

export type AiGenerateTextInput = {
  tenantId?: string;
  requestId: string;
  prompt: string;
  modelId?: string;
};

export type AiGenerateTextResult = {
  tenantId: string;
  planId: AiPlanId;
  modelId: string;
  provider: string;
  text: string;
  usage: LlmUsage;
  costUsd: number;
  quota: AiUsageState["quota"];
  invocation: AiInvocationLog;
  idempotencyKey: string;
};

export type AiSaasRuntime = {
  saasRuntime: SaasRuntime;
  providerProfile: ReturnType<typeof getAiProviderProfile>;
  llmRegistry: InMemoryLlmRegistry;
  llmService: LlmService;
  llmMeteringService: LlmMeteringService;
  invocationLog: InMemoryAiInvocationLogStore;
  service: AiSaasService;
};

export type AiSaasDemoSnapshot = {
  contract: {
    version: typeof AI_SAAS_SMOKE_CONTRACT_VERSION;
    providerProfile: string;
  };
  tenant: {
    id: string;
    slug: string;
    planId: AiPlanId;
  };
  request: {
    id: string;
    promptLength: number;
  };
  generation: {
    modelId: string;
    provider: string;
    text: string;
    usage: LlmUsage;
    costUsd: number;
    idempotencyKey: string;
  };
  usage: AiUsageState;
  evalLog: {
    count: number;
    last: AiInvocationLog;
  };
  quotaFailure: {
    code: string;
    tenantId: string;
    planId: AiPlanId;
  };
};

export class InMemoryAiInvocationLogStore {
  private readonly logs: AiInvocationLog[] = [];

  record(input: Omit<AiInvocationLog, "createdAt" | "id">): AiInvocationLog {
    const log = {
      ...input,
      id: `ai_invocation_${this.logs.length + 1}`,
      createdAt: new Date().toISOString(),
    };
    this.logs.push(log);
    return log;
  }

  list(tenantId: string): AiInvocationLog[] {
    return this.logs.filter((log) => log.tenantId === tenantId);
  }
}

export class AiSaasService {
  private readonly rateLimitWindows = new Map<string, number[]>();

  constructor(
    private readonly saasRuntime: SaasRuntime,
    private readonly llmRegistry: InMemoryLlmRegistry,
    private readonly llmService: LlmService,
    private readonly llmMeteringService: LlmMeteringService,
    private readonly invocationLog: InMemoryAiInvocationLogStore,
  ) {}

  async generateText(input: AiGenerateTextInput): Promise<AiGenerateTextResult> {
    const tenantId = normalizeTenantId(input.tenantId);
    const tenant = await this.saasRuntime.tenantStore.findById(tenantId);
    if (!tenant) {
      throw new AiTenantNotFoundProblem(tenantId);
    }

    const modelId = normalizeModelId(input.modelId ?? DEFAULT_AI_MODEL_ID);
    await this.assertModelAvailable(modelId);
    const plan = await this.resolvePlan(tenantId);
    await this.registerAiMeters(tenantId, plan);
    const before = await this.getUsageState(tenantId, modelId);
    this.assertPreflightQuota(plan, before, input.prompt.length);
    this.assertRateLimit(tenantId, plan);

    const idempotencyKey = buildAiIdempotencyKey(tenantId, input.requestId);
    const startedAt = Date.now();

    try {
      const result = await this.saasRuntime.tenantManager.run(tenantId, () =>
        this.llmService.generate({
          modelId,
          prompt: input.prompt,
          metadata: {
            tenantId,
            requestId: input.requestId,
          },
        }),
      );
      const usageRecord = await this.llmMeteringService.recordUsage({
        tenantId,
        modelId,
        provider: DEFAULT_AI_PROVIDER,
        usage: result.usage,
        idempotencyKey,
        metadata: {
          operationType: "generate",
          requestId: input.requestId,
        },
      });
      const usage = await this.getUsageState(tenantId, modelId);
      const invocation = this.recordInvocation({
        tenantId,
        requestId: input.requestId,
        modelId,
        promptLength: input.prompt.length,
        responseLength: result.text.length,
        usage: result.usage,
        costUsd: usageRecord.costUsd,
        status: usage.quota.status === "over_quota" ? "over_quota" : "completed",
        errorCategory: null,
        startedAt,
      });

      return {
        tenantId,
        planId: plan.id,
        modelId,
        provider: DEFAULT_AI_PROVIDER,
        text: result.text,
        usage: result.usage,
        costUsd: usageRecord.costUsd,
        quota: usage.quota,
        invocation,
        idempotencyKey,
      };
    } catch (error) {
      this.recordInvocation({
        tenantId,
        requestId: input.requestId,
        modelId,
        promptLength: input.prompt.length,
        responseLength: 0,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, accuracy: "UNKNOWN" },
        costUsd: 0,
        status: "failed",
        errorCategory: error instanceof Problem ? error.code : "ai-saas/provider-unavailable",
        startedAt,
      });

      if (error instanceof Problem) {
        throw error;
      }
      throw new AiProviderUnavailableProblem(modelId, error);
    }
  }

  async getUsageState(
    tenantIdInput: string | undefined,
    modelId = DEFAULT_AI_MODEL_ID,
  ): Promise<AiUsageState> {
    const tenantId = normalizeTenantId(tenantIdInput);
    const tenant = await this.saasRuntime.tenantStore.findById(tenantId);
    if (!tenant) {
      throw new AiTenantNotFoundProblem(tenantId);
    }

    const plan = await this.resolvePlan(tenantId);
    await this.registerAiMeters(tenantId, plan);
    const [promptTokens, completionTokens, embeddingTokens, costUsdNanos] = await Promise.all([
      this.readUsage(tenantId, PROMPT_TOKENS),
      this.readUsage(tenantId, COMPLETION_TOKENS),
      this.readUsage(tenantId, EMBEDDING_TOKENS),
      this.readUsage(tenantId, COST_USD_NANOS),
    ]);
    const costUsd = costUsdNanos / 1_000_000_000;
    const totalTokens = promptTokens + completionTokens + embeddingTokens;
    const remainingTokens = Math.max(0, plan.monthlyTokenBudget - totalTokens);
    const remainingCostUsd = Math.max(0, plan.monthlyCostBudgetUsd - costUsd);

    return {
      tenantId,
      planId: plan.id,
      modelId,
      provider: DEFAULT_AI_PROVIDER,
      usage: {
        promptTokens,
        completionTokens,
        embeddingTokens,
        totalTokens,
        costUsd,
      },
      quota: {
        monthlyTokenBudget: plan.monthlyTokenBudget,
        monthlyCostBudgetUsd: plan.monthlyCostBudgetUsd,
        remainingTokens,
        remainingCostUsd,
        status:
          totalTokens > plan.monthlyTokenBudget || costUsd > plan.monthlyCostBudgetUsd
            ? "over_quota"
            : "ok",
      },
    };
  }

  async listInvocationLogs(tenantIdInput: string | undefined): Promise<AiInvocationLog[]> {
    const tenantId = normalizeTenantId(tenantIdInput);
    const tenant = await this.saasRuntime.tenantStore.findById(tenantId);
    if (!tenant) {
      throw new AiTenantNotFoundProblem(tenantId);
    }

    return this.invocationLog.list(tenantId);
  }

  private async resolvePlan(tenantId: string): Promise<AiPlan> {
    const planId = await this.saasRuntime.subscriptionProvider.getCurrentPlanId(tenantId);
    if (!isAiPlanId(planId)) {
      throw new AiQuotaExceededProblem(PROMPT_TOKENS, 0, 0);
    }

    return AI_PLAN_CATALOG[planId];
  }

  private async assertModelAvailable(modelId: string): Promise<void> {
    const models = await this.llmRegistry.listModels();
    if (!models.includes(modelId)) {
      throw new AiModelNotFoundProblem(modelId);
    }
  }

  private async registerAiMeters(tenantId: string, plan: AiPlan): Promise<void> {
    await Promise.all([
      this.saasRuntime.meterRegistry.register({
        tenantId,
        meterId: PROMPT_TOKENS,
        type: "COUNT",
        quota: plan.monthlyTokenBudget,
        allowOverQuota: false,
        metadata: { unit: "token", source: "ai-saas", planId: plan.id },
      }),
      this.saasRuntime.meterRegistry.register({
        tenantId,
        meterId: COMPLETION_TOKENS,
        type: "COUNT",
        quota: plan.monthlyTokenBudget,
        allowOverQuota: false,
        metadata: { unit: "token", source: "ai-saas", planId: plan.id },
      }),
      this.saasRuntime.meterRegistry.register({
        tenantId,
        meterId: EMBEDDING_TOKENS,
        type: "COUNT",
        quota: plan.monthlyTokenBudget,
        allowOverQuota: false,
        metadata: { unit: "token", source: "ai-saas", planId: plan.id },
      }),
      this.saasRuntime.meterRegistry.register({
        tenantId,
        meterId: COST_USD_NANOS,
        type: "CUSTOM_EVENT",
        quota: plan.monthlyCostBudgetUsd * 1_000_000_000,
        allowOverQuota: false,
        metadata: { unit: "usd_nanodollar", source: "ai-saas", planId: plan.id },
      }),
    ]);
  }

  private assertPreflightQuota(plan: AiPlan, usage: AiUsageState, estimatedPromptTokens: number) {
    const projectedTokens = usage.usage.totalTokens + estimatedPromptTokens;
    if (projectedTokens > plan.monthlyTokenBudget) {
      throw new AiQuotaExceededProblem(PROMPT_TOKENS, projectedTokens, plan.monthlyTokenBudget);
    }

    if (usage.usage.costUsd >= plan.monthlyCostBudgetUsd) {
      throw new AiQuotaExceededProblem(
        COST_USD_NANOS,
        usage.usage.costUsd * 1_000_000_000,
        plan.monthlyCostBudgetUsd * 1_000_000_000,
      );
    }
  }

  private assertRateLimit(tenantId: string, plan: AiPlan): void {
    const key = `${tenantId}:${plan.id}`;
    const now = Date.now();
    const windowStart = now - 60_000;
    const currentWindow = (this.rateLimitWindows.get(key) ?? []).filter(
      (timestamp) => timestamp > windowStart,
    );

    if (currentWindow.length >= plan.rateLimitPerMinute) {
      throw new AiRateLimitExceededProblem(plan.rateLimitPerMinute);
    }

    currentWindow.push(now);
    this.rateLimitWindows.set(key, currentWindow);
  }

  private async readUsage(tenantId: string, meterId: string): Promise<number> {
    return this.saasRuntime.meteringService.getUsage({
      tenantId,
      meterId,
      period: "billing_cycle",
    });
  }

  private recordInvocation(input: {
    tenantId: string;
    requestId: string;
    modelId: string;
    promptLength: number;
    responseLength: number;
    usage: LlmUsage;
    costUsd: number;
    status: AiInvocationLog["status"];
    errorCategory: string | null;
    startedAt: number;
  }): AiInvocationLog {
    return this.invocationLog.record({
      tenantId: input.tenantId,
      requestId: input.requestId,
      modelId: input.modelId,
      provider: DEFAULT_AI_PROVIDER,
      promptMetadata: {
        length: input.promptLength,
        rawPromptStored: false,
      },
      responseMetadata: {
        length: input.responseLength,
        rawResponseStored: false,
      },
      latencyMs: Date.now() - input.startedAt,
      usage: input.usage,
      costUsd: input.costUsd,
      status: input.status,
      errorCategory: input.errorCategory,
    });
  }
}

export function createAiSaasRuntime(
  saasRuntime: SaasRuntime = createSaasDemoRuntime(),
): AiSaasRuntime {
  const providerProfile = getAiProviderProfile("in-memory");
  const llmRegistry = new InMemoryLlmRegistry();
  llmRegistry.registerProvider(
    DEFAULT_AI_MODEL_ID,
    () =>
      new InMemoryLlmModel(DEFAULT_AI_MODEL_ID, {
        "Draft a short tenant onboarding email.":
          "Welcome to the deterministic Croco AI SaaS demo.",
      }),
  );
  const eventBus = new InMemoryEventBus();
  const llmService = new LlmService(llmRegistry, eventBus);
  const llmMeteringService = new LlmMeteringService({
    meteringService: saasRuntime.meteringService,
    eventBus,
  });
  const invocationLog = new InMemoryAiInvocationLogStore();
  const service = new AiSaasService(
    saasRuntime,
    llmRegistry,
    llmService,
    llmMeteringService,
    invocationLog,
  );

  return {
    saasRuntime,
    providerProfile,
    llmRegistry,
    llmService,
    llmMeteringService,
    invocationLog,
    service,
  };
}

export const defaultAiSaasRuntime = createAiSaasRuntime(defaultSaasRuntime);

export async function seedAiSaasTenant(runtime: AiSaasRuntime, planId: AiPlanId, slug: string) {
  const tenant = await runtime.saasRuntime.tenantStore.create({
    slug,
    name: `${slug} AI SaaS`,
    status: "trial",
    settings: {
      timezone: "UTC",
      features: ["ai.generate", "ai.usage"],
    },
  });
  await runtime.saasRuntime.billingService.createCheckout({
    tenantId: tenant.id,
    email: `${slug}@example.test`,
    productId: planId,
    successUrl: "https://app.example.test/ai/billing/success",
    cancelUrl: "https://app.example.test/ai/billing/cancel",
    idempotencyKey: `checkout_${tenant.id}_${planId}`,
  });
  await runtime.saasRuntime.billingStore.saveSubscription({
    id: `subscription_${tenant.id}`,
    billingAccountId: tenant.id,
    externalSubscriptionId: `external_subscription_${tenant.id}`,
    planId,
    planVersionRef: planVersionRef(`${planId}@v1`),
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false,
    lastSyncedAt: new Date(),
  });

  await runtime.service.getUsageState(tenant.id);

  return { tenant, planId };
}

export async function runAiSaasDemoFlow(
  runtime: AiSaasRuntime = createAiSaasRuntime(),
): Promise<AiSaasDemoSnapshot> {
  const seeded = await seedAiSaasTenant(runtime, "team", "ai-acme");
  const request = {
    id: "ai-smoke-request",
    prompt: "Draft a short tenant onboarding email.",
  };
  const generation = await runtime.service.generateText({
    tenantId: seeded.tenant.id,
    requestId: request.id,
    prompt: request.prompt,
    modelId: DEFAULT_AI_MODEL_ID,
  });
  const usage = await runtime.service.getUsageState(seeded.tenant.id, generation.modelId);
  const logs = await runtime.service.listInvocationLogs(seeded.tenant.id);

  const quotaSeed = await seedAiSaasTenant(runtime, "free", "ai-free-quota");
  let quotaFailureCode = "none";
  try {
    await runtime.service.generateText({
      tenantId: quotaSeed.tenant.id,
      requestId: "ai-quota-exhausted",
      prompt: "This prompt is intentionally too long for the free AI plan quota.",
      modelId: DEFAULT_AI_MODEL_ID,
    });
  } catch (error) {
    if (!(error instanceof Problem)) {
      throw error;
    }
    quotaFailureCode = error.code;
  }

  const lastLog = logs.length === 0 ? undefined : logs[logs.length - 1];
  if (!lastLog) {
    throw new Error("AI SaaS smoke did not record an invocation log");
  }

  return {
    contract: {
      version: AI_SAAS_SMOKE_CONTRACT_VERSION,
      providerProfile: runtime.providerProfile.name,
    },
    tenant: {
      id: seeded.tenant.id,
      slug: seeded.tenant.slug,
      planId: seeded.planId,
    },
    request: {
      id: request.id,
      promptLength: request.prompt.length,
    },
    generation: {
      modelId: generation.modelId,
      provider: generation.provider,
      text: generation.text,
      usage: generation.usage,
      costUsd: generation.costUsd,
      idempotencyKey: generation.idempotencyKey,
    },
    usage,
    evalLog: {
      count: logs.length,
      last: lastLog,
    },
    quotaFailure: {
      code: quotaFailureCode,
      tenantId: quotaSeed.tenant.id,
      planId: quotaSeed.planId,
    },
  };
}

export function buildAiIdempotencyKey(tenantId: string, requestId: string): string {
  return `ai-generate:${tenantId}:${requestId}`;
}

function normalizeTenantId(tenantId: string | undefined): string {
  const normalized = tenantId?.trim();
  if (!normalized) {
    throw new AiTenantRequiredProblem();
  }

  return normalized;
}

function normalizeModelId(modelId: string | undefined): string {
  const normalized = modelId?.trim();
  if (!normalized) {
    throw new AiModelRequiredProblem();
  }

  return normalized;
}

function isAiPlanId(planId: string | null): planId is AiPlanId {
  return planId !== null && planId in AI_PLAN_CATALOG;
}

export type AiUsageRecord = LlmUsageRecord;
