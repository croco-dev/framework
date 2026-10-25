import { compareStrings } from "../../../../tooling/compareStrings.mjs";
import type { z } from "zod";

export const CONTRACT_SCHEMA_JSON_UNSAFE_DIAGNOSTIC_CODE = "contract-schema-json-unsafe";
export const CONTRACT_SCHEMA_ZOD_EFFECTS_UNWRAPPED_DIAGNOSTIC_CODE =
  "contract-schema-zod-effects-unwrapped";

export type ContractSchemaPrimitiveValue = string | number | boolean | null;
export type ContractSchemaJsonSafeStatus = "supported" | "unsupported";
export type ContractSchemaDiagnosticSeverity = "error" | "warning";

export type ContractSchemaDiagnostic = {
  readonly code: string;
  readonly severity: ContractSchemaDiagnosticSeverity;
  readonly typeName: string;
  readonly message: string;
  readonly schemaPath: readonly string[];
};

export type ContractSchemaSupportMatrixEntry = {
  readonly typeName: string;
  readonly kind: string;
  readonly jsonSafe: ContractSchemaJsonSafeStatus;
  readonly note: string;
};

export type ContractSchemaDescriptor = {
  readonly kind: string;
  readonly typeName: string;
  readonly jsonSafe: boolean;
  readonly unsupportedReason?: string;
  readonly effectType?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: boolean;
  readonly exclusiveMaximum?: boolean;
  readonly integer?: boolean;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly fields?: readonly ContractSchemaFieldDescriptor[];
  readonly element?: ContractSchemaDescriptor | null;
  readonly inner?: ContractSchemaDescriptor | null;
  readonly options?: readonly ContractSchemaDescriptor[];
  readonly values?: readonly (string | number)[];
  readonly value?: ContractSchemaPrimitiveValue;
};

export type ContractSchemaFieldDescriptor = {
  readonly name: string;
  readonly required: boolean;
  readonly schema: ContractSchemaDescriptor;
};

export const JSON_SAFE_ZOD_SCHEMA_SUPPORT_MATRIX = [
  {
    typeName: "ZodString",
    kind: "string",
    jsonSafe: "supported",
    note: "Emitted as a JSON string contract with min/max/length checks normalized to minLength/maxLength. Length checks combined with trim/case mutations are unsupported. Other string checks are not represented.",
  },
  {
    typeName: "ZodNumber",
    kind: "number",
    jsonSafe: "supported",
    note: "Emitted as a JSON number contract with finite minimum/maximum, exclusive bounds and integer checks. multipleOf and non-finite bounds are unsupported and produce diagnostics. Arbitrary refinements are not inferred.",
  },
  {
    typeName: "ZodBoolean",
    kind: "boolean",
    jsonSafe: "supported",
    note: "Emitted as a JSON boolean contract.",
  },
  {
    typeName: "ZodNull",
    kind: "null",
    jsonSafe: "supported",
    note: "Emitted as a JSON null contract.",
  },
  {
    typeName: "ZodLiteral",
    kind: "literal",
    jsonSafe: "supported",
    note: "Supported for string, number, boolean, and null literal values.",
  },
  {
    typeName: "ZodEnum",
    kind: "enum",
    jsonSafe: "supported",
    note: "Supported for string enum values.",
  },
  {
    typeName: "ZodObject",
    kind: "object",
    jsonSafe: "supported",
    note: "Supported when every field schema is JSON-safe.",
  },
  {
    typeName: "ZodArray",
    kind: "array",
    jsonSafe: "supported",
    note: "Supported when the element schema is JSON-safe; min/max/length are normalized to minItems/maxItems. Cardinalities must be finite non-negative integers. Arbitrary refinements are not inferred.",
  },
  {
    typeName: "ZodRecord",
    kind: "record",
    jsonSafe: "supported",
    note: "Supported for z.string()-keyed records when the value schema is JSON-safe.",
  },
  {
    typeName: "ZodUnion",
    kind: "union",
    jsonSafe: "supported",
    note: "Supported when every option schema is JSON-safe.",
  },
  {
    typeName: "ZodDiscriminatedUnion",
    kind: "union",
    jsonSafe: "supported",
    note: "Supported when every option schema is JSON-safe.",
  },
  {
    typeName: "ZodOptional",
    kind: "optional",
    jsonSafe: "supported",
    note: "Unwraps to the inner schema and marks object fields as optional.",
  },
  {
    typeName: "ZodNullable",
    kind: "nullable",
    jsonSafe: "supported",
    note: "Unwraps to the inner schema plus null.",
  },
  {
    typeName: "ZodDefault",
    kind: "default",
    jsonSafe: "supported",
    note: "Unwraps to the inner schema and marks object fields as optional.",
  },
  {
    typeName: "ZodCatch",
    kind: "catch",
    jsonSafe: "supported",
    note: "Unwraps to the inner schema while retaining the runtime fallback.",
  },
  {
    typeName: "ZodEffects",
    kind: "effects",
    jsonSafe: "supported",
    note: "Zod 4 custom refinement checks normalize to an effects descriptor with a warning; transforms and preprocessors are rejected.",
  },
  {
    typeName: "ZodReadonly",
    kind: "readonly",
    jsonSafe: "supported",
    note: "Unwraps to the inner schema.",
  },
  {
    typeName: "ZodAny",
    kind: "any",
    jsonSafe: "supported",
    note: "Emitted as an explicit unknown JSON value contract.",
  },
  {
    typeName: "ZodUnknown",
    kind: "unknown",
    jsonSafe: "supported",
    note: "Emitted as an explicit unknown JSON value contract.",
  },
  {
    typeName: "ZodNever",
    kind: "never",
    jsonSafe: "supported",
    note: "Emitted as an impossible contract branch.",
  },
  {
    typeName: "ZodDate",
    kind: "date",
    jsonSafe: "unsupported",
    note: "Date instances are not JSON values; use an ISO string contract.",
  },
  {
    typeName: "ZodBigInt",
    kind: "bigint",
    jsonSafe: "unsupported",
    note: "BigInt values are not JSON values; use a string or number boundary contract.",
  },
  {
    typeName: "ZodFunction",
    kind: "function",
    jsonSafe: "unsupported",
    note: "Functions are not serializable JSON contract values.",
  },
  {
    typeName: "ZodMap",
    kind: "map",
    jsonSafe: "unsupported",
    note: "Maps are not JSON objects with stable string keys; use an object or array contract.",
  },
  {
    typeName: "ZodSet",
    kind: "set",
    jsonSafe: "unsupported",
    note: "Sets are not JSON arrays with stable element semantics; use an array contract.",
  },
  {
    typeName: "ZodPromise",
    kind: "promise",
    jsonSafe: "unsupported",
    note: "Promises are runtime behavior, not JSON contract values.",
  },
  {
    typeName: "ZodSymbol",
    kind: "symbol",
    jsonSafe: "unsupported",
    note: "Symbols are not JSON values.",
  },
  {
    typeName: "ZodNaN",
    kind: "nan",
    jsonSafe: "unsupported",
    note: "NaN is not a JSON number.",
  },
  {
    typeName: "ZodVoid",
    kind: "void",
    jsonSafe: "unsupported",
    note: "Void is not a JSON value; omit the response schema for empty responses.",
  },
  {
    typeName: "ZodUndefined",
    kind: "undefined",
    jsonSafe: "unsupported",
    note: "Undefined is not a JSON value; use optional object fields or omit the schema.",
  },
] as const satisfies readonly ContractSchemaSupportMatrixEntry[];

type ZodDefinition = {
  readonly checks?: readonly { readonly _zod: { readonly def: Record<string, unknown> } }[];
  readonly shape?: unknown;
  readonly in?: unknown;
  readonly out?: unknown;
  readonly discriminator?: unknown;
  readonly innerType?: unknown;
  readonly type?: unknown;
  readonly check?: unknown;
  readonly format?: unknown;
  readonly element?: unknown;
  readonly keyType?: unknown;
  readonly valueType?: unknown;
  readonly options?: unknown;
  readonly values?: unknown;
  readonly entries?: unknown;
  readonly value?: unknown;
  readonly defaultValue?: unknown | (() => unknown);
  readonly catchall?: unknown;
};

type TransparentZodWrapperChildKey = "innerType";

const TRANSPARENT_ZOD_WRAPPER_CHILD_KEYS: Readonly<Record<string, TransparentZodWrapperChildKey>> =
  {
    ZodOptional: "innerType",
    ZodNullable: "innerType",
    ZodDefault: "innerType",
    ZodCatch: "innerType",
    ZodReadonly: "innerType",
  };

const PARAMETER_SCHEMA_CACHE = new WeakMap<z.ZodType, z.ZodType>();
const ARRAY_INPUT_SCHEMA_CACHE = new WeakMap<object, z.ZodType | null>();

export function describeZodSchema(
  schema: z.ZodType | null | undefined,
): ContractSchemaDescriptor | null {
  if (!schema) {
    return null;
  }

  return describeUnknownSchema(schema, new Set());
}

export function getSchemaDescriptorDiagnostics(
  descriptor: ContractSchemaDescriptor | null,
): readonly ContractSchemaDiagnostic[] {
  if (!descriptor) {
    return [];
  }

  return collectSchemaDescriptorDiagnostics(descriptor, []);
}

export function formatSchemaDiagnostic(diagnostic: ContractSchemaDiagnostic): string {
  const location = diagnostic.schemaPath.length > 0 ? ` at ${diagnostic.schemaPath.join(".")}` : "";

  return `${diagnostic.code}${location}: ${diagnostic.message}`;
}

export function unwrapZodEffectsSchema<TSchema extends z.ZodType | null | undefined>(
  schema: TSchema,
): TSchema {
  // Refinements are checks on the original schema in Zod 4, not a wrapper to remove.
  return schema;
}

export function getZodSchemaTypeName(schema: unknown): string {
  return getSchemaTypeName(schema);
}

export function getZodInnerSchema(schema: unknown): unknown {
  const definition = getZodDefinition(schema);

  return definition?.innerType ?? definition?.in;
}

/**
 * Returns whether a schema accepts an array without changing its input shape.
 *
 * Optional, nullable, default, catch, branded, readonly, and refinement wrappers
 * preserve array input. Transform and preprocess effects remain opaque because
 * they may change the runtime value shape.
 */
export function isZodArraySchema(schema: unknown): boolean {
  return getTransparentZodArraySchema(schema) !== undefined;
}

/**
 * Returns whether a parameter schema explicitly accepts array input.
 *
 * Arrays, any, unknown, transparent wrappers and refinements around them, and
 * ordinary unions containing an array-capable option accept repeated values.
 * Value-changing effects remain opaque so coercion and preprocessing cannot
 * silently reinterpret repeated scalar parameters.
 */
export function acceptsZodArrayInput(schema: unknown): boolean {
  return getZodArrayInputSchema(schema) !== undefined;
}

/**
 * Projects a parameter schema to the branches that preserve array input.
 *
 * Scalar and value-changing union branches are removed so their coercion,
 * preprocessing, or catch behavior cannot consume repeated parameter values.
 * The projection is cached by source schema for request-path reuse.
 */
export function getZodArrayInputSchema(schema: unknown): z.ZodType | undefined {
  if (!isRecord(schema)) {
    return undefined;
  }

  const cachedSchema = ARRAY_INPUT_SCHEMA_CACHE.get(schema);
  if (cachedSchema !== undefined) {
    return cachedSchema ?? undefined;
  }

  const projectedSchema = projectZodArrayInputSchema(schema, new Map());
  const result = isZodType(projectedSchema) ? projectedSchema : undefined;
  ARRAY_INPUT_SCHEMA_CACHE.set(schema, result ?? null);
  return result;
}

function projectZodArrayInputSchema(
  schema: unknown,
  projectedSchemas: Map<object, unknown | undefined>,
): unknown | undefined {
  if (!isRecord(schema)) {
    return undefined;
  }

  if (projectedSchemas.has(schema)) {
    return projectedSchemas.get(schema);
  }

  projectedSchemas.set(schema, undefined);

  const typeName = getSchemaTypeName(schema);
  if (typeName === "ZodArray" || typeName === "ZodAny" || typeName === "ZodUnknown") {
    projectedSchemas.set(schema, schema);
    return schema;
  }

  const definition = getZodDefinition(schema);
  if (!definition) {
    return undefined;
  }

  const childKey = getCatchRewriteChildKey(typeName);
  if (childKey) {
    const child = definition[childKey];
    const projectedChild = projectZodArrayInputSchema(child, projectedSchemas);
    if (projectedChild === undefined) {
      return undefined;
    }

    const projected =
      typeName === "ZodCatch"
        ? removeCatchFallback(schema, projectedChild)
        : projectedChild === child
          ? schema
          : reconstructZodSchema(schema, {
              [childKey]: projectedChild,
            });
    projectedSchemas.set(schema, projected);
    return projected;
  }

  if (typeName === "ZodUnion" && Array.isArray(definition?.options)) {
    const projectedOptions: unknown[] = [];
    for (const option of definition.options) {
      const projectedOption = projectZodArrayInputSchema(option, projectedSchemas);
      if (projectedOption !== undefined) {
        projectedOptions.push(projectedOption);
      }
    }

    if (projectedOptions.length === 0) {
      return undefined;
    }

    const projected =
      projectedOptions.length === 1 && !definition.checks?.length
        ? projectedOptions[0]
        : definition.options.length === projectedOptions.length &&
            definition.options.every((option, index) => option === projectedOptions[index])
          ? schema
          : reconstructZodSchema(schema, {
              options: projectedOptions,
            });
    projectedSchemas.set(schema, projected);
    return projected;
  }

  return undefined;
}

/**
 * Removes catch wrappers that parameter-schema consumers cannot interpret.
 *
 * Transparent wrappers and ordinary union options are reconstructed only when
 * they contain a catch. Value-changing effects and discriminated unions remain opaque.
 */
export function unwrapZodParameterSchema<TSchema extends z.ZodType | null | undefined>(
  schema: TSchema,
): TSchema {
  if (!schema) {
    return schema;
  }

  const cachedSchema = PARAMETER_SCHEMA_CACHE.get(schema);
  if (cachedSchema) {
    return cachedSchema as TSchema;
  }

  const rewrittenSchema = rewriteZodCatchSchemas(schema, new Map()) as z.ZodType;
  PARAMETER_SCHEMA_CACHE.set(schema, rewrittenSchema);
  return rewrittenSchema as TSchema;
}

export function getZodArrayElementSchema(schema: unknown): unknown {
  const arraySchema = getTransparentZodArraySchema(schema);
  const definition = getZodDefinition(arraySchema);

  return definition?.element;
}

function getTransparentZodArraySchema(schema: unknown): unknown | undefined {
  const unwrapped = getTransparentZodSchema(schema);

  return getSchemaTypeName(unwrapped) === "ZodArray" ? unwrapped : undefined;
}

function getTransparentZodSchema(schema: unknown): unknown {
  const seen = new Set<object>();
  let current = schema;

  while (isRecord(current) && !seen.has(current)) {
    seen.add(current);

    const typeName = getSchemaTypeName(current);
    if (isTransparentArrayWrapper(typeName)) {
      current = getZodInnerSchema(current);
      continue;
    }

    break;
  }

  return current;
}

function rewriteZodCatchSchemas(schema: unknown, rewrittenSchemas: Map<object, unknown>): unknown {
  if (!isRecord(schema)) {
    return schema;
  }

  if (rewrittenSchemas.has(schema)) {
    return rewrittenSchemas.get(schema);
  }

  rewrittenSchemas.set(schema, schema);

  const typeName = getSchemaTypeName(schema);
  const definition = getZodDefinition(schema);
  if (!definition) {
    return schema;
  }

  const childKey = getCatchRewriteChildKey(typeName);
  if (childKey) {
    const child = definition[childKey];
    const rewrittenChild = rewriteZodCatchSchemas(child, rewrittenSchemas);

    if (typeName === "ZodCatch") {
      const withoutFallback = removeCatchFallback(schema, rewrittenChild);
      rewrittenSchemas.set(schema, withoutFallback);
      return withoutFallback;
    }

    const rewritten =
      rewrittenChild === child
        ? schema
        : reconstructZodSchema(schema, {
            [childKey]: rewrittenChild,
          });
    rewrittenSchemas.set(schema, rewritten);
    return rewritten;
  }

  if (typeName === "ZodUnion" && Array.isArray(definition.options)) {
    const rewrittenOptions = definition.options.map((option) =>
      rewriteZodCatchSchemas(option, rewrittenSchemas),
    );
    const rewritten = definition.options.every(
      (option, index) => option === rewrittenOptions[index],
    )
      ? schema
      : reconstructZodSchema(schema, {
          options: rewrittenOptions,
        });
    rewrittenSchemas.set(schema, rewritten);
    return rewritten;
  }

  return schema;
}

function getCatchRewriteChildKey(typeName: string): TransparentZodWrapperChildKey | undefined {
  return TRANSPARENT_ZOD_WRAPPER_CHILD_KEYS[typeName];
}

function reconstructZodSchema(schema: object, changes: ZodDefinition): unknown {
  // Preserve lazy default/shape getters without evaluating them while projecting input branches.
  const definition = Object.defineProperties(
    {},
    {
      ...Object.getOwnPropertyDescriptors(getZodDefinition(schema)),
      ...Object.getOwnPropertyDescriptors(changes),
    },
  );
  return Reflect.construct(schema.constructor, [definition]);
}

function removeCatchFallback(schema: object, inner: unknown): unknown {
  const checks = getZodDefinition(schema)?.checks;
  if (!isZodType(inner) || !checks?.length) return inner;
  return reconstructZodSchema(inner, {
    checks: [...(getZodDefinition(inner)?.checks ?? []), ...checks],
  });
}

export function getZodDefaultValue(schema: unknown): unknown {
  const defaultValue = getZodDefinition(schema)?.defaultValue;

  return typeof defaultValue === "function" ? defaultValue() : defaultValue;
}

export function getZodInputObjectSchema(schema: z.ZodType): z.ZodObject | undefined {
  const visited = new Set<z.ZodType>();
  let current: z.ZodType = schema;

  while (!visited.has(current)) {
    visited.add(current);
    const definition = getZodDefinition(current);
    const typeName = getSchemaTypeName(current);
    if (typeName === "ZodObject") {
      return current as z.ZodObject;
    }
    const inner = typeName === "ZodPipeline" ? definition?.in : undefined;
    if (!isZodType(inner)) {
      return undefined;
    }
    current = inner;
  }
  return undefined;
}

export function getZodQueryInputSchema(
  schema: z.ZodType,
  input: Readonly<Record<string, unknown>>,
): z.ZodType {
  const definition = getZodDefinition(schema);
  const typeName = getSchemaTypeName(schema);
  if (!definition) {
    return schema;
  }

  const childKey = typeName === "ZodPipeline" ? "in" : undefined;
  if (childKey) {
    const child = definition[childKey];
    if (!isZodType(child)) {
      return schema;
    }
    const projected = getZodQueryInputSchema(child, input);
    return projected === child
      ? schema
      : (reconstructZodSchema(schema, { [childKey]: projected }) as z.ZodType);
  }

  if (typeName !== "ZodObject") {
    return schema;
  }
  const shape = getObjectShape(schema);
  const projectedFields: Record<string, z.ZodType> = {};
  for (const [name, field] of Object.entries(shape)) {
    if (!Array.isArray(input[name])) {
      continue;
    }
    const projected = getZodArrayInputSchema(field);
    if (projected && projected !== field) {
      projectedFields[name] = projected;
    }
  }
  return Object.keys(projectedFields).length === 0
    ? schema
    : (reconstructZodSchema(schema, {
        shape: { ...shape, ...projectedFields },
      }) as z.ZodType);
}

export function getZodObjectShape(schema: unknown): Record<string, unknown> {
  return getObjectShape(schema);
}

export function getContractFieldSchema(
  contractSchema: z.ZodType | null | undefined,
  fieldName: string,
): z.ZodType | null {
  const shape = contractSchema ? getZodObjectShape(getZodInputObjectSchema(contractSchema)) : {};
  const field = shape[fieldName];

  return isZodType(field) ? field : null;
}

export function getZodObjectUnsupportedDynamicKeyMode(
  schema: unknown,
): "catchall" | "passthrough" | undefined {
  const definition = getZodDefinition(schema);

  if (definition?.catchall === undefined) {
    return undefined;
  }

  const catchallSchemaName = getSchemaTypeName(definition.catchall);

  if (catchallSchemaName === "ZodNever") {
    return undefined;
  }

  return catchallSchemaName === "ZodUnknown" ? "passthrough" : "catchall";
}

function describeUnknownSchema(
  schema: unknown,
  seen: Set<unknown>,
  refinementUnwrapped = false,
): ContractSchemaDescriptor {
  if (!isZodType(schema)) {
    return unsupportedDescriptor("unknown", typeof schema, "Schema value is not a Zod schema.");
  }

  const checks = getSchemaChecks(getZodDefinition(schema));
  if (!refinementUnwrapped && checks.some((check) => check.kind === "custom")) {
    const inner = describeUnknownSchema(schema, seen, true);
    return {
      ...descriptorFromChildren("effects", "ZodEffects", [inner]),
      effectType: "refinement",
      inner,
    };
  }

  if (seen.has(schema)) {
    return unsupportedDescriptor(
      "recursive",
      getSchemaTypeName(schema),
      "Recursive schemas are not supported by generated JSON contracts.",
    );
  }

  seen.add(schema);

  const typeName = getSchemaTypeName(schema);
  const definition = getZodDefinition(schema);

  if (typeName === "ZodString") {
    const checks = getSchemaChecks(definition);
    if (
      checks.some(
        (check) => check.kind === "min" || check.kind === "max" || check.kind === "length",
      ) &&
      checks.some((check) => check.kind === "overwrite")
    ) {
      return unsupportedDescriptor(
        "string",
        typeName,
        "String length checks combined with trim/toLowerCase/toUpperCase mutations are not supported by generated JSON contracts.",
      );
    }
    let minLength: number | undefined;
    let maxLength: number | undefined;
    for (const check of checks) {
      if (check.kind !== "min" && check.kind !== "max" && check.kind !== "length") {
        continue;
      }
      if (
        typeof check.value !== "number" ||
        !Number.isFinite(check.value) ||
        !Number.isInteger(check.value) ||
        check.value < 0
      ) {
        return unsupportedDescriptor(
          "string",
          typeName,
          "String length bounds must be finite non-negative integers.",
        );
      }
      if (check.kind === "min" || check.kind === "length") {
        minLength = Math.max(minLength ?? 0, check.value);
      }
      if (check.kind === "max" || check.kind === "length") {
        maxLength = Math.min(maxLength ?? Number.POSITIVE_INFINITY, check.value);
      }
    }
    return {
      ...supportedDescriptor("string", typeName),
      ...(minLength !== undefined ? { minLength } : {}),
      ...(maxLength !== undefined ? { maxLength } : {}),
    };
  }

  if (typeName === "ZodNumber") {
    const bounds: {
      minimum?: number;
      maximum?: number;
      exclusiveMinimum?: boolean;
      exclusiveMaximum?: boolean;
      integer?: boolean;
    } = {};
    for (const check of getSchemaChecks(definition)) {
      if (check.kind === "custom") continue;
      if (check.kind === "int") {
        bounds.integer = true;
        if (bounds.minimum === undefined || bounds.minimum < Number.MIN_SAFE_INTEGER) {
          bounds.minimum = Number.MIN_SAFE_INTEGER;
          bounds.exclusiveMinimum = false;
        }
        if (bounds.maximum === undefined || bounds.maximum > Number.MAX_SAFE_INTEGER) {
          bounds.maximum = Number.MAX_SAFE_INTEGER;
          bounds.exclusiveMaximum = false;
        }
      } else if (check.kind === "min" || check.kind === "max") {
        if (typeof check.value !== "number" || !Number.isFinite(check.value)) {
          return unsupportedDescriptor(
            "number",
            typeName,
            "Numeric bounds must be finite numbers.",
          );
        }
        const key = check.kind === "min" ? "minimum" : "maximum";
        const exclusiveKey = check.kind === "min" ? "exclusiveMinimum" : "exclusiveMaximum";
        const previous = bounds[key];
        if (
          previous === undefined ||
          (key === "minimum" ? check.value > previous : check.value < previous)
        ) {
          bounds[key] = check.value;
          bounds[exclusiveKey] = check.inclusive === false;
        } else if (check.value === previous && check.inclusive === false) {
          bounds[exclusiveKey] = true;
        }
      } else if (check.kind !== "finite") {
        return unsupportedDescriptor(
          "number",
          typeName,
          `Numeric check ${check.kind} is not represented by generated JSON contracts.`,
        );
      }
    }
    return {
      ...supportedDescriptor("number", typeName),
      ...(bounds.minimum !== undefined
        ? { minimum: bounds.minimum, exclusiveMinimum: bounds.exclusiveMinimum }
        : {}),
      ...(bounds.maximum !== undefined
        ? { maximum: bounds.maximum, exclusiveMaximum: bounds.exclusiveMaximum }
        : {}),
      ...(bounds.integer ? { integer: true } : {}),
    };
  }

  if (typeName === "ZodBoolean") {
    return supportedDescriptor("boolean", typeName);
  }

  if (typeName === "ZodNull") {
    return supportedDescriptor("null", typeName);
  }

  if (typeName === "ZodAny" || typeName === "ZodUnknown" || typeName === "ZodNever") {
    return supportedDescriptor(typeName.replace(/^Zod/, "").toLowerCase(), typeName);
  }

  if (typeName === "ZodUndefined") {
    return unsupportedDescriptor(
      "undefined",
      typeName,
      "Undefined is not a JSON value; use an optional object field or omit the schema.",
    );
  }

  if (typeName === "ZodVoid") {
    return unsupportedDescriptor(
      "void",
      typeName,
      "Void is not a JSON value; omit the response schema for empty responses.",
    );
  }

  if (typeName === "ZodBigInt") {
    return unsupportedDescriptor(
      "bigint",
      typeName,
      "BigInt values are not JSON-safe; use a string or number boundary schema.",
    );
  }

  if (typeName === "ZodDate") {
    return unsupportedDescriptor(
      "date",
      typeName,
      "Date instances are not JSON-safe; use an ISO string schema at the contract boundary.",
    );
  }

  if (typeName === "ZodFunction") {
    return unsupportedDescriptor("function", typeName, "Functions are not JSON contract values.");
  }

  if (typeName === "ZodMap") {
    return unsupportedDescriptor(
      "map",
      typeName,
      "Maps are not stable JSON object contracts; use an object or array schema.",
    );
  }

  if (typeName === "ZodSet") {
    return unsupportedDescriptor(
      "set",
      typeName,
      "Sets are not stable JSON array contracts; use an array schema.",
    );
  }

  if (typeName === "ZodPromise") {
    return unsupportedDescriptor(
      "promise",
      typeName,
      "Promises are runtime behavior, not JSON values.",
    );
  }

  if (typeName === "ZodSymbol") {
    return unsupportedDescriptor("symbol", typeName, "Symbols are not JSON values.");
  }

  if (typeName === "ZodNaN") {
    return unsupportedDescriptor("nan", typeName, "NaN is not a JSON number.");
  }

  if (typeName === "ZodLiteral") {
    if (Array.isArray(definition?.values) && definition.values.length !== 1) {
      return unsupportedDescriptor(
        "literal",
        typeName,
        "Multi-value literals are not represented by generated contracts; use z.union() of single-value literals.",
      );
    }
    const value = normalizeLiteralValue(getLiteralValue(definition));

    return value.supported
      ? { ...supportedDescriptor("literal", typeName), value: value.value }
      : unsupportedDescriptor("literal", typeName, value.reason);
  }

  if (typeName === "ZodEnum") {
    const enumValues = getEnumValues(schema);

    if (enumValues.unsupportedReason) {
      return {
        ...unsupportedDescriptor("enum", typeName, enumValues.unsupportedReason),
        values: enumValues.values,
      };
    }

    return {
      ...supportedDescriptor("enum", typeName),
      values: enumValues.values.sort(comparePrimitiveValues),
    };
  }

  if (typeName === "ZodOptional" || typeName === "ZodDefault") {
    const inner = describeMaybeSchema(definition?.innerType, seen);
    const kind = typeName === "ZodOptional" ? "optional" : "default";

    return {
      ...descriptorFromChildren(kind, typeName, [inner]),
      inner,
    };
  }

  if (typeName === "ZodCatch") {
    const inner = describeMaybeSchema(definition?.innerType, seen);

    return {
      ...descriptorFromChildren("catch", typeName, [inner]),
      inner,
    };
  }

  if (typeName === "ZodNullable") {
    const inner = describeMaybeSchema(definition?.innerType, seen);

    return {
      ...descriptorFromChildren("nullable", typeName, [inner]),
      inner,
    };
  }

  if (typeName === "ZodPipeline") {
    const preprocess = getSchemaTypeName(definition?.in) === "ZodTransform";
    const effectType = preprocess ? "preprocess" : "transform";
    const inner = describeMaybeSchema(preprocess ? definition?.out : definition?.in, seen);

    if (effectType === "transform" || effectType === "preprocess" || effectType === "unknown") {
      return {
        ...unsupportedDescriptor(
          "effects",
          typeName,
          `Zod ${effectType} effects can change runtime values and are not JSON-safe contract schemas.`,
        ),
        effectType,
        inner,
      };
    }

    return {
      ...descriptorFromChildren("effects", typeName, [inner]),
      effectType,
      inner,
    };
  }

  if (typeName === "ZodReadonly") {
    const inner = describeMaybeSchema(definition?.innerType, seen);
    const kind = "readonly";

    return {
      ...descriptorFromChildren(kind, typeName, [inner]),
      inner,
    };
  }

  if (typeName === "ZodArray") {
    const element = describeMaybeSchema(definition?.element, seen);

    const bounds: { minItems?: number; maxItems?: number } = {};
    for (const check of getSchemaChecks(definition)) {
      if (check.kind === "custom") continue;
      if (
        !["min", "max", "length"].includes(check.kind) ||
        typeof check.value !== "number" ||
        !Number.isFinite(check.value) ||
        !Number.isInteger(check.value) ||
        check.value < 0
      ) {
        return {
          ...unsupportedDescriptor(
            "array",
            typeName,
            "Array cardinalities must be finite non-negative integers.",
          ),
          element,
        };
      }
      if (check.kind !== "max") bounds.minItems = Math.max(bounds.minItems ?? 0, check.value);
      if (check.kind !== "min")
        bounds.maxItems = Math.min(bounds.maxItems ?? Infinity, check.value);
    }
    return {
      ...descriptorFromChildren("array", typeName, [element]),
      element,
      ...bounds,
    };
  }

  if (typeName === "ZodRecord") {
    const key = describeMaybeSchema(definition?.keyType, seen);
    const element = describeMaybeSchema(definition?.valueType, seen);

    if (key?.typeName !== "ZodString") {
      return {
        ...unsupportedDescriptor(
          "record",
          typeName,
          `ZodRecord key schema ${key?.typeName ?? "unknown"} is unsupported; use z.string() for JSON object keys.`,
        ),
        element,
      };
    }

    return {
      ...descriptorFromChildren("record", typeName, [element]),
      element,
    };
  }

  if (typeName === "ZodObject") {
    const fields = Object.entries(getObjectShape(schema))
      .map(([name, fieldSchema]) => ({
        name,
        required: !isOptionalInputSchema(fieldSchema),
        schema: describeUnknownSchema(fieldSchema, new Set(seen)),
      }))
      .sort(compareSchemaFields);

    return {
      ...descriptorFromChildren(
        "object",
        typeName,
        fields.map((field) => field.schema),
      ),
      fields,
    };
  }

  if (typeName === "ZodUnion" || typeName === "ZodDiscriminatedUnion") {
    const options = getSchemaOptions(definition)
      .map((option) => describeUnknownSchema(option, new Set(seen)))
      .sort(compareSchemaDescriptors);

    return {
      ...descriptorFromChildren("union", typeName, options),
      options,
    };
  }

  return unsupportedDescriptor(
    "other",
    typeName,
    `Unsupported Zod schema ${typeName}; use a schema listed in JSON_SAFE_ZOD_SCHEMA_SUPPORT_MATRIX.`,
  );
}

function getLiteralValue(definition: ZodDefinition | undefined): unknown {
  if (definition && Object.prototype.hasOwnProperty.call(definition, "value")) {
    return definition.value;
  }

  return getFirstArrayValue(definition?.values);
}

function describeMaybeSchema(value: unknown, seen: Set<unknown>): ContractSchemaDescriptor | null {
  return isZodType(value) ? describeUnknownSchema(value, new Set(seen)) : null;
}

function collectSchemaDescriptorDiagnostics(
  descriptor: ContractSchemaDescriptor,
  path: readonly string[],
): ContractSchemaDiagnostic[] {
  const diagnostics: ContractSchemaDiagnostic[] = [];

  if (!descriptor.jsonSafe && descriptor.unsupportedReason) {
    diagnostics.push({
      code: CONTRACT_SCHEMA_JSON_UNSAFE_DIAGNOSTIC_CODE,
      severity: "error",
      typeName: descriptor.typeName,
      schemaPath: path,
      message:
        descriptor.unsupportedReason ??
        `Unsupported Zod schema ${descriptor.typeName}; use a JSON-safe contract schema.`,
    });
  } else if (descriptor.kind === "effects") {
    diagnostics.push({
      code: CONTRACT_SCHEMA_ZOD_EFFECTS_UNWRAPPED_DIAGNOSTIC_CODE,
      severity: "warning",
      typeName: descriptor.typeName,
      schemaPath: path,
      message:
        "Zod refinements are represented from their inner schema in generated contracts; runtime refinements still run on the server.",
    });
  }

  if (descriptor.inner) {
    diagnostics.push(...collectSchemaDescriptorDiagnostics(descriptor.inner, path));
  }

  if (descriptor.element) {
    diagnostics.push(...collectSchemaDescriptorDiagnostics(descriptor.element, [...path, "[]"]));
  }

  for (const [index, option] of (descriptor.options ?? []).entries()) {
    diagnostics.push(...collectSchemaDescriptorDiagnostics(option, [...path, `option${index}`]));
  }

  for (const field of descriptor.fields ?? []) {
    diagnostics.push(...collectSchemaDescriptorDiagnostics(field.schema, [...path, field.name]));
  }

  return diagnostics;
}

function supportedDescriptor(kind: string, typeName: string): ContractSchemaDescriptor {
  return { kind, typeName, jsonSafe: true };
}

function unsupportedDescriptor(
  kind: string,
  typeName: string,
  unsupportedReason: string,
): ContractSchemaDescriptor {
  return { kind, typeName, jsonSafe: false, unsupportedReason };
}

function descriptorFromChildren(
  kind: string,
  typeName: string,
  children: readonly (ContractSchemaDescriptor | null)[],
): ContractSchemaDescriptor {
  const unsupportedChild = children.find((child) => child && !child.jsonSafe);

  if (unsupportedChild) {
    return { kind, typeName, jsonSafe: false };
  }

  return supportedDescriptor(kind, typeName);
}

function isOptionalInputSchema(schema: unknown): boolean {
  const typeName = getSchemaTypeName(schema);

  if (typeName === "ZodOptional" || typeName === "ZodDefault") {
    return true;
  }

  if (typeName === "ZodPipeline") {
    const definition = getZodDefinition(schema);

    return isOptionalInputSchema(definition?.in);
  }

  if (typeName === "ZodNullable" || typeName === "ZodReadonly") {
    const definition = getZodDefinition(schema);
    const inner = definition?.innerType;

    return isOptionalInputSchema(inner);
  }

  return false;
}

function isTransparentArrayWrapper(typeName: string): boolean {
  return TRANSPARENT_ZOD_WRAPPER_CHILD_KEYS[typeName] !== undefined;
}

function getSchemaTypeName(schema: unknown): string {
  if (!schema || typeof schema !== "object") {
    return typeof schema;
  }

  const definition = getZodDefinition(schema);
  const type = definition?.type;
  if (typeof type !== "string") return schema.constructor.name;
  if (type === "union" && definition?.discriminator !== undefined) return "ZodDiscriminatedUnion";
  const names: Readonly<Record<string, string>> = {
    bigint: "ZodBigInt",
    nan: "ZodNaN",
    pipe: "ZodPipeline",
    readonly: "ZodReadonly",
  };
  return names[type] ?? `Zod${type[0]?.toUpperCase()}${type.slice(1)}`;
}

function getZodDefinition(schema: unknown): ZodDefinition | undefined {
  if (!isRecord(schema) || !isRecord(schema["_zod"])) return undefined;
  return schema["_zod"]["def"] as ZodDefinition;
}

type SchemaCheck = {
  readonly kind: string;
  readonly value?: unknown;
  readonly inclusive?: boolean;
};

function getSchemaChecks(definition: ZodDefinition | undefined): readonly SchemaCheck[] {
  const checks = (definition?.checks ?? []).map((check) => {
    const def = check._zod.def;
    switch (def["check"]) {
      case "min_length":
        return { kind: "min", value: def["minimum"] };
      case "max_length":
        return { kind: "max", value: def["maximum"] };
      case "length_equals":
        return { kind: "length", value: def["length"] };
      case "greater_than":
        return { kind: "min", value: def["value"], inclusive: def["inclusive"] === true };
      case "less_than":
        return { kind: "max", value: def["value"], inclusive: def["inclusive"] === true };
      case "number_format":
        return {
          kind: def["format"] === "safeint" ? "int" : String(def["format"]),
        };
      default:
        return { kind: String(def["check"]) };
    }
  });
  if (definition?.check === "number_format") {
    checks.unshift({
      kind: definition.format === "safeint" ? "int" : String(definition.format),
    });
  }
  return checks;
}

function getObjectShape(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object") {
    return {};
  }

  if ("shape" in schema) {
    const shape = schema.shape;

    if (shape && typeof shape === "object") {
      return shape as Record<string, unknown>;
    }
  }

  const definition = getZodDefinition(schema);
  const shape = typeof definition?.shape === "function" ? definition.shape() : definition?.shape;

  return shape && typeof shape === "object" ? (shape as Record<string, unknown>) : {};
}

function getSchemaOptions(definition: ZodDefinition | undefined): unknown[] {
  if (!definition) {
    return [];
  }

  if (Array.isArray(definition.options)) {
    return definition.options;
  }

  if (definition.options instanceof Map) {
    return [...definition.options.values()];
  }

  return [];
}

export function isZodType(value: unknown): value is z.ZodType {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { readonly safeParse?: unknown };

  return (
    isRecord(value) &&
    isRecord(value["_zod"]) &&
    isRecord(value["_zod"]["version"]) &&
    value["_zod"]["version"]["major"] === 4 &&
    typeof candidate.safeParse === "function"
  );
}

function normalizeLiteralValue(value: unknown):
  | { readonly supported: true; readonly value: ContractSchemaPrimitiveValue }
  | {
      readonly supported: false;
      readonly reason: string;
    } {
  if (typeof value === "string" || typeof value === "boolean" || value === null) {
    return { supported: true, value };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return { supported: true, value };
  }

  return {
    supported: false,
    reason: `Literal value ${String(value)} is not JSON-safe; use a string, number, boolean, or null literal.`,
  };
}

type EnumValuesResult = {
  readonly values: (string | number)[];
  readonly unsupportedReason?: string;
};

function getEnumValues(schema: unknown): EnumValuesResult {
  if (
    !isRecord(schema) ||
    !isRecord(schema["_zod"]) ||
    !(schema["_zod"]["values"] instanceof Set)
  ) {
    return { values: [] };
  }
  return toEnumValuesResult([...schema["_zod"]["values"]]);
}

function getFirstArrayValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : undefined;
}

function toEnumValuesResult(values: readonly unknown[]): EnumValuesResult {
  const unsupportedValues = values.filter((value) => !isJsonEnumValue(value));
  const jsonValues = [...new Set(values.filter(isJsonEnumValue))];

  if (unsupportedValues.length > 0) {
    return {
      values: jsonValues,
      unsupportedReason: `Enum values ${unsupportedValues.map(String).join(", ")} are not JSON-safe; use string or finite number enum values.`,
    };
  }

  return { values: jsonValues };
}

function isJsonEnumValue(value: unknown): value is string | number {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value));
}

function compareSchemaFields(
  left: ContractSchemaFieldDescriptor,
  right: ContractSchemaFieldDescriptor,
): number {
  return compareStrings(left.name, right.name);
}

function compareSchemaDescriptors(
  left: ContractSchemaDescriptor,
  right: ContractSchemaDescriptor,
): number {
  return compareStrings(JSON.stringify(left), JSON.stringify(right));
}

function comparePrimitiveValues(left: string | number, right: string | number): number {
  const typeComparison = compareCodeUnits(typeof left, typeof right);
  return typeComparison || compareCodeUnits(String(left), String(right));
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function getUnsupportedZodMajor(
  schema: unknown,
): { readonly major: number; readonly kind: string } | undefined {
  if (
    isRecord(schema) &&
    isRecord(schema["_def"]) &&
    typeof schema["_def"]["typeName"] === "string" &&
    !("_zod" in schema)
  ) {
    return { major: 3, kind: schema["_def"]["typeName"] };
  }
  if (typeof schema !== "object" || schema === null || !("_zod" in schema)) return undefined;
  const internals = schema._zod;
  if (typeof internals !== "object" || internals === null || !("version" in internals))
    return undefined;
  const version = internals.version;
  if (typeof version !== "object" || version === null || !("major" in version)) return undefined;
  const major = version.major;
  if (typeof major !== "number" || major === 4) return undefined;
  const definition = "def" in internals ? internals.def : undefined;
  const kind =
    typeof definition === "object" &&
    definition !== null &&
    "type" in definition &&
    typeof definition.type === "string"
      ? definition.type
      : schema.constructor.name;
  return { major, kind };
}

function requiresQueryArrayInput(schema: ContractSchemaDescriptor | null): boolean {
  if (!schema) {
    return false;
  }
  switch (schema.kind) {
    case "array":
      return true;
    case "union":
      return (
        schema.typeName === "ZodUnion" &&
        !!schema.options?.length &&
        schema.options.every(requiresQueryArrayInput)
      );
    case "optional":
    case "nullable":
    case "default":
    case "catch":
    case "branded":
    case "readonly":
      return !!schema.inner && requiresQueryArrayInput(schema.inner);
    case "effects":
      return (
        schema.effectType === "refinement" &&
        !!schema.inner &&
        requiresQueryArrayInput(schema.inner)
      );
    default:
      return false;
  }
}

/** Normalize HTTP query cardinality without parsing domain values. */
export function normalizeZodQueryInput<TSchema extends z.ZodType>(
  schema: TSchema,
  source: Readonly<Record<string, unknown>>,
): { input: Record<string, unknown>; schema: TSchema; repeatedScalarFields: string[] } {
  const input = { ...source };
  const repeatedScalarFields: string[] = [];
  for (const [name, field] of Object.entries(getZodInputObjectSchema(schema)?.shape ?? {})) {
    const value = input[name];
    if (Array.isArray(value) && !getZodArrayInputSchema(field)) repeatedScalarFields.push(name);
    if (
      typeof value === "string" &&
      isZodType(field) &&
      requiresQueryArrayInput(describeZodSchema(field))
    )
      input[name] = [value];
  }
  return { input, schema: getZodQueryInputSchema(schema, input) as TSchema, repeatedScalarFields };
}
