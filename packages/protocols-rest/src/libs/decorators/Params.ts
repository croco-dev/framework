import "reflect-metadata";
import type { z } from "zod";
import { ParamType, REST_PARAMS_KEY } from "../constants";
import type { ParamMetadata } from "../types";
import { ValidationPipe } from "../validators/ValidationPipe";

function createParamDecorator(type: ParamType) {
  return (name?: string, schema?: z.ZodType): ParameterDecorator => {
    return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
      if (!propertyKey) return;

      const existingParams: Map<string | symbol, ParamMetadata[]> =
        Reflect.getMetadata(REST_PARAMS_KEY, target.constructor) || new Map();

      const methodParams = existingParams.get(propertyKey) || [];

      const param: ParamMetadata = {
        type,
        index: parameterIndex,
        name,
      };

      if (schema) {
        param.pipes = [new ValidationPipe(schema)];
      }

      methodParams.push(param);

      existingParams.set(propertyKey, methodParams);
      Reflect.defineMetadata(REST_PARAMS_KEY, existingParams, target.constructor);
    };
  };
}

/**
 * 경로 파라미터를 메서드 인자에 바인딩합니다.
 */
export const Param = (name: string, schema?: z.ZodType) =>
  createParamDecorator(ParamType.PARAM)(name, schema);

/**
 * 쿼리스트링 값을 메서드 인자에 바인딩합니다.
 */
export const Query = (name: string, schema?: z.ZodType) =>
  createParamDecorator(ParamType.QUERY)(name, schema);

/**
 * 요청 헤더 값을 메서드 인자에 바인딩합니다.
 */
export const Header = (name: string, schema?: z.ZodType) =>
  createParamDecorator(ParamType.HEADER)(name, schema);

/**
 * 요청 본문 전체를 메서드 인자에 바인딩합니다.
 */
export const Body = (schema?: z.ZodType): ParameterDecorator =>
  createParamDecorator(ParamType.BODY)(undefined, schema);

/**
 * 추상화된 HTTP 컨텍스트를 메서드 인자에 바인딩합니다.
 */
export const Ctx = (): ParameterDecorator => createParamDecorator(ParamType.CTX)();

/**
 * 전송 계층의 원본 요청 객체를 메서드 인자에 바인딩합니다.
 */
export const Raw = (): ParameterDecorator => createParamDecorator(ParamType.RAW)();
