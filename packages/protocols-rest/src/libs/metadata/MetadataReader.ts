import "reflect-metadata";
import { ProblemFactory } from "@croco/problems-core";
import {
  REST_CONTROLLER_KEY,
  REST_FILTERS_KEY,
  REST_GUARDS_KEY,
  REST_INTERCEPTORS_KEY,
  REST_PARAMS_KEY,
  REST_PIPES_KEY,
  REST_ROUTES_KEY,
} from "../constants";
import type {
  Constructor,
  ControllerMetadata,
  ExceptionFilterConstructor,
  GuardConstructor,
  InterceptorConstructor,
  ParamMetadata,
  PipeTransformConstructor,
  RouteMetadata,
} from "../types";

/**
 * 클래스에 등록된 컨트롤러 메타데이터를 조회합니다.
 */
export function getControllerMeta(target: Constructor): ControllerMetadata | undefined {
  return Reflect.getMetadata(REST_CONTROLLER_KEY, target);
}

/**
 * 클래스에 등록된 라우트 메타데이터 배열을 조회합니다.
 */
export function getRouteMeta(target: Constructor): RouteMetadata[] {
  return Reflect.getMetadata(REST_ROUTES_KEY, target) || [];
}

/**
 * 메서드 파라미터 바인딩 메타데이터를 조회합니다.
 */
export function getParamsMeta(target: Constructor, methodName: string | symbol): ParamMetadata[] {
  const paramsMap: Map<string | symbol, ParamMetadata[]> =
    Reflect.getMetadata(REST_PARAMS_KEY, target) || new Map();
  const params = paramsMap.get(methodName) || [];
  const seenIndexes = new Set<number>();

  for (const param of params) {
    if (seenIndexes.has(param.index)) {
      throw ProblemFactory.internalServerError(
        "protocols-rest/duplicate-parameter-index",
        `Duplicate parameter metadata detected for ${String(methodName)} at index ${param.index}`,
      );
    }

    seenIndexes.add(param.index);
  }

  return params;
}

/**
 * 클래스 또는 메서드에 등록된 Guard 목록을 조회합니다.
 */
export function getGuards(target: Constructor, methodName?: string | symbol): GuardConstructor[] {
  const classGuards: GuardConstructor[] = Reflect.getMetadata(REST_GUARDS_KEY, target) || [];
  if (methodName) {
    const methodGuards: GuardConstructor[] =
      Reflect.getMetadata(REST_GUARDS_KEY, target, methodName) || [];
    return [...classGuards, ...methodGuards];
  }
  return classGuards;
}

/**
 * 클래스 또는 메서드에 등록된 Pipe 목록을 조회합니다.
 */
export function getPipes(
  target: Constructor,
  methodName?: string | symbol,
): PipeTransformConstructor[] {
  const classPipes: PipeTransformConstructor[] = Reflect.getMetadata(REST_PIPES_KEY, target) || [];
  if (methodName) {
    const methodPipes: PipeTransformConstructor[] =
      Reflect.getMetadata(REST_PIPES_KEY, target, methodName) || [];
    return [...classPipes, ...methodPipes];
  }
  return classPipes;
}

/**
 * 클래스 또는 메서드에 등록된 Interceptor 목록을 조회합니다.
 */
export function getInterceptors(
  target: Constructor,
  methodName?: string | symbol,
): InterceptorConstructor[] {
  const classInterceptors: InterceptorConstructor[] =
    Reflect.getMetadata(REST_INTERCEPTORS_KEY, target) || [];
  if (methodName) {
    const methodInterceptors: InterceptorConstructor[] =
      Reflect.getMetadata(REST_INTERCEPTORS_KEY, target, methodName) || [];
    return [...classInterceptors, ...methodInterceptors];
  }
  return classInterceptors;
}

/**
 * 클래스 또는 메서드에 등록된 Exception Filter 목록을 조회합니다.
 */
export function getFilters(
  target: Constructor,
  methodName?: string | symbol,
): ExceptionFilterConstructor[] {
  const classFilters: ExceptionFilterConstructor[] =
    Reflect.getMetadata(REST_FILTERS_KEY, target) || [];
  if (methodName) {
    const methodFilters: ExceptionFilterConstructor[] =
      Reflect.getMetadata(REST_FILTERS_KEY, target, methodName) || [];
    return [...classFilters, ...methodFilters];
  }
  return classFilters;
}

/**
 * 대상 클래스가 REST 컨트롤러인지 판별합니다.
 */
export function isController(target: Constructor): boolean {
  return !!getControllerMeta(target);
}
