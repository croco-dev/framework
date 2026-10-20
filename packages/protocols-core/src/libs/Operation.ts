import { ProblemFactory } from "@croco/problems-core";
import type { z } from "zod";
import { getUnsupportedZodMajor, isZodType, normalizeZodQueryInput } from "./SchemaDescriptor";

/** Transport-independent, explicitly authorized business operation contract. */
export type OperationDefinition<
  Input extends z.ZodType,
  Output extends z.ZodType,
  Context,
  Kind extends "query" | "command" = "query" | "command",
> = {
  readonly id: string;
  readonly kind: Kind;
  readonly input: Input;
  readonly output: Output;
  /** Runs before input is read or parsed. Throw a Problem to deny access. */
  readonly authorize: (context: Context) => void | Promise<void>;
  /** Runs on parsed domain input, after authorization and before the handler. */
  readonly policy?: (input: z.output<Input>, context: Context) => void | Promise<void>;
};

export type OperationHandler<Input extends z.ZodType, Output extends z.ZodType, Context> = (
  input: z.output<Input>,
  context: Context,
) => z.input<Output> | Promise<z.input<Output>>;

export type Operation<
  Input extends z.ZodType,
  Output extends z.ZodType,
  Context,
  Kind extends "query" | "command" = "query" | "command",
> = {
  readonly definition: OperationDefinition<Input, Output, Context, Kind>;
  /** The caller supplies server-verified authority separately from domain input. */
  readonly invoke: (input: z.input<Input>, context: Context) => Promise<z.output<Output>>;
  /**
   * Adapter boundary: authorization completes before the untrusted input source is read.
   * Query encoding retains schema-aware repeated-value selection before domain parsing.
   */
  readonly dispatch: (
    context: Context,
    readInput: () => unknown | Promise<unknown>,
    inputEncoding?: "query",
  ) => Promise<z.output<Output>>;
};

export function defineOperation<
  Input extends z.ZodType,
  Output extends z.ZodType,
  Context,
  const Kind extends "query" | "command" = "query" | "command",
>(
  definition: OperationDefinition<Input, Output, Context, Kind>,
): OperationDefinition<Input, Output, Context, Kind> {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*(\.[a-zA-Z][a-zA-Z0-9_-]*)+$/.test(definition.id)) {
    throw invalidOperationDefinition(
      "Operation ids require a domain and name, for example product.detail",
    );
  }
  if (definition.kind !== "query" && definition.kind !== "command") {
    throw invalidOperationDefinition("Operation kind must be query or command");
  }
  if (
    !isZodType(definition.input) ||
    !isZodType(definition.output) ||
    getUnsupportedZodMajor(definition.input) !== undefined ||
    getUnsupportedZodMajor(definition.output) !== undefined ||
    typeof definition.authorize !== "function" ||
    (definition.policy !== undefined && typeof definition.policy !== "function")
  ) {
    throw invalidOperationDefinition(
      "Operations require Zod 3 input/output schemas and an explicit authorization function",
    );
  }
  return Object.freeze({ ...definition });
}

/** Bind either a function or a generated class-method factory to the same contract. */
export function createOperation<
  Input extends z.ZodType,
  Output extends z.ZodType,
  Context,
  const Kind extends "query" | "command" = "query" | "command",
>(
  definition: OperationDefinition<Input, Output, Context, Kind>,
  handler: OperationHandler<NoInfer<Input>, NoInfer<Output>, NoInfer<Context>>,
): Operation<Input, Output, Context, Kind> {
  const contract = defineOperation(definition);
  if (typeof handler !== "function") {
    throw invalidOperationDefinition("Operations require a callable handler");
  }
  const dispatch = async (
    context: Context,
    readInput: () => unknown | Promise<unknown>,
    inputEncoding?: "query",
  ): Promise<z.output<Output>> => {
    const authorization = await contract.authorize(context);
    if (authorization !== undefined) {
      throw ProblemFactory.internalServerError(
        "protocols-core/invalid-operation-authorization",
        "Operation authorization must complete without a result or throw a Problem to deny access",
      );
    }
    const rawInput = await readInput();
    const normalized =
      inputEncoding === "query" &&
      typeof rawInput === "object" &&
      rawInput !== null &&
      !Array.isArray(rawInput)
        ? normalizeZodQueryInput(contract.input, rawInput as Record<string, unknown>)
        : { input: rawInput, schema: contract.input, repeatedScalarFields: [] };
    const parsed =
      normalized.repeatedScalarFields.length > 0
        ? {
            success: false as const,
            error: {
              issues: normalized.repeatedScalarFields.map((path) => ({
                path: [path],
                code: "invalid_type" as const,
              })),
            },
          }
        : await normalized.schema.safeParseAsync(normalized.input);
    if (!parsed.success) {
      throw ProblemFactory.validationError(
        "protocols-core/operation-input-invalid",
        `Input for operation '${contract.id}' is invalid`,
        {
          extensions: {
            operationId: contract.id,
            issues: parsed.error.issues.map(({ path, code }) => ({ path, code })),
          },
        },
      );
    }
    const policy = await contract.policy?.(parsed.data, context);
    if (policy !== undefined) {
      throw ProblemFactory.internalServerError(
        "protocols-core/invalid-operation-policy",
        "Operation policy must complete without a result or throw a Problem to deny access",
      );
    }
    const result = await handler(parsed.data, context);
    const projected = await contract.output.safeParseAsync(result);
    if (!projected.success) {
      throw ProblemFactory.internalServerError(
        "protocols-core/operation-output-invalid",
        `Output for operation '${contract.id}' is invalid`,
      );
    }
    return projected.data;
  };
  return Object.freeze({
    definition: contract,
    dispatch,
    invoke: (input: z.input<Input>, context: Context) => dispatch(context, () => input),
  });
}

function invalidOperationDefinition(detail: string) {
  return ProblemFactory.internalServerError("protocols-core/invalid-operation-definition", detail);
}
