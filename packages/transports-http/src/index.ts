import { CrocoApp, createApp } from './libs/CrocoApp';
import { ErrorHandler } from './libs/ErrorHandler';
import type { HealthCheckRegistry } from './libs/HealthCheckRegistry';
import { HttpExecutionContext } from './libs/HttpExecutionContext';
import { ParamResolver } from './libs/ParamResolver';
import { PipelineRunner } from './libs/PipelineRunner';
import { RouteCompiler } from './libs/RouteCompiler';

/**
 * AWS Lambda(API Gateway v2) 이벤트를 Croco HTTP 앱에 연결하는 핸들러를 생성합니다.
 */
export { toLambdaHandler } from './libs/adapters/LambdaAdapter';

/**
 * Node.js 환경에서 Croco HTTP 앱을 실행하는 서버 시작 유틸리티입니다.
 */
export { startServer } from './libs/adapters/NodeAdapter';

/**
 * transports-http 구성과 실행에 사용되는 핵심 타입 집합입니다.
 */
export type {
  AppConfig,
  CompiledRoute,
  CrocoHttpContext,
  CrocoRequest,
  CrocoResponse,
  FilterProvider,
  GuardProvider,
  InterceptorProvider,
  LambdaContext,
  LambdaEvent,
  LambdaEventWithAuthorizer,
  LambdaHandler,
  LambdaRequestContext,
  LambdaRequestContextWithAuthorizer,
  LambdaResponse,
  MiddlewareFunction,
  PipeProvider,
} from './libs/types';

/**
 * Croco HTTP 앱의 핵심 런타임 API입니다.
 */
export {
  CrocoApp,
  createApp,
  ErrorHandler,
  type HealthCheckRegistry,
  HttpExecutionContext,
  ParamResolver,
  PipelineRunner,
  RouteCompiler,
};

/**
 * 헬스 체크 레지스트리 작성/응답에 사용하는 타입 집합입니다.
 */
export type {
  HealthCheckFunction,
  HealthCheckOptions,
  HealthCheckResult,
  HealthCheckStatus,
} from './libs/HealthCheckRegistry';

/**
 * CORS 미들웨어 및 옵션 타입입니다.
 */
export { type CorsOptions, corsMiddleware } from './libs/middleware/CorsMiddleware';

/**
 * 보안 헤더 미들웨어 및 옵션 타입입니다.
 */
export { type SecurityHeadersOptions, securityHeadersMiddleware } from './libs/middleware/SecurityHeadersMiddleware';

/**
 * 파이프라인 실행기 구성 타입입니다.
 */
export type { PipelineConfig } from './libs/PipelineRunner';

/**
 * 라우트 컴파일러 구성 타입입니다.
 */
export type { CompileOptions } from './libs/RouteCompiler';
