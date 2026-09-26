import "reflect-metadata";
import { Container, type Guard } from "@croco/framework-context";
import { Problem, ProblemCategory } from "@croco/problems-core";
import {
  type ArgumentMetadata,
  Body,
  Controller,
  Ctx,
  type ExecutionContext,
  Get,
  Header,
  Param,
  Post,
  Query,
  Raw,
  ResponseSchema,
  ResponseValidationProblem,
  type PipeTransform,
  UseFilters,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from "@croco/protocols-rest";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
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

class ContextProtectionPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    executionOrder.push(`pipe:protected:${metadata.type}`);
    if (metadata.type === "custom") {
      throw new PipeFailureProblem();
    }
    return value;
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

@Controller("/pipe-context")
@UsePipes(ContextProtectionPipe)
class ContextPipeController {
  @Post("/inspect")
  inspect(
    @Body() body: { value: string },
    @Ctx() ctx: { raw: unknown },
    @Raw() raw: unknown,
  ): { contextPreserved: boolean; value: string } {
    return { contextPreserved: ctx.raw === raw, value: body.value };
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

const availableName = async (name: string): Promise<boolean> => name !== "taken";
const nameSchema = z.string().refine(availableName, "name is taken");
const bodySchema = z.object({ name: nameSchema });
const responseSchema = z.object({ name: nameSchema });
const responseFilterErrors: unknown[] = [];

class ResponseProblemFilter {
  catch(error: unknown): undefined {
    responseFilterErrors.push(error);
    return undefined;
  }
}

@Controller("/async-validation")
class AsyncValidationController {
  @Post("/body")
  body(@Body(bodySchema) body: { name: string }): { name: string } {
    return body;
  }

  @Get("/query")
  query(@Query("name", nameSchema) name: string): { name: string } {
    return { name };
  }

  @Get("/param/:name")
  param(@Param("name", nameSchema) name: string): { name: string } {
    return { name };
  }

  @Get("/header")
  header(@Header("x-name", nameSchema) name: string): { name: string } {
    return { name };
  }

  @Get("/response/:name")
  @ResponseSchema(responseSchema)
  @UseFilters(ResponseProblemFilter)
  response(@Param("name") name: string): { name: string } {
    return { name };
  }
}

const asyncValidationCases = [
  {
    source: "body",
    request: (name: string) =>
      new Request("http://localhost/async-validation/body", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    issuePath: "body.name",
  },
  {
    source: "query",
    request: (name: string) => new Request(`http://localhost/async-validation/query?name=${name}`),
    issuePath: "query.value",
  },
  {
    source: "param",
    request: (name: string) => new Request(`http://localhost/async-validation/param/${name}`),
    issuePath: "params.value",
  },
  {
    source: "header",
    request: (name: string) =>
      new Request("http://localhost/async-validation/header", { headers: { "x-name": name } }),
    issuePath: "headers.value",
  },
] as const;

describe("async Zod schema validation", () => {
  beforeEach(() => {
    Container.reset();
    responseFilterErrors.length = 0;
  });

  it.each(asyncValidationCases)("accepts a valid $source", async ({ request }) => {
    const app = createApp({ controllers: [AsyncValidationController], securityValidation: "off" });
    const response = await app.fetch(request("ada"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ name: "ada" });
  });

  it.each(asyncValidationCases)(
    "rejects an invalid $source with a 422 Problem",
    async ({ request, issuePath }) => {
      const app = createApp({
        controllers: [AsyncValidationController],
        securityValidation: "off",
      });
      const response = await app.fetch(request("taken"));

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toMatchObject({
        code: "protocols-rest/request-validation-failed",
        issues: [{ path: issuePath, message: "name is taken" }],
      });
    },
  );

  it("accepts a response validated by an async refinement", async () => {
    const app = createApp({ controllers: [AsyncValidationController], securityValidation: "off" });
    const response = await app.fetch(new Request("http://localhost/async-validation/response/ada"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ name: "ada" });
  });

  it("routes an async response validation failure through the Problem filter", async () => {
    const app = createApp({ controllers: [AsyncValidationController], securityValidation: "off" });
    const response = await app.fetch(
      new Request("http://localhost/async-validation/response/taken"),
    );

    expect(response.status).toBe(500);
    expect(responseFilterErrors).toHaveLength(1);
    expect(responseFilterErrors[0]).toBeInstanceOf(ResponseValidationProblem);
    await expect(response.json()).resolves.toMatchObject({
      code: "protocols-rest/response-validation-failed",
      status: 500,
      detail: "An internal error occurred",
    });
  });
});

describe("HTTP pipe execution", () => {
  beforeEach(() => {
    Container.reset();
    executionOrder.length = 0;
    Container.set(ClassPipe, new ClassPipe());
    Container.set(MethodPipe, new MethodPipe());
    Container.set(AllowGuard, new AllowGuard());
    Container.set(OrderInterceptor, new OrderInterceptor());
    Container.set(FailingPipe, new FailingPipe());
    Container.set(ContextProtectionPipe, new ContextProtectionPipe());
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

  it("keeps route pipes away from framework context parameters", async () => {
    const app = createApp({
      controllers: [ContextPipeController],
      securityValidation: "off",
    });

    const response = await app.fetch(
      new Request("http://localhost/pipe-context/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "preserved" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      contextPreserved: true,
      value: "preserved",
    });
    expect(executionOrder).toEqual(["pipe:protected:body"]);

    const graph = app
      .describeRequestPipelineGraphs()
      .find((entry) => entry.target === "POST /pipe-context/inspect");
    expect(graph?.successOrder.filter((nodeId) => nodeId.startsWith("pipe:"))).toEqual([
      "pipe:0:0",
    ]);
  });
});
