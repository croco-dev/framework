import { type Constructor, getParamsMeta, type ParamMetadata, ParamType } from '@croco/protocols-rest';
import type { CrocoHttpContext } from './types';

export class ParamResolver {
  private static readonly PARSED_BODY_PROMISE_KEY = '@croco/transports-http:parsed-body-promise';

  async resolveParams(ctx: CrocoHttpContext, controller: Constructor, methodName: string | symbol): Promise<unknown[]> {
    const paramsMeta = getParamsMeta(controller, methodName);

    if (paramsMeta.length === 0) {
      return [];
    }

    const sortedParams = [...paramsMeta].sort((a, b) => a.index - b.index);
    const maxIndex = Math.max(...sortedParams.map((p) => p.index));
    const args: unknown[] = new Array(maxIndex + 1).fill(undefined);
    const cachedBody = await this.resolveBody(ctx, sortedParams);

    for (const param of sortedParams) {
      args[param.index] = await this.resolveParam(ctx, param, cachedBody);
    }

    return args;
  }

  private async resolveBody(ctx: CrocoHttpContext, params: ParamMetadata[]): Promise<unknown> {
    const hasBodyParam = params.some((param) => param.type === ParamType.BODY);
    if (!hasBodyParam) {
      return undefined;
    }

    const cachedBodyPromise = ctx.get<Promise<unknown>>(ParamResolver.PARSED_BODY_PROMISE_KEY);
    if (cachedBodyPromise) {
      return cachedBodyPromise;
    }

    const bodyPromise = ctx.json();
    ctx.set(ParamResolver.PARSED_BODY_PROMISE_KEY, bodyPromise);

    return bodyPromise;
  }

  private async resolveParam(ctx: CrocoHttpContext, param: ParamMetadata, cachedBody: unknown): Promise<unknown> {
    switch (param.type) {
      case ParamType.PARAM:
        return param.name ? ctx.param(param.name) : undefined;

      case ParamType.QUERY:
        return param.name ? ctx.query(param.name) : undefined;

      case ParamType.HEADER:
        return param.name ? ctx.header(param.name) : undefined;

      case ParamType.BODY:
        return cachedBody;

      case ParamType.CTX:
        return ctx;

      case ParamType.RAW:
        return ctx.raw;

      default:
        return undefined;
    }
  }
}
