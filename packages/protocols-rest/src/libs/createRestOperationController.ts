import "reflect-metadata";
import { ProblemFactory } from "@croco/problems-core";
import { assertContractGraphHasNoErrors, buildContractGraph } from "@croco/protocols-core";
import type { Operation } from "@croco/protocols-core";
import type { z } from "zod";
import { Controller } from "./decorators/Controller";
import { Ctx } from "./decorators/Params";
import { HttpMethod, RESPONSE_SCHEMA_KEY, REST_ROUTES_KEY } from "./constants";
import { isRouteParameterSchema } from "./internal/routeParameterSchema";
import type { Constructor, RouteMetadata } from "./types";
import { captureRestDecoratorSourceLocation } from "./sourceLocation";

/** Server-owned request boundary. Credentials must be verified before createContext returns. */
export type RestOperationRequest = {
  readonly req: {
    readonly params: Record<string, string>;
    readonly query: Record<string, string | string[]>;
    readonly headers: Record<string, string>;
  };
  json(): Promise<unknown>;
  header(name: string): string | undefined;
  get<T>(key: string): T | undefined;
};

export type RestOperationBinding<
  Context,
  Kind extends "query" | "command" = "query" | "command",
> = {
  readonly method: Kind extends "command"
    ? "POST" | "PUT" | "PATCH" | "DELETE"
    : "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly path: string;
  readonly input: "body" | "query" | "params";
  readonly successStatus?: number;
  readonly createContext: (request: RestOperationRequest) => Context | Promise<Context>;
};

/**
 * Explicit REST export of a function operation through the existing controller/route graph.
 * Creating an operation alone never exposes a network surface.
 */
export function createRestOperationController<
  Input extends z.ZodType,
  Output extends z.ZodType,
  Context,
  Kind extends "query" | "command",
>(
  operation: Operation<Input, Output, Context, Kind>,
  binding: RestOperationBinding<Context, NoInfer<Kind>>,
): Constructor {
  const { definition } = operation;
  const sourceLocation = captureRestDecoratorSourceLocation();
  const parameterSchema = isRouteParameterSchema(definition.input) ? definition.input : undefined;
  const status = binding.successStatus ?? 200;
  if (
    (definition.kind === "command" && binding.method === "GET") ||
    (binding.method === "GET" && binding.input === "body") ||
    !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(binding.method) ||
    !["body", "query", "params"].includes(binding.input) ||
    (binding.input !== "body" && !parameterSchema) ||
    !Number.isInteger(status) ||
    status < 200 ||
    status > 299 ||
    status === 204 ||
    status === 205 ||
    typeof binding.path !== "string" ||
    !binding.path.startsWith("/") ||
    typeof binding.createContext !== "function"
  ) {
    throw ProblemFactory.internalServerError(
      "protocols-rest/invalid-operation-binding",
      "REST operation bindings require an absolute path, a body-bearing success status, and a safe method/input combination",
    );
  }
  const exportBinding = Object.freeze({ ...binding });
  const method = HttpMethod[exportBinding.method];
  const bindingId = `${definition.id}:${exportBinding.method}:${exportBinding.path}`.replace(
    /[^a-zA-Z0-9]/g,
    (character) => `_${character.charCodeAt(0).toString(16)}_`,
  );
  class RestOperationController {
    async handle(request: RestOperationRequest): Promise<z.output<Output>> {
      const context = await exportBinding.createContext(request);
      return operation.dispatch(
        context,
        async () => {
          if (exportBinding.input === "query") return { ...request.req.query };
          if (exportBinding.input === "params") return { ...request.req.params };
          if (
            request.header("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !==
            "application/json"
          ) {
            throw ProblemFactory.unsupportedMediaType(
              "protocols-rest/operation-media-type-invalid",
              "Operation request bodies require application/json",
            );
          }
          try {
            return await request.json();
          } catch {
            throw ProblemFactory.badRequest(
              "protocols-rest/operation-json-invalid",
              "Operation request body must contain valid JSON",
            );
          }
        },
        exportBinding.input === "query" ? "query" : undefined,
      );
    }
  }
  Object.defineProperty(RestOperationController, "name", {
    value: `Operation_${bindingId}`,
  });
  Controller()(RestOperationController);
  Ctx()(RestOperationController.prototype, "handle", 0);
  const routes: RouteMetadata[] = [
    {
      method,
      path: exportBinding.path,
      methodName: "handle",
      statusCode: status,
      ...(sourceLocation ? { sourceLocation } : {}),
      contract: {
        id: bindingId,
        operationId: bindingId,
        method,
        path: exportBinding.path,
        ...(sourceLocation ? { sourceLocation } : {}),
        ...(exportBinding.input === "body" ? { body: definition.input } : {}),
        ...(exportBinding.input === "query" ? { query: parameterSchema } : {}),
        ...(exportBinding.input === "params" ? { params: parameterSchema } : {}),
        response: definition.output,
      },
    },
  ];
  Reflect.defineMetadata(REST_ROUTES_KEY, routes, RestOperationController);
  Reflect.defineMetadata(RESPONSE_SCHEMA_KEY, definition.output, RestOperationController, "handle");
  Reflect.defineMetadata(
    Symbol.for("croco:operation:route"),
    {
      id: definition.id,
      kind: definition.kind,
      inputSource: exportBinding.input,
      inputSchema: definition.input,
      outputSchema: definition.output,
    },
    RestOperationController,
    "handle",
  );
  assertContractGraphHasNoErrors(buildContractGraph([RestOperationController]));
  return RestOperationController;
}
