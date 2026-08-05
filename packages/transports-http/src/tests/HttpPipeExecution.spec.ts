import "reflect-metadata";
import { Container, type Guard } from "@croco/framework-context";
import { Problem, ProblemCategory } from "@croco/problems-core";
import {
  type ArgumentMetadata,
  Body,
  Controller,
  type ExecutionContext,
  Post,
  Query,
  type PipeTransform,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from "@croco/protocols-rest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../libs/CrocoApp";

const executionOrder: string[] = [];

class GlobalPipe implements PipeTransform<unknown, string> {
  transform(value: unknown, metadata: ArgumentMetadata): string {
    executionOrder.push("pipe:global");
    expect(metadata.type).toBe("body");
    const body = value as { value: string };
    return `${body.value}:global`;
  }
}

class ClassPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    executionOrder.push("pipe:class");
    return `${String(value)}:class`;
  }
}

class MethodPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    executionOrder.push("pipe:method");
    return `${String(value)}:method`;
  }
}

class AllowGuard implements Guard<ExecutionContext> {
  canActivate(): boolean {
    executionOrder.push("guard");
    return true;
  }
}

class OrderInterceptor {
  async intercept(
    _context: ExecutionContext,
    next: { handle(): Promise<unknown> },
  ): Promise<unknown> {
    executionOrder.push("interceptor:before");
    const result = await next.handle();
    executionOrder.push("interceptor:after");
    return result;
  }
}

@Controller("/pipe-execution")
@UsePipes(ClassPipe)
class PipeExecutionController {
  @Post("/transform")
  @UseGuards(AllowGuard)
  @UseInterceptors(OrderInterceptor)
  @UsePipes(MethodPipe)
  transform(@Body() value: string): { value: string } {
    executionOrder.push("controller");
    return { value };
  }
}

class PipeFailureProblem extends Problem {
  constructor() {
    super("transports-http/pipe-rejected", ProblemCategory.BadRequest, "pipe rejected input");
  }
}

class FailingPipe implements PipeTransform {
  transform(): never {
    throw new PipeFailureProblem();
  }
}

@Controller("/pipe-execution")
class FailingPipeController {
  @Post("/failure")
  @UsePipes(FailingPipe)
  transform(@Body() value: unknown): { value: unknown } {
    executionOrder.push("controller:failure");
    return { value };
  }
}

class GraphPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    executionOrder.push(`graph-pipe:${metadata.type}`);
    return value;
  }
}

@Controller("/pipe-graph")
@UsePipes(GraphPipe)
class PipeGraphController {
  @Post("/multiple")
  multiple(@Body() body: unknown, @Query("q") query: string): { body: unknown; query: string } {
    return { body, query };
  }

  @Post("/none")
  none(): string {
    return "none";
  }
}

describe("HTTP pipe execution", () => {
  beforeEach(() => {
    Container.reset();
    executionOrder.length = 0;
    Container.set(ClassPipe, new ClassPipe());
    Container.set(MethodPipe, new MethodPipe());
    Container.set(AllowGuard, new AllowGuard());
    Container.set(OrderInterceptor, new OrderInterceptor());
    Container.set(FailingPipe, new FailingPipe());
    Container.set(GraphPipe, new GraphPipe());
  });

  it("transforms handler inputs in global, class, and method order inside the lifecycle pipeline", async () => {
    const app = createApp({
      controllers: [PipeExecutionController],
      globalPipes: [new GlobalPipe()],
      securityValidation: "off",
    });

    const response = await app.fetch(
      new Request("http://localhost/pipe-execution/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "raw" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ value: "raw:global:class:method" });
    expect(executionOrder).toEqual([
      "guard",
      "interceptor:before",
      "pipe:global",
      "pipe:class",
      "pipe:method",
      "controller",
      "interceptor:after",
    ]);

    const graph = app
      .describeRequestPipelineGraphs()
      .find((entry) => entry.target === "POST /pipe-execution/transform");
    const successOrder = graph?.successOrder ?? [];
    expect(successOrder).toEqual(expect.arrayContaining(["pipe:0:0", "pipe:0:1", "pipe:0:2"]));
    expect(successOrder.indexOf("interceptor:0:before")).toBeLessThan(
      successOrder.indexOf("pipe:0:0"),
    );
    expect(successOrder.indexOf("pipe:0:2")).toBeLessThan(
      successOrder.indexOf("handler:PipeExecutionController.transform"),
    );
  });

  it("describes pipe execution once per decorated parameter and omits unused pipe stages", async () => {
    const app = createApp({
      controllers: [PipeGraphController],
      securityValidation: "off",
    });

    const response = await app.fetch(
      new Request("http://localhost/pipe-graph/multiple?q=query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "body" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(executionOrder).toEqual(["graph-pipe:body", "graph-pipe:query"]);

    const multipleGraph = app
      .describeRequestPipelineGraphs()
      .find((entry) => entry.target === "POST /pipe-graph/multiple");
    expect(multipleGraph?.successOrder).toEqual(expect.arrayContaining(["pipe:0:0", "pipe:1:0"]));

    const noneResponse = await app.fetch(
      new Request("http://localhost/pipe-graph/none", { method: "POST" }),
    );
    expect(noneResponse.status).toBe(200);
    expect(executionOrder).toEqual(["graph-pipe:body", "graph-pipe:query"]);

    const noneGraph = app
      .describeRequestPipelineGraphs()
      .find((entry) => entry.target === "POST /pipe-graph/none");
    expect(noneGraph?.successOrder.some((nodeId) => nodeId.startsWith("pipe:"))).toBe(false);
  });

  it("routes pipe Problems through the standard HTTP failure response", async () => {
    const app = createApp({
      controllers: [FailingPipeController],
      securityValidation: "off",
    });

    const response = await app.fetch(
      new Request("http://localhost/pipe-execution/failure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "rejected" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        code: "transports-http/pipe-rejected",
        status: 400,
      }),
    );
    expect(executionOrder).not.toContain("controller:failure");
  });
});
