import { AsyncLocalStorage } from "node:async_hooks";
import "reflect-metadata";
import type { ILogger } from "@croco/framework-context";
import { Container, LOGGER_TOKEN } from "@croco/framework-context";
import type {
  MeterAggregationOf,
  MeterBillingOf,
  MeterDimensionsOf,
  MeterRef,
} from "../MeterDefinition";
import { isMeterRef } from "../MeterDefinition";
import type { MeteringService } from "../MeteringService";
import { InvalidMeterDefinitionProblem } from "../problems/InvalidMeterDefinitionProblem";

export const METERED_METADATA_KEY = Symbol("meter:metered");

export type LegacyMeteredOptions = {
  meterId: string;
  valueExtractor?: (args: unknown[], result: unknown) => number;
  idempotencyKeyExtractor?: (args: unknown[]) => string | undefined;
  metadataExtractor?: (args: unknown[], result: unknown) => Record<string, unknown> | undefined;
};

type TypedMeteredValidity<TMeter extends MeterRef> = TMeter extends unknown
  ? MeterAggregationOf<TMeter> extends "COUNT"
    ? MeterBillingOf<TMeter> extends "local"
      ? keyof MeterDimensionsOf<TMeter> extends never
        ? true
        : false
      : false
    : false
  : never;

export type TypedMeteredOptions<TMeter extends MeterRef> =
  false extends TypedMeteredValidity<TMeter>
    ? never
    : {
        readonly meter: TMeter;
        readonly metadataExtractor?: (
          args: unknown[],
          result: unknown,
        ) => Record<string, unknown> | undefined;
      };

export type MeteredOptions = LegacyMeteredOptions;

export type MeteredMetadata = {
  meterId: string;
  meter?: MeterRef;
  valueExtractor: (args: unknown[], result: unknown) => number;
  idempotencyKeyExtractor?: (args: unknown[]) => string | undefined;
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
 *
 * @example
 * ```typescript
 * class ApiService {
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
export function Metered<const TMeter extends MeterRef>(
  options: TypedMeteredOptions<TMeter>,
): MethodDecorator;
export function Metered(options: LegacyMeteredOptions): MethodDecorator;
export function Metered(
  options: LegacyMeteredOptions | { readonly meter: MeterRef },
): MethodDecorator {
  const meter = "meter" in options ? options.meter : undefined;
  if (meter !== undefined) {
    if (!isMeterRef(meter)) {
      throw new InvalidMeterDefinitionProblem(
        "meter",
        "must be a MeterRef returned by defineMeter()",
      );
    }
    if (
      meter.descriptor.aggregation !== "COUNT" ||
      meter.descriptor.billing !== "local" ||
      Object.keys(meter.descriptor.dimensions).length > 0
    ) {
      throw new InvalidMeterDefinitionProblem(
        "meter",
        "must be a dimensionless local COUNT meter when used with @Metered",
      );
    }
  }

  return (
    _target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const originalMethod = descriptor.value;

    const metadata: MeteredMetadata = {
      meterId: meter?.descriptor.key ?? (options as LegacyMeteredOptions).meterId,
      meter,
      valueExtractor: (options as LegacyMeteredOptions).valueExtractor ?? (() => 1),
      idempotencyKeyExtractor: (options as LegacyMeteredOptions).idempotencyKeyExtractor,
      metadataExtractor: (
        options as {
          readonly metadataExtractor?: (
            args: unknown[],
            result: unknown,
          ) => Record<string, unknown> | undefined;
        }
      ).metadataExtractor,
    };

    // 메타데이터 저장 (선택적 조회용)
    Reflect.defineMetadata(METERED_METADATA_KEY, metadata, _target, propertyKey);

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      // 원본 메서드 실행
      const result = await originalMethod.apply(this, args);

      // MeteringService가 설정되어 있으면 기록
      const service = resolveMeteringService();
      if (service) {
        const tenantId = (this as { tenantId?: string }).tenantId ?? "default";

        try {
          if (metadata.meter) {
            const recordTyped = service.record as unknown as (
              meterRef: MeterRef,
              input: unknown,
            ) => Promise<unknown>;
            await recordTyped(metadata.meter, {
              tenantId,
              metadata: metadata.metadataExtractor?.(args, result),
            });
          } else {
            await service.record({
              tenantId,
              meterId: metadata.meterId,
              value: metadata.valueExtractor(args, result),
              idempotencyKey: metadata.idempotencyKeyExtractor?.(args),
              metadata: metadata.metadataExtractor?.(args, result),
            });
          }
        } catch (error) {
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
