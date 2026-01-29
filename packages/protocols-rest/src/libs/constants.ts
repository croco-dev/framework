export const REST_CONTROLLER_KEY = Symbol('croco:rest:controller');
export const REST_ROUTES_KEY = Symbol('croco:rest:routes');
export const REST_PARAMS_KEY = Symbol('croco:rest:params');
export const REST_GUARDS_KEY = Symbol('croco:rest:guards');
export const REST_PIPES_KEY = Symbol('croco:rest:pipes');
export const REST_INTERCEPTORS_KEY = Symbol('croco:rest:interceptors');
export const REST_FILTERS_KEY = Symbol('croco:rest:filters');
export const REST_ROLES_KEY = Symbol('croco:rest:roles');

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
