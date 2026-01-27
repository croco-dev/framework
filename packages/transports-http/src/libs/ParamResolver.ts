import { type Constructor, getParamsMeta, type ParamMetadata, ParamType } from '@croco/protocols-rest';
import type { CrocoHttpContext } from './types';

export class ParamResolver {
  async resolveParams(ctx: CrocoHttpContext, controller: Constructor, methodName: string | symbol): Promise<unknown[]> {
    const paramsMeta = getParamsMeta(controller, methodName);

    if (paramsMeta.length === 0) {
      return [];
    }

    const sortedParams = [...paramsMeta].sort((a, b) => a.index - b.index);
    const maxIndex = Math.max(...sortedParams.map((p) => p.index));
    const args: unknown[] = new Array(maxIndex + 1).fill(undefined);

    for (const param of sortedParams) {
      args[param.index] = await this.resolveParam(ctx, param);
    }

    return args;
  }

  private async resolveParam(ctx: CrocoHttpContext, param: ParamMetadata): Promise<unknown> {
    switch (param.type) {
      case ParamType.PARAM:
        return param.name ? ctx.param(param.name) : undefined;

      case ParamType.QUERY:
        return param.name ? ctx.query(param.name) : undefined;

      case ParamType.HEADER:
        return param.name ? ctx.header(param.name) : undefined;

      case ParamType.BODY:
        return ctx.json();

      case ParamType.CTX:
        return ctx;

      case ParamType.RAW:
        return ctx.raw;

      default:
        return undefined;
    }
  }
}
