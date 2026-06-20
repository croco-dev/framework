import { Problem, ProblemCategory } from "@croco/problems-core";
import type { ProblemDetails } from "@croco/problems-core";
import type { ZodSchema } from "zod";
import type { RuntimeContext } from "../render/types";

export type ServerActionValidationFields = Record<string, readonly string[]>;

export type ServerActionProblemKind =
  | "action_not_found"
  | "invalid_path"
  | "validation"
  | "domain_problem";

export type ServerActionProblemContract<Code extends string = string> = {
  readonly code: Code;
  readonly status?: number;
  readonly description?: string;
  readonly type?: string;
};

export type ServerActionOutputContract<TOutput = unknown> = {
  readonly description?: string;
  readonly example?: TOutput;
  readonly schema?: unknown;
};

export type ServerActionSuccessResult<TOutput = unknown> = {
  readonly ok: true;
  readonly data: TOutput;
};

export type ServerActionFailureResult = ProblemDetails & {
  readonly ok: false;
  readonly kind: ServerActionProblemKind;
  readonly actionName?: string;
  readonly path?: string;
  readonly fields?: ServerActionValidationFields;
  readonly formErrors?: readonly string[];
};

export type ServerActionResult<TOutput = unknown> =
  | ServerActionSuccessResult<TOutput>
  | ServerActionFailureResult;

export type ServerActionHandlerResult<TOutput = unknown> =
  | Response
  | ServerActionSuccessResult<TOutput>;

export class ServerActionNotFoundProblem extends Problem {
  readonly code = "meta-vite/server-action-not-found";
  readonly category = ProblemCategory.NotFound;

  constructor(actionName: string) {
    super(
      "meta-vite/server-action-not-found",
      ProblemCategory.NotFound,
      `Server action '${actionName}' is not registered`,
      { extensions: { actionName } },
    );
  }
}

export class ServerActionInvalidPathProblem extends Problem {
  readonly code = "meta-vite/server-action-invalid-path";
  readonly category = ProblemCategory.BadRequest;

  constructor(path: string) {
    super(
      "meta-vite/server-action-invalid-path",
      ProblemCategory.BadRequest,
      "Invalid server action path",
      { extensions: { path } },
    );
  }
}

export class ServerActionValidationProblem extends Problem {
  readonly code = "meta-vite/server-action-validation-failed";
  readonly category = ProblemCategory.ValidationError;

  constructor(fields: ServerActionValidationFields, formErrors: readonly string[]) {
    super(
      "meta-vite/server-action-validation-failed",
      ProblemCategory.ValidationError,
      "Server action input validation failed",
      { extensions: { fields, formErrors } },
    );
  }
}

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
export type ServerActionConfig<
  TInput = unknown,
  TOutput = unknown,
  TProblemCode extends string = string,
> = {
  /** Unique identifier for this action */
  name: string;
  /** Optional Zod schema for input validation */
  schema?: ZodSchema<TInput>;
  /** Optional output contract metadata for codegen and documentation */
  output?: ServerActionOutputContract<TOutput>;
  /** Optional declared domain Problems that the handler can surface */
  problems?: readonly ServerActionProblemContract<TProblemCode>[];
  /** Action handler receiving parsed/validated data and optional runtime context */
  handler: (
    data: TInput,
    context?: RuntimeContext,
  ) => Promise<ServerActionHandlerResult<TOutput>> | ServerActionHandlerResult<TOutput>;
};

export class ServerActionRegistry {
  private readonly actions = new Map<string, ServerActionConfig<unknown, unknown>>();

  /**
   * Register a server action in this registry.
   * @throws Error if action name is already registered in this registry
   */
  register<TInput, TOutput, TProblemCode extends string>(
    config: ServerActionConfig<TInput, TOutput, TProblemCode>,
  ): void {
    if (this.actions.has(config.name)) {
      throw new Error(`ServerAction '${config.name}' already registered`);
    }
    this.actions.set(config.name, config as ServerActionConfig<unknown, unknown>);
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
   * - Returns 422 if validation fails
   * - Passes RuntimeContext to the handler
   */
  async dispatch(
    name: string,
    formData: FormData | Record<string, unknown>,
    context?: RuntimeContext,
  ): Promise<Response> {
    const config = this.actions.get(name);
    if (!config) {
      return createServerActionProblemResponse(
        new ServerActionNotFoundProblem(name),
        "action_not_found",
      );
    }

    // Convert FormData to plain object if needed
    const raw = formData instanceof FormData ? formDataToObject(formData) : formData;

    let data: unknown = raw;

    if (config.schema) {
      const parsed = config.schema.safeParse(raw);
      if (!parsed.success) {
        const flattened = parsed.error.flatten();
        return createServerActionProblemResponse(
          new ServerActionValidationProblem(
            normalizeValidationFields(flattened.fieldErrors),
            flattened.formErrors,
          ),
          "validation",
        );
      }
      data = parsed.data;
    }

    try {
      return normalizeServerActionHandlerResult(await config.handler(data, context));
    } catch (error) {
      if (error instanceof Problem) {
        return createServerActionProblemResponse(error, "domain_problem");
      }

      throw error;
    }
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
export function createServerAction<TInput, TOutput = unknown, TProblemCode extends string = string>(
  config: ServerActionConfig<TInput, TOutput, TProblemCode>,
  registry: ServerActionRegistry = globalServerActionRegistry,
): void {
  registry.register(config);
}

export function createServerActionSuccess<TOutput>(
  data: TOutput,
): ServerActionSuccessResult<TOutput> {
  return { ok: true, data };
}

export function createServerActionSuccessResponse<TOutput>(
  data: TOutput,
  init: ResponseInit = {},
): Response {
  return createJsonResponse(createServerActionSuccess(data), init);
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
 * - Returns 422 if validation fails
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

function normalizeValidationFields(
  fieldErrors: Record<string, string[] | undefined>,
): ServerActionValidationFields {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => {
      const [, messages] = entry;
      return Array.isArray(messages) && messages.length > 0;
    }),
  );
}

function normalizeServerActionHandlerResult(result: ServerActionHandlerResult): Response {
  if (result instanceof Response) {
    return result;
  }

  return createJsonResponse(result);
}

function createServerActionProblemResponse(
  problem: Problem,
  kind: ServerActionProblemKind,
): Response {
  const body: ServerActionFailureResult = {
    ...problem.toJSON(),
    ok: false,
    kind,
  };

  return createJsonResponse(body, { status: body.status }, "application/problem+json");
}

function createJsonResponse(
  body: unknown,
  init: ResponseInit = {},
  contentType = "application/json",
): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", contentType);
  }

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
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
        return createServerActionProblemResponse(
          new ServerActionInvalidPathProblem(pathname),
          "invalid_path",
        );
      }

      const actionName = segments[3];
      const formData = await request.formData();

      return registry.dispatch(actionName, formData, context);
    },
  };
}
