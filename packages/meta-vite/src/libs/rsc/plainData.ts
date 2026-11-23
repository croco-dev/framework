import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * A value bound for an RSC build's worker thread is not plain data. Structured
 * clone would turn it into something else without an error (a class instance
 * loses its prototype, a getter runs once), so it is refused instead.
 */
export class RscBuildValueUnsupportedProblem extends Problem {
  readonly code = "meta-vite/rsc-build-value-unsupported";
  readonly category = ProblemCategory.InternalServerError;

  constructor(path: string, reason: string) {
    super(
      "meta-vite/rsc-build-value-unsupported",
      ProblemCategory.InternalServerError,
      `The value at '${path}' cannot cross into the RSC build worker: ${reason}`,
      { extensions: { path, reason } },
    );
  }
}

/**
 * Accepts primitives, arrays and objects whose prototype is `Object.prototype`
 * or null with data properties only, without cycles.
 */
export function assertRscPlainData(value: unknown, path: string): void {
  checkValue(value, path, new Set());
}

function checkValue(value: unknown, path: string, ancestors: Set<object>): void {
  if (value === null || value === undefined) {
    return;
  }
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean" || type === "bigint") {
    return;
  }
  if (type !== "object") {
    throw new RscBuildValueUnsupportedProblem(path, `a ${type} is not plain data`);
  }

  const object = value as object;
  if (ancestors.has(object)) {
    throw new RscBuildValueUnsupportedProblem(path, "the value refers to itself");
  }
  ancestors.add(object);
  if (Array.isArray(object)) {
    checkArray(object, path, ancestors);
  } else {
    checkPlainObject(object, path, ancestors);
  }
  ancestors.delete(object);
}

function checkArray(array: unknown[], path: string, ancestors: Set<object>): void {
  if (Object.getPrototypeOf(array) !== Array.prototype) {
    throw new RscBuildValueUnsupportedProblem(path, "an array subclass is not plain data");
  }
  for (const key of Reflect.ownKeys(array)) {
    if (key === "length") {
      continue;
    }
    const childPath = `${path}[${String(key)}]`;
    if (typeof key === "symbol" || !/^(0|[1-9]\d*)$/.test(key)) {
      throw new RscBuildValueUnsupportedProblem(
        childPath,
        "a named array property is not plain data",
      );
    }
    checkDataProperty(array, key, childPath, ancestors);
  }
}

function checkPlainObject(object: object, path: string, ancestors: Set<object>): void {
  const prototype = Object.getPrototypeOf(object);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RscBuildValueUnsupportedProblem(path, "a class instance is not plain data");
  }
  for (const key of Reflect.ownKeys(object)) {
    const childPath = `${path}.${String(key)}`;
    if (typeof key === "symbol") {
      throw new RscBuildValueUnsupportedProblem(childPath, "a symbol key is not plain data");
    }
    checkDataProperty(object, key, childPath, ancestors);
  }
}

// Reading the descriptor instead of the value keeps a getter from running and
// from answering differently when the value is cloned.
function checkDataProperty(
  object: object,
  key: string,
  path: string,
  ancestors: Set<object>,
): void {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor || !("value" in descriptor)) {
    throw new RscBuildValueUnsupportedProblem(path, "an accessor property is not plain data");
  }
  checkValue(descriptor.value, path, ancestors);
}
