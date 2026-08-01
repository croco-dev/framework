import { Problem, ProblemCategory } from "@croco/problems-core";
import { describeZodSchema, getZodObjectUnsupportedDynamicKeyMode } from "@croco/protocols-core";
import type { ContractSchemaDescriptor } from "@croco/protocols-core";
import type { InferDesktopSchema } from "./types";

export type DesktopWireSourceLocation = {
  readonly path: string;
  readonly line?: number;
  readonly column?: number;
};

export type DesktopWireSchemaDiagnosticCode =
  | "DESKTOP_WIRE_SCHEMA_CONSTRAINED_VALUE"
  | "DESKTOP_WIRE_SCHEMA_DYNAMIC_OBJECT"
  | "DESKTOP_WIRE_SCHEMA_RECURSIVE"
  | "DESKTOP_WIRE_SCHEMA_REFINEMENT"
  | "DESKTOP_WIRE_SCHEMA_UNSUPPORTED"
  | "DESKTOP_WIRE_VALUE_INVALID";

export type DesktopWireSchemaDiagnostic = {
  readonly code: DesktopWireSchemaDiagnosticCode;
  readonly contractMember: string;
  readonly schemaPath: readonly string[];
  readonly message: string;
  readonly recovery: string;
  readonly sourceLocation?: DesktopWireSourceLocation;
};

export type DesktopWireSchemaContext = {
  readonly contractMember: string;
  readonly sourceLocation?: DesktopWireSourceLocation;
};

export type DesktopWirePrimitiveDescriptor = {
  readonly kind: "string" | "number" | "boolean" | "null";
};

export type DesktopWireLiteralDescriptor = {
  readonly kind: "literal";
  readonly value: string | number | boolean | null;
};

export type DesktopWireEnumDescriptor = {
  readonly kind: "enum";
  readonly values: readonly (string | number)[];
};

export type DesktopWireObjectDescriptor = {
  readonly kind: "object";
  readonly unknownKeys: "reject";
  readonly fields: readonly {
    readonly name: string;
    readonly required: boolean;
    readonly schema: DesktopWireSchemaDescriptor;
  }[];
};

export type DesktopWireSchemaDescriptor =
  | DesktopWirePrimitiveDescriptor
  | DesktopWireLiteralDescriptor
  | DesktopWireEnumDescriptor
  | DesktopWireObjectDescriptor
  | { readonly kind: "array"; readonly element: DesktopWireSchemaDescriptor }
  | { readonly kind: "optional"; readonly inner: DesktopWireSchemaDescriptor }
  | { readonly kind: "nullable"; readonly inner: DesktopWireSchemaDescriptor }
  | { readonly kind: "union"; readonly options: readonly DesktopWireSchemaDescriptor[] };

type ZodDefinition = {
  readonly checks?: readonly unknown[];
  readonly coerce?: unknown;
  readonly shape?: unknown;
  readonly innerType?: unknown;
  readonly element?: unknown;
  readonly type?: unknown;
  readonly options?: unknown;
};

export class DesktopWireSchemaProblem extends Problem {
  public readonly diagnostics: readonly DesktopWireSchemaDiagnostic[];

  public constructor(diagnostics: readonly DesktopWireSchemaDiagnostic[]) {
    const problemCode = diagnostics.every(
      (diagnostic) => diagnostic.code === "DESKTOP_WIRE_VALUE_INVALID",
    )
      ? "DESKTOP_WIRE_VALUE_INVALID"
      : "DESKTOP_WIRE_SCHEMA_INVALID";
    super(
      problemCode,
      ProblemCategory.ValidationError,
      diagnostics.map(formatDesktopWireSchemaDiagnostic).join("\n"),
      { extensions: { diagnostics } },
    );
    this.diagnostics = diagnostics;
  }
}

export function compileDesktopWireSchema(
  schema: unknown,
  context: DesktopWireSchemaContext,
): DesktopWireSchemaDescriptor {
  const diagnostics: DesktopWireSchemaDiagnostic[] = [];
  const descriptor = compileSchemaNode(schema, context, [], new Set(), diagnostics);

  if (!descriptor || diagnostics.length > 0) {
    throw new DesktopWireSchemaProblem(diagnostics);
  }

  return descriptor;
}

export function stringifyDesktopWireSchemaDescriptor(
  descriptor: DesktopWireSchemaDescriptor,
): string {
  return `${JSON.stringify(descriptor, null, 2)}\n`;
}

export function parseDesktopWireValue<TSchema>(
  schema: TSchema,
  value: unknown,
  context: DesktopWireSchemaContext,
): InferDesktopSchema<TSchema> {
  const descriptor = compileDesktopWireSchema(schema, context);
  const shapeFailure = findWireShapeFailure(descriptor, value, []);
  if (shapeFailure) {
    throwInvalidWireValue(context, shapeFailure);
  }

  return value as InferDesktopSchema<TSchema>;
}

export function formatDesktopWireSchemaDiagnostic(diagnostic: DesktopWireSchemaDiagnostic): string {
  const schemaPath = diagnostic.schemaPath.length > 0 ? `.${diagnostic.schemaPath.join(".")}` : "";
  const location = diagnostic.sourceLocation
    ? ` (${diagnostic.sourceLocation.path}${formatPosition(diagnostic.sourceLocation)})`
    : "";

  return `${diagnostic.code} ${diagnostic.contractMember}${schemaPath}${location}: ${diagnostic.message} Recovery: ${diagnostic.recovery}`;
}

function compileSchemaNode(
  schema: unknown,
  context: DesktopWireSchemaContext,
  path: readonly string[],
  ancestors: Set<object>,
  diagnostics: DesktopWireSchemaDiagnostic[],
): DesktopWireSchemaDescriptor | undefined {
  if (!isRecord(schema)) {
    diagnostics.push(
      createDiagnostic(
        "DESKTOP_WIRE_SCHEMA_UNSUPPORTED",
        context,
        path,
        "DesktopWire contracts require an inspectable Zod schema.",
        "Replace the value with a supported Zod primitive, object, array, optional, nullable, enum, literal, or union schema.",
      ),
    );
    return undefined;
  }

  if (ancestors.has(schema)) {
    diagnostics.push(
      createDiagnostic(
        "DESKTOP_WIRE_SCHEMA_RECURSIVE",
        context,
        path,
        "Recursive DesktopWire schemas cannot be serialized deterministically.",
        "Replace the recursive boundary with a finite object or an explicit identifier reference.",
      ),
    );
    return undefined;
  }

  const sharedDescriptor = describeZodSchema(schema as never);
  if (!sharedDescriptor) {
    diagnostics.push(
      createDiagnostic(
        "DESKTOP_WIRE_SCHEMA_UNSUPPORTED",
        context,
        path,
        "DesktopWire contracts require a schema descriptor.",
        "Use a supported Zod schema at this contract boundary.",
      ),
    );
    return undefined;
  }

  const nextAncestors = new Set(ancestors).add(schema);
  const definition = readDefinition(schema);

  if (isConstrainedPrimitive(sharedDescriptor, definition)) {
    diagnostics.push(
      createDiagnostic(
        "DESKTOP_WIRE_SCHEMA_CONSTRAINED_VALUE",
        context,
        path,
        `${sharedDescriptor.typeName} coercions and checks are not represented by the shared descriptor.`,
        "Move normalization and validation into the handler, or use an unconstrained DesktopWire primitive.",
      ),
    );
    return undefined;
  }

  switch (sharedDescriptor.kind) {
    case "string":
    case "number":
    case "boolean":
    case "null":
      return { kind: sharedDescriptor.kind };
    case "literal":
      return sharedDescriptor.value === undefined
        ? rejectUnsupported(sharedDescriptor, context, path, diagnostics)
        : { kind: "literal", value: sharedDescriptor.value };
    case "enum":
      return sharedDescriptor.values
        ? { kind: "enum", values: [...sharedDescriptor.values] }
        : rejectUnsupported(sharedDescriptor, context, path, diagnostics);
    case "optional":
    case "nullable": {
      const innerSchema = definition?.innerType;
      const inner = compileSchemaNode(innerSchema, context, path, nextAncestors, diagnostics);
      return inner ? { kind: sharedDescriptor.kind, inner } : undefined;
    }
    case "array": {
      const element = compileSchemaNode(
        definition?.element ?? definition?.type,
        context,
        [...path, "[]"],
        nextAncestors,
        diagnostics,
      );
      return element ? { kind: "array", element } : undefined;
    }
    case "object": {
      const dynamicKeyMode = getZodObjectUnsupportedDynamicKeyMode(schema);
      if (dynamicKeyMode) {
        diagnostics.push(
          createDiagnostic(
            "DESKTOP_WIRE_SCHEMA_DYNAMIC_OBJECT",
            context,
            path,
            `DesktopWire objects cannot use Zod ${dynamicKeyMode} unknown-key handling.`,
            "Remove passthrough or catchall behavior; DesktopWire objects reject undeclared keys.",
          ),
        );
        return undefined;
      }

      const shape = readShape(definition?.shape);
      const sharedFields = new Map(
        (sharedDescriptor.fields ?? []).map((field) => [field.name, field]),
      );
      const fields = Object.keys(shape)
        .sort(compareCodeUnits)
        .map((name) => {
          const fieldSchema = compileSchemaNode(
            shape[name],
            context,
            [...path, name],
            nextAncestors,
            diagnostics,
          );
          const sharedField = sharedFields.get(name);
          return fieldSchema && sharedField
            ? { name, required: sharedField.required, schema: fieldSchema }
            : undefined;
        });
      return fields.every(isDefined)
        ? { kind: "object", unknownKeys: "reject", fields }
        : undefined;
    }
    case "union": {
      const options = readOptions(definition?.options)
        .map((option, index) =>
          compileSchemaNode(
            option,
            context,
            [...path, `option${index}`],
            nextAncestors,
            diagnostics,
          ),
        )
        .filter(isDefined)
        .sort((left, right) => compareCodeUnits(JSON.stringify(left), JSON.stringify(right)));
      return options.length > 0 && options.length === (sharedDescriptor.options?.length ?? 0)
        ? { kind: "union", options }
        : undefined;
    }
    case "effects":
      diagnostics.push(
        createDiagnostic(
          "DESKTOP_WIRE_SCHEMA_REFINEMENT",
          context,
          path,
          `Zod ${sharedDescriptor.effectType ?? "effect"} schemas do not preserve validation meaning in generated DesktopWire code.`,
          "Replace the effect with a supported structural schema and perform the refinement inside the handler.",
        ),
      );
      return undefined;
    case "other":
      if (sharedDescriptor.typeName === "ZodLazy") {
        diagnostics.push(
          createDiagnostic(
            "DESKTOP_WIRE_SCHEMA_RECURSIVE",
            context,
            path,
            "Lazy or recursive DesktopWire schemas are not supported.",
            "Replace the recursive boundary with a finite object or an explicit identifier reference.",
          ),
        );
        return undefined;
      }
      return rejectUnsupported(sharedDescriptor, context, path, diagnostics);
    default:
      return rejectUnsupported(sharedDescriptor, context, path, diagnostics);
  }
}

function rejectUnsupported(
  descriptor: ContractSchemaDescriptor,
  context: DesktopWireSchemaContext,
  path: readonly string[],
  diagnostics: DesktopWireSchemaDiagnostic[],
): undefined {
  diagnostics.push(
    createDiagnostic(
      "DESKTOP_WIRE_SCHEMA_UNSUPPORTED",
      context,
      path,
      descriptor.unsupportedReason ?? `${descriptor.typeName} is outside the DesktopWire subset.`,
      "Use strict objects, JSON primitives, finite literals/enums, arrays, optional/nullable values, or supported unions.",
    ),
  );
  return undefined;
}

function findWireShapeFailure(
  descriptor: DesktopWireSchemaDescriptor,
  value: unknown,
  path: readonly string[],
): { readonly path: readonly string[]; readonly message: string } | undefined {
  switch (descriptor.kind) {
    case "string":
    case "number":
    case "boolean":
      return typeof value === descriptor.kind &&
        (descriptor.kind !== "number" || Number.isFinite(value))
        ? undefined
        : { path, message: `Expected a finite DesktopWire ${descriptor.kind}.` };
    case "null":
      return value === null ? undefined : { path, message: "Expected null." };
    case "literal":
      return value === descriptor.value
        ? undefined
        : { path, message: "Value does not match the declared literal." };
    case "enum":
      return descriptor.values.includes(value as string | number)
        ? undefined
        : { path, message: "Value is not a declared enum member." };
    case "optional":
      return value === undefined
        ? { path, message: "Optional object keys must be omitted instead of set to undefined." }
        : findWireShapeFailure(descriptor.inner, value, path);
    case "nullable":
      return value === null ? undefined : findWireShapeFailure(descriptor.inner, value, path);
    case "array":
      if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
        return { path, message: "Expected a DesktopWire array." };
      }
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key === "symbol" || (key !== "length" && !isArrayIndex(key, value.length))) {
          return { path, message: "DesktopWire arrays cannot contain symbol or custom keys." };
        }
      }
      for (let index = 0; index < value.length; index++) {
        const property = Object.getOwnPropertyDescriptor(value, String(index));
        if (!property) {
          return {
            path: [...path, String(index)],
            message: "Sparse arrays are not DesktopWire values.",
          };
        }
        if (!property.enumerable || !("value" in property)) {
          return {
            path: [...path, String(index)],
            message: "DesktopWire array items must be enumerable data properties.",
          };
        }
        const failure = findWireShapeFailure(descriptor.element, property.value, [
          ...path,
          String(index),
        ]);
        if (failure) return failure;
      }
      return undefined;
    case "union":
      return descriptor.options.some((option) => !findWireShapeFailure(option, value, path))
        ? undefined
        : { path, message: "Value does not match any supported union option." };
    case "object": {
      if (!isPlainObject(value)) {
        return {
          path,
          message:
            "Expected a plain object; class and Electron instances are not DesktopWire values.",
        };
      }
      const fields = new Map(descriptor.fields.map((field) => [field.name, field]));
      const properties = Object.getOwnPropertyDescriptors(value);
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key === "symbol") {
          return { path, message: "Symbol object keys are not DesktopWire values." };
        }
        if (!fields.has(key)) {
          return {
            path: [...path, key],
            message: `Unknown object key "${key}" is not allowed.`,
          };
        }
        const property = properties[key];
        if (!property?.enumerable || !("value" in property)) {
          return {
            path: [...path, key],
            message: `Object key "${key}" must be an enumerable data property.`,
          };
        }
      }
      for (const field of descriptor.fields) {
        if (!Object.prototype.hasOwnProperty.call(value, field.name)) {
          if (field.required)
            return {
              path: [...path, field.name],
              message: `Required object key "${field.name}" is missing.`,
            };
          continue;
        }
        const failure = findWireShapeFailure(field.schema, properties[field.name]?.value, [
          ...path,
          field.name,
        ]);
        if (failure) return failure;
      }
      return undefined;
    }
  }
}

function throwInvalidWireValue(
  context: DesktopWireSchemaContext,
  failure: { readonly path: readonly string[]; readonly message: string },
): never {
  throw new DesktopWireSchemaProblem([
    createDiagnostic(
      "DESKTOP_WIRE_VALUE_INVALID",
      context,
      failure.path,
      failure.message,
      "Send a JSON-safe value that exactly matches the contract member schema.",
    ),
  ]);
}

function createDiagnostic(
  code: DesktopWireSchemaDiagnosticCode,
  context: DesktopWireSchemaContext,
  schemaPath: readonly string[],
  message: string,
  recovery: string,
): DesktopWireSchemaDiagnostic {
  return {
    code,
    contractMember: context.contractMember,
    schemaPath,
    message,
    recovery,
    ...(context.sourceLocation ? { sourceLocation: context.sourceLocation } : {}),
  };
}

function isConstrainedPrimitive(
  descriptor: ContractSchemaDescriptor,
  definition: ZodDefinition | undefined,
): boolean {
  return (
    (descriptor.kind === "string" ||
      descriptor.kind === "number" ||
      descriptor.kind === "boolean") &&
    (definition?.coerce === true || (definition?.checks?.length ?? 0) > 0)
  );
}

function readDefinition(schema: object): ZodDefinition | undefined {
  const definition = (schema as { readonly _def?: unknown })._def;
  return isRecord(definition) ? definition : undefined;
}

function readShape(shape: unknown): Readonly<Record<string, unknown>> {
  const value = typeof shape === "function" ? (shape as () => unknown)() : shape;
  return isRecord(value) ? value : {};
}

function readOptions(options: unknown): readonly unknown[] {
  if (Array.isArray(options)) return options;
  if (options instanceof Map) return [...options.values()];
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function isArrayIndex(key: string, length: number): boolean {
  const index = Number(key);
  return Number.isInteger(index) && index >= 0 && index < length && String(index) === key;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function formatPosition(location: DesktopWireSourceLocation): string {
  const line = location.line === undefined ? "" : `:${location.line}`;
  const column = location.column === undefined ? "" : `:${location.column}`;
  return `${line}${column}`;
}
