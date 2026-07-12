import { ProblemFactory } from "@croco/problems-core";
import { getHttpParamFallbackSchema, isZodType } from "@croco/protocols-core";
import {
  type ArgumentMetadata,
  type Constructor,
  getParamsMeta,
  type ParamMetadata,
  ParamType,
  type PipeTransform,
  type PipeTransformConstructor,
  RequestValidationProblem,
  ValidationPipe,
} from "@croco/protocols-rest";
import type { z } from "zod";
import type { CrocoHttpContext } from "./types";

const PARAM_TYPE_MAP: Record<ParamType, ArgumentMetadata["type"]> = {
  [ParamType.PARAM]: "param",
  [ParamType.QUERY]: "query",
  [ParamType.BODY]: "body",
  [ParamType.HEADER]: "header",
  [ParamType.CTX]: "custom",
  [ParamType.RAW]: "custom",
};

const BODY_PARSE_FAILURE_MESSAGE = "Request body must contain valid JSON";

const SCHEMALESS_NAMED_PARAM_PIPES: Partial<Record<ParamType, PipeTransform>> = {
  [ParamType.QUERY]: new ValidationPipe(getHttpParamFallbackSchema("query")),
  [ParamType.HEADER]: new ValidationPipe(getHttpParamFallbackSchema("header")),
};

/**
 * 컨트롤러 파라미터 메타데이터를 읽어 실제 메서드 인자 배열로 변환합니다.
 */
export class ParamResolver {
  private static readonly PARSED_BODY_PROMISE_KEY = "@croco/transports-http:parsed-body-promise";

  constructor(
    private readonly createPipeInstance: (
      pipe: PipeTransformConstructor,
    ) => PipeTransform | null | undefined = () => undefined,
  ) {}

  async resolveParams(
    ctx: CrocoHttpContext,
    controller: Constructor,
    methodName: string | symbol,
  ): Promise<unknown[]> {
    const paramsMeta = getParamsMeta(controller, methodName);

    if (paramsMeta.length === 0) {
      return [];
    }

    const sortedParams = [...paramsMeta].sort((a, b) => a.index - b.index);
    const maxIndex = Math.max(...sortedParams.map((p) => p.index));
    const args: unknown[] = Array.from({ length: maxIndex + 1 }).fill(undefined) as unknown[];
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

    const bodyPromise = this.parseBody(ctx);
    ctx.set(ParamResolver.PARSED_BODY_PROMISE_KEY, bodyPromise);

    return bodyPromise;
  }

  private async parseBody(ctx: CrocoHttpContext): Promise<unknown> {
    try {
      return await ctx.json();
    } catch {
      throw new RequestValidationProblem("body", [
        {
          path: "value",
          message: BODY_PARSE_FAILURE_MESSAGE,
        },
      ]);
    }
  }

  private async resolveParam(
    ctx: CrocoHttpContext,
    param: ParamMetadata,
    cachedBody: unknown,
  ): Promise<unknown> {
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
    const metadata: ArgumentMetadata = {
      type: PARAM_TYPE_MAP[param.type] ?? "custom",
      ...(param.name ? { name: param.name } : {}),
    };

    if (!param.pipes || param.pipes.length === 0) {
      const fallbackPipe = param.name ? SCHEMALESS_NAMED_PARAM_PIPES[param.type] : undefined;
      return fallbackPipe ? fallbackPipe.transform(value, metadata) : value;
    }

    let result = value;
    for (const pipe of param.pipes) {
      const pipeInstance: PipeTransform = this.resolvePipe(pipe);
      result = await pipeInstance.transform(result, metadata);
    }

    return result;
  }

  private resolvePipe(pipe: PipeTransformConstructor | PipeTransform | z.ZodType): PipeTransform {
    if (isZodType(pipe)) {
      return new ValidationPipe(pipe);
    }

    if (typeof pipe === "object" && pipe !== null) {
      return pipe as PipeTransform;
    }

    const pipeInstance = this.createPipeInstance(pipe as PipeTransformConstructor);
    if (pipeInstance == null) {
      throw ProblemFactory.internalServerError(
        "transports-http/pipe-resolution-failed",
        `Container did not return an instance for pipe ${pipe.name}`,
      );
    }

    return pipeInstance;
  }
}
