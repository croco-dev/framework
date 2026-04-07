import { CrocoApp, createApp } from './libs/CrocoApp';
import { ErrorHandler } from './libs/ErrorHandler';
import type { HealthCheckRegistry } from './libs/HealthCheckRegistry';
import { HttpExecutionContext } from './libs/HttpExecutionContext';
import { ParamResolver } from './libs/ParamResolver';
import { PipelineRunner } from './libs/PipelineRunner';
import { RouteCompiler } from './libs/RouteCompiler';

export { toLambdaHandler } from './libs/adapters/LambdaAdapter';
export { startServer } from './libs/adapters/NodeAdapter';

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

export {
  getLambdaContext,
  getLambdaEvent,
  type LambdaExecutionEnv,
  type TypedLambdaHandler,
} from './libs/CrocoLambdaAdapter';
export type {
  HealthCheckFunction,
  HealthCheckOptions,
  HealthCheckResult,
  HealthCheckStatus,
} from './libs/HealthCheckRegistry';
export {
  type BodyLimitOptions,
  bodyLimitMiddleware,
  kb,
  mb,
} from './libs/middleware/BodyLimitMiddleware';
export {
  type CompressionEncoding,
  type CompressionOptions,
  compressionMiddleware,
} from './libs/middleware/CompressionMiddleware';
export { type CorsOptions, corsMiddleware } from './libs/middleware/CorsMiddleware';
export {
  type GracefulShutdownOptions,
  gracefulShutdownMiddleware,
  isShuttingDown,
  resetShutdownState,
  setupGracefulShutdown,
} from './libs/middleware/GracefulShutdownMiddleware';
export {
  createRateLimitMiddlewareFactory,
  type RateLimitHttpOptions,
  type RateLimitMiddlewareFactoryOptions,
  rateLimitHttpMiddleware,
} from './libs/middleware/RateLimitMiddleware';
export { type SecurityHeadersOptions, securityHeadersMiddleware } from './libs/middleware/SecurityHeadersMiddleware';
export type { PipelineConfig } from './libs/PipelineRunner';
export type { CompileOptions } from './libs/RouteCompiler';
