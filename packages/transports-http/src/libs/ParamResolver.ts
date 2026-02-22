import { Container } from '@croco/framework-context';
import {
  type ArgumentMetadata,
  type Constructor,
  getParamsMeta,
  type ParamMetadata,
  ParamType,
  type PipeTransform,
  type PipeTransformConstructor,
} from '@croco/protocols-rest';
import type { CrocoHttpContext } from './types';

const PARAM_TYPE_MAP: Record<ParamType, ArgumentMetadata['type']> = {
  [ParamType.PARAM]: 'param',
  [ParamType.QUERY]: 'query',
  [ParamType.BODY]: 'body',
  [ParamType.HEADER]: 'header',
  [ParamType.CTX]: 'custom',
  [ParamType.RAW]: 'custom',
};

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
      const rawValue = await this.resolveParam(ctx, param, cachedBody);
      args[param.index] = await this.runPipes(rawValue, param);
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

  private async runPipes(value: unknown, param: ParamMetadata): Promise<unknown> {
    if (!param.pipes || param.pipes.length === 0) {
      return value;
    }

    const metadata: ArgumentMetadata = {
      type: PARAM_TYPE_MAP[param.type] ?? 'custom',
      name: param.name,
    };

    let result = value;
    for (const PipeClass of param.pipes) {
      const pipe: PipeTransform = this.resolvePipe(PipeClass);
      result = await pipe.transform(result, metadata);
    }

    return result;
  }

  private resolvePipe(PipeClass: PipeTransformConstructor): PipeTransform {
    try {
      return Container.get(PipeClass);
    } catch {
      return new PipeClass();
    }
  }
}
