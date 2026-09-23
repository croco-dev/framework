import { planVersionRef } from "@croco/billing-core";
import { Token } from "@croco/framework-context";
import {
  AI_OUTPUT_TOKENS as COMPLETION_TOKENS,
  AI_COST_USD_NANOS as COST_USD_NANOS,
  AI_EMBEDDING_TOKENS as EMBEDDING_TOKENS,
  AiUsageIngestService,
  AiPricingTable,
  AI_INPUT_TOKENS as PROMPT_TOKENS,
  type AiUsageRecord,
  type ModelPricing,
} from "@croco/ai-usage";
import { Problem } from "@croco/problems-core";
import {
  AiModelRequiredProblem,
  AiProviderUnavailableProblem,
  AiQuotaExceededProblem,
  AiRateLimitExceededProblem,
  AiTenantNotFoundProblem,
  AiTenantRequiredProblem,
} from "./aiProblems";
import {
  assertGenerationReady,
  deterministicGenerate,
  demoPromptPolicy,
  MAX_AI_PROMPT_LENGTH,
  MAX_AI_OUTPUT_LENGTH,
  type Generate,
  type Generation,
  type GenerationUsage,
  type PromptPolicy,
} from "./aiGenerate";
import { createSaasDemoRuntime } from "./saasDemo";
import type { SaasRuntime } from "./saasDemo";

export const AI_SAAS_SMOKE_CONTRACT_VERSION = "ai-saas-smoke-contract/v2";
export const DEFAULT_AI_MODEL_ID = "demo-deterministic";
export const DEFAULT_AI_PROVIDER = "in-memory";

export const AI_PROVIDER_PROFILES = {
  "in-memory": {
    name: "in-memory",
    status: "supported",
    description: "Deterministic app-local generation.",
    packages: ["@croco/ai-usage"],
    env: ["AI_DEFAULT_MODEL_ID"],
  },
  openai: {
    name: "openai",
    status: "supported",
    description:
      "Direct OpenAI Responses SDK 6.44.0 reference; inject tenant credentials and prompt policy.",
    packages: ["openai", "@croco/ai-usage"],
    env: [],
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
    status: "ok" | "over_quota" | "reconciliation_required";
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
  usage: GenerationUsage;
  costUsd: number | null;
  status: "completed" | "over_quota" | "failed";
  errorCategory: string | null;
  createdAt: string;
};

export type AiGenerateTextInput = {
  tenantId?: string;
  requestId: string;
  prompt: string;
  modelId?: string;
  signal?: AbortSignal;
  deadline?: number;
};

export type AiGenerateTextResult = {
  tenantId: string;
  planId: AiPlanId;
  modelId: string;
  provider: string;
  text: string;
  usage: GenerationUsage;
  costUsd: number | null;
  quota: AiUsageState["quota"];
  invocation: AiInvocationLog;
  idempotencyKey: string;
};

export type AiSaasRuntime = {
  saasRuntime: SaasRuntime;
  providerProfile: ReturnType<typeof getAiProviderProfile>;
  receipts: AiReceiptStore;
  aiUsageService: AiUsageIngestService;
  invocationLog: InMemoryAiInvocationLogStore;
  service: AiSaasService;
};

export const AI_SAAS_RUNTIME_TOKEN = new Token<AiSaasRuntime>("AiSaasRuntime");

export class AiSaasRuntimeState {
  constructor(private runtime: AiSaasRuntime) {}

  get current(): AiSaasRuntime {
    return this.runtime;
  }

  update(runtime: AiSaasRuntime): void {
    this.runtime = runtime;
  }
}

export const AI_SAAS_RUNTIME_STATE_TOKEN = new Token<AiSaasRuntimeState>("AiSaasRuntimeState");

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
    usage: GenerationUsage;
    costUsd: number | null;
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
    private readonly options: AiRuntimeOptions,
    private readonly receipts: AiReceiptStore,
    private readonly aiUsageService: AiUsageIngestService,
    private readonly invocationLog: InMemoryAiInvocationLogStore,
  ) {}

  async generateText(input: AiGenerateTextInput): Promise<AiGenerateTextResult> {
    const tenantId = normalizeTenantId(input.tenantId);
    const tenant = await this.saasRuntime.tenantStore.findById(tenantId);
    if (!tenant) {
      throw new AiTenantNotFoundProblem(tenantId);
    }

    const modelId = normalizeModelId(input.modelId ?? DEFAULT_AI_MODEL_ID);
    const key = buildAiIdempotencyKey(tenantId, input.requestId);
    const previous = await this.receipts.get(key);
    if (previous) return this.deliver(previous);
    if (await this.receipts.hasPending(tenantId)) throw new AiProviderUnavailableProblem(modelId);
    if (
      !input.requestId.trim() ||
      input.requestId.length > 128 ||
      modelId.length > 128 ||
      !input.prompt.trim() ||
      input.prompt.length > MAX_AI_PROMPT_LENGTH
    ) {
      throw new AiProviderUnavailableProblem(modelId);
    }
    const generationInput = {
      tenantId,
      modelId,
      prompt: input.prompt,
      signal: input.signal ?? new AbortController().signal,
      deadline: Math.min(input.deadline ?? Date.now() + 30_000, Date.now() + 30_000),
    };
    assertGenerationReady(generationInput);
    const plan = await this.resolvePlan(tenantId);
    await this.registerAiMeters(tenantId, plan);
    const before = await this.getUsageState(tenantId, modelId);
    this.assertPreflightQuota(
      plan,
      before,
      input.prompt.length,
      await this.readUsage(tenantId, COST_USD_NANOS),
    );
    await this.options.promptPolicy(generationInput);
    assertGenerationReady(generationInput);
    this.assertRateLimit(tenantId, plan);
    const receipt: AiReceipt = {
      key,
      tenantId,
      requestId: input.requestId,
      planId: plan.id,
      modelId,
      promptLength: input.prompt.length,
      startedAt: Date.now(),
      state: "outcome-unknown",
      usagePending: true,
      eventPending: true,
    };
    if (!(await this.receipts.claim(receipt))) throw new AiProviderUnavailableProblem(modelId);
    try {
      receipt.generation = await this.saasRuntime.tenantManager.run(tenantId, () =>
        this.options.generate(generationInput),
      );
      if (
        !receipt.generation.text.trim() ||
        receipt.generation.text.length > MAX_AI_OUTPUT_LENGTH
      ) {
        throw new AiProviderUnavailableProblem(modelId);
      }
      receipt.state = "provider-succeeded";
      await this.receipts.save(receipt);
    } catch (error) {
      // The pre-call receipt intentionally remains unknown: response loss does not prove zero spend.
      throw new AiProviderUnavailableProblem(modelId, error);
    }
    return this.deliver(receipt);
  }

  private async deliver(receipt: AiReceipt): Promise<AiGenerateTextResult> {
    if (receipt.result) return receipt.result;
    const generation = receipt.generation;
    if (
      receipt.state !== "provider-succeeded" ||
      !generation ||
      generation.usage.state === "unknown"
    ) {
      throw new AiProviderUnavailableProblem(receipt.modelId);
    }
    if (receipt.usagePending) {
      const recorded = await this.aiUsageService.ingestGenerationUsage({
        tenantId: receipt.tenantId,
        modelId: generation.modelId,
        provider: generation.provider,
        usage: generation.usage,
        idempotencyKey: receipt.key,
      });
      receipt.costUsd = recorded.costUsd;
      receipt.usagePending = false;
      await this.receipts.save(receipt);
    }
    if (receipt.eventPending) {
      await this.options.publishCompletion({
        idempotencyKey: receipt.key,
        tenantId: receipt.tenantId,
        providerResponseId: generation.providerResponseId,
        providerRequestId: generation.providerRequestId,
      });
      receipt.eventPending = false;
      await this.receipts.save(receipt);
    }
    const state = await this.getUsageState(receipt.tenantId, generation.modelId);
    const invocation = this.recordInvocation({
      tenantId: receipt.tenantId,
      requestId: receipt.requestId,
      modelId: generation.modelId,
      provider: generation.provider,
      promptLength: receipt.promptLength,
      responseLength: generation.text.length,
      usage: generation.usage,
      costUsd: receipt.costUsd ?? null,
      status: state.quota.status === "over_quota" ? "over_quota" : "completed",
      errorCategory: null,
      startedAt: receipt.startedAt,
    });
    receipt.result = {
      tenantId: receipt.tenantId,
      planId: receipt.planId,
      modelId: generation.modelId,
      provider: generation.provider,
      text: generation.text,
      usage: generation.usage,
      costUsd: receipt.costUsd ?? null,
      quota: state.quota,
      invocation,
      idempotencyKey: receipt.key,
    };
    await this.receipts.save(receipt);
    return receipt.result;
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
      provider: this.options.providerProfile,
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
        status: (await this.receipts.hasPending(tenantId))
          ? "reconciliation_required"
          : totalTokens > plan.monthlyTokenBudget || costUsd > plan.monthlyCostBudgetUsd
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

  private assertPreflightQuota(
    plan: AiPlan,
    usage: AiUsageState,
    estimatedPromptTokens: number,
    costUsdNanos: number,
  ) {
    const projectedTokens = usage.usage.totalTokens + estimatedPromptTokens;
    if (projectedTokens > plan.monthlyTokenBudget) {
      throw new AiQuotaExceededProblem(PROMPT_TOKENS, projectedTokens, plan.monthlyTokenBudget);
    }

    const costQuotaUsdNanos = plan.monthlyCostBudgetUsd * 1_000_000_000;
    if (costUsdNanos >= costQuotaUsdNanos) {
      throw new AiQuotaExceededProblem(COST_USD_NANOS, costUsdNanos, costQuotaUsdNanos);
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
    provider: string;
    promptLength: number;
    responseLength: number;
    usage: GenerationUsage;
    costUsd: number | null;
    status: AiInvocationLog["status"];
    errorCategory: string | null;
    startedAt: number;
  }): AiInvocationLog {
    return this.invocationLog.record({
      tenantId: input.tenantId,
      requestId: input.requestId,
      modelId: input.modelId,
      provider: input.provider,
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

export type CompletionIntent = {
  idempotencyKey: string;
  tenantId: string;
  providerResponseId: string;
  providerRequestId: string | null;
};
export type AiRuntimeOptions = {
  providerProfile: AiProviderProfileName;
  generate: Generate;
  promptPolicy: PromptPolicy;
  pricing: ModelPricing;
  publishCompletion: (intent: CompletionIntent) => Promise<void>;
};
export type AiReceipt = {
  key: string;
  tenantId: string;
  requestId: string;
  planId: AiPlanId;
  modelId: string;
  promptLength: number;
  startedAt: number;
  state: "outcome-unknown" | "provider-succeeded";
  usagePending: boolean;
  eventPending: boolean;
  generation?: Generation;
  costUsd?: number;
  result?: AiGenerateTextResult;
};
export interface AiReceiptStore {
  get(key: string): Promise<AiReceipt | undefined>;
  claim(receipt: AiReceipt): Promise<boolean>;
  save(receipt: AiReceipt): Promise<void>;
  hasPending(tenantId: string): Promise<boolean>;
}
export class InMemoryAiReceiptStore implements AiReceiptStore {
  private readonly receipts = new Map<string, AiReceipt>();
  async get(key: string) {
    return structuredClone(this.receipts.get(key));
  }
  async claim(receipt: AiReceipt) {
    if (
      this.receipts.has(receipt.key) ||
      [...this.receipts.values()].some(
        (current) =>
          current.tenantId === receipt.tenantId && (current.usagePending || current.eventPending),
      )
    )
      return false;
    this.receipts.set(receipt.key, structuredClone(receipt));
    return true;
  }
  async save(receipt: AiReceipt) {
    this.receipts.set(receipt.key, structuredClone(receipt));
  }
  async hasPending(tenantId: string) {
    return [...this.receipts.values()].some(
      (receipt) => receipt.tenantId === tenantId && (receipt.usagePending || receipt.eventPending),
    );
  }
}

export function createAiSaasRuntime(
  saasRuntime: SaasRuntime = createSaasDemoRuntime(),
  options: AiRuntimeOptions = {
    providerProfile: "in-memory",
    generate: deterministicGenerate,
    promptPolicy: demoPromptPolicy,
    pricing: { inputPricePerToken: 0.000001, outputPricePerToken: 0.000002, currency: "USD" },
    publishCompletion: async () => {},
  },
  receipts: AiReceiptStore = new InMemoryAiReceiptStore(),
): AiSaasRuntime {
  const providerProfile = getAiProviderProfile(options.providerProfile);
  const aiUsageService = new AiUsageIngestService({
    meteringService: saasRuntime.meteringService,
    defaultPricing: options.pricing,
    pricingTable: new AiPricingTable(new Map(), { version: "application-pricing" }),
  });
  const invocationLog = new InMemoryAiInvocationLogStore();
  const service = new AiSaasService(saasRuntime, options, receipts, aiUsageService, invocationLog);
  return { saasRuntime, providerProfile, aiUsageService, receipts, invocationLog, service };
}

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

export type { AiUsageRecord };
