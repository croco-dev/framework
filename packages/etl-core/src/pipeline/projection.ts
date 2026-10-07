import { Problem, ProblemCategory } from "@croco/problems-core";
import { validateRow } from "@croco/warehouse-core";
import type { CanonicalRow, Column, FactDeclaration } from "@croco/warehouse-core";
import type { SourceField, SourceRow, SourceSchema } from "../source/types";

export type ProjectionValue = string | boolean | null;
export type ProjectionExpression<S extends SourceSchema = SourceSchema> =
  | {
      readonly kind: "column";
      readonly field: S["fields"][number]["name"];
      readonly cast?: "integer" | "instant" | "date";
      readonly default?: ProjectionValue;
    }
  | { readonly kind: "constant"; readonly value: ProjectionValue };
export type ProjectionColumns<S extends SourceSchema, F extends FactDeclaration> = {
  readonly [K in keyof F["columns"]]: ProjectionExpression<S>;
};
export type Projection<
  S extends SourceSchema = SourceSchema,
  F extends FactDeclaration = FactDeclaration,
> = {
  readonly source: S;
  readonly target: F;
  readonly columns: ProjectionColumns<S, F>;
  project(row: SourceRow): CanonicalRow;
  artifactHash(): Promise<string>;
};
export type ProjectionReason =
  | "invalid-expression"
  | "missing-source-field"
  | "missing-target-field"
  | "unknown-target-field"
  | "unsafe-cast"
  | "null-not-allowed"
  | "invalid-value";

export class ProjectionProblem extends Problem {
  readonly code = "etl-core/projection-failed";
  readonly category = ProblemCategory.ValidationError;

  constructor(
    readonly reason: ProjectionReason,
    readonly field: string,
  ) {
    super(undefined, undefined, `Projection ${reason} at '${field}'.`, {
      extensions: { reason, field },
    });
  }
}

export function defineProjection<
  const S extends SourceSchema,
  const F extends FactDeclaration,
>(options: {
  readonly source: S;
  readonly target: F;
  readonly columns: ProjectionColumns<S, F>;
}): Projection<S, F> {
  const declaration = freeze(JSON.parse(canonical(options)) as typeof options);
  const fields = new Map<string, SourceField>();
  for (const field of declaration.source.fields) {
    if (fields.has(field.name)) throw new ProjectionProblem("invalid-expression", field.name);
    fields.set(field.name, field);
  }
  for (const key of Object.keys(declaration.columns)) {
    if (!Object.hasOwn(declaration.target.columns, key))
      throw new ProjectionProblem("unknown-target-field", key);
  }
  for (const [key, target] of Object.entries(declaration.target.columns)) {
    if (!Object.hasOwn(declaration.columns, key))
      throw new ProjectionProblem("missing-target-field", key);
    const expression = declaration.columns[key];
    if (!expression || (expression.kind !== "column" && expression.kind !== "constant"))
      throw new ProjectionProblem("invalid-expression", key);
    if (expression.kind === "constant") {
      assertValue(expression.value, target, key);
      continue;
    }
    const field = fields.get(expression.field);
    if (!field) throw new ProjectionProblem("missing-source-field", expression.field);
    if (Object.hasOwn(expression, "default")) assertValue(expression.default, target, key);
    if (field.nullable && !target.nullable && !Object.hasOwn(expression, "default"))
      throw new ProjectionProblem("null-not-allowed", key);
    const compatible =
      expression.cast === undefined
        ? field.type === "string" && target.type !== "boolean"
        : expression.cast === "integer"
          ? field.type === "number" && (target.type === "int64" || target.type === "money")
          : expression.cast === "instant"
            ? field.type === "date" && target.type === "instant"
            : expression.cast === "date" &&
              field.type === "date" &&
              target.type === "date" &&
              target.zone === "UTC";
    if (!compatible) throw new ProjectionProblem("unsafe-cast", key);
  }
  return Object.freeze({
    ...declaration,
    project(row: SourceRow): CanonicalRow {
      const result: Record<string, ProjectionValue> = {};
      for (const [key, expression] of Object.entries(declaration.columns)) {
        if (expression.kind === "constant") {
          result[key] = expression.value;
          continue;
        }
        if (!Object.hasOwn(row, expression.field))
          throw new ProjectionProblem("missing-source-field", expression.field);
        const value = row[expression.field];
        if (value === null) {
          result[key] = Object.hasOwn(expression, "default")
            ? (expression.default as ProjectionValue)
            : null;
          continue;
        }
        const target = declaration.target.columns[key];
        if (expression.cast === "integer") {
          if (typeof value !== "number" || !Number.isSafeInteger(value))
            throw new ProjectionProblem("unsafe-cast", key);
          result[key] = value.toString();
        } else if (expression.cast === "instant" || expression.cast === "date") {
          if (!(value instanceof Date) || !Number.isFinite(value.getTime()))
            throw new ProjectionProblem("invalid-value", key);
          const iso = value.toISOString();
          if (expression.cast === "date") {
            if (!iso.endsWith("T00:00:00.000Z")) throw new ProjectionProblem("unsafe-cast", key);
            result[key] = iso.slice(0, 10);
          } else if (target.type === "instant" && target.precision === "second") {
            if (value.getUTCMilliseconds() !== 0) throw new ProjectionProblem("unsafe-cast", key);
            result[key] = iso.replace(".000Z", "Z");
          } else {
            result[key] =
              target.type === "instant" && target.precision === "microsecond"
                ? iso.replace("Z", "000Z")
                : iso;
          }
        } else {
          if (typeof value !== "string") throw new ProjectionProblem("invalid-value", key);
          result[key] = value;
        }
      }
      return validateRow(declaration.target, result);
    },
    async artifactHash(): Promise<string> {
      const digest = await globalThis.crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonical({ version: 1, ...declaration })),
      );
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
        "",
      );
    },
  });
}

function assertValue(
  value: unknown,
  target: Column,
  key: string,
): asserts value is ProjectionValue {
  if (value === null) {
    if (!target.nullable) throw new ProjectionProblem("null-not-allowed", key);
  } else if (target.type === "boolean" ? typeof value !== "boolean" : typeof value !== "string") {
    throw new ProjectionProblem("unsafe-cast", key);
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(",")}}`;
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return JSON.stringify(value);
  throw new ProjectionProblem("invalid-expression", "declaration");
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
