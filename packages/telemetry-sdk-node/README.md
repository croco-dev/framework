# @croco/telemetry-sdk-node

Node.js와 AWS Lambda에서 OpenTelemetry SDK를 초기화하는 런타임 패키지입니다. OTLP exporter, 샘플링, 자동 계측, flush 제어를 제공합니다.

## 설치

```bash
pnpm add @croco/telemetry-sdk-node
```

## 사용법

### 기본 초기화

```typescript
import { TelemetryRuntime } from "@croco/telemetry-sdk-node";

const telemetry = TelemetryRuntime.getInstance();
await telemetry.init({
  serviceName: "orders",
  trace: {
    enabled: true,
    exporterUrl: "http://localhost:4318/v1/traces",
  },
});
```

### Lambda 프리셋

```typescript
import { TelemetryRuntime, lambdaPreset } from "@croco/telemetry-sdk-node";

const telemetry = TelemetryRuntime.getInstance();
await telemetry.init(
  lambdaPreset({
    serviceName: "orders",
    probability: 0.1,
  }),
);
```

### 종료 전 flush

```typescript
const result = await telemetry.forceFlush(5000);
if (!result.success) {
  throw result.error ?? new Error("telemetry flush failed");
}
```

`@croco/transports-http`의 Lambda handler와 함께 사용할 때는 handler flush callback에 연결합니다.
flush 실패는 handler 실패로 전파되어 trace export 실패가 성공 응답처럼 숨겨지지 않습니다.

```typescript
export const handler = app.lambdaHandler({
  flush: async () => {
    const result = await telemetry.forceFlush(5000);
    if (!result.success) {
      throw result.error ?? new Error("telemetry flush failed");
    }
  },
});
```

### 초기화 수명주기

`init({ enabled: false })`와 `init({ trace: { enabled: false } })`는 설정만 저장하고 OpenTelemetry SDK를 시작하지
않습니다. 같은 프로세스에서 나중에 telemetry와 trace를 활성화한 `init()`을 호출하면 SDK를 초기화할 수 있습니다.

SDK가 이미 초기화된 뒤의 추가 `init()` 호출은 기존 런타임을 유지합니다. 설정을 바꾸려면 먼저 `shutdown()`을
호출한 뒤 다시 `init()`을 호출합니다.

`isInitialized()`와 `isEnabled()`는 SDK가 실제로 초기화되어 활성화된 경우에만 `true`를 반환합니다.

### Degraded mode와 복구

Telemetry 또는 trace가 의도적으로 꺼진 상태는 애플리케이션 실패가 아닙니다. `init({ enabled: false })`,
`init({ trace: { enabled: false } })`, 또는 `TELEMETRY_ENABLED=false`는 설정을 보존하지만 SDK와 exporter를 시작하지
않으며,
`TelemetryDiagnosticsProvider`는 이를 `degraded` 상태와 안전한 metadata(`serviceName`, `enabled`,
`initialized`, `traceEnabled`, `probability`, `mode`)로 보고합니다. exporter URL이나 header 값은 diagnostics에
노출하지 않습니다.

Trace export를 켠 상태에서 OTLP endpoint가 없으면 초기화가 fail-closed 됩니다. `trace.enabled: false`로 명시해
무자격 로컬 실행을 허용하거나, `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`/`OTEL_EXPORTER_OTLP_ENDPOINT` 또는
`trace.exporterUrl`을 설정한 뒤 다시 초기화하세요.

Exporter나 SDK 시작 실패는 `TelemetryRuntimeProblem`으로 정규화됩니다. 같은 프로세스에서 복구하려면 원인을 수정한
뒤 `shutdown()`을 호출하거나 실패한 초기화가 반환된 후 다시 `init()`을 호출합니다. 실패한 초기화는 processor를
남기지 않으므로 `forceFlush()`는 no-op 성공으로 안전하게 끝납니다.

Lambda에서는 handler 작업이 끝난 뒤 `forceFlush()` 결과를 확인하세요. Trace export 실패를 요청 성공처럼 숨기면 안
되는 경로에서는 `result.success === false`일 때 `result.error`를 throw 합니다. Telemetry를 명시적으로 비활성화한
환경에서는 `forceFlush()`가 no-op 성공을 반환하므로 비즈니스 요청 처리를 막지 않습니다.

## API 레퍼런스

- `TelemetryRuntime`: `init`, `forceFlush`, `shutdown`, `isInitialized`, `isEnabled`, `getConfig`
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
