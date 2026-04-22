# ABC Group Refactoring - Learnings

## 2026-03-18 세션 시작

### 플랜 개요
- 13개 GitHub 이슈 (Groups A+B+C)
- 4개 Wave로 진행
- Critical Path: T1 → T2 → T4 → F1-F4 → P1

### 핵심 결정사항
1. **ILogger 인터페이스**: `(message, context?)` 시그니처 + `LOGGER_TOKEN`
2. **IBatchLoaderFactory**: `BatchLoaderLike`도 repository-core 소유 + `BATCH_LOADER_FACTORY_TOKEN`
3. **Container.get()**: 추상 계약만 토큰화, concrete class는 일반 injection
4. **Breaking Change**: 허용 (내부 프레임워크, 배포 전)
5. **테스트**: 각 변경 파일마다 `*.spec.ts` 추가

### Oracle CONDITIONAL 조건
- BatchLoader.prime()은 의도적으로 rejected promise 캐싱 → 동작 변경 금지, 로깅만 추가
- OTLP localhost fallback 제거 시 로컬 개발 환경 깨짐 → 명확한 에러 메시지 제공
- ILogger는 아직 존재하지 않음 → framework-context에 최소 인터페이스 생성 필요

## 2026-03-18 T1 ILogger

- `Logger`의 실제 교차 계층 시그니처는 `debug/info/warn(message, context?)`, `error(message, context?: Record<string, unknown> | Error)`, `child(bindings)` 패턴이다.
- `framework-context`에서는 `Token`을 `index.ts`에서 re-export하지만, 내부 `libs` 파일에서는 `typedi`에서 직접 가져오는 패턴이 가장 단순했다.
- `ILogger` 테스트는 런타임 인스턴스 생성보다 타입 제네릭 제약으로 `Logger` 호환성을 검증하면 `framework-config` 의존성 없이 최소 범위로 유지할 수 있다.

## 2026-03-18 T4 Container.get 기본 파라미터 제거

- concrete class 의존성(`ErrorHandler`, `HealthCheckRegistry`, `AuditLogRepository`)은 토큰화하지 않고 constructor 인자로 직접 전달하는 편이 노이즈가 적고 테스트 교체도 단순하다.
- logger만 추상 계약이므로 `ILogger` + `LOGGER_TOKEN`을 사용하고, composition root(`createApp`)에서 `Logger` concrete를 `LOGGER_TOKEN`에 한 번 연결한 뒤 하위 객체(`RouteCompiler`, `PipelineRunner`)로 전달하는 패턴이 맞다.
- `RouteCompiler`와 `PipelineRunner`처럼 원래 무인자 생성이던 클래스는 테스트에서 작은 factory helper를 두고 필요한 의존성만 조립하면 public 동작을 바꾸지 않고 명시적 주입으로 전환할 수 있다.

## 2026-03-18 T3 BatchLoad

- `repository-core`의 데코레이터가 하위 계층 구현을 직접 import하면 레이어가 새므로, `IBatchLoaderFactory`와 `BATCH_LOADER_FACTORY_TOKEN` 같은 추상 계약을 repository-core가 소유하고 구현체 패키지가 런타임에 등록하는 패턴이 안전하다.
- 데코레이터는 constructor injection이 불가능하므로 `Container.has()`로 등록 여부를 먼저 확인하고 `Container.get(token)` 실패를 명시적 Problem으로 감싸는 방식이 조용한 fallback 없이 의도를 드러낸다.
- `BatchLoaderLike`의 최소 계약을 repository-core에 두면 dataloader-core의 추가 메서드(loadMany/clear/prime)를 상위 레이어에 노출하지 않고도 context-scoped 캐시 동작을 유지할 수 있다.

## 2026-03-18 T2 LoggingInterceptor → ILogger + constructor injection

- `@Inject(LOGGER_TOKEN)` 데코레이터는 `@croco/framework-context`에서 import (`Inject`, `LOGGER_TOKEN` 모두 포함됨).
- `Pick<Logger, 'info'>` 기본 파라미터는 실제 DI보다 테스트 모킹이 어렵고, `Container.get(Logger)` 기본값은 레이어 위반(`protocols` → `framework-logger`)을 야기한다.
- `ILogger`는 인터페이스이므로 타입 기반 주입이 불가능하고 반드시 `@Inject(LOGGER_TOKEN)`을 사용해야 한다 (Oracle 조건).
- 테스트 파일에서도 `Logger` 대신 `ILogger`를 import하고, mock은 `Pick<ILogger, 'info'>`로 생성하면 타입 호환성을 유지할 수 있다.
Container.get singleton (cold) 벤치마크 p75: 0.2μs (2,407,808 samples)
