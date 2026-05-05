import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  type RouteConfig,
} from '@asteasolutions/zod-to-openapi';
import { extractRouteIR, type ParamIR, type RouteIR } from '@croco/protocols-core';
import { type ZodType, z } from 'zod';

extendZodWithOpenApi(z);

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'] as const;

type OpenAPIDocument = ReturnType<OpenApiGeneratorV31['generateDocument']>;
type HttpMethod = (typeof HTTP_METHODS)[number];
type ControllerConstructor = new (...args: unknown[]) => unknown;
type OpenAPIParamLocation = 'path' | 'query' | 'header';

export function emitOpenAPI(controllers: Function[]): OpenAPIDocument {
  const registry = new OpenAPIRegistry();
  const routes = controllers.flatMap((controller) => extractRouteIR(controller as ControllerConstructor));

  routes.forEach((route) => {
    registry.registerPath(toRouteConfig(route));
  });

  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Croco API',
      version: '1.0.0',
      license: {
        name: 'MIT',
        identifier: 'MIT',
      },
    },
    servers: [{ url: 'https://api.croco.dev' }],
    security: [],
    tags: toTags(routes),
  });
}

function toRouteConfig(route: RouteIR): RouteConfig {
  return {
    method: toHttpMethod(route.httpMethod),
    path: toOpenAPIPath(route.path),
    operationId: `${route.controllerName}_${route.methodName}`,
    summary: `${route.controllerName}.${route.methodName}`,
    tags: [route.domain ?? route.controllerName],
    responses: {
      200: {
        description: 'Successful response',
      },
      400: {
        description: 'Invalid request',
      },
    },
    ...(route.params.length > 0 || route.inputSchema ? { request: toRequestConfig(route) } : {}),
  };
}

function toTags(routes: RouteIR[]): { name: string; description: string }[] {
  const tagNames = new Set(routes.map((route) => route.domain ?? route.controllerName));

  return [...tagNames].map((name) => ({
    name,
    description: `${name} operations`,
  }));
}

function toRequestConfig(route: RouteIR): RouteConfig['request'] {
  const params = toZodObject(route.params.filter((param) => param.kind === 'path'));
  const query = toZodObject(route.params.filter((param) => param.kind === 'query'));
  const headers = toZodObject(route.params.filter((param) => param.kind === 'header'));
  const bodySchema = route.inputSchema ?? route.params.find((param) => param.kind === 'body')?.schema;

  return {
    ...(bodySchema
      ? {
          body: {
            required: true,
            content: {
              'application/json': {
                schema: bodySchema,
              },
            },
          },
        }
      : {}),
    ...(params ? { params } : {}),
    ...(query ? { query } : {}),
    ...(headers ? { headers } : {}),
  };
}

function toZodObject(params: ParamIR[]): z.ZodObject<Record<string, ZodType>> | undefined {
  if (params.length === 0) {
    return undefined;
  }

  const shape = Object.fromEntries(params.map((param) => [param.name, withParameterMetadata(param)]));

  return z.object(shape);
}

function withParameterMetadata(param: ParamIR): ZodType {
  const schema = param.schema ?? z.string();
  const location = toOpenAPIParamLocation(param.kind);

  return schema.openapi({
    param: {
      name: param.name,
      in: location,
      required: param.kind === 'path',
    },
  });
}

function toOpenAPIParamLocation(kind: ParamIR['kind']): OpenAPIParamLocation {
  if (kind === 'path' || kind === 'query' || kind === 'header') {
    return kind;
  }

  throw new Error(`Unsupported OpenAPI parameter kind: ${kind}`);
}

function toOpenAPIPath(path: string): string {
  return path.replace(/:([^/]+)/g, '{$1}');
}

function toHttpMethod(method: string): HttpMethod {
  const normalizedMethod = method.toLowerCase();
  const httpMethod = HTTP_METHODS.find((candidate) => candidate === normalizedMethod);

  if (httpMethod) {
    return httpMethod;
  }

  throw new Error(`Unsupported HTTP method: ${method}`);
}
