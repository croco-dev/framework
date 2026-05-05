/**
 * @croco/protocols-rest와 동일한 Symbol.for() 키를 사용합니다.
 * Symbol.for()는 전역 Symbol 레지스트리를 사용하므로 별도 import 없이
 * @croco/protocols-rest가 저장한 Reflect metadata를 읽을 수 있습니다.
 */
export const REST_CONTROLLER_KEY = Symbol.for('croco:rest:controller');
export const REST_ROUTES_KEY = Symbol.for('croco:rest:routes');
export const REST_PARAMS_KEY = Symbol.for('croco:rest:params');

export enum ParamType {
  PARAM = 'param',
  QUERY = 'query',
  HEADER = 'header',
  BODY = 'body',
  CTX = 'ctx',
  RAW = 'raw',
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
}

export interface ParamMetadata {
  type: ParamType;
  index: number;
  name?: string;
  pipes?: unknown[];
}
