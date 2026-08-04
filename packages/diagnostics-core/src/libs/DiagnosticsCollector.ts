import type {
  DiagnosticsCollectorOptions,
  DiagnosticsProvider,
  DiagnosticsProviderOptions,
  DiagnosticsReport,
  ErrorRecord,
  HealthStatus,
} from "./types";
import { ErrorHistoryRingBuffer } from "./ErrorHistoryRingBuffer";
import {
  DuplicateDiagnosticsProviderProblem,
  InvalidDiagnosticsTimeoutProblem,
  MAX_DIAGNOSTICS_TIMEOUT_MS,
} from "./problems/DiagnosticsProblems";

const DEFAULT_PROVIDER_TIMEOUT_MS = 5000;

function assertValidTimeout(timeout: number, source: "default" | "provider"): void {
  if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > MAX_DIAGNOSTICS_TIMEOUT_MS) {
    throw new InvalidDiagnosticsTimeoutProblem(source, timeout);
  }
}

type RegisteredDiagnosticsProvider = {
  readonly provider: DiagnosticsProvider;
  readonly timeout?: number;
};

class DiagnosticsProviderTimeoutError extends Error {
  constructor(providerName: string, timeoutMs: number) {
    super(`Provider health check timed out after ${timeoutMs}ms for ${providerName}`);
    this.name = "DiagnosticsProviderTimeoutError";
  }
}

function capMessage(message: string, maxLength: number): string {
  if (message.length <= maxLength) {
    return message;
  }
  return `${message.slice(0, maxLength - 3)}...`;
}

function computeSummary(statuses: readonly HealthStatus[]): DiagnosticsReport["summary"] {
  if (statuses.length === 0) {
    return "all_healthy";
  }
  if (statuses.some((s) => s.status === "unhealthy")) {
    return "issues_detected";
  }
  if (statuses.some((s) => s.status === "degraded")) {
    return "degraded";
  }
  return "all_healthy";
}

export class DiagnosticsCollector {
  private readonly providers = new Map<string, RegisteredDiagnosticsProvider>();
  private readonly errors = new ErrorHistoryRingBuffer();
  private readonly timeout: number;

  constructor(options: DiagnosticsCollectorOptions = {}) {
    const timeout = options.timeout ?? DEFAULT_PROVIDER_TIMEOUT_MS;
    assertValidTimeout(timeout, "default");
    this.timeout = timeout;
  }

  registerProvider(provider: DiagnosticsProvider, options: DiagnosticsProviderOptions = {}): void {
    const timeout = options.timeout;
    if (timeout !== undefined) {
      assertValidTimeout(timeout, "provider");
    }
    const existingProvider = this.providers.get(provider.name);

    if (existingProvider !== undefined) {
      if (existingProvider.provider === provider) {
        return;
      }

      throw new DuplicateDiagnosticsProviderProblem(provider.name);
    }

    this.providers.set(provider.name, { provider, timeout });
  }

  getProviders(): readonly DiagnosticsProvider[] {
    return Array.from(this.providers.values(), ({ provider }) => provider);
  }

  recordError(error: ErrorRecord): void {
    this.errors.push(error);
  }

  async getReport(): Promise<DiagnosticsReport> {
    const providerEntries = Array.from(this.providers.entries());

    const settled = await Promise.allSettled(
      providerEntries.map(async ([, registeredProvider]) =>
        this.getProviderHealth(registeredProvider),
      ),
    );

    const components: HealthStatus[] = settled.map((result, index) => {
      const providerName = providerEntries[index][0];

      if (result.status === "fulfilled") {
        return result.value;
      }

      const message =
        result.reason instanceof Error
          ? capMessage(result.reason.message, 100)
          : "Provider check failed";

      return {
        status: "degraded",
        component: providerName,
        message,
        lastChecked: new Date().toISOString(),
      };
    });

    return {
      timestamp: new Date().toISOString(),
      summary: computeSummary(components),
      components,
      recentErrors: this.errors.getAll(),
    };
  }

  private async getProviderHealth({
    provider,
    timeout: timeoutOverride,
  }: RegisteredDiagnosticsProvider): Promise<HealthStatus> {
    const timeoutMs = timeoutOverride ?? this.timeout;
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<HealthStatus>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new DiagnosticsProviderTimeoutError(provider.name, timeoutMs));
        controller.abort();
      }, timeoutMs);
    });

    try {
      return await Promise.race([provider.getHealth(controller.signal), timeoutPromise]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }
}
