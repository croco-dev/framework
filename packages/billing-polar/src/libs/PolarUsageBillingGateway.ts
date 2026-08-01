import {
  type CustomerMeterState,
  type CustomerMeterStateQuery,
  type UsageBillingBatchReceipt,
  type UsageBillingEvent,
  type UsageBillingGateway,
} from "@croco/billing-core";
import type { MeterRef } from "@croco/metering-core";
import { Polar } from "@polar-sh/sdk";
import type { PolarConfig } from "../types";
import {
  normalizePolarBillingError,
  PolarUsageMeterMappingProblem,
  validatePolarConfig,
} from "./problems/PolarBillingProblems";

const POLAR_RETRY_CONFIG = {
  strategy: "backoff" as const,
  retryConnectionErrors: true,
  backoff: {
    initialInterval: 500,
    maxInterval: 5_000,
    exponent: 1.5,
    maxElapsedTime: 15_000,
  },
};

const POLAR_RETRY_CODES = ["429", "500", "502", "503", "504"];
const POLAR_USAGE_REQUEST_TIMEOUT_MS = 5_000;

export type PolarUsageMeterBinding<Meter extends MeterRef = MeterRef> = {
  readonly meter: Meter;
  readonly eventName: string;
  readonly providerMeterId: string;
  readonly valueMetadataKey: string;
};

/**
 * Binds one typed Croco meter to its pre-declared Polar event and meter. Croco dimension keys are forwarded as
 * Polar event metadata, so the Polar meter filter can be declared against the same named dimensions.
 */
export function bindPolarUsageMeter<const Meter extends MeterRef>(options: {
  readonly meter: Meter;
  readonly eventName: string;
  readonly providerMeterId: string;
  readonly valueMetadataKey?: string;
}): PolarUsageMeterBinding<Meter> {
  requireNonEmpty(options.meter.key, "meter key");
  requireNonEmpty(options.eventName, "event name");
  requireNonEmpty(options.providerMeterId, "provider meter id");
  const valueMetadataKey = options.valueMetadataKey ?? "value";
  requireNonEmpty(valueMetadataKey, "value metadata key");
  if (valueMetadataKey in options.meter.dimensions) {
    throw new PolarUsageMeterMappingProblem(
      options.meter.key,
      "Usage value metadata key conflicts with a declared Croco meter dimension",
    );
  }

  return Object.freeze({
    meter: options.meter,
    eventName: options.eventName,
    providerMeterId: options.providerMeterId,
    valueMetadataKey,
  });
}

/**
 * Polar implementation of the provider-neutral usage capability.
 *
 * Polar returns aggregate insert/duplicate counts rather than event identities. Each event is therefore submitted
 * in its own provider request, retaining a deterministic Croco receipt for every journal claim.
 */
export class PolarUsageBillingGateway implements UsageBillingGateway {
  private readonly client: Polar;
  private readonly bindings: ReadonlyMap<string, PolarUsageMeterBinding>;
  private readonly organizationId?: string;

  constructor(config: PolarConfig, bindings: readonly PolarUsageMeterBinding[]) {
    const validConfig = validatePolarConfig(config);
    this.client = new Polar({
      accessToken: validConfig.accessToken,
      server: validConfig.environment,
    });
    this.organizationId = validConfig.organizationId;
    this.bindings = createBindingMap(bindings);
  }

  async ingest(events: readonly UsageBillingEvent[]): Promise<UsageBillingBatchReceipt> {
    const receipts = await Promise.all(events.map(async (event) => await this.ingestOne(event)));
    return { receipts };
  }

  async getCustomerMeterState(query: CustomerMeterStateQuery): Promise<CustomerMeterState | null> {
    const binding = this.requireBinding(query.meterId);
    try {
      const pages = await this.client.customerMeters.list(
        {
          externalCustomerId: query.billingAccountId,
          meterId: binding.providerMeterId,
          limit: 2,
        },
        {
          retries: POLAR_RETRY_CONFIG,
          retryCodes: POLAR_RETRY_CODES,
          timeoutMs: POLAR_USAGE_REQUEST_TIMEOUT_MS,
        },
      );
      for await (const page of pages) {
        const meter = page.result.items.find((item) => item.meterId === binding.providerMeterId);
        if (!meter) continue;
        return {
          billingAccountId: query.billingAccountId,
          meterId: query.meterId,
          updatedAt: meter.modifiedAt ?? meter.createdAt,
          value: meter.consumedUnits,
        };
      }
      return null;
    } catch (error) {
      throw normalizePolarBillingError(
        error,
        "usage.getCustomerMeterState",
        query.billingAccountId,
      );
    }
  }

  private async ingestOne(event: UsageBillingEvent) {
    const binding = this.requireBinding(event.meterId);
    try {
      const response = await this.client.events.ingest(
        {
          events: [
            {
              externalCustomerId: event.billingAccountId,
              externalId: event.eventId,
              name: binding.eventName,
              ...(this.organizationId && { organizationId: this.organizationId }),
              timestamp: event.occurredAt,
              metadata: {
                ...event.dimensions,
                [binding.valueMetadataKey]: event.value,
              },
            },
          ],
        },
        {
          retries: POLAR_RETRY_CONFIG,
          retryCodes: POLAR_RETRY_CODES,
          timeoutMs: POLAR_USAGE_REQUEST_TIMEOUT_MS,
        },
      );
      if (response.inserted === 1 && response.duplicates === 0) {
        return { eventId: event.eventId, status: "inserted" as const };
      }
      if (response.inserted === 0 && response.duplicates === 1) {
        return { eventId: event.eventId, status: "duplicate" as const };
      }
      throw new PolarUsageMeterMappingProblem(
        event.meterId,
        "Polar returned an invalid single-event ingestion receipt",
      );
    } catch (error) {
      throw normalizePolarBillingError(error, "usage.ingest", event.billingAccountId);
    }
  }

  private requireBinding(meterId: string): PolarUsageMeterBinding {
    const binding = this.bindings.get(meterId);
    if (!binding) throw new PolarUsageMeterMappingProblem(meterId);
    return binding;
  }
}

function createBindingMap(
  bindings: readonly PolarUsageMeterBinding[],
): ReadonlyMap<string, PolarUsageMeterBinding> {
  const map = new Map<string, PolarUsageMeterBinding>();
  for (const binding of bindings) {
    requireNonEmpty(binding.meter.key, "meter key");
    requireNonEmpty(binding.eventName, "event name");
    requireNonEmpty(binding.providerMeterId, "provider meter id");
    requireNonEmpty(binding.valueMetadataKey, "value metadata key");
    if (binding.valueMetadataKey in binding.meter.dimensions) {
      throw new PolarUsageMeterMappingProblem(
        binding.meter.key,
        "Usage value metadata key conflicts with a declared Croco meter dimension",
      );
    }
    if (map.has(binding.meter.key)) {
      throw new PolarUsageMeterMappingProblem(
        binding.meter.key,
        "Croco meter is bound more than once",
      );
    }
    map.set(binding.meter.key, binding);
  }
  return map;
}

function requireNonEmpty(value: string, field: string): void {
  if (!value.trim()) {
    throw new PolarUsageMeterMappingProblem(field, "Usage meter binding field must be non-empty");
  }
}
