import type { Constructor, ExecutionContext } from '@croco/protocols-rest';
import type { CrocoHttpContext } from './types';

export class HttpExecutionContext implements ExecutionContext {
  constructor(
    private readonly ctx: CrocoHttpContext,
    private readonly controllerClass: Constructor,
    private readonly handlerName: string | symbol
  ) {}

  getRequest(): Request {
    // Hono의 raw context에서 Request 추출
    return this.ctx.raw.req.raw;
  }

  getClass(): Constructor {
    return this.controllerClass;
  }

  getHandler(): string | symbol {
    return this.handlerName;
  }

  getPath(): string {
    return this.ctx.req.path;
  }

  getMethod(): string {
    return this.ctx.req.method;
  }

  getHttpContext(): CrocoHttpContext {
    return this.ctx;
  }
}
