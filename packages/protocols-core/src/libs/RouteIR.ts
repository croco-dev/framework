import type { ProblemCategory } from "@croco/problems-core";
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
  problemResponses?: readonly ProblemResponseIR[];
  domain: string | null;
}

export type RouteInputSchemas = {
  body: z.ZodType | null;
  path: z.ZodType | null;
  query: z.ZodType | null;
  headers: z.ZodType | null;
};

export interface ParamIR {
  kind: "path" | "query" | "body" | "header" | "ctx";
  name: string;
  schema: z.ZodType | null;
}

export type ProblemResponseIR<
  Code extends string = string,
  Category extends ProblemCategory = ProblemCategory,
  Status extends number = number,
> = {
  readonly code: Code;
  readonly category: Category;
  readonly status: Status;
  readonly description?: string;
  readonly type?: string;
};
