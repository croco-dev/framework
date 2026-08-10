import "reflect-metadata";
import type { z } from "zod";
import { ParamType, REST_PARAMS_KEY } from "../constants";
import { captureRestDecoratorSourceLocation } from "../sourceLocation";
import type { ParamMetadata } from "../types";
import {
  hasRouteBodyContract,
  hasRouteParamsContract,
  hasRouteQueryContract,
  type RouteContractWithBody,
  type RouteContractWithParams,
  type RouteContractWithQuery,
  type RouteHandlerBody,
  type RouteHandlerPathParams,
  type RouteHandlerQuery,
  type RoutePathParamName,
} from "../types/RouteContract";
import { ValidationPipe } from "../validators/ValidationPipe";

type AnyZodObject = z.AnyZodObject;

function createParamDecorator(type: ParamType) {
  return (name?: string, schema?: z.ZodType): ParameterDecorator => {
    const sourceLocation = captureRestDecoratorSourceLocation();

    return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
      if (!propertyKey) return;

      const existingParams: Map<string | symbol, ParamMetadata[]> =
        Reflect.getMetadata(REST_PARAMS_KEY, target.constructor) || new Map();

      const methodParams = existingParams.get(propertyKey) || [];

      const param: ParamMetadata = {
        type,
        index: parameterIndex,
        name,
        ...(sourceLocation ? { sourceLocation } : {}),
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

type AnyMethod = (...args: never[]) => unknown;

type IsAny<T> = 0 extends 1 & T ? true : false;

type IsUnknown<T> =
  IsAny<T> extends true
    ? false
    : unknown extends T
      ? [keyof T] extends [never]
        ? true
        : false
      : false;

type IsEqual<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;

type IsGenericOrOverloaded<Method extends AnyMethod> =
  IsEqual<Method, (...args: Parameters<Method>) => ReturnType<Method>> extends true ? false : true;

type MethodAt<Target, Key extends PropertyKey> =
  Target extends Record<Key, infer Method extends AnyMethod> ? Method : never;

type TupleIndexes<Values extends readonly unknown[]> =
  Exclude<keyof Values, keyof (readonly unknown[])> extends infer Index
    ? Index extends `${infer NumericIndex extends number}`
      ? NumericIndex
      : never
    : never;

type AcceptedParameterIndexes<Method, Expected> = Method extends (
  ...args: infer Parameters
) => unknown
  ? {
      [Index in TupleIndexes<Parameters>]: IsAny<Parameters[Index]> extends true
        ? never
        : IsAny<Expected> extends true
          ? IsUnknown<Parameters[Index]> extends true
            ? Index
            : never
          : [Expected] extends [Parameters[Index]]
            ? Index
            : never;
    }[TupleIndexes<Parameters>]
  : never;

type IsStaticTarget<Target> = Target extends { readonly prototype: object } ? true : false;

/**
 * Ensures the parsed contract output is assignable to the decorated parameter annotation.
 *
 * The method target is inferred before the parameter index is checked so an `any`
 * annotation cannot satisfy the contract through ordinary function assignability.
 */
type ContractParameterDecorator<Expected> = <
  Target extends object,
  Key extends PropertyKey,
  Index extends number,
>(
  target: Target & Record<Key, AnyMethod>,
  propertyKey: Key,
  parameterIndex: Index &
    (IsStaticTarget<Target> extends true
      ? never
      : IsGenericOrOverloaded<MethodAt<Target, Key>> extends true
        ? never
        : Index extends AcceptedParameterIndexes<MethodAt<Target, Key>, Expected>
          ? unknown
          : never),
) => void;

/**
 * 경로 파라미터를 메서드 인자에 바인딩합니다.
 */
export function Param<
  TContract extends RouteContractWithParams,
  Name extends RoutePathParamName<TContract["path"]> &
    keyof RouteHandlerPathParams<TContract> &
    string,
>(
  contract: TContract,
  name: Name,
): ContractParameterDecorator<RouteHandlerPathParams<TContract>[Name]>;
export function Param(name: string, schema?: z.ZodType): ParameterDecorator;
export function Param(
  nameOrContract: string | RouteContractWithParams,
  schemaOrName?: z.ZodType | string,
): unknown {
  if (hasRouteParamsContract(nameOrContract)) {
    const name = schemaOrName as keyof RouteHandlerPathParams<typeof nameOrContract> & string;

    return createParamDecorator(ParamType.PARAM)(name, getObjectShape(nameOrContract.params)[name]);
  }

  return createParamDecorator(ParamType.PARAM)(nameOrContract, schemaOrName as z.ZodType);
}

/**
 * 쿼리스트링 값을 메서드 인자에 바인딩합니다.
 */
export function Query<
  TContract extends RouteContractWithQuery,
  Name extends keyof RouteHandlerQuery<TContract> & string,
>(contract: TContract, name: Name): ContractParameterDecorator<RouteHandlerQuery<TContract>[Name]>;
export function Query(name: string, schema?: z.ZodType): ParameterDecorator;
export function Query(
  nameOrContract: string | RouteContractWithQuery,
  schemaOrName?: z.ZodType | string,
): unknown {
  if (hasRouteQueryContract(nameOrContract)) {
    const name = schemaOrName as keyof RouteHandlerQuery<typeof nameOrContract> & string;

    return createParamDecorator(ParamType.QUERY)(name, getObjectShape(nameOrContract.query)[name]);
  }

  return createParamDecorator(ParamType.QUERY)(nameOrContract, schemaOrName as z.ZodType);
}

/**
 * 요청 헤더 값을 메서드 인자에 바인딩합니다.
 */
export const Header = (name: string, schema?: z.ZodType) =>
  createParamDecorator(ParamType.HEADER)(name, schema);

/**
 * 요청 본문 전체를 메서드 인자에 바인딩합니다.
 */
export function Body<TContract extends RouteContractWithBody>(
  contract: TContract,
): ContractParameterDecorator<RouteHandlerBody<TContract>>;
export function Body(schema?: z.ZodType): ParameterDecorator;
export function Body(schemaOrContract?: z.ZodType | RouteContractWithBody): unknown {
  const schema = hasRouteBodyContract(schemaOrContract) ? schemaOrContract.body : schemaOrContract;

  return createParamDecorator(ParamType.BODY)(undefined, schema);
}

/**
 * 추상화된 HTTP 컨텍스트를 메서드 인자에 바인딩합니다.
 */
export const Ctx = (): ParameterDecorator => createParamDecorator(ParamType.CTX)();

/**
 * 전송 계층의 원본 요청 객체를 메서드 인자에 바인딩합니다.
 */
export const Raw = (): ParameterDecorator => createParamDecorator(ParamType.RAW)();

function getObjectShape(schema: AnyZodObject): z.ZodRawShape {
  return schema.shape;
}
