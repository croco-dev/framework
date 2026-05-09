/**
 * 컨트롤러 메타데이터를 저장하는 Reflect 키입니다.
 */
export const REST_CONTROLLER_KEY = Symbol.for('croco:rest:controller');

/**
 * 라우트 메타데이터 목록을 저장하는 Reflect 키입니다.
 */
export const REST_ROUTES_KEY = Symbol.for('croco:rest:routes');

/**
 * 파라미터 바인딩 메타데이터를 저장하는 Reflect 키입니다.
 */
export const REST_PARAMS_KEY = Symbol.for('croco:rest:params');

/**
 * Guard 메타데이터를 저장하는 Reflect 키입니다.
 */
export const REST_GUARDS_KEY = Symbol.for('croco:rest:guards');

/**
 * Pipe 메타데이터를 저장하는 Reflect 키입니다.
 */
export const REST_PIPES_KEY = Symbol.for('croco:rest:pipes');

/**
 * Interceptor 메타데이터를 저장하는 Reflect 키입니다.
 */
export const REST_INTERCEPTORS_KEY = Symbol.for('croco:rest:interceptors');

/**
 * Exception Filter 메타데이터를 저장하는 Reflect 키입니다.
 */
export const REST_FILTERS_KEY = Symbol.for('croco:rest:filters');

/**
 * 역할 메타데이터를 저장하는 Reflect 키입니다.
 */
export const REST_ROLES_KEY = Symbol.for('croco:rest:roles');

export const RESPONSE_SCHEMA_KEY = Symbol.for('croco:rest:responseSchema');

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  OPTIONS = 'OPTIONS',
  HEAD = 'HEAD',
  ALL = 'ALL',
}

export enum ParamType {
  PARAM = 'param',
  QUERY = 'query',
  HEADER = 'header',
  BODY = 'body',
  CTX = 'ctx',
  RAW = 'raw',
}

export type ParamSource = 'param' | 'query' | 'header' | 'body';
