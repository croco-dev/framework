const CIRCULAR_VALUE = "[Circular]";
const MAX_PROTOTYPE_DEPTH = 16;
const TRUNCATED_VALUE = "[Truncated]";
const UNSERIALIZABLE_VALUE = "[Unserializable]";

export const MAX_LOG_NESTING_DEPTH = 8;

const SENSITIVE_LOG_KEYS = new Set(["authorization", "cookie", "password", "secret", "token"]);

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_LOG_KEYS.has(key.toLowerCase());
}

function getDataProperty(value: object, key: string): unknown {
  let current: object | null = value;
  const seen = new Set<object>();
  let depth = 0;

  while (current && !seen.has(current) && depth < MAX_PROTOTYPE_DEPTH) {
    seen.add(current);
    const descriptor = Object.getOwnPropertyDescriptor(current, key);
    if (descriptor) {
      return "value" in descriptor ? descriptor.value : undefined;
    }
    current = Object.getPrototypeOf(current);
    depth += 1;
  }

  return undefined;
}

function getErrorDiagnosticProperty(error: object, key: "message" | "stack"): unknown {
  let current: object | null = error;
  const seen = new Set<object>();
  let depth = 0;

  while (current && !seen.has(current) && depth < MAX_PROTOTYPE_DEPTH) {
    seen.add(current);
    const descriptor = Object.getOwnPropertyDescriptor(current, key);
    if (descriptor) {
      if ("value" in descriptor) {
        return descriptor.value;
      }
      if (!descriptor.enumerable && descriptor.get) {
        return Reflect.apply(descriptor.get, error, []);
      }
      return undefined;
    }
    current = Object.getPrototypeOf(current);
    depth += 1;
  }

  return undefined;
}

function getErrorType(error: Error): string {
  const prototype = Object.getPrototypeOf(error);
  const constructor = prototype ? getDataProperty(prototype, "constructor") : undefined;
  const constructorName =
    typeof constructor === "function"
      ? Object.getOwnPropertyDescriptor(constructor, "name")?.value
      : undefined;
  const name = getDataProperty(error, "name");

  if (typeof constructorName === "string" && constructorName) {
    return constructorName;
  }
  return typeof name === "string" && name ? name : "Error";
}

function getErrorTextWithCauses(
  error: object,
  key: "message" | "stack",
  seen: Set<object>,
  depth: number,
): string | undefined {
  const value = getErrorDiagnosticProperty(error, key);
  const text = typeof value === "string" ? value : undefined;
  const cause = getDataProperty(error, "cause");

  if (!cause || typeof cause !== "object") {
    return text;
  }
  if (seen.has(cause)) {
    return key === "stack" ? `${text ?? ""}\ncauses have become circular...` : `${text ?? ""}: ...`;
  }

  const causeText = getErrorDiagnosticProperty(cause, key);
  if (typeof causeText !== "string") {
    return text;
  }

  const separator = key === "stack" ? "\ncaused by: " : ": ";
  if (depth + 1 >= MAX_LOG_NESTING_DEPTH) {
    return `${text ?? ""}${separator}${TRUNCATED_VALUE}`;
  }

  seen.add(cause);
  const nested = getErrorTextWithCauses(cause, key, seen, depth + 1);
  seen.delete(cause);
  return `${text ?? ""}${separator}${nested ?? ""}`;
}

function sanitizeError(
  error: Error,
  depth: number,
  ancestors: WeakSet<object>,
): Record<string, unknown> | string {
  if (depth >= MAX_LOG_NESTING_DEPTH) {
    return TRUNCATED_VALUE;
  }
  if (ancestors.has(error)) {
    return CIRCULAR_VALUE;
  }

  ancestors.add(error);
  try {
    const sanitized: Record<string, unknown> = { type: getErrorType(error) };
    const message = getErrorTextWithCauses(error, "message", new Set([error]), depth);
    const stack = getErrorTextWithCauses(error, "stack", new Set([error]), depth);

    if (message !== undefined) {
      sanitized.message = message;
    }
    if (stack !== undefined) {
      sanitized.stack = stack;
    }

    const descriptors = Object.getOwnPropertyDescriptors(error);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (
        !descriptor.enumerable ||
        isSensitiveKey(key) ||
        !("value" in descriptor) ||
        Object.prototype.hasOwnProperty.call(sanitized, key)
      ) {
        continue;
      }

      const sanitizedValue = sanitizeValue(descriptor.value, depth + 1, ancestors);
      if (sanitizedValue !== undefined) {
        sanitized[key] = sanitizedValue;
      }
    }

    const errors = getDataProperty(error, "errors");
    if (Array.isArray(errors)) {
      sanitized.aggregateErrors = sanitizeValue(errors, depth + 1, ancestors);
    }

    return sanitized;
  } catch {
    return UNSERIALIZABLE_VALUE;
  } finally {
    ancestors.delete(error);
  }
}

function sanitizeObject(
  value: object,
  depth: number,
  ancestors: WeakSet<object>,
): Record<string, unknown> | unknown[] | string {
  if (depth >= MAX_LOG_NESTING_DEPTH) {
    return TRUNCATED_VALUE;
  }
  if (ancestors.has(value)) {
    return CIRCULAR_VALUE;
  }

  ancestors.add(value);
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const sanitized: Record<string, unknown> | unknown[] = Array.isArray(value) ? [] : {};

    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (!descriptor.enumerable || isSensitiveKey(key) || !("value" in descriptor)) {
        continue;
      }

      const sanitizedValue = sanitizeValue(descriptor.value, depth + 1, ancestors);
      if (sanitizedValue !== undefined) {
        Object.defineProperty(sanitized, key, {
          configurable: true,
          enumerable: true,
          value: sanitizedValue,
          writable: true,
        });
      }
    }

    if (Array.isArray(value) && Array.isArray(sanitized)) {
      sanitized.length = value.length;
    }

    return sanitized;
  } catch {
    return UNSERIALIZABLE_VALUE;
  } finally {
    ancestors.delete(value);
  }
}

function sanitizeValue(value: unknown, depth: number, ancestors: WeakSet<object>): unknown {
  try {
    if (value === null || value === undefined) {
      return value;
    }

    switch (typeof value) {
      case "bigint":
      case "boolean":
      case "number":
      case "string":
        return value;
      case "function":
      case "symbol":
        return undefined;
      case "object":
        if (value instanceof Error) {
          return sanitizeError(value, depth, ancestors);
        }
        if (value instanceof Date) {
          const time = value.getTime();
          return Number.isNaN(time) ? null : value.toISOString();
        }
        if (value instanceof URL) {
          return URL.prototype.toString.call(value);
        }
        if (Buffer.isBuffer(value)) {
          return { type: "Buffer", data: Array.from(value.values()) };
        }
        return sanitizeObject(value, depth, ancestors);
    }
  } catch {
    return UNSERIALIZABLE_VALUE;
  }
}

export function sanitizeLogRecord(record: Record<string, unknown>): Record<string, unknown> {
  const sanitized = sanitizeObject(record, 0, new WeakSet());
  return typeof sanitized === "string" || Array.isArray(sanitized)
    ? { context: sanitized }
    : sanitized;
}
