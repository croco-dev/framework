# 자기 진단(Self-Diagnosing) 서브시스템 가이드

## 목표

Croco 프레임워크 운영 중 발생하는 내부 상태 불일치, 컴포넌트 초기화 실패, 성능 저하 등의 문제를 실행 환경 내에서 실시간으로 파악할 수 있도록 돕습니다.

## 배경: 자기 진단 서브시스템이란

자기 진단 서브시스템은 프레임워크를 구성하는 주요 컴포넌트(Container, EventBus, Telemetry 등)가 스스로의 건강 상태와 오류 내역을 중앙 집중식으로 리포팅하는 기능입니다. 
외부 관측(Observability) 시스템의 사각지대나 초기화 과정의 문제를 빠르고 정확하게 진단하기 위해 설계되었습니다.

## 핵심 개념

- **`DiagnosticsProvider`**: 개별 컴포넌트나 모듈의 상태를 진단하고 리포팅하는 인터페이스입니다. 각 시스템 요소는 이 인터페이스를 구현하여 자신의 `HealthStatus`를 제공합니다.
- **`DiagnosticsCollector`**: 등록된 모든 `DiagnosticsProvider`를 순회하며 상태 정보를 수집합니다. 또한 프레임워크 전반에서 발생하는 중요한 내부 에러를 수집합니다.
- **`DiagnosticsReport`**: 수집기(`DiagnosticsCollector`)가 종합한 최종 진단 보고서 데이터 형식입니다. 컴포넌트 상태 배열과 최근 에러 이력을 포함합니다.

## 사용법: HTTP 엔드포인트

웹 서버나 Lambda 환경에서 다음 엔드포인트를 통해 진단 결과를 조회할 수 있습니다.

- **URL**: `GET /health/diagnostics`

응답 구조 예시:
```json
{
  "timestamp": "2026-05-16T12:00:00.000Z",
  "summary": "degraded",
  "components": [
    {
      "status": "degraded",
      "component": "EventBus",
      "message": "Some events failed to process",
      "details": { ... },
      "lastChecked": "2026-05-16T12:00:00.000Z"
    }
  ],
  "recentErrors": [
    {
      "timestamp": "2026-05-16T11:55:00.000Z",
      "code": "EVENT_PUBLISH_ERROR",
      "message": "Failed to publish event UserCreated. Details: ..."
    }
  ]
}
```

**보안 및 에러 제한**:
- 에러 메시지(`message`)의 노출을 통한 민감 정보 유출을 막기 위해 진단 결과의 오류 메시지는 최대 **100자**로 제한(cap)되며, Stack Trace는 절대 포함되지 않습니다.

## 환경변수 설정

진단 엔드포인트는 기본적으로 **비활성화**되어 있습니다. 사용하려면 다음 환경변수를 설정해야 합니다.

- `CROCO_DIAGNOSTICS_ENABLED`: `true`로 설정 시 `/health/diagnostics` 라우트가 활성화됩니다.
- `CROCO_DIAGNOSTICS_TOKEN`: 외부에서 이 엔드포인트를 호출할 때 필요한 인증 토큰입니다. (선택사항) 설정 시, 요청 헤더에 반드시 `X-Diagnostics-Token: <토큰값>`을 포함해야 합니다.

## Provider별 진단 정보

각 `DiagnosticsProvider`는 다음과 같은 정보를 수집합니다.

### TelemetryDiagnosticsProvider
- **수집 정보**: OTel SDK 초기화 여부(`isInitialized`), 현재 샘플링 확률(`probability`)
- **Degraded 조건**: 초기화에 실패하거나 외부 콜렉터 연결 등 추적 시스템 상태가 불안정할 때

### EventBusDiagnosticsProvider
- **수집 정보**: 현재 활성 구독자 수(`subscriberCount`), 누적 발행 횟수(`publishedCount`), 누적 실패 횟수(`failCount`)
- **Degraded 조건**: `failCount`가 비정상적으로 급증하거나 건강 상태가 나빠진 경우

### ContainerDiagnosticsProvider
- **수집 정보**: DI 컨테이너 초기화 여부(`isInitialized`), 등록된 서비스 개수(`registeredServiceCount`), 스코프별(singleton, request 등) 통계(`scopes`)
- **Degraded 조건**: 컨테이너가 정상적으로 초기화되지 않거나 필수 서비스 바인딩이 누락된 경우

### ModuleDiagnosticsProvider
- **수집 정보**: 등록된 모듈의 총 개수(`registeredModuleCount`), 초기화된 모듈 목록(`moduleList`)
- **Degraded 조건**: 필수 모듈의 부트스트랩이 실패하거나 초기화가 지연될 때

## ErrorHistoryRingBuffer

최근 발생한 내부 에러는 중앙 `ErrorHistoryRingBuffer`에 수집됩니다.

- 최대 **100개**의 슬롯을 갖는 원형 버퍼(Circular Buffer)로 구현되어 O(1) 성능을 보장하며, OOM(Out Of Memory) 위험이 없습니다.
- 새 에러가 발생하여 100개를 초과할 경우 가장 오래된 에러부터 순차적으로 자동 덮어쓰기 삭제가 일어납니다.
- 진단 리포트의 `recentErrors` 속성을 통해 최신순으로 조회할 수 있습니다.

## AWS Lambda 제약사항

Croco는 AWS Lambda에 최적화된 프레임워크입니다. Lambda 환경에서 진단 서브시스템을 활용할 때 다음 사항을 유의해야 합니다.

- **인메모리 기반**: 모든 통계치와 에러 이력은 메모리 상에 임시로 유지됩니다. 
- **Cold Start 리셋**: 새로운 Lambda 컨테이너가 프로비저닝(Cold Start)될 때마다 카운터와 링 버퍼 등 내부 상태는 모두 **리셋(초기화)**됩니다. 따라서 조회된 데이터는 현재 활성화된 특정 Lambda 인스턴스의 라이프사이클 내에서 발생한 정보입니다.

## 진단 시나리오 예제

### 시나리오 1: "Telemetry 데이터가 보이지 않을 때"

배포 후 외부 모니터링 대시보드에 Trace 정보가 보이지 않는다면 `/health/diagnostics`를 호출해 봅니다.
- `components` 배열에서 `TelemetryDiagnosticsProvider` 항목을 확인합니다.
- `details.isInitialized`가 `false`라면 환경변수 오류 등으로 인해 OTel SDK 초기화가 이뤄지지 않은 상태입니다.
- 초기화는 성공했지만 `details.probability`가 `0`으로 되어 있다면, 코드 레벨에서 샘플링 확률이 0%로 강제 드롭되고 있는지 확인해야 합니다.

### 시나리오 2: "이벤트가 처리되지 않을 때"

시스템 내에서 기대했던 비동기 이벤트 훅이 동작하지 않으면 다음을 진단합니다.
- `components` 배열에서 `EventBusDiagnosticsProvider` 상태를 점검합니다.
- `details.subscriberCount`가 `0`이라면, 서비스 모듈에서 이벤트 구독용 데코레이터나 함수 등록 과정이 제대로 실행되지 않은 것입니다.
- 반면 `subscriberCount`는 정상이나 `details.failCount`가 지속적으로 증가한다면, `recentErrors` 목록을 통해 어느 단계의 이벤트 핸들링에서 예외가 발생하고 있는지 100자 메시지와 에러 코드로 확인할 수 있습니다.
