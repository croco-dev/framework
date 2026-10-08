import { OPERATOR_ONLY_PROBLEM_DETAIL, Problem, ProblemCategory } from "@croco/problems-core";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createServerActionRegistry,
  createServerAction,
  createServerActionHandler,
  createServerActionSuccess,
  dispatchServerAction,
  resetServerActions,
  unregisterServerAction,
} from "../libs/actions/serverActions";
import { createCloudflareHandler } from "../libs/providers/cloudflare";
import { createMetaFetchHandler } from "../libs/render/composeHandler";
import type { RuntimeContext } from "../libs/render/types";

function createExecutionContext(): ExecutionContext {
  return {
    waitUntil: () => {},
    passThroughOnException: () => {},
  };
}

class SignupClosedProblem extends Problem {
  readonly code = "test/signup-closed";
  readonly category = ProblemCategory.BusinessRuleViolation;

  constructor() {
    super("test/signup-closed", ProblemCategory.BusinessRuleViolation, "Signup is closed", {
      extensions: { recoveryAction: "join_waitlist" },
    });
  }
}

class PaymentGatewayProblem extends Problem {
  readonly code = "test/gateway-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor() {
    super(
      "test/gateway-failed",
      ProblemCategory.InternalServerError,
      "Stripe request failed for customer cus_123 at postgres://db.internal/prod",
      { extensions: { upstreamRequestId: "req_internal_9f2", sqlState: "57P01" } },
    );
  }
}

class SeatLimitProblem extends Problem {
  readonly code = "test/seat-limit";
  readonly category = ProblemCategory.Conflict;

  constructor() {
    super("test/seat-limit", ProblemCategory.Conflict, "Seat limit reached", {
      extensions: { max: 5, internalAccountId: "acct_internal_42" },
    });
  }
}

describe("Server Actions", () => {
  beforeEach(() => {
    resetServerActions();
  });

  it("registers and dispatches an action without schema", async () => {
    createServerAction({
      name: "greet",
      handler: async (data) => {
        return new Response(
          JSON.stringify({ message: `Hello, ${(data as { name: string }).name}!` }),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    });

    const response = await dispatchServerAction("greet", { name: "World" });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.message).toBe("Hello, World!");
  });

  it("dispatches an action with Zod schema validation", async () => {
    const schema = z.object({ email: z.string().email(), count: z.number() });

    createServerAction({
      name: "submit-form",
      schema,
      handler: async (data) => {
        return new Response(JSON.stringify({ received: data }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    const response = await dispatchServerAction("submit-form", {
      email: "test@example.com",
      count: 42,
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.received.email).toBe("test@example.com");
    expect(body.received.count).toBe(42);
  });

  it("returns Problem result when Zod validation fails", async () => {
    const schema = z.object({ email: z.string().email() });

    createServerAction({
      name: "validate-email",
      schema,
      handler: async () => new Response("ok"),
    });

    const response = await dispatchServerAction("validate-email", { email: "not-an-email" });
    expect(response.status).toBe(422);
    expect(response.headers.get("Content-Type")).toBe("application/problem+json");

    const body = await response.json();
    expect(body).toMatchObject({
      ok: false,
      kind: "validation",
      type: "about:blank",
      title: "Validation Error",
      status: 422,
      code: "meta-vite/server-action-validation-failed",
      detail: "Server action input validation failed",
      fields: {
        email: expect.arrayContaining([expect.any(String)]),
      },
    });
  });

  it("preserves field and form validation errors in the Problem response", async () => {
    const schema = z.object({ email: z.string() }).superRefine((_data, context) => {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Email is invalid",
      });
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Form is invalid",
      });
    });

    createServerAction({
      name: "validate-form",
      schema,
      handler: async () => new Response("ok"),
    });

    const response = await dispatchServerAction("validate-form", { email: "test@example.com" });
    expect(response.status).toBe(422);
    expect(response.headers.get("Content-Type")).toBe("application/problem+json");
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      kind: "validation",
      code: "meta-vite/server-action-validation-failed",
      fields: { email: ["Email is invalid"] },
      formErrors: ["Form is invalid"],
    });
  });

  it("returns Problem result when action is not registered", async () => {
    const response = await dispatchServerAction("nonexistent-action", {});
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe("application/problem+json");

    const body = await response.json();
    expect(body).toMatchObject({
      ok: false,
      kind: "action_not_found",
      type: "about:blank",
      title: "Not Found",
      status: 404,
      code: "meta-vite/server-action-not-found",
      detail: "Server action 'nonexistent-action' is not registered",
      actionName: "nonexistent-action",
    });
  });

  it("normalizes typed success results from action handlers", async () => {
    createServerAction({
      name: "typed-greet",
      output: {
        description: "Greeting payload",
        example: { message: "Hello, World!" },
      },
      problems: [{ code: "test/signup-closed", status: 422 }],
      handler: async (data) =>
        createServerActionSuccess({
          message: `Hello, ${(data as { name: string }).name}!`,
        }),
    });

    const response = await dispatchServerAction("typed-greet", { name: "World" });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");

    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { message: "Hello, World!" },
    });
  });

  it("normalizes domain Problems thrown by action handlers", async () => {
    createServerAction({
      name: "domain-problem",
      problems: [{ code: "test/signup-closed", status: 422 }],
      handler: async () => {
        throw new SignupClosedProblem();
      },
    });

    const response = await dispatchServerAction("domain-problem", {});
    expect(response.status).toBe(422);
    expect(response.headers.get("Content-Type")).toBe("application/problem+json");

    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      kind: "domain_problem",
      type: "about:blank",
      title: "Business Rule Violation",
      status: 422,
      code: "test/signup-closed",
      detail: "Signup is closed",
      recoveryAction: "join_waitlist",
    });
  });

  it("redacts operator-only Problem details and extensions", async () => {
    const registry = createServerActionRegistry();
    registry.register({
      name: "checkout",
      handler: async () => {
        throw new PaymentGatewayProblem();
      },
    });

    const response = await registry.dispatch("checkout", {});
    expect(response.status).toBe(500);
    expect(response.headers.get("Content-Type")).toBe("application/problem+json");
    await expect(response.json()).resolves.toEqual({
      type: "about:blank",
      title: "Internal Server Error",
      status: 500,
      code: "test/gateway-failed",
      detail: OPERATOR_ONLY_PROBLEM_DETAIL,
      ok: false,
      kind: "domain_problem",
    });
  });

  it("keeps public extensions and removes private 4xx extensions", async () => {
    const registry = createServerActionRegistry();
    registry.register({
      name: "reserve-seat",
      handler: async () => {
        throw new SeatLimitProblem();
      },
    });

    const response = await registry.dispatch("reserve-seat", {});
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      type: "about:blank",
      title: "Conflict",
      status: 409,
      code: "test/seat-limit",
      detail: "Seat limit reached",
      max: 5,
      ok: false,
      kind: "domain_problem",
    });
  });

  it("throws when registering duplicate action name", () => {
    createServerAction({
      name: "unique-action",
      handler: async () => new Response("ok"),
    });

    expect(() => {
      createServerAction({
        name: "unique-action",
        handler: async () => new Response("ok"),
      });
    }).toThrow("Server action 'unique-action' is already registered");
  });

  it("keeps duplicate action names isolated between scoped registries", async () => {
    const firstRegistry = createServerActionRegistry();
    const secondRegistry = createServerActionRegistry();

    firstRegistry.register({
      name: "shared-action",
      handler: async () => Response.json({ registry: "first" }),
    });
    secondRegistry.register({
      name: "shared-action",
      handler: async () => Response.json({ registry: "second" }),
    });

    const firstResponse = await firstRegistry.dispatch("shared-action", {});
    const secondResponse = await secondRegistry.dispatch("shared-action", {});

    await expect(firstResponse.json()).resolves.toEqual({ registry: "first" });
    await expect(secondResponse.json()).resolves.toEqual({ registry: "second" });
  });

  it("supports global unregister and reset cleanup", async () => {
    createServerAction({
      name: "cleanup-action",
      handler: async () => Response.json({ cleaned: false }),
    });

    expect(unregisterServerAction("cleanup-action")).toBe(true);
    const unregisteredResponse = await dispatchServerAction("cleanup-action", {});
    expect(unregisteredResponse.status).toBe(404);

    createServerAction({
      name: "cleanup-action",
      handler: async () => Response.json({ cleaned: false }),
    });
    resetServerActions();

    const resetResponse = await dispatchServerAction("cleanup-action", {});
    expect(resetResponse.status).toBe(404);
  });

  it("lets scoped registries reset without clearing the global registry", async () => {
    const scopedRegistry = createServerActionRegistry();

    createServerAction({
      name: "global-action",
      handler: async () => Response.json({ scope: "global" }),
    });
    scopedRegistry.register({
      name: "scoped-action",
      handler: async () => Response.json({ scope: "scoped" }),
    });

    scopedRegistry.clear();

    const scopedResponse = await scopedRegistry.dispatch("scoped-action", {});
    const globalResponse = await dispatchServerAction("global-action", {});

    expect(scopedResponse.status).toBe(404);
    await expect(globalResponse.json()).resolves.toEqual({ scope: "global" });
  });

  it("passes RuntimeContext to handler", async () => {
    createServerAction({
      name: "check-context",
      handler: async (data, context) => {
        return new Response(JSON.stringify({ platform: context?.platform ?? "none" }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    const response = await dispatchServerAction("check-context", {}, { platform: "cloudflare" });
    const body = await response.json();
    expect(body.platform).toBe("cloudflare");
  });

  it("converts FormData to object before validation", async () => {
    const schema = z.object({ name: z.string(), age: z.coerce.number() });

    createServerAction({
      name: "form-submit",
      schema,
      handler: async (data) => {
        return new Response(JSON.stringify({ received: data }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    const formData = new FormData();
    formData.append("name", "Alice");
    formData.append("age", "30");

    const response = await dispatchServerAction("form-submit", formData);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.received.name).toBe("Alice");
    expect(body.received.age).toBe(30);
  });

  it("preserves repeated FormData values as an array during validation", async () => {
    const schema = z.object({ name: z.string(), tags: z.array(z.string()) });

    createServerAction({
      name: "tagged-form-submit",
      schema,
      handler: async (data) => Response.json({ received: data }),
    });

    const formData = new FormData();
    formData.append("name", "Alice");
    formData.append("tags", "a");
    formData.append("tags", "b");
    formData.append("tags", "c");

    const response = await dispatchServerAction("tagged-form-submit", formData);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: { name: "Alice", tags: ["a", "b", "c"] },
    });
  });

  it("preserves repeated FormData values for reserved object keys", async () => {
    const schema = z.preprocess(
      (input) => {
        if (typeof input !== "object" || input === null) {
          return input;
        }

        return { values: Object.getOwnPropertyDescriptor(input, "__proto__")?.value };
      },
      z.object({ values: z.array(z.string()) }),
    );

    createServerAction({
      name: "reserved-key-form-submit",
      schema,
      handler: async (data) => Response.json({ received: data }),
    });

    const formData = new FormData();
    formData.append("__proto__", "first");
    formData.append("__proto__", "second");

    const response = await dispatchServerAction("reserved-key-form-submit", formData);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: { values: ["first", "second"] },
    });
  });
});

describe("Server Action HTTP Integration", () => {
  beforeEach(() => {
    resetServerActions();
  });

  it("handles POST /api/action/subscribe via composeHandler", async () => {
    createServerAction({
      name: "subscribe",
      handler: async (data) => {
        return new Response(
          JSON.stringify({ subscribed: true, email: (data as { email: string }).email }),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    });

    const handler = createMetaFetchHandler({
      apiRoutes: [createServerActionHandler()],
    });

    const formData = new FormData();
    formData.append("email", "test@example.com");

    const response = await handler(
      new Request("http://localhost/api/action/subscribe", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.subscribed).toBe(true);
    expect(body.email).toBe("test@example.com");
  });

  it("passes RuntimeContext from composeHandler to server action handlers", async () => {
    let observedContext: RuntimeContext | undefined;
    const context: RuntimeContext = {
      platform: "lambda",
      event: { requestId: "event-1" },
      lambdaContext: { awsRequestId: "lambda-1" },
    };

    createServerAction({
      name: "http-context",
      handler: async (_data, runtimeContext) => {
        observedContext = runtimeContext;
        return Response.json({
          platform: runtimeContext?.platform,
          requestId: (runtimeContext?.event as { requestId?: string } | undefined)?.requestId,
        });
      },
    });

    const handler = createMetaFetchHandler({
      apiRoutes: [createServerActionHandler()],
    });

    const response = await handler(
      new Request("http://localhost/api/action/http-context", {
        method: "POST",
        body: new FormData(),
      }),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      platform: "lambda",
      requestId: "event-1",
    });
    expect(observedContext).toBe(context);
  });

  it("passes Cloudflare RuntimeContext to server action handlers", async () => {
    const env = { TEST_BINDING: "bound-value" };
    const executionContext = createExecutionContext();

    createServerAction({
      name: "cloudflare-http-context",
      handler: async (_data, context) =>
        Response.json({
          platform: context?.platform,
          binding: (context?.env as { TEST_BINDING?: string } | undefined)?.TEST_BINDING,
          hasExecutionContext: context?.executionContext === executionContext,
        }),
    });

    const handler = createCloudflareHandler(
      createMetaFetchHandler({
        apiRoutes: [createServerActionHandler()],
      }),
    );

    const response = await handler(
      new Request("http://localhost/api/action/cloudflare-http-context", {
        method: "POST",
        body: new FormData(),
      }),
      env,
      executionContext,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      platform: "cloudflare",
      binding: "bound-value",
      hasExecutionContext: true,
    });
  });

  it("returns Problem result for unregistered action via HTTP", async () => {
    const handler = createMetaFetchHandler({
      apiRoutes: [createServerActionHandler()],
    });

    const response = await handler(
      new Request("http://localhost/api/action/nonexistent", {
        method: "POST",
        body: new FormData(),
      }),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe("application/problem+json");
    const body = await response.json();
    expect(body).toMatchObject({
      ok: false,
      kind: "action_not_found",
      code: "meta-vite/server-action-not-found",
      actionName: "nonexistent",
    });
  });

  it("returns Problem result for validation failure via HTTP", async () => {
    const schema = z.object({ email: z.string().email() });

    createServerAction({
      name: "signup",
      schema,
      handler: async () => {
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    const handler = createMetaFetchHandler({
      apiRoutes: [createServerActionHandler()],
    });

    const formData = new FormData();
    formData.append("email", "invalid-email");

    const response = await handler(
      new Request("http://localhost/api/action/signup", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(422);
    expect(response.headers.get("Content-Type")).toBe("application/problem+json");
    const body = await response.json();
    expect(body).toMatchObject({
      ok: false,
      kind: "validation",
      code: "meta-vite/server-action-validation-failed",
      fields: {
        email: expect.arrayContaining([expect.any(String)]),
      },
    });
  });

  it("returns Problem result for invalid action paths", async () => {
    const route = createServerActionHandler();

    const response = await route.handler(
      new Request("http://localhost/api/action/signup/extra", {
        method: "POST",
        body: new FormData(),
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toBe("application/problem+json");
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      kind: "invalid_path",
      title: "Bad Request",
      status: 400,
      code: "meta-vite/server-action-invalid-path",
      detail: "Invalid server action path",
      path: "/api/action/signup/extra",
    });
  });

  it("returns Problem result for non-form-data POST bodies", async () => {
    createServerAction({
      name: "json-post",
      handler: async () => new Response("ok"),
    });

    const route = createServerActionHandler();

    const response = await route.handler(
      new Request("http://localhost/api/action/json-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com" }),
      }),
    );

    expect(response.status).toBe(415);
    expect(response.headers.get("Content-Type")).toBe("application/problem+json");
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      kind: "invalid_content_type",
      title: "Unsupported Media Type",
      status: 415,
      code: "meta-vite/server-action-invalid-content-type",
      detail: "Server actions require a form-data request body",
      reason: "application/json",
    });
  });

  it("returns Problem result for malformed form bodies with a form content type", async () => {
    createServerAction({
      name: "malformed-post",
      handler: async () => new Response("ok"),
    });

    const route = createServerActionHandler();

    const response = await route.handler(
      new Request("http://localhost/api/action/malformed-post", {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data; boundary=----invalid" },
        body: "this is not valid multipart",
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toBe("application/problem+json");
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      kind: "malformed_body",
      title: "Bad Request",
      status: 400,
      code: "meta-vite/server-action-malformed-body",
      detail: "Server action request body could not be parsed",
    });
  });

  it("rethrows request aborts instead of mapping them to 415", async () => {
    createServerAction({
      name: "aborted-post",
      handler: async () => new Response("ok"),
    });

    const route = createServerActionHandler();
    const controller = new AbortController();
    const request = new Request("http://localhost/api/action/aborted-post", {
      method: "POST",
      body: new FormData(),
      signal: controller.signal,
    });
    const abortError = new DOMException("This operation was aborted", "AbortError");
    request.formData = () => Promise.reject(abortError);

    await expect(route.handler(request)).rejects.toBe(abortError);
  });

  it("returns 405 for non-POST method on action endpoint", async () => {
    const handler = createMetaFetchHandler({
      apiRoutes: [createServerActionHandler()],
    });

    const response = await handler(
      new Request("http://localhost/api/action/some-action", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
    await expect(response.json()).resolves.toEqual({ error: "Method Not Allowed" });
  });

  it("dispatches HTTP actions through a supplied scoped registry", async () => {
    const registry = createServerActionRegistry();

    registry.register({
      name: "scoped-http",
      handler: async (data) =>
        Response.json({ scope: "scoped", name: (data as { name: string }).name }),
    });

    const handler = createMetaFetchHandler({
      apiRoutes: [createServerActionHandler(registry)],
    });

    const formData = new FormData();
    formData.append("name", "Scoped");

    const response = await handler(
      new Request("http://localhost/api/action/scoped-http", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ scope: "scoped", name: "Scoped" });
  });
});
