export const REST_CONTROLLER_KEY = Symbol.for('croco:rest:controller');
export const REST_ROUTES_KEY = Symbol.for('croco:rest:routes');
export const REST_PARAMS_KEY = Symbol.for('croco:rest:params');
export const REST_GUARDS_KEY = Symbol.for('croco:rest:guards');
export const REST_PIPES_KEY = Symbol.for('croco:rest:pipes');
export const REST_INTERCEPTORS_KEY = Symbol.for('croco:rest:interceptors');
export const REST_FILTERS_KEY = Symbol.for('croco:rest:filters');
export const REST_ROLES_KEY = Symbol.for('croco:rest:roles');

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
