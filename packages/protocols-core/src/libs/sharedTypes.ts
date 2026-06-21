import type { ProblemCategory } from "@croco/problems-core";
import type { z } from "zod";

/**
 * @croco/protocols-rest와 동일한 Symbol.for() 키를 사용합니다.
 * Symbol.for()는 전역 Symbol 레지스트리를 사용하므로 별도 import 없이
 * @croco/protocols-rest가 저장한 Reflect metadata를 읽을 수 있습니다.
 */
export const REST_CONTROLLER_KEY = Symbol.for("croco:rest:controller");
export const REST_ROUTES_KEY = Symbol.for("croco:rest:routes");
export const REST_PARAMS_KEY = Symbol.for("croco:rest:params");
export const REST_GUARDS_KEY = Symbol.for("croco:rest:guards");
export const REST_ROLES_KEY = Symbol.for("croco:rest:roles");
export const PROBLEM_RESPONSES_KEY = Symbol.for("croco:rest:problemResponses");
export const ENTITLEMENT_REQUIRED_KEY = "entitlement:required";
export const ENTITLEMENT_REQUIREMENTS_KEY = Symbol.for("croco:entitlements:requirements");

export enum ParamType {
  PARAM = "param",
  QUERY = "query",
  HEADER = "header",
  BODY = "body",
  CTX = "ctx",
  RAW = "raw",
}

export type Constructor<T = unknown> = new (...args: unknown[]) => T;

export interface ControllerMetadata {
  path: string;
  target: Function;
}

export interface RouteMetadata {
  method: string;
  path: string;
  methodName: string | symbol;
  statusCode?: number;
  contract?: RouteContractMetadata;
}

export type RouteContractSourceLocation = {
  readonly path: string;
  readonly line?: number;
  readonly column?: number;
};

export type RouteContractProblemMetadata = {
  readonly code: string;
  readonly category: ProblemCategory;
  readonly status?: number;
  readonly description?: string;
  readonly type?: string;
};

export type RouteContractMetadata = {
  readonly id?: string;
  readonly method: string;
  readonly path: string;
  readonly operationId?: string;
  readonly sourceLocation?: RouteContractSourceLocation;
  readonly params?: z.AnyZodObject;
  readonly query?: z.AnyZodObject;
  readonly body?: z.ZodType;
  readonly response?: z.ZodType;
  readonly problems?: readonly RouteContractProblemMetadata[];
};

export type ProblemResponseMetadata = RouteContractProblemMetadata & {
  readonly routeContractProblems?: readonly RouteContractProblemMetadata[];
};

export type EntitlementResourceRequirementMetadata = {
  readonly type: string;
  readonly id?: string;
  readonly idParam?: string;
};

export type EntitlementRequirementMetadata = {
  readonly feature: string;
  readonly description?: string;
  readonly resource?: EntitlementResourceRequirementMetadata;
};

export interface ParamMetadata {
  type: ParamType;
  index: number;
  name?: string;
  pipes?: unknown[];
}
