import type { z } from "zod";

export interface RouteIR {
  controllerName: string;
  methodName: string;
  httpMethod: string;
  path: string;
  params: ParamIR[];
  inputSchema: z.ZodType | null;
  inputSchemas: RouteInputSchemas;
  outputSchema: z.ZodType | null;
  domain: string | null;
}

export type RouteInputSchemas = {
  body: z.ZodType | null;
  path: z.ZodType | null;
  query: z.ZodType | null;
};

export interface ParamIR {
  kind: "path" | "query" | "body" | "header" | "ctx";
  name: string;
  schema: z.ZodType | null;
}
