import type { ZodSchema } from "zod";
import type { RuntimeContext } from "../render/types";

/**
 * Server Action configuration.
 * @example
 * createServerAction({
 *   name: 'submit-form',
 *   schema: z.object({ email: z.string().email(), name: z.string() }),
 *   handler: async (data, context) => {
 *     // context may be undefined
 *     return new Response(JSON.stringify({ success: true }), { status: 200 });
 *   },
 * });
 */
export type ServerActionConfig<T = unknown> = {
  /** Unique identifier for this action */
  name: string;
  /** Optional Zod schema for input validation */
  schema?: ZodSchema<T>;
  /** Action handler receiving parsed/validated data and optional runtime context */
  handler: (data: T, context?: RuntimeContext) => Promise<Response> | Response;
};

export class ServerActionRegistry {
  private readonly actions = new Map<string, ServerActionConfig<unknown>>();

  /**
   * Register a server action in this registry.
   * @throws Error if action name is already registered in this registry
   */
  register<T>(config: ServerActionConfig<T>): void {
    if (this.actions.has(config.name)) {
      throw new Error(`ServerAction '${config.name}' already registered`);
    }
    this.actions.set(config.name, config as ServerActionConfig<unknown>);
  }

  /**
   * Remove a registered server action from this registry.
   */
  unregister(name: string): boolean {
    return this.actions.delete(name);
  }

  /**
   * Clear all server actions from this registry.
   */
  clear(): void {
    this.actions.clear();
  }

  /**
   * Dispatch a registered server action by name.
   * - Validates input against the registered schema (if any)
   * - Returns 404 if action not found
   * - Returns 400 if validation fails
   * - Passes RuntimeContext to the handler
   */
  async dispatch(
    name: string,
    formData: FormData | Record<string, unknown>,
    context?: RuntimeContext,
  ): Promise<Response> {
    const config = this.actions.get(name);
    if (!config) {
      return new Response(JSON.stringify({ code: "ACTION_NOT_FOUND", name }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Convert FormData to plain object if needed
    const raw = formData instanceof FormData ? formDataToObject(formData) : formData;

    if (config.schema) {
      const parsed = config.schema.safeParse(raw);
      if (!parsed.success) {
        return new Response(
          JSON.stringify({
            code: "VALIDATION_ERROR",
            fields: parsed.error.flatten().fieldErrors,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      return config.handler(parsed.data, context);
    }

    return config.handler(raw as never, context);
  }
}

/**
 * Create an isolated server action registry for app, test, or HMR lifecycle scoping.
 */
export function createServerActionRegistry(): ServerActionRegistry {
  return new ServerActionRegistry();
}

const globalServerActionRegistry = createServerActionRegistry();

/**
 * Register a server action in the global registry by default.
 * @throws Error if action name is already registered in the selected registry
 */
export function createServerAction<T>(
  config: ServerActionConfig<T>,
  registry: ServerActionRegistry = globalServerActionRegistry,
): void {
  registry.register(config);
}

/**
 * Remove a server action from the global registry by default.
 */
export function unregisterServerAction(
  name: string,
  registry: ServerActionRegistry = globalServerActionRegistry,
): boolean {
  return registry.unregister(name);
}

/**
 * Clear all actions from the global registry by default.
 */
export function resetServerActions(
  registry: ServerActionRegistry = globalServerActionRegistry,
): void {
  registry.clear();
}

/**
 * Dispatch a registered server action by name from the global registry by default.
 * - Validates input against the registered schema (if any)
 * - Returns 404 if action not found
 * - Returns 400 if validation fails
 * - Passes RuntimeContext to the handler
 */
export async function dispatchServerAction(
  name: string,
  formData: FormData | Record<string, unknown>,
  context?: RuntimeContext,
  registry: ServerActionRegistry = globalServerActionRegistry,
): Promise<Response> {
  return registry.dispatch(name, formData, context);
}

// Workaround: Node.js FormData type does not include entries() method
// Cast through unknown to satisfy both DOM and Node types
type FormDataWithEntries = { entries(): IterableIterator<[string, string]> };

/**
 * Convert FormData to plain object for Zod validation.
 */
function formDataToObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of (formData as unknown as FormDataWithEntries).entries()) {
    result[key] = value;
  }

  return result;
}

/**
 * Create a fetch handler that dispatches Server Actions via HTTP.
 * Integrates with composeHandler's apiRoutes dispatch:
 * - Base path: `/api/action`
 * - Extracts action name from URL pathname (e.g., `/api/action/signup` → `signup`)
 * - Method: POST only (Server Actions are write operations)
 * - Passes FormData to dispatchServerAction
 *
 * Usage with composeHandler:
 * ```ts
 * const handler = createMetaFetchHandler({
 *   apiRoutes: [createServerActionHandler()],
 *   pageHandler: renderServer,
 * });
 * ```
 */
export function createServerActionHandler(
  registry: ServerActionRegistry = globalServerActionRegistry,
): {
  path: string;
  method: "POST";
  handler: (request: Request, context?: RuntimeContext) => Promise<Response>;
} {
  return {
    path: "/api/action",
    method: "POST",
    handler: async (request: Request, context?: RuntimeContext): Promise<Response> => {
      const url = new URL(request.url);
      const pathname = url.pathname;

      // Extract action name: /api/action/signup → signup
      const segments = pathname.split("/");
      if (
        segments.length !== 4 ||
        segments[0] !== "" ||
        segments[1] !== "api" ||
        segments[2] !== "action" ||
        !segments[3]
      ) {
        return new Response(
          JSON.stringify({ code: "INVALID_PATH", message: "Invalid action path" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const actionName = segments[3];
      const formData = await request.formData();

      return registry.dispatch(actionName, formData, context);
    },
  };
}
