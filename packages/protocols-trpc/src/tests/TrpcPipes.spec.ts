import "reflect-metadata";
import { CurrentApiKey, CurrentPrincipal, User } from "@croco/auth-core";
import {
  Container,
  Context,
  GENERATED_DI_GRAPH_VERSION,
  defineGeneratedDiGraph,
} from "@croco/framework-context";
import { ProblemFactory } from "@croco/problems-core";
import {
  Body,
  Controller,
  Ctx,
  Header,
  Param,
  Post,
  Query,
  Raw,
  UseFilters,
  UseInterceptors,
  UsePipes,
} from "@croco/protocols-rest";
import type {
  ArgumentMetadata,
  CallHandler,
  ExceptionFilter,
  ExecutionContext,
  HttpExceptionFilterResponse,
  Interceptor,
  PipeTransform,
} from "@croco/protocols-rest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createTrpcRouter } from "../libs/createTrpcRouter";

const transformations: Array<{ stage: string; value: unknown; metadata: ArgumentMetadata }> = [];

class ClassPipe implements PipeTransform {
  async transform(value: unknown, metadata: ArgumentMetadata): Promise<string> {
    await Promise.resolve();
    transformations.push({ stage: "class", value, metadata });
    return `${String(value)}:class`;
  }
}

class MethodPipe implements PipeTransform {
  async transform(value: unknown, metadata: ArgumentMetadata): Promise<string> {
    await Promise.resolve();
    transformations.push({ stage: "method", value, metadata });
    return `${String(value)}:method`;
  }
}

@Controller("/pipes")
@UsePipes(ClassPipe)
class PipesController {
  @Post("/body")
  @UsePipes(MethodPipe)
  body(@Body(z.string().transform((value) => value.trim())) value: string): string {
    return value;
  }

  @Post("/path/:id")
  @UsePipes(MethodPipe)
  path(@Param("id", z.string()) value: string): string {
    return value;
  }

  @Post("/query")
  @UsePipes(MethodPipe)
  query(@Query("search", z.string()) value: string): string {
    return value;
  }

  @Post("/header")
  @UsePipes(MethodPipe)
  header(@Header("x-label", z.string()) value: string): string {
    return value;
  }

  @Post("/context")
  @UsePipes(MethodPipe)
  context(
    @Body(z.string()) value: string,
    @Ctx() context: unknown,
    @Raw() raw: unknown,
    @CurrentPrincipal() principal: unknown,
    @User() user: unknown,
    @CurrentApiKey() apiKey: unknown,
  ) {
    return { value, context, raw, principal, user, apiKey };
  }
}

type PipesCaller = {
  pipes: {
    body: (input: unknown) => Promise<string>;
    path: (input: unknown) => Promise<string>;
    query: (input: unknown) => Promise<string>;
    header: (input: unknown) => Promise<string>;
    context: (input: unknown) => Promise<{
      value: string;
      context: unknown;
      raw: unknown;
      principal: unknown;
      user: unknown;
      apiKey: unknown;
    }>;
  };
};

const locations = [
  { method: "body", input: " value ", metadata: { type: "body" } },
  { method: "path", input: { path: { id: "value" } }, metadata: { type: "param", name: "id" } },
  {
    method: "query",
    input: { query: { search: "value" } },
    metadata: { type: "query", name: "search" },
  },
  {
    method: "header",
    input: { headers: { "x-label": "value" } },
    metadata: { type: "header", name: "x-label" },
  },
] as const;

describe("tRPC pipes", () => {
  beforeEach(() => {
    Container.reset();
    transformations.length = 0;
  });

  it("trims an object body through a method pipe before invoking the handler", async () => {
    class TrimPipe implements PipeTransform<{ name: string }, { name: string }> {
      transform(value: { name: string }): { name: string } {
        return { name: value.name.trim() };
      }
    }
    @Controller("/trimmed")
    class TrimmedController {
      @Post("/")
      @UsePipes(TrimPipe)
      create(@Body(z.object({ name: z.string() })) value: { name: string }): string {
        return value.name;
      }
    }
    const caller = createTrpcRouter([TrimmedController]).createCaller({}) as unknown as {
      trimmed: { create: (input: { name: string }) => Promise<string> };
    };

    await expect(caller.trimmed.create({ name: "  Alice  " })).resolves.toBe("Alice");
  });

  it("runs pipes inside the interceptor before invoking the handler", async () => {
    const events: string[] = [];
    class RecordingPipe implements PipeTransform {
      transform(value: unknown): unknown {
        events.push("pipe");
        return value;
      }
    }
    class RecordingInterceptor implements Interceptor {
      async intercept(_context: ExecutionContext, next: CallHandler): Promise<unknown> {
        events.push("interceptor:before");
        const result = await next.handle();
        events.push("interceptor:after");
        return result;
      }
    }
    @Controller("/pipe-lifecycle")
    @UseInterceptors(RecordingInterceptor)
    @UsePipes(RecordingPipe)
    class PipeLifecycleController {
      @Post("/")
      accept(@Body(z.string()) value: string): string {
        events.push("handler");
        return value;
      }
    }
    const caller = createTrpcRouter([PipeLifecycleController]).createCaller({}) as unknown as {
      pipeLifecycle: { accept: (input: string) => Promise<string> };
    };

    await caller.pipeLifecycle.accept("value");

    expect(events).toEqual(["interceptor:before", "pipe", "handler", "interceptor:after"]);
  });

  it.each(locations)(
    "awaits class then method pipes for $method parameters with location metadata",
    async ({ method, input, metadata }) => {
      const caller = createTrpcRouter([PipesController]).createCaller({}) as unknown as PipesCaller;

      await expect(caller.pipes[method](input)).resolves.toBe("value:class:method");
      expect(transformations).toEqual([
        { stage: "class", value: "value", metadata },
        { stage: "method", value: "value:class", metadata },
      ]);
    },
  );

  it("rejects invalid schema input before running pipes or the handler", async () => {
    const handler = vi.fn();
    @Controller("/invalid-pipe-input")
    @UsePipes(ClassPipe)
    class InvalidPipeInputController {
      @Post("/")
      accept(@Body(z.string()) value: string): void {
        handler(value);
      }
    }
    const caller = createTrpcRouter([InvalidPipeInputController]).createCaller({}) as unknown as {
      invalidPipeInput: { accept: (input: unknown) => Promise<unknown> };
    };

    await expect(caller.invalidPipeInput.accept(123)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(transformations).toEqual([]);
    expect(handler).not.toHaveBeenCalled();
  });

  it("preserves context, raw, and authentication values while transforming the body", async () => {
    const context = {
      requestId: "pipe-context",
      principal: { id: "principal-1" },
      user: { id: "user-1" },
      apiKey: { id: "key-1" },
    };
    const caller = createTrpcRouter([PipesController]).createCaller(
      context,
    ) as unknown as PipesCaller;
    const result = await caller.pipes.context("value");

    expect(result).toEqual({
      value: "value:class:method",
      context,
      raw: context,
      principal: context.principal,
      user: context.user,
      apiKey: context.apiKey,
    });
    expect(result.principal).toBe(context.principal);
    expect(result.user).toBe(context.user);
    expect(result.apiKey).toBe(context.apiKey);
    expect(transformations.map(({ metadata }) => metadata)).toEqual([
      { type: "body" },
      { type: "body" },
    ]);
  });

  it("resolves injected pipes in isolated concurrent request contexts", async () => {
    let nextId = 0;
    class RequestState {
      readonly id = ++nextId;
    }
    class ScopedPipe implements PipeTransform {
      constructor(private readonly state: RequestState) {}

      async transform(value: unknown): Promise<unknown> {
        await Promise.resolve();
        return {
          value,
          requestId: Context.getRequestId(),
          stateId: this.state.id,
          sameState: Container.get(RequestState) === this.state,
        };
      }
    }
    @Controller("/scoped-pipe")
    @UsePipes(ScopedPipe)
    class ScopedPipeController {
      @Post("/")
      accept(@Body(z.string()) value: unknown): unknown {
        return value;
      }
    }
    const graphId = "trpc-pipe-request-scope";
    const sourceLocation = { file: "TrpcPipes.spec.ts", line: 1, column: 1 };
    Container.installGeneratedGraph(
      defineGeneratedDiGraph({
        version: GENERATED_DI_GRAPH_VERSION,
        graphId,
        compilerVersion: "test",
        inputHash: graphId,
        providers: [
          {
            token: RequestState,
            tokenId: "pipe-state",
            debugName: "RequestState",
            scope: "request",
            dependencies: [],
            factory: () => new RequestState(),
            sourceLocation,
          },
          {
            token: ScopedPipe,
            tokenId: "scoped-pipe",
            debugName: "ScopedPipe",
            scope: "request",
            dependencies: [{ token: RequestState, tokenId: "pipe-state", parameterIndex: 0 }],
            factory: (resolver) => new ScopedPipe(resolver.get(RequestState)),
            sourceLocation,
          },
        ],
        roots: [ScopedPipe],
      }),
    );

    try {
      const router = createTrpcRouter([ScopedPipeController]);
      type Caller = {
        scopedPipe: {
          accept: (
            input: string,
          ) => Promise<{ value: string; requestId: string; stateId: number; sameState: boolean }>;
        };
      };
      const first = router.createCaller({ requestId: "request-1" }) as unknown as Caller;
      const second = router.createCaller({ requestId: "request-2" }) as unknown as Caller;
      const results = await Promise.all([
        first.scopedPipe.accept("first"),
        second.scopedPipe.accept("second"),
      ]);

      expect(results).toEqual([
        { value: "first", requestId: "request-1", stateId: expect.any(Number), sameState: true },
        { value: "second", requestId: "request-2", stateId: expect.any(Number), sameState: true },
      ]);
      expect(results[0].stateId).not.toBe(results[1].stateId);
      expect(Context.isActive()).toBe(false);
    } finally {
      Container.removeGeneratedGraph(graphId);
    }
  });

  it("routes pipe Problems through exception filters before exposing the tRPC failure", async () => {
    const failure = ProblemFactory.badRequest("pipe-rejected", "Pipe rejected the input");
    const caught = vi.fn();
    const handler = vi.fn();
    class RejectingPipe implements PipeTransform {
      async transform(): Promise<never> {
        throw failure;
      }
    }
    class PipeFilter implements ExceptionFilter {
      catch(error: unknown): HttpExceptionFilterResponse {
        caught(error);
        return {
          status: 422,
          headers: {},
          body: {
            type: "about:blank",
            title: "Invalid input",
            status: 422,
            code: "pipe-filtered",
            detail: "Filtered pipe failure",
          },
        };
      }
    }
    @Controller("/filtered-pipe")
    @UseFilters(PipeFilter)
    @UsePipes(RejectingPipe)
    class FilteredPipeController {
      @Post("/")
      accept(@Body(z.string()) value: string): void {
        handler(value);
      }
    }
    const caller = createTrpcRouter([FilteredPipeController]).createCaller({}) as unknown as {
      filteredPipe: { accept: (input: string) => Promise<unknown> };
    };

    await expect(caller.filteredPipe.accept("value")).rejects.toMatchObject({
      code: "UNPROCESSABLE_CONTENT",
      cause: expect.objectContaining({ code: "pipe-filtered", status: 422 }),
    });
    expect(caught).toHaveBeenCalledExactlyOnceWith(failure);
    expect(handler).not.toHaveBeenCalled();
    expect(Context.isActive()).toBe(false);
  });
});
