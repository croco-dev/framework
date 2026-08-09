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

### Batch processor 조정

`trace.batchTimeout`은 `0`부터 `2_147_483_647`까지의 정수이며, `trace.batchCount`와
`trace.batchSize`는 `1`부터 `2_147_483_647`까지의 정수입니다. 유효 기본값을 적용한 뒤에도
`batchSize`는 `batchCount`보다 클 수 없습니다. 위반하면 OpenTelemetry SDK나 exporter를 만들기 전에
`TelemetryBatchConfigurationProblem`이 실패한 필드, 제약, 수신값과 함께 발생합니다.

### 자동 계측

`trace.autoInstrumentation`을 설정하면 Node 환경에서는 HTTP/HTTPS, Express, DNS, Net 계측이 기본으로
`NodeSDK`에 전달됩니다. `lambdaPreset()`은 HTTP/HTTPS, AWS SDK, AWS Lambda 계측을 자동으로 활성화합니다.
OpenTelemetry가 HTTP와 HTTPS에 하나의 공용 계측기를 제공하므로 `http`와 `https`는 항상 함께 선택하거나 함께
제외해야 하며, 부분 선택은 초기화 전에 명시적으로 실패합니다.

```typescript
await telemetry.init({
  serviceName: "orders",
  trace: {
    exporterUrl: "http://localhost:4318/v1/traces",
    autoInstrumentation: {
      modules: ["http", "https", "express", "pg"],
      excludeModules: ["express"],
      moduleOptions: {
        pg: { enhancedDatabaseReporting: true },
      },
    },
  },
});
```

`trace.instrumentations`의 custom 인스턴스가 먼저 적용되며, 같은 `instrumentationName`의 자동 인스턴스를
대체합니다. 그 다음 `autoInstrumentation.customInstrumentations`, 자동 인스턴스 순서로 병합되고, 각 이름의 첫
custom 인스턴스만 유지됩니다. `enabled: false`는 자동 인스턴스를 만들지 않습니다.

Upstream Node 자동 계측이 공통으로 실행할 수 없는 operation `include`/`exclude` 필터, 설치된 번들에 없는 모듈,
선택되지 않은 모듈의 options는 `TelemetryAutoInstrumentationProblem`으로 SDK 시작 전에 거부됩니다. Diagnostics에는
활성화된 OpenTelemetry 모듈 이름만 노출되고 exporter URL, header, 요청 데이터는 포함되지 않습니다.

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
import { TelemetryForceFlushUnsupportedProblem } from "@croco/telemetry-sdk-node";

const result = await telemetry.forceFlush(5000);
if (result.outcome === "failed") {
  throw result.error;
}
if (result.outcome === "unsupported") {
  throw new TelemetryForceFlushUnsupportedProblem();
}
```

`@croco/transports-http`의 Lambda handler와 함께 사용할 때는 handler flush callback에 연결합니다.
flush 실패는 handler 실패로 전파되어 trace export 실패가 성공 응답처럼 숨겨지지 않습니다.

```typescript
import { TelemetryForceFlushUnsupportedProblem } from "@croco/telemetry-sdk-node";

export const handler = app.lambdaHandler({
  flush: async () => {
    const result = await telemetry.forceFlush(5000);
    if (result.outcome === "failed") {
      throw result.error;
    }
    if (result.outcome === "unsupported") {
      throw new TelemetryForceFlushUnsupportedProblem();
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

### 지원 신호

이 패키지의 실행 가능한 신호 계약은 trace입니다. `TelemetryConfig`에는 `trace`만 존재하며 metrics/logs 설정과
`MetricsApi`/`LogsApi` façade를 제공하지 않습니다. 애플리케이션 메트릭에는 `@croco/metrics-core` 같은 도메인 계약을
사용하고, OTLP metrics/logs provider가 필요한 경우에는 해당 OpenTelemetry SDK를 애플리케이션에서 명시적으로
구성하세요.

### Degraded mode와 복구

Telemetry 또는 trace가 의도적으로 꺼진 상태는 애플리케이션 실패가 아닙니다. `init({ enabled: false })`,
`init({ trace: { enabled: false } })`, 또는 `TELEMETRY_ENABLED=false`는 설정을 보존하지만 SDK와 exporter를 시작하지
않으며,
`TelemetryDiagnosticsProvider`는 이를 `degraded` 상태와 안전한 metadata(`serviceName`, `enabled`,
`initialized`, `traceEnabled`, `probability`, `signals`, `autoInstrumentationModules`, `mode`)로 보고합니다. `signals`는
trace가 `supported`인지 `disabled`인지 구분합니다. exporter URL이나 header 값은 diagnostics에 노출하지 않습니다.

Trace export를 켠 상태에서 OTLP endpoint가 없으면 초기화가 fail-closed 됩니다. `trace.enabled: false`로 명시해
무자격 로컬 실행을 허용하거나, `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`/`OTEL_EXPORTER_OTLP_ENDPOINT` 또는
`trace.exporterUrl`을 설정한 뒤 다시 초기화하세요.

Exporter나 SDK 시작 실패는 `TelemetryRuntimeProblem`으로 정규화됩니다. 같은 프로세스에서 복구하려면 원인을 수정한
뒤 실패한 초기화가 반환된 후 다시 `init()`을 호출합니다. 초기화와 동시에 `shutdown()`을 호출하면 shutdown도 원래
초기화 오류로 실패하므로 초기화 실패가 성공적인 종료처럼 숨겨지지 않습니다.

Lambda에서는 handler 작업이 끝난 뒤 `forceFlush()` 결과를 확인하세요. Trace export 실패를 요청 성공처럼 숨기면 안
되는 경로에서는 `failed` 결과의 `error`를 throw 하고, `unsupported`는 초기화 누락으로 처리합니다. Telemetry를
명시적으로 비활성화한 환경은 `skipped`, 실제 processor가 flush를 마친 경우만 `completed`입니다.

프로세스를 종료하거나 같은 런타임 인스턴스를 새 설정으로 다시 초기화하기 전에는 `shutdown()`을 호출합니다. 실제 SDK
종료는 `completed`, 명시적 비활성화는 `skipped`, SDK가 없는 pre-init 상태는 `unsupported`입니다. `shutdown()`이
`completed`를 반환한 뒤에는 새 `init()` 호출로 trace runtime을 다시 시작할 수 있습니다.

## API 레퍼런스

- `TelemetryRuntime`: `init`, `forceFlush`, `shutdown`, `isInitialized`, `isEnabled`, `getConfig`
- `lambdaPreset`: Lambda 환경 기본 설정 생성
- `ProbabilitySampler`: 확률 기반 샘플링 구현체
- 자동 계측: `normalizeAutoInstrumentationConfig`, `LAMBDA_DEFAULT_MODULES`, `NODE_DEFAULT_MODULES`
- Problem: `OtlpEndpointRequiredProblem`, `SamplerProblem`, `TelemetryAutoInstrumentationProblem`,
  `TelemetryBatchConfigurationProblem`
- 타입: `TelemetryConfig`, `TraceConfig`, `ForceFlushResult`, `ShutdownResult`, `TelemetryLifecycleSkipReason`,
  `TelemetryBatchConfigurationField`, `TelemetryBatchConfigurationConstraint`

## Lambda 참고

- `AWS_LAMBDA_EXEC_WRAPPER` 방식은 사용하지 않습니다.
- 핸들러 바깥에서 `init()`을 호출합니다.
- 핸들러 종료 전에 `forceFlush()`를 호출합니다.
