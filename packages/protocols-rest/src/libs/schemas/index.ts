/**
 * Zod 스키마 기반 요청/응답 타입 정의 서브-barrel입니다.
 */
export { defineRouteSchema } from "@croco/protocols-core";
export type {
  DefinedRouteSchema,
  InferRouteSchemaRequest,
  InferRouteSchemaResponse,
  RouteRequestSchemas,
  RouteSchemaLike,
} from "@croco/protocols-core";
export type {
  InferRequestType,
  InferResponseType,
  RequestSchema,
  ResponseSchema as ResponseSchemaType,
  RouteSchema,
} from "./ValidationSchema";
