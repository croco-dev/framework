import "reflect-metadata";
import type { AddressInfo } from "node:net";
import {
  Container,
  DEV_INSPECTOR_TOKEN,
  type Guard,
  type RuntimeInspector,
  type RuntimeInspectorRecorderEventInput,
} from "@croco/framework-context";
import { Problem, ProblemCategory, ProblemFactory } from "@croco/problems-core";
import {
  type CallHandler,
  Body,
  Controller,
  type Constructor,
  type ExceptionFilter,
  type ExecutionContext,
  Get,
  type HttpExceptionFilterResponse,
  type Interceptor,
  Post,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@croco/protocols-rest";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { TRPCError, type AnyRouter } from "@trpc/server";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createTrpcRouter } from "../libs/createTrpcRouter";
import { TrpcExecutionContext } from "../libs/TrpcExecutionContext";

const events: string[] = [];
let observedTrpcContext: unknown;

class DenyGuard implements Guard<ExecutionContext> {
  canActivate(context: ExecutionContext): boolean {
    events.push("guard");
    observedTrpcContext =
      context instanceof TrpcExecutionContext ? context.getTrpcContext() : undefined;

    return false;
  }
}

class InvalidInputDenyGuard implements Guard<ExecutionContext> {
  canActivate(): boolean {
    events.push("invalid-input-guard");

    return false;
  }
}

class ClassGuard implements Guard<ExecutionContext> {
  canActivate(): boolean {
    events.push("class-guard");

    return true;
  }
}

class MethodGuard implements Guard<ExecutionContext> {
  canActivate(): boolean {
    events.push("method-guard");

    return true;
  }
}

class ClassInterceptor implements Interceptor<ExecutionContext> {
  async intercept(_context: ExecutionContext, next: CallHandler): Promise<unknown> {
    events.push("class-interceptor:before");

    try {
      return await next.handle();
    } finally {
      events.push("class-interceptor:after");
    }
  }
}

class MethodInterceptor implements Interceptor<ExecutionContext> {
  async intercept(_context: ExecutionContext, next: CallHandler): Promise<unknown> {
    events.push("method-interceptor:before");

    try {
      return await next.handle();
    } finally {
      events.push("method-interceptor:after");
    }
  }
}

class ClassFilter implements ExceptionFilter<unknown, ExecutionContext> {
  catch(): undefined {
    events.push("class-filter");

    return undefined;
  }
}

class MethodFilter implements ExceptionFilter<unknown, ExecutionContext> {
  catch(): HttpExceptionFilterResponse {
    events.push("method-filter");

    return {
      status: 422,
      headers: { "Content-Type": "application/problem+json" },
      body: {
        type: "about:blank",
        title: "Validation Error",
        status: 422,
        code: "protocols-trpc/filter-handled",
        detail: "filter handled the failure",
        reason: "handled",
      },
    };
  }
}

class InvalidReturnFilter implements ExceptionFilter<unknown, ExecutionContext> {
  catch(): HttpExceptionFilterResponse {
    return { status: 200, headers: {}, body: {} };
  }
}

class ThrowingFilter implements ExceptionFilter<unknown, ExecutionContext> {
  catch(): never {
    throw new Error("filter failure");
  }
}

class PrivateProblem extends Problem {
  readonly code = "protocols-trpc/private-problem";
  readonly category = ProblemCategory.InternalServerError;

  constructor() {
    super("protocols-trpc/private-problem", ProblemCategory.InternalServerError, "private detail", {
      extensions: { reason: "denied", secret: "do not expose" },
    });
  }
}

type GuardDependency = {
  readonly allowed: boolean;
};

class DependencyBackedGuard implements Guard<ExecutionContext> {
  constructor(private readonly dependency: GuardDependency) {}

  canActivate(): boolean {
    events.push("dependency-guard");

    return this.dependency.allowed;
  }
}

const invalidInputSchema = z.object({ name: z.string().min(1) });

@Controller("/trpc/deny")
class TrpcDenyController {
  @Get("/")
  @UseGuards(DenyGuard)
  denied(): never {
    throw new Error("handler must not run");
  }

  @Post("/invalid-input")
  @UseGuards(InvalidInputDenyGuard)
  invalidInput(@Body(invalidInputSchema) _input: z.infer<typeof invalidInputSchema>): never {
    throw new Error("handler must not run");
  }
}

@Controller("/trpc/pipeline")
@UseFilters(ClassFilter)
@UseInterceptors(ClassInterceptor)
@UseGuards(ClassGuard)
class TrpcPipelineController {
  @Get("/")
  @UseFilters(MethodFilter)
  @UseInterceptors(MethodInterceptor)
  @UseGuards(MethodGuard)
  fails(): never {
    events.push("handler");
    throw ProblemFactory.badRequest("protocols-trpc/pipeline-problem", "pipeline problem");
  }
}

@Controller("/trpc/problems")
class TrpcProblemController {
  @Get("/")
  fails(): never {
    throw new PrivateProblem();
  }

  @Get("/validation")
  validation(): never {
    throw ProblemFactory.validationError("protocols-trpc/validation-failed", "Email is invalid", {
      type: "https://croco.dev/problems/validation-failed",
      extensions: {
        errors: [{ field: "email", message: "Invalid email" }],
        secret: "do not expose",
      },
    });
  }

  @Get("/not-found")
  notFound(): never {
    throw ProblemFactory.notFound("protocols-trpc/user-not-found", "User was not found", {
      extensions: { reason: "missing", secret: "do not expose" },
    });
  }

  @Get("/unknown")
  unknown(): never {
    throw new Error("database password must not cross the wire");
  }

  @Get("/unknown-trpc")
  unknownTrpc(): never {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "database password must not cross the wire",
    });
  }
}

@Controller("/trpc/filter-diagnostics")
class TrpcFilterDiagnosticsController {
  @Get("/invalid-return")
  @UseFilters(InvalidReturnFilter)
  invalidReturn(): never {
    throw new PrivateProblem();
  }

  @Get("/throwing")
  @UseFilters(ThrowingFilter)
  throwing(): never {
    throw new PrivateProblem();
  }
}

@Controller("/trpc/di")
class TrpcDiController {
  @Get("/")
  @UseGuards(DependencyBackedGuard as unknown as Constructor<Guard>)
  protected(): string {
    return "protected";
  }
}

@Controller("/trpc/required-dependency")
class TrpcRequiredDependencyController {
  constructor(_dependency: GuardDependency) {}

  @Get("/")
  handler(): string {
    return "unreachable";
  }
}

@Controller("/trpc/guard-provider")
class TrpcGuardProviderFailureController {
  @Get("/")
  @UseFilters(MethodFilter)
  @UseGuards(DependencyBackedGuard as unknown as Constructor<Guard>)
  protected(): string {
    return "unreachable";
  }
}

describe("tRPC Croco execution pipeline", () => {
  beforeEach(() => {
    Container.reset();
    events.length = 0;
    observedTrpcContext = undefined;
  });

  it("blocks a tRPC procedure before its handler when a guard denies access", async () => {
    const router = createTrpcRouter([TrpcDenyController]);
    const caller = router.createCaller({ identity: "caller-1" }) as unknown as {
      trpcDeny: { denied: () => Promise<unknown> };
    };

    const denied = caller.trpcDeny.denied();
    await expect(denied).rejects.toThrow();
    await expect(denied).rejects.toMatchObject({
      code: "FORBIDDEN",
      cause: expect.objectContaining({
        code: "TRPC_ACCESS_DENIED",
        status: 403,
      }),
    });
    expect(events).toEqual(["guard"]);
    expect(observedTrpcContext).toEqual({ identity: "caller-1" });
  });

  it("runs guards before tRPC input parsing", async () => {
    const router = createTrpcRouter([TrpcDenyController]);
    const caller = router.createCaller({}) as unknown as {
      trpcDeny: { invalidInput: (input: unknown) => Promise<unknown> };
    };

    const denied = caller.trpcDeny.invalidInput({ name: "" });
    await expect(denied).rejects.toThrow();
    await expect(denied).rejects.toMatchObject({
      code: "FORBIDDEN",
      cause: expect.objectContaining({ code: "TRPC_ACCESS_DENIED" }),
    });
    expect(events).toEqual(["invalid-input-guard"]);
  });

  it("runs class and method lifecycle metadata in Croco pipeline order", async () => {
    const router = createTrpcRouter([TrpcPipelineController]);
    const caller = router.createCaller({}) as unknown as {
      trpcPipeline: { fails: () => Promise<unknown> };
    };

    const failure = caller.trpcPipeline.fails();
    await expect(failure).rejects.toThrow();
    await expect(failure).rejects.toMatchObject({
      code: "UNPROCESSABLE_CONTENT",
      cause: expect.objectContaining({
        code: "protocols-trpc/filter-handled",
        status: 422,
      }),
    });
    expect(events).toEqual([
      "class-guard",
      "method-guard",
      "class-interceptor:before",
      "method-interceptor:before",
      "handler",
      "method-interceptor:after",
      "class-interceptor:after",
      "class-filter",
      "method-filter",
    ]);
  });

  it("preserves declared Problem contracts and redacts private and unknown failures", async () => {
    const router = createTrpcRouter([TrpcProblemController]);
    const server = createHTTPServer({ router });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const client = createTRPCClient<typeof router>({
      links: [httpBatchLink({ url: `http://127.0.0.1:${getPort(server)}` })],
    }) as unknown as {
      trpcProblem: {
        fails: { query: () => Promise<unknown> };
        validation: { query: () => Promise<unknown> };
        notFound: { query: () => Promise<unknown> };
        unknown: { query: () => Promise<unknown> };
        unknownTrpc: { query: () => Promise<unknown> };
      };
    };

    try {
      const validationError = toClientError(
        await captureRejectedValue(client.trpcProblem.validation.query()),
      );
      expect(validationError.data.code).toBe("UNPROCESSABLE_CONTENT");
      expect(validationError.data.croco).toEqual({
        code: "protocols-trpc/validation-failed",
        status: 422,
        title: "Validation Error",
        type: "https://croco.dev/problems/validation-failed",
        detail: "Email is invalid",
        extensions: {
          errors: [{ field: "email", message: "Invalid email" }],
        },
      });
      expect(validationError.data.croco).not.toHaveProperty("extensions.secret");
      expect(validationError.data).not.toHaveProperty("stack");

      const notFoundError = toClientError(
        await captureRejectedValue(client.trpcProblem.notFound.query()),
      );
      expect(notFoundError.data.code).toBe("NOT_FOUND");
      expect(notFoundError.data.croco).toEqual({
        code: "protocols-trpc/user-not-found",
        status: 404,
        title: "Not Found",
        type: "about:blank",
        detail: "User was not found",
        extensions: { reason: "missing" },
      });
      expect(notFoundError.data.croco).not.toHaveProperty("extensions.secret");
      expect(notFoundError.data).not.toHaveProperty("stack");

      const privateError = toClientError(
        await captureRejectedValue(client.trpcProblem.fails.query()),
      );
      expect(privateError.data.code).toBe("INTERNAL_SERVER_ERROR");
      expect(privateError.data.croco).toMatchObject({
        code: "protocols-trpc/private-problem",
        status: 500,
        detail: "An internal error occurred",
        extensions: {},
      });
      expect(privateError.data.croco).not.toHaveProperty("extensions.secret");
      expect(privateError.message).not.toContain("private detail");
      expect(privateError.data).not.toHaveProperty("stack");

      const unknownError = toClientError(
        await captureRejectedValue(client.trpcProblem.unknown.query()),
      );
      expect(unknownError.data.code).toBe("INTERNAL_SERVER_ERROR");
      expect(unknownError.data).not.toHaveProperty("croco");
      expect(unknownError.message).not.toContain("database password");
      expect(unknownError.data).not.toHaveProperty("stack");

      const unknownTrpcError = toClientError(
        await captureRejectedValue(client.trpcProblem.unknownTrpc.query()),
      );
      expect(unknownTrpcError.data.code).toBe("INTERNAL_SERVER_ERROR");
      expect(unknownTrpcError.data).not.toHaveProperty("croco");
      expect(unknownTrpcError.message).not.toContain("database password");
      expect(unknownTrpcError.data).not.toHaveProperty("stack");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });

  it("resolves decorated lifecycle providers from the configured container", async () => {
    const dependencyGuard = new DependencyBackedGuard({ allowed: true });
    const controller = new TrpcDiController();
    const container = {
      get<T>(type: Constructor<T>): T {
        if (type === DependencyBackedGuard) {
          return dependencyGuard as T;
        }

        if (type === TrpcDiController) {
          return controller as T;
        }

        throw new Error(`Unexpected provider ${type.name}`);
      },
    };
    const router = createTrpcRouter([TrpcDiController], { container });
    const caller = router.createCaller({}) as unknown as {
      trpcDi: { protected: () => Promise<unknown> };
    };

    await expect(caller.trpcDi.protected()).resolves.toBe("protected");
    expect(events).toEqual(["dependency-guard"]);
  });

  it("requires a container for providers with constructor dependencies", async () => {
    const router = createTrpcRouter([TrpcRequiredDependencyController]);
    const caller = router.createCaller({}) as unknown as {
      trpcRequiredDependency: { handler: () => Promise<unknown> };
    };

    const failure = caller.trpcRequiredDependency.handler();
    await expect(failure).rejects.toThrow();
    await expect(failure).rejects.toMatchObject({
      cause: expect.objectContaining({ code: "protocols-trpc/provider-container-required" }),
    });
  });

  it("lets filters handle guard provider instantiation failures", async () => {
    const router = createTrpcRouter([TrpcGuardProviderFailureController]);
    const caller = router.createCaller({}) as unknown as {
      trpcGuardProviderFailure: { protected: () => Promise<unknown> };
    };

    const failure = caller.trpcGuardProviderFailure.protected();
    await expect(failure).rejects.toThrow();
    await expect(failure).rejects.toMatchObject({
      code: "UNPROCESSABLE_CONTENT",
      cause: expect.objectContaining({
        code: "protocols-trpc/filter-handled",
        status: 422,
      }),
    });
    expect(events).toEqual(["method-filter"]);
  });

  it("preserves the original failure and records invalid filter results", async () => {
    const diagnosticEvents: RuntimeInspectorRecorderEventInput[] = [];
    const recorder = {
      recordEvent(event: RuntimeInspectorRecorderEventInput): void {
        diagnosticEvents.push(event);
      },
    };
    Container.set(DEV_INSPECTOR_TOKEN, recorder as RuntimeInspector);
    const router = createTrpcRouter([TrpcFilterDiagnosticsController]);
    const caller = router.createCaller({}) as unknown as {
      trpcFilterDiagnostics: { invalidReturn: () => Promise<unknown> };
    };

    const failure = caller.trpcFilterDiagnostics.invalidReturn();
    await expect(failure).rejects.toThrow();
    await expect(failure).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      cause: expect.objectContaining({ code: "protocols-trpc/private-problem" }),
    });
    expect(diagnosticEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "CROCO_TRPC_FILTER_001",
          details: expect.objectContaining({ reason: "invalid-return" }),
        }),
      ]),
    );
  });

  it("preserves the original failure and records throwing filters", async () => {
    const diagnosticEvents: RuntimeInspectorRecorderEventInput[] = [];
    const recorder = {
      recordEvent(event: RuntimeInspectorRecorderEventInput): void {
        diagnosticEvents.push(event);
      },
    };
    Container.set(DEV_INSPECTOR_TOKEN, recorder as RuntimeInspector);
    const router = createTrpcRouter([TrpcFilterDiagnosticsController]);
    const caller = router.createCaller({}) as unknown as {
      trpcFilterDiagnostics: { throwing: () => Promise<unknown> };
    };

    const failure = caller.trpcFilterDiagnostics.throwing();
    await expect(failure).rejects.toThrow();
    await expect(failure).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      cause: expect.objectContaining({ code: "protocols-trpc/private-problem" }),
    });
    expect(diagnosticEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "CROCO_TRPC_FILTER_001",
          details: expect.objectContaining({ reason: "thrown", filterErrorName: "Error" }),
        }),
      ]),
    );
  });

  it("keeps typed contexts and safely normalizes HTTP requests", () => {
    const context = new TrpcExecutionContext<{
      readonly request: Request;
      readonly identity: string;
    }>(
      { request: new Request("https://example.test/trpc"), identity: "caller-1" },
      TrpcDenyController,
      "denied",
      "/trpc/deny",
      "GET",
    );
    const nodeRequestContext = new TrpcExecutionContext(
      { req: { url: "/trpc/node", method: "GET", headers: { host: "example.test" } } },
      TrpcDenyController,
      "denied",
      "/trpc/deny",
      "GET",
    );
    const missingRequestContext = new TrpcExecutionContext(
      {},
      TrpcDenyController,
      "denied",
      "/trpc/deny",
      "GET",
    );
    const invalidNodeRequestContext = new TrpcExecutionContext(
      { req: { url: "/trpc/node", method: "GET", headers: { "invalid header": "value" } } },
      TrpcDenyController,
      "denied",
      "/trpc/deny",
      "GET",
    );

    expect(context.getTrpcContext().identity).toBe("caller-1");
    expect(context.getRequest()).toBeInstanceOf(Request);
    expect(nodeRequestContext.getRequest().url).toBe("http://example.test/trpc/node");
    expect(() => missingRequestContext.getRequest()).toThrow(
      expect.objectContaining({ code: "protocols-trpc/request-unavailable" }),
    );
    expect(() => invalidNodeRequestContext.getRequest()).toThrow(
      expect.objectContaining({ code: "protocols-trpc/request-normalization-failed" }),
    );
    try {
      invalidNodeRequestContext.getRequest();
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain("invalid header");
    }
  });
});

function getPort(server: ReturnType<typeof createHTTPServer>): number {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new TypeError("tRPC test server address is not available");
  }

  return (address as AddressInfo).port;
}

async function captureRejectedValue(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  expect.fail("Expected promise to reject.");
}

function toClientError(error: unknown): {
  readonly message: string;
  readonly data: {
    readonly code: string;
    readonly croco?: unknown;
    readonly stack?: string;
  };
} {
  return error as {
    readonly message: string;
    readonly data: {
      readonly code: string;
      readonly croco?: unknown;
      readonly stack?: string;
    };
  };
}
