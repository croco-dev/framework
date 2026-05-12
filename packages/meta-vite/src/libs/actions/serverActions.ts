import type { RuntimeContext } from '../render/types';

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
  schema?: import('zod').ZodSchema<T>;
  /** Action handler receiving parsed/validated data and optional runtime context */
  handler: (data: T, context?: RuntimeContext) => Promise<Response> | Response;
};

const registry = new Map<string, ServerActionConfig<unknown>>();

/**
 * Register a server action.
 * @throws Error if action name is already registered
 */
export function createServerAction<T>(config: ServerActionConfig<T>): void {
  if (registry.has(config.name)) {
    throw new Error(`ServerAction '${config.name}' already registered`);
  }
  registry.set(config.name, config as ServerActionConfig<unknown>);
}

/**
 * Dispatch a registered server action by name.
 * - Validates input against the registered schema (if any)
 * - Returns 404 if action not found
 * - Returns 400 if validation fails
 * - Passes RuntimeContext to the handler
 */
export async function dispatchServerAction(
  name: string,
  formData: FormData | Record<string, unknown>,
  context?: RuntimeContext
): Promise<Response> {
  const config = registry.get(name);
  if (!config) {
    return new Response(JSON.stringify({ code: 'ACTION_NOT_FOUND', name }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Convert FormData to plain object if needed
  const raw = formData instanceof FormData ? formDataToObject(formData) : formData;

  if (config.schema) {
    const parsed = config.schema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          code: 'VALIDATION_ERROR',
          fields: parsed.error.flatten().fieldErrors,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return config.handler(parsed.data, context);
  }

  return config.handler(raw as never, context);
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
export function createServerActionHandler(): {
  path: string;
  method: 'POST';
  handler: (request: Request) => Promise<Response>;
} {
  return {
    path: '/api/action',
    method: 'POST',
    handler: async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      const pathname = url.pathname;

      // Extract action name: /api/action/signup → signup
      const segments = pathname.split('/');
      if (
        segments.length !== 4 ||
        segments[0] !== '' ||
        segments[1] !== 'api' ||
        segments[2] !== 'action' ||
        !segments[3]
      ) {
        return new Response(JSON.stringify({ code: 'INVALID_PATH', message: 'Invalid action path' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const actionName = segments[3];
      const formData = await request.formData();

      return dispatchServerAction(actionName, formData);
    },
  };
}
