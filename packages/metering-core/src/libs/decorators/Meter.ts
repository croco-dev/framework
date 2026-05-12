import "reflect-metadata";
import type { MeterType } from "../types";

export const METER_METADATA_KEY = Symbol("meter:definition");

export type MeterOptions = {
  meterId: string;
  type?: MeterType;
  quota?: number;
  allowOverQuota?: boolean;
};

export type MeterMetadata = {
  meterId: string;
  type: MeterType;
  quota?: number;
  allowOverQuota: boolean;
};

/**
 * @Meter 클래스 데코레이터
 *
 * @description
 * 클래스에 Meter 정의를 메타데이터로 저장합니다.
 * 앱 시작 시 MeterRegistry에 자동 등록될 수 있습니다.
 *
 * @example
 * ```typescript
 * @Meter({ meterId: 'api_calls', type: 'COUNT', quota: 1000 })
 * class ApiController {
 *   // ...
 * }
 * ```
 */
export function Meter(options: MeterOptions): ClassDecorator {
  return (target: Function) => {
    const metadata: MeterMetadata = {
      meterId: options.meterId,
      type: options.type ?? "COUNT",
      quota: options.quota,
      allowOverQuota: options.allowOverQuota ?? false,
    };

    Reflect.defineMetadata(METER_METADATA_KEY, metadata, target);
  };
}

/**
 * 클래스에서 Meter 메타데이터 조회
 */
export function getMeterMetadata(target: Function): MeterMetadata | undefined {
  return Reflect.getMetadata(METER_METADATA_KEY, target);
}

/**
 * Meter 메타데이터가 있는지 확인
 */
export function hasMeterMetadata(target: Function): boolean {
  return Reflect.hasMetadata(METER_METADATA_KEY, target);
}
