# @croco/telemetry-sdk-node

Node.js와 AWS Lambda에서 OpenTelemetry SDK를 초기화하는 런타임 패키지입니다. OTLP exporter, 샘플링, 자동 계측, flush 제어를 제공합니다.

## 설치

```bash
pnpm add @croco/telemetry-sdk-node
```

## 사용법

### 기본 초기화

```typescript
import { TelemetryRuntime } from '@croco/telemetry-sdk-node';

const telemetry = TelemetryRuntime.getInstance();
await telemetry.init({
  serviceName: 'orders',
  trace: {
    enabled: true,
    exporterUrl: 'http://localhost:4318/v1/traces',
  },
});
```

### Lambda 프리셋

```typescript
import { TelemetryRuntime, lambdaPreset } from '@croco/telemetry-sdk-node';

const telemetry = TelemetryRuntime.getInstance();
await telemetry.init(
  lambdaPreset({
    serviceName: 'orders',
    probability: 0.1,
  })
);
```

### 종료 전 flush

```typescript
const result = await telemetry.forceFlush(5000);
if (!result.success) {
  throw result.error ?? new Error('telemetry flush failed');
}
```

## API 레퍼런스

- `TelemetryRuntime`: `init`, `forceFlush`, `shutdown`, `isInitialized`, `getConfig`
- `lambdaPreset`: Lambda 환경 기본 설정 생성
- `ProbabilitySampler`: 확률 기반 샘플링 구현체
- 자동 계측: `normalizeAutoInstrumentationConfig`, `LAMBDA_DEFAULT_MODULES`, `NODE_DEFAULT_MODULES`
- Problem: `OtlpEndpointRequiredProblem`, `SamplerProblem`
- 타입: `TelemetryConfig`, `TraceConfig`, `MetricsConfig`, `LogsConfig`, `ForceFlushResult`
- 메트릭 타입: `MetricsApi`, `Counter`, `Histogram`, `Gauge`
- 로그 타입: `LogsApi`, `Logger`, `LogRecord`, `LogSeverity`

## Lambda 참고

- `AWS_LAMBDA_EXEC_WRAPPER` 방식은 사용하지 않습니다.
- 핸들러 바깥에서 `init()`을 호출합니다.
- 핸들러 종료 전에 `forceFlush()`를 호출합니다.
