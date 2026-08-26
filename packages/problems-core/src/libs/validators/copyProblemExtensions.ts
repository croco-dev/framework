import type { ProblemExtensions } from "../ProblemExtensions";

const MAX_EXTENSION_DEPTH = 100;
const MAX_EXTENSION_NODES = 10_000;
const MAX_DIAGNOSTIC_KEY_LENGTH = 64;
const MAX_DIAGNOSTIC_PATH_LENGTH = 200;

const RESERVED_PROBLEM_KEYS = new Set(["type", "title", "status", "detail", "instance", "code"]);

type CopyFailure = {
  readonly ok: false;
  readonly path: string;
  readonly reason: string;
};

type CopySuccess<T> = {
  readonly ok: true;
  readonly value: T;
};

type CopyResult<T> = CopyFailure | CopySuccess<T>;

type CopyState = {
  readonly ancestors: Set<object>;
  nodeCount: number;
};

export function copyProblemExtensions(extensions: unknown): CopyResult<ProblemExtensions> {
  try {
    if (typeof extensions !== "object" || extensions === null || Array.isArray(extensions)) {
      return invalid("extensions", "must be a plain object");
    }

    const state: CopyState = { ancestors: new Set<object>([extensions]), nodeCount: 1 };
    const result = copyJsonObject(extensions, "extensions", state, 0, true);

    return result.ok ? { ok: true, value: result.value } : result;
  } catch {
    return invalid("extensions", "could not be inspected safely");
  }
}

export function copyValidatedProblemExtensions(
  target: Record<string, unknown>,
  extensions: ProblemExtensions,
): void {
  for (const key of Reflect.ownKeys(extensions)) {
    const descriptor = Object.getOwnPropertyDescriptor(extensions, key);
    if (descriptor && "value" in descriptor) {
      Object.defineProperty(target, key, {
        configurable: true,
        enumerable: true,
        value: descriptor.value,
        writable: true,
      });
    }
  }
}

function copyJsonValue(
  value: unknown,
  path: string,
  state: CopyState,
  depth: number,
): CopyResult<unknown> {
  if (depth > MAX_EXTENSION_DEPTH) {
    return invalid(path, `exceeds the maximum supported depth of ${MAX_EXTENSION_DEPTH}`);
  }

  state.nodeCount++;
  if (state.nodeCount > MAX_EXTENSION_NODES) {
    return invalid(path, `exceeds the maximum supported size of ${MAX_EXTENSION_NODES} values`);
  }

  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return { ok: true, value };
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { ok: true, value }
      : invalid(path, "contains a non-finite number");
  }

  if (typeof value !== "object") {
    return invalid(path, `contains unsupported type '${typeof value}'`);
  }

  if (state.ancestors.has(value)) {
    return invalid(path, "contains a cyclic reference");
  }

  state.ancestors.add(value);

  try {
    return Array.isArray(value)
      ? copyJsonArray(value, path, state, depth)
      : copyJsonObject(value, path, state, depth, false);
  } catch {
    return invalid(path, "could not be inspected safely");
  } finally {
    state.ancestors.delete(value);
  }
}

function copyJsonArray(
  value: readonly unknown[],
  path: string,
  state: CopyState,
  depth: number,
): CopyResult<unknown[]> {
  const keys = Reflect.ownKeys(value);
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  const length =
    lengthDescriptor && "value" in lengthDescriptor ? lengthDescriptor.value : undefined;

  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) {
    return invalid(path, "has an invalid array length");
  }

  if (length > MAX_EXTENSION_NODES - state.nodeCount) {
    return invalid(path, `exceeds the maximum supported size of ${MAX_EXTENSION_NODES} values`);
  }

  for (const key of keys) {
    if (typeof key !== "string" || (key !== "length" && !isArrayIndex(key, length))) {
      return invalid(path, "contains unsupported array properties");
    }
  }

  const copy: unknown[] = [];

  for (let index = 0; index < length; index++) {
    const itemPath = appendIndex(path, index);
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));

    if (descriptor === undefined) {
      return invalid(itemPath, "contains a sparse array entry");
    }

    if (!descriptor.enumerable || !("value" in descriptor)) {
      return invalid(itemPath, "must be an enumerable data property");
    }

    const item = copyJsonValue(descriptor.value, itemPath, state, depth + 1);
    if (!item.ok) {
      return item;
    }
    copy.push(item.value);
  }

  Object.freeze(copy);
  return { ok: true, value: copy };
}

function copyJsonObject(
  value: object,
  path: string,
  state: CopyState,
  depth: number,
  rejectReservedKeys: boolean,
): CopyResult<ProblemExtensions> {
  try {
    if (!hasPlainObjectPrototype(value)) {
      return invalid(path, "must be a plain object");
    }

    const keys = Reflect.ownKeys(value);
    if (keys.length > MAX_EXTENSION_NODES - state.nodeCount) {
      return invalid(path, `exceeds the maximum supported size of ${MAX_EXTENSION_NODES} values`);
    }

    const copy: ProblemExtensions = {};

    for (const key of keys) {
      if (typeof key !== "string") {
        return invalid(path, "contains a symbol property");
      }

      const propertyPath = appendProperty(path, key);
      if (rejectReservedKeys && RESERVED_PROBLEM_KEYS.has(key)) {
        return invalid(propertyPath, "uses a reserved Problem field");
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return invalid(propertyPath, "must be an enumerable data property");
      }

      const property = copyJsonValue(descriptor.value, propertyPath, state, depth + 1);
      if (!property.ok) {
        return property;
      }

      Object.defineProperty(copy, key, {
        configurable: true,
        enumerable: true,
        value: property.value,
        writable: true,
      });
    }

    Object.freeze(copy);
    return { ok: true, value: copy };
  } catch {
    return invalid(path, "could not be inspected safely");
  }
}

function hasPlainObjectPrototype(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  if (prototype === null || prototype === Object.prototype) {
    return true;
  }

  if (Object.getPrototypeOf(prototype) !== null) {
    return false;
  }

  const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor");
  if (
    constructor === undefined ||
    !("value" in constructor) ||
    typeof constructor.value !== "function"
  ) {
    return false;
  }

  const constructorPrototype = Object.getOwnPropertyDescriptor(constructor.value, "prototype");
  return (
    constructorPrototype !== undefined &&
    "value" in constructorPrototype &&
    constructorPrototype.value === prototype &&
    Function.prototype.toString.call(constructor.value) === "function Object() { [native code] }"
  );
}

function isArrayIndex(key: string, length: number): boolean {
  const index = Number(key);
  return Number.isInteger(index) && index >= 0 && index < length && String(index) === key;
}

function appendProperty(path: string, key: string): string {
  const diagnosticKey =
    key.length <= MAX_DIAGNOSTIC_KEY_LENGTH
      ? key
      : `${key.slice(0, MAX_DIAGNOSTIC_KEY_LENGTH - 3)}...`;
  return boundPath(`${path}[${JSON.stringify(diagnosticKey)}]`);
}

function appendIndex(path: string, index: number): string {
  return boundPath(`${path}[${index}]`);
}

function boundPath(path: string): string {
  return path.length <= MAX_DIAGNOSTIC_PATH_LENGTH
    ? path
    : `${path.slice(0, MAX_DIAGNOSTIC_PATH_LENGTH - 3)}...`;
}

function invalid(path: string, reason: string): CopyFailure {
  return { ok: false, path: boundPath(path), reason };
}
