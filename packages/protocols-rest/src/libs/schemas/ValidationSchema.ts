import type { z } from 'zod';

export type RequestSchema = {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
  headers?: z.ZodType;
};

export type ResponseSchema<T = unknown> = z.ZodType<T>;

export type RouteSchema<Req extends RequestSchema = RequestSchema, Res = unknown> = {
  request: Req;
  response: ResponseSchema<Res>;
};

export type InferRequestType<T extends RequestSchema> = {
  body: T['body'] extends z.ZodType ? z.infer<T['body']> : unknown;
  query: T['query'] extends z.ZodType ? z.infer<T['query']> : unknown;
  params: T['params'] extends z.ZodType ? z.infer<T['params']> : unknown;
  headers: T['headers'] extends z.ZodType ? z.infer<T['headers']> : unknown;
};

export type InferResponseType<T extends ResponseSchema> = z.infer<T>;
