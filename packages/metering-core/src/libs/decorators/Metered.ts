import { AsyncLocalStorage } from "node:async_hooks";
import "reflect-metadata";
import type { ILogger } from "@croco/framework-context";
import { Container, LOGGER_TOKEN } from "@croco/framework-context";
import type { MeteringService } from "../MeteringService";
import type { CountMeterRef, MeterRecordInput } from "../MeterRef";
import { InvalidUsageEnvelopeProblem } from "../problems/InvalidUsageEnvelopeProblem";

export const METERED_METADATA_KEY = Symbol("meter:metered");

/** 문자열 meter ID를 사용하는 기존 `@Metered` 데코레이터 옵션입니다. */
export type MeteredOptions = {
  meterId: string;
  billing?: "local" | "required";
  valueExtractor?: (args: unknown[], result: unknown) => number;
  idempotencyKeyExtractor?: (args: unknown[]) => string | undefined;
  metadataExtractor?: (args: unknown[], result: unknown) => Record<string, unknown> | undefined;
};

type MeteredDimensionsExtractor<Meter extends CountMeterRef> =
  MeterRecordInput<Meter> extends { dimensions: infer Dimensions }
    ? {
        dimensionsExtractor: (args: unknown[]) => Dimensions;
      }
    : {
        dimensionsExtractor?: never;
      };

type MeteredEventExtractor<Meter extends CountMeterRef> =
  MeterRecordInput<Meter> extends { eventId: string }
    ? {
        eventIdExtractor: (args: unknown[]) => string;
      }
    : {
        eventIdExtractor?: (args: unknown[]) => string | undefined;
      };

/** 타입이 지정된 count meter 계약을 사용하는 `@Metered` 데코레이터 옵션입니다. */
export type MeteredRefOptions<Meter extends CountMeterRef> = {
  meter: Meter;
  metadataExtractor?: (args: unknown[], result: unknown) => Record<string, unknown> | undefined;
} & MeteredDimensionsExtractor<Meter> &
  MeteredEventExtractor<Meter>;

/** `@Metered`가 메서드에 저장하는 정규화된 런타임 메타데이터입니다. */
export type MeteredMetadata = {
  meterId: string;
  meter?: CountMeterRef;
  billing?: "local" | "required";
  valueExtractor: (args: unknown[], result: unknown) => number;
  idempotencyKeyExtractor?: (args: unknown[]) => string | undefined;
  eventIdExtractor?: (args: unknown[]) => string | undefined;
  dimensionsExtractor?: (args: unknown[]) => Record<string, string | number | boolean>;
  metadataExtractor?: (args: unknown[], result: unknown) => Record<string, unknown> | undefined;
};

let meteringServiceInstance: MeteringService | null = null;
const meteringServiceScope = new AsyncLocalStorage<MeteringService | null>();

/**
 * MeteringService 인스턴스 설정 (앱 부트스트랩에서 호출)
 */
export function setMeteringService(service: MeteringService | null): void {
  meteringServiceInstance = service;
}

export function clearMeteringService(): void {
  meteringServiceInstance = null;
}

export function runWithMeteringService<T>(service: MeteringService | null, fn: () => T): T {
  return meteringServiceScope.run(service, fn);
}

/**
 * MeteringService 인스턴스 조회
 */
export function getMeteringService(): MeteringService | null {
  return meteringServiceInstance;
}

function resolveMeteringService(): MeteringService | null {
  const scopedService = meteringServiceScope.getStore();
  return scopedService ?? meteringServiceInstance;
}

/**
 * @Metered 메서드 데코레이터
 *
 * @description
 * 메서드 호출 시 자동으로 Usage를 기록합니다.
 * 메서드 실행 후 MeteringService.record()를 호출합니다.
 * billing-required meter의 기록 실패는 원본 메서드가 완료된 뒤 전파되므로, 재시도 시 비즈니스 로직이
 * 반복될 수 있습니다. billing-required meter를 사용하는 구현은 자체 재시도 안전장치를 두고 원본
 * 비즈니스 로직의 멱등성을 보장해야 합니다.
 *
 * @example
 * ```typescript
 * const apiCalls = defineMeter({
 *   key: 'api.calls',
 *   aggregation: 'COUNT',
 *   unit: 'request',
 *   dimensions: {
 *     region: dimension.enum(['us', 'eu']),
 *   },
 *   billing: 'required',
 * });
 *
 * class ApiService {
 *   @Metered({
 *     meter: apiCalls,
 *     eventIdExtractor: ([request]) => (request as { eventId: string }).eventId,
 *     dimensionsExtractor: ([request]) => ({
 *       region: (request as { region: 'us' | 'eu' }).region,
 *     }),
 *   })
 *   async listUsers(request: { eventId: string; region: 'us' | 'eu' }): Promise<void> {
 *     // ...
 *   }
 *
 *   @Metered({ meterId: 'api_calls' })
 *   async handleRequest(req: Request): Promise<Response> {
 *     // ...
 *   }
 *
 *   @Metered({
 *     meterId: 'data_transfer',
 *     valueExtractor: (args, result) => (result as { size: number }).size,
 *   })
 *   async transferData(data: Buffer): Promise<{ size: number }> {
 *     // ...
 *   }
 * }
 * ```
 */
export function Metered<Meter extends CountMeterRef>(
  options: MeteredRefOptions<Meter>,
): MethodDecorator;
export function Metered(options: MeteredOptions): MethodDecorator;
export function Metered(
  options: MeteredOptions | MeteredRefOptions<CountMeterRef>,
): MethodDecorator {
  return (
    _target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const originalMethod = descriptor.value;

    const metadata: MeteredMetadata =
      "meter" in options
        ? {
            meterId: options.meter.key,
            meter: options.meter,
            valueExtractor: () => 1,
            eventIdExtractor: options.eventIdExtractor,
            dimensionsExtractor:
              options.dimensionsExtractor as MeteredMetadata["dimensionsExtractor"],
            metadataExtractor: options.metadataExtractor,
          }
        : {
            meterId: options.meterId,
            billing: options.billing,
            valueExtractor: options.valueExtractor ?? (() => 1),
            idempotencyKeyExtractor: options.idempotencyKeyExtractor,
            metadataExtractor: options.metadataExtractor,
          };

    // 메타데이터 저장 (선택적 조회용)
    Reflect.defineMetadata(METERED_METADATA_KEY, metadata, _target, propertyKey);

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const service = resolveMeteringService();
      const tenantId = (this as { tenantId?: string }).tenantId ?? "default";
      let billingRequirement =
        service && typeof service.getBillableUsageRequirement === "function"
          ? service.getBillableUsageRequirement(tenantId, metadata.meterId)
          : undefined;
      const declaredBillingRequired =
        metadata.meter?.billing === "required" || metadata.billing === "required";
      if (
        service &&
        billingRequirement === "unknown" &&
        typeof service.resolveBillableUsageRequirement === "function"
      ) {
        billingRequirement = await service.resolveBillableUsageRequirement(
          tenantId,
          metadata.meterId,
        );
      }
      if (service && billingRequirement === "unknown" && !declaredBillingRequired) {
        throw new InvalidUsageEnvelopeProblem(
          metadata.meterId,
          "meter billing contract must be loaded before @Metered execution",
        );
      }
      const billingRequired = declaredBillingRequired || billingRequirement === "required";
      if (!service && billingRequired) {
        throw new InvalidUsageEnvelopeProblem(
          metadata.meterId,
          "MeteringService is required for billable meters",
        );
      }
      let eventId: string | undefined;
      let idempotencyKey: string | undefined;
      if (billingRequired && metadata.meter) {
        eventId = metadata.eventIdExtractor?.(args);
      } else if (billingRequired) {
        idempotencyKey = metadata.idempotencyKeyExtractor?.(args);
      }
      if (billingRequired && !(eventId ?? idempotencyKey)?.trim()) {
        throw new InvalidUsageEnvelopeProblem(
          metadata.meterId,
          "billing-required meters require a non-empty eventId or idempotencyKey",
        );
      }
      // 원본 메서드 실행
      const result = await originalMethod.apply(this, args);

      // MeteringService가 설정되어 있으면 기록
      if (service) {
        try {
          if (metadata.meter) {
            const input = {
              tenantId,
              value: 1,
              eventId: eventId ?? metadata.eventIdExtractor?.(args),
              dimensions: metadata.dimensionsExtractor?.(args),
              metadata: metadata.metadataExtractor?.(args, result),
            } as unknown as MeterRecordInput<typeof metadata.meter>;
            await service.record(metadata.meter, input);
          } else {
            await service.record({
              tenantId,
              meterId: metadata.meterId,
              value: metadata.valueExtractor(args, result),
              idempotencyKey: idempotencyKey ?? metadata.idempotencyKeyExtractor?.(args),
              metadata: metadata.metadataExtractor?.(args, result),
            });
          }
        } catch (error) {
          if (billingRequired) {
            throw error;
          }

          // 계량 실패해도 원본 결과는 반환 (fail-safe)
          try {
            const logger = Container.get(LOGGER_TOKEN) as ILogger;
            logger.error(`Metering failed for ${String(propertyKey)}:`, error as Error);
          } catch {
            // Logger DI is unavailable; fallback to console.error so the error is not lost.
            // eslint-disable-next-line no-console
            console.error(`Metering failed for ${String(propertyKey)}:`, error);
          }
        }
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * 메서드에서 Metered 메타데이터 조회
 */
export function getMeteredMetadata(
  target: object,
  propertyKey: string | symbol,
): MeteredMetadata | undefined {
  return Reflect.getMetadata(METERED_METADATA_KEY, target, propertyKey);
}
