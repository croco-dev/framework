/**
 * 타입 안전한 서비스 식별자를 생성하는 TypeDI Token 클래스입니다.
 *
 * @param name - `new Token(name)` 생성자에 전달하는 디버깅용 이름입니다.
 * @returns 의존성 식별에 사용할 `Token<T>` 클래스 참조를 반환합니다.
 *
 * @example
 * ```typescript
 * import { Token } from '@croco/framework-context';
 *
 * const apiKeyToken = new Token<string>('config.apiKey');
 * ```
 */
// biome-ignore assist/source/organizeImports: keep export split for per-symbol TSDoc
export { Token } from "typedi";

/**
 * 클래스 프로퍼티 또는 생성자 파라미터에 의존성을 주입하는 TypeDI 데코레이터입니다.
 *
 * @param token - 선택적 주입 식별자입니다. 생략하면 타입 메타데이터를 사용합니다.
 * @returns 프로퍼티 또는 파라미터 데코레이터 함수를 반환합니다.
 *
 * @example
 * ```typescript
 * import { Inject } from '@croco/framework-context';
 *
 * class Repository {}
 *
 * class UserService {
 *   @Inject()
 *   private readonly repository!: Repository;
 * }
 * ```
 */
export { Inject } from "./libs/decorators/Inject";

/**
 * 컴포넌트 scope에 맞춰 의존성을 조회하고 관리하는 DI 컨테이너 클래스입니다.
 *
 * @param token - `Container.get(token)` 호출 시 조회할 생성자 토큰입니다.
 * @returns 의존성 조회와 등록에 사용하는 `Container` 클래스 참조를 반환합니다.
 *
 * @example
 * ```typescript
 * import { Component, Container } from '@croco/framework-context';
 *
 * @Component()
 * class UserService {}
 *
 * const service = Container.get(UserService);
 * ```
 */
export { Container } from "./libs/Container";

export { ContainerDiagnosticsProvider } from "./libs/diagnostics/ContainerDiagnosticsProvider";
export {
  DEV_INSPECTOR_TOKEN,
  RuntimeInspector,
  finishRuntimeInspectionRequest,
  recordRuntimeInspectionEvent,
  startRuntimeInspectionRequest,
} from "./libs/RuntimeInspector";

/**
 * TypeDI 컨테이너 인스턴스 타입입니다.
 *
 * @returns 개별 컨테이너 인스턴스의 타입 정의를 반환합니다.
 *
 * @example
 * ```typescript
 * import { ContainerInstance } from '@croco/framework-context';
 *
 * function setup(container: ContainerInstance) {
 *   container.set('key', value);
 * }
 * ```
 */
export { ContainerInstance } from "typedi";

/**
 * 요청 단위 컨텍스트를 실행하고 조회하는 AsyncLocalStorage 기반 유틸리티 클래스입니다.
 *
 * @param context - `Context.run(context, fn)`에 전달할 요청 컨텍스트입니다.
 * @returns 현재 실행 컨텍스트의 값 조회와 실행에 사용할 `Context` 클래스 참조를 반환합니다.
 *
 * @example
 * ```typescript
 * import { Context } from '@croco/framework-context';
 *
 * const requestId = await Context.run({ requestId: 'req-123' }, async () => {
 *   return Context.getRequestId();
 * });
 * ```
 */
export { Context } from "./libs/Context";

/**
 * 현재 실행 중인 트랜잭션 컨텍스트를 식별하는 DI 토큰입니다.
 *
 * @example
 * ```typescript
 * import { Container, TRANSACTION_CONTEXT_TOKEN } from '@croco/framework-context';
 *
 * const context = Container.get(TRANSACTION_CONTEXT_TOKEN);
 * ```
 */
export { TRANSACTION_CONTEXT_TOKEN } from "./libs/TransactionContext";

/**
 * 클래스를 Croco DI 컨테이너에 등록하는 컴포넌트 데코레이터입니다.
 *
 * @param options - 컴포넌트 등록 옵션입니다.
 * @returns 클래스 데코레이터를 반환합니다.
 *
 * @example
 * ```typescript
 * import { Component } from '@croco/framework-context';
 *
 * @Component({ scope: 'request' })
 * class RequestScopedService {}
 * ```
 */
export { Component } from "./libs/decorators/Component";

/**
 * 애플리케이션 종료 시 실행할 shutdown 훅을 등록하는 데코레이터입니다.
 *
 * @param 없음 - 클래스 또는 메서드에 인자 없이 적용합니다.
 * @returns 클래스 또는 메서드 데코레이터를 반환합니다.
 *
 * @example
 * ```typescript
 * import { OnShutdown } from '@croco/framework-context';
 *
 * class AppService {
 *   @OnShutdown()
 *   async onShutdown(): Promise<void> {}
 * }
 * ```
 */
export { OnShutdown } from "./libs/decorators/OnShutdown";

/**
 * 심볼 키 기반으로 메타데이터를 저장하고 조회하는 저장소 인스턴스입니다.
 *
 * @param key - `MetadataStorage.define()` 또는 `MetadataStorage.get()`에 사용할 메타데이터 키입니다.
 * @returns 메타데이터 정의와 조회 API를 제공하는 `MetadataStorage` 인스턴스를 반환합니다.
 *
 * @example
 * ```typescript
 * import { MetadataStorage } from '@croco/framework-context';
 *
 * const key = Symbol('sample');
 * class Sample {}
 *
 * MetadataStorage.define(key, Sample, { enabled: true });
 * const metadata = MetadataStorage.get<{ enabled: boolean }>(key, Sample);
 * ```
 */
export { MetadataStorage } from "./libs/MetadataStorage";

/**
 * 프레임워크 로거 인스턴스를 등록하고 조회할 때 사용하는 DI 토큰입니다.
 *
 * @example
 * ```typescript
 * import { Container, LOGGER_TOKEN } from '@croco/framework-context';
 *
 * Container.set(LOGGER_TOKEN, logger);
 * ```
 */
export { LOGGER_TOKEN } from "./libs/ILogger";

/**
 * 요청 컨텍스트에 미들웨어를 순차 실행하는 onion 패턴 체인 클래스입니다.
 *
 * @param middleware - `chain.use(middleware)`에 등록할 미들웨어 함수입니다.
 * @returns 미들웨어 등록과 실행에 사용하는 `MiddlewareChain` 클래스 참조를 반환합니다.
 *
 * @example
 * ```typescript
 * import { MiddlewareChain } from '@croco/framework-context';
 *
 * const chain = new MiddlewareChain<{ requestId: string }>();
 * chain.use(async (_ctx, next) => {
 *   await next();
 * });
 *
 * await chain.execute({ requestId: 'req-123' });
 * ```
 */
export { MiddlewareChain } from "./libs/Middleware";

/**
 * 종료 훅을 등록하고 프로세스 시그널에서 graceful shutdown을 실행하는 매니저 클래스입니다.
 *
 * @param hook - `manager.register(hook)`로 등록할 shutdown 훅입니다.
 * @returns 종료 훅 등록과 실행을 관리하는 `ShutdownManager` 클래스 참조를 반환합니다.
 *
 * @example
 * ```typescript
 * import { ShutdownManager } from '@croco/framework-context';
 *
 * const manager = ShutdownManager.getInstance();
 * manager.register({
 *   onShutdown: async () => {},
 * });
 * manager.listen();
 * ```
 */
export { ShutdownManager } from "./libs/ShutdownManager";
export {
  ContainerResolutionProblem,
  ContainerScopeMismatchProblem,
} from "./libs/problems/ContainerResolutionProblem";
export { CircularDependencyProblem } from "./libs/problems/CircularDependencyProblem";
export { MiddlewareProblem } from "./libs/problems/MiddlewareProblems";
export {
  ShutdownConfigurationConflictProblem,
  ShutdownTimeoutProblem,
} from "./libs/problems/ShutdownProblems";

/**
 * 컴포넌트 등록 시 내부적으로 사용하는 메타데이터 타입입니다.
 *
 * @property scope - 컴포넌트 생명주기 범위입니다.
 * @property target - 등록 대상 생성자입니다.
 *
 * @example
 * ```typescript
 * import type { ComponentMetadata } from '@croco/framework-context';
 *
 * const metadata: ComponentMetadata = {
 *   scope: 'singleton',
 *   target: class Service {},
 * };
 * ```
 */
export type { ComponentMetadata } from "./libs/types";

export type { ContainerResolutionFailureReason } from "./libs/problems/ContainerResolutionProblem";

export type {
  DependencyProviderKind,
  DependencyResolutionStep,
  DependencyResolutionStepStatus,
  DependencyResolutionTrace,
  DependencyResolutionTraceStatus,
  DependencyTokenKind,
} from "./libs/types";

/**
 * `@Component` 데코레이터에 전달하는 컴포넌트 옵션 타입입니다.
 *
 * @property [scope] - 컴포넌트 생명주기 범위입니다.
 *
 * @example
 * ```typescript
 * import type { ComponentOptions } from '@croco/framework-context';
 *
 * const options: ComponentOptions = {
 *   scope: 'request',
 * };
 * ```
 */
export type { ComponentOptions } from "./libs/types";

/**
 * 인스턴스를 생성할 수 있는 생성자 시그니처 타입입니다.
 *
 * @property prototype - 생성자 프로토타입입니다.
 *
 * @example
 * ```typescript
 * import type { Constructor } from '@croco/framework-context';
 *
 * class UserService {}
 *
 * const target: Constructor<UserService> = UserService;
 * ```
 */
export type { Constructor } from "./libs/types";

export type {
  RuntimeCapabilities,
  RuntimeContext,
  RuntimeInspectorRecorder,
  RuntimeInspectorRecorderEventInput,
  RuntimeNativeContext,
  RuntimePlatform,
  RuntimeTraceContext,
} from "./libs/types";
export type {
  RuntimeInspectionOutcome,
  RuntimeInspectionRecord,
  RuntimeInspectorEventInput,
  RuntimeInspectorEventKind,
  RuntimeInspectorEventOutcome,
  RuntimeInspectorFailureReporter,
  RuntimeInspectorOptions,
  RuntimeInspectorRequestFinish,
  RuntimeInspectorRequestStart,
  RuntimeInspectorSnapshot,
  RuntimeInspectorTimelineEvent,
} from "./libs/RuntimeInspector";

/**
 * 요청 라이프사이클 전후와 에러 상황에 실행할 훅 타입입니다.
 *
 * @property [onRequestStart] - 요청 시작 시 호출됩니다.
 * @property [onRequestEnd] - 요청 성공 종료 시 호출됩니다.
 * @property [onRequestError] - 요청 에러 발생 시 호출됩니다.
 *
 * @example
 * ```typescript
 * import type { LifecycleHooks } from '@croco/framework-context';
 *
 * const hooks: LifecycleHooks = {
 *   onRequestStart: async (ctx) => {
 *     void ctx.requestId;
 *   },
 * };
 * ```
 */
export type { LifecycleHooks } from "./libs/types";

/**
 * 컨텍스트와 `next` 함수를 받아 실행되는 미들웨어 함수 타입입니다.
 *
 * @property length - 함수 선언 파라미터 개수입니다.
 *
 * @example
 * ```typescript
 * import type { Middleware } from '@croco/framework-context';
 *
 * const middleware: Middleware = async (_ctx, next) => {
 *   await next();
 * };
 * ```
 */
export type { Middleware } from "./libs/types";

/**
 * 요청 단위로 전달되는 공통 컨텍스트 타입입니다.
 *
 * @property requestId - 요청 고유 식별자입니다.
 * @property [user] - 현재 사용자 정보입니다.
 * @property [tenantId] - 멀티 테넌트 식별자입니다.
 * @property [traceId] - 분산 추적 식별자입니다.
 *
 * @example
 * ```typescript
 * import type { RequestContext } from '@croco/framework-context';
 *
 * const ctx: RequestContext = {
 *   requestId: 'req-123',
 *   tenantId: 'tenant-a',
 * };
 * ```
 */
export type { RequestContext } from "./libs/types";
export type { TransactionContext } from "./libs/TransactionContext";

/**
 * 컴포넌트 인스턴스 생명주기를 정의하는 scope 타입입니다.
 *
 * @property singleton - 애플리케이션 전역 단일 인스턴스입니다.
 * @property request - 요청 컨텍스트 단위 인스턴스입니다.
 * @property transient - 요청마다 새로 생성되는 인스턴스입니다.
 *
 * @example
 * ```typescript
 * import type { Scope } from '@croco/framework-context';
 *
 * const scope: Scope = 'singleton';
 * ```
 */
export type { Scope } from "./libs/types";

/**
 * graceful shutdown 단계에서 호출되는 훅 인터페이스 타입입니다.
 *
 * @property onShutdown - 종료 시 실행되는 비동기 정리 함수입니다.
 *
 * @example
 * ```typescript
 * import type { ShutdownHook } from '@croco/framework-context';
 *
 * const hook: ShutdownHook = {
 *   onShutdown: async () => {},
 * };
 * ```
 */
export type { ShutdownHook } from "./libs/types";

/**
 * 요청을 계속 처리할 수 있는지 판단하는 Guard 인터페이스입니다.
 *
 * @typeParam TContext - Guard 실행 컨텍스트 타입입니다.
 * @returns 요청을 계속 진행하면 true를 반환합니다.
 *
 * @example
 * ```typescript
 * import type { Guard } from '@croco/framework-context';
 *
 * const guard: Guard<{ userId: string }> = {
 *   canActivate(context) {
 *     return context.userId !== undefined;
 *   },
 * };
 * ```
 */
export type { Guard } from "./libs/Guard";

/**
 * Croco 전역 로거가 따라야 하는 최소 인터페이스 타입입니다.
 *
 * @example
 * ```typescript
 * import type { ILogger } from '@croco/framework-context';
 *
 * const logger: ILogger = {
 *   info: () => undefined,
 *   warn: () => undefined,
 *   error: () => undefined,
 *   debug: () => undefined,
 * };
 * ```
 */
export type { ILogger } from "./libs/ILogger";
