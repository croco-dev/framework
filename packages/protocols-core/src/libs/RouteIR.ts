import type { ProblemCategory } from "@croco/problems-core";
import type { z } from "zod";

export interface RouteIR {
  controllerName: string;
  methodName: string;
  httpMethod: string;
  path: string;
  routeContract: RouteContractIR | null;
  params: ParamIR[];
  inputSchema: z.ZodType | null;
  inputSchemas: RouteInputSchemas;
  outputSchema: z.ZodType | null;
  problemResponses?: readonly ProblemResponseIR[];
  domain: string | null;
}

export type RouteContractIR = {
  readonly id: string | null;
  readonly method: string;
  readonly path: string;
  readonly operationId?: string;
  readonly sourceLocation?: RouteContractSourceLocation;
  readonly inputSchemas: RouteInputSchemas;
  readonly outputSchema: z.ZodType | null;
  readonly problemResponses: readonly ProblemResponseIR[];
};

export type RouteContractSourceLocation = {
  readonly path: string;
  readonly line?: number;
  readonly column?: number;
};

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
  readonly cookbookPath?: string;
  readonly routeContractProblems?: readonly ProblemResponseIR[];
};
