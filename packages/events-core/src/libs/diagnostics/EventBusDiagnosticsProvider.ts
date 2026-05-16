import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import { EventBusConfig } from "../EventBusConfig";

export class EventBusDiagnosticsProvider implements DiagnosticsProvider {
  readonly name = "events";

  async getHealth(): Promise<HealthStatus> {
    const config = EventBusConfig.getInstance();
    const stats = EventBusConfig.getStats();
    const subscriberCount = config.getSubscriptions().size;

    if (subscriberCount === 0) {
      return {
        status: "unhealthy",
        component: "events",
        message: "No event subscribers registered",
        details: this.buildDetails(subscriberCount, stats?.getStats()),
        lastChecked: new Date().toISOString(),
      };
    }

    if (!stats) {
      return {
        status: "degraded",
        component: "events",
        message: "EventBusStats not configured",
        details: this.buildDetails(subscriberCount, undefined),
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      status: "healthy",
      component: "events",
      details: this.buildDetails(subscriberCount, stats.getStats()),
      lastChecked: new Date().toISOString(),
    };
  }

  private buildDetails(
    subscriberCount: number,
    stats: { publishedCount: number; failCount: number } | undefined,
  ): Record<string, unknown> {
    return {
      subscriberCount,
      publishedCount: stats?.publishedCount ?? 0,
      failCount: stats?.failCount ?? 0,
    };
  }
}
