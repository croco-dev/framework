import 'reflect-metadata';
import { Container } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import type { MeteringService } from '../MeteringService';

export const METERED_METADATA_KEY = Symbol('meter:metered');

export type MeteredOptions = {
  meterId: string;
  valueExtractor?: (args: unknown[], result: unknown) => number;
  idempotencyKeyExtractor?: (args: unknown[]) => string | undefined;
  metadataExtractor?: (args: unknown[], result: unknown) => Record<string, unknown> | undefined;
};

export type MeteredMetadata = {
  meterId: string;
  valueExtractor: (args: unknown[], result: unknown) => number;
  idempotencyKeyExtractor?: (args: unknown[]) => string | undefined;
  metadataExtractor?: (args: unknown[], result: unknown) => Record<string, unknown> | undefined;
};

// MeteringService 인스턴스를 저장할 전역 변수 (DI 컨테이너에서 설정)
let meteringServiceInstance: MeteringService | null = null;

/**
 * MeteringService 인스턴스 설정 (앱 부트스트랩에서 호출)
 */
export function setMeteringService(service: MeteringService): void {
  meteringServiceInstance = service;
}

/**
 * MeteringService 인스턴스 조회
 */
export function getMeteringService(): MeteringService | null {
  return meteringServiceInstance;
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
export function Metered(options: MeteredOptions): MethodDecorator {
  return (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;

    const metadata: MeteredMetadata = {
      meterId: options.meterId,
      valueExtractor: options.valueExtractor ?? (() => 1),
      idempotencyKeyExtractor: options.idempotencyKeyExtractor,
      metadataExtractor: options.metadataExtractor,
    };

    // 메타데이터 저장 (선택적 조회용)
    Reflect.defineMetadata(METERED_METADATA_KEY, metadata, _target, propertyKey);

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      // 원본 메서드 실행
      const result = await originalMethod.apply(this, args);

      // MeteringService가 설정되어 있으면 기록
      const service = getMeteringService();
      if (service) {
        const tenantId = (this as { tenantId?: string }).tenantId ?? 'default';

        try {
          await service.record({
            tenantId,
            meterId: metadata.meterId,
            value: metadata.valueExtractor(args, result),
            idempotencyKey: metadata.idempotencyKeyExtractor?.(args),
            metadata: metadata.metadataExtractor?.(args, result),
          });
        } catch (error) {
          // 계량 실패해도 원본 결과는 반환 (fail-safe)
          try {
            const logger = Container.get(Logger);
            logger.error(`Metering failed for ${String(propertyKey)}:`, error as Error);
          } catch {
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
export function getMeteredMetadata(target: object, propertyKey: string | symbol): MeteredMetadata | undefined {
  return Reflect.getMetadata(METERED_METADATA_KEY, target, propertyKey);
}
