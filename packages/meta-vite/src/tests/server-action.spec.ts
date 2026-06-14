import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createServerAction,
  createServerActionHandler,
  dispatchServerAction,
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

describe("Server Actions", () => {
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

  it("returns 400 when Zod validation fails", async () => {
    const schema = z.object({ email: z.string().email() });

    createServerAction({
      name: "validate-email",
      schema,
      handler: async () => new Response("ok"),
    });

    const response = await dispatchServerAction("validate-email", { email: "not-an-email" });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.fields).toHaveProperty("email");
  });

  it("returns 404 when action is not registered", async () => {
    const response = await dispatchServerAction("nonexistent-action", {});
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.code).toBe("ACTION_NOT_FOUND");
    expect(body.name).toBe("nonexistent-action");
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
    }).toThrow("ServerAction 'unique-action' already registered");
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
});

describe("Server Action HTTP Integration", () => {
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

  it("returns 404 for unregistered action via HTTP", async () => {
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
    const body = await response.json();
    expect(body.code).toBe("ACTION_NOT_FOUND");
  });

  it("returns 400 for validation failure via HTTP", async () => {
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

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.fields).toHaveProperty("email");
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

    expect(response.status).toBe(404);
  });
});
