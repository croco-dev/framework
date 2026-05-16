import type { DiagnosticsProvider, HealthStatus, ErrorRecord, DiagnosticsReport } from "./types";
import { ErrorHistoryRingBuffer } from "./ErrorHistoryRingBuffer";

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
  private readonly providers = new Map<string, DiagnosticsProvider>();
  private readonly errors = new ErrorHistoryRingBuffer();

  registerProvider(provider: DiagnosticsProvider): void {
    this.providers.set(provider.name, provider);
  }

  getProviders(): readonly DiagnosticsProvider[] {
    return Array.from(this.providers.values());
  }

  recordError(error: ErrorRecord): void {
    this.errors.push(error);
  }

  async getReport(): Promise<DiagnosticsReport> {
    const providerEntries = Array.from(this.providers.entries());

    const settled = await Promise.allSettled(
      providerEntries.map(async ([, provider]) => provider.getHealth()),
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
}
