import type { z } from 'zod';

export interface RouteIR {
  controllerName: string;
  methodName: string;
  httpMethod: string;
  path: string;
  params: ParamIR[];
  inputSchema: z.ZodType | null;
  outputSchema: z.ZodType | null;
  domain: string | null;
}

export interface ParamIR {
  kind: 'path' | 'query' | 'body' | 'header' | 'ctx';
  name: string;
  schema: z.ZodType | null;
}
