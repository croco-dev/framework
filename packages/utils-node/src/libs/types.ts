/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import type { Application } from 'express';
import type { Container, ContainerInstance } from 'typedi';

export interface BootstrapConfig {
  configureApp?: (app: Application) => void | Promise<void>;
  containerSetup?: Array<() => void | Promise<void>>;
  controllers?: Function[];
  routePrefix?: string;
  validation?: boolean;
  middlewares?: Function[];
  onBootstrap?: (app: Application, container: typeof Container) => void | Promise<void>;
  onShutdown?: () => void | Promise<void>;
}

export interface ServerConfig {
  port?: number;
}

export type JobConstructor<TData = unknown, TResult = unknown> = new (
  ...args: unknown[]
) => {
  execute: (data: TData) => Promise<TResult> | TResult;
};

export interface WorkerConfig<TData = unknown, TResult = unknown> {
  containerSetup?: Array<(container: ContainerInstance) => void | Promise<void>>;
  onWorkerBootstrap?: (container: ContainerInstance) => void | Promise<void>;
  onWorkerShutdown?: () => void | Promise<void>;
  beforeJobExecution?: (job: string, data: TData) => void | Promise<void>;
  afterJobExecution?: (job: string, data: TData, result?: TResult) => void | Promise<void>;
  onJobError?: (job: string, data: TData, error: Error) => void | Promise<void>;

  /**
   * Resolve a job name to a Job class/constructor (TypeDI token).
   * Example: name => JobRegistry.getJob(name)
   */
  getJob: (job: string) => JobConstructor<TData, TResult>;
}
