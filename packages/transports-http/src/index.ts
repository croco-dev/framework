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
  LambdaHandler,
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
export type {
  HealthCheckFunction,
  HealthCheckOptions,
  HealthCheckResult,
  HealthCheckStatus,
} from './libs/HealthCheckRegistry';
export type { PipelineConfig } from './libs/PipelineRunner';
export type { CompileOptions } from './libs/RouteCompiler';
