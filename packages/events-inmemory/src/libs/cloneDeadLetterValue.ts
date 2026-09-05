import type { DomainEvent } from "@croco/events-core";
import { UnsupportedDeadLetterValueProblem } from "./problems/EventsInmemoryProblems";

function copyEnumerableProperties(
  source: object,
  target: object,
  copies: WeakMap<object, unknown>,
): void {
  for (const key of Reflect.ownKeys(source)) {
    if (!Object.prototype.propertyIsEnumerable.call(source, key)) {
      continue;
    }
    Object.defineProperty(target, key, {
      value: cloneDeadLetterValue(Reflect.get(source, key), copies),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
}

export function cloneDeadLetterValue<T>(value: T, copies = new WeakMap<object, unknown>()): T {
  if (typeof value === "function" || typeof value === "symbol") {
    throw new UnsupportedDeadLetterValueProblem();
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (copies.has(value)) {
    return copies.get(value) as T;
  }

  const prototype: unknown = Object.getPrototypeOf(value);
  let clone: object;
  if (prototype === Date.prototype && value instanceof Date) {
    clone = new Date(value.getTime());
  } else if (prototype === RegExp.prototype && value instanceof RegExp) {
    const expression = new RegExp(value.source, value.flags);
    clone = expression;
    copies.set(value, clone);
    expression.lastIndex = cloneDeadLetterValue(value.lastIndex, copies);
  } else if (prototype === Map.prototype && value instanceof Map) {
    const entries = new Map<unknown, unknown>();
    clone = entries;
    copies.set(value, clone);
    for (const [key, entry] of value) {
      entries.set(cloneDeadLetterValue(key, copies), cloneDeadLetterValue(entry, copies));
    }
  } else if (prototype === Set.prototype && value instanceof Set) {
    const entries = new Set<unknown>();
    clone = entries;
    copies.set(value, clone);
    for (const entry of value) {
      entries.add(cloneDeadLetterValue(entry, copies));
    }
  } else if (prototype === Array.prototype && Array.isArray(value)) {
    const entries: unknown[] = [];
    entries.length = value.length;
    clone = entries;
  } else if (prototype === Object.prototype || prototype === null) {
    clone = Object.create(prototype) as object;
  } else {
    throw new UnsupportedDeadLetterValueProblem();
  }

  copies.set(value, clone);
  copyEnumerableProperties(value, clone, copies);
  return clone as T;
}

export function cloneDeadLetterEvent<T extends DomainEvent>(
  event: T,
  copies = new WeakMap<object, unknown>(),
): T {
  if (copies.has(event)) {
    return copies.get(event) as T;
  }
  const clone = Object.create(Object.getPrototypeOf(event)) as T;
  copies.set(event, clone);
  copyEnumerableProperties(event, clone, copies);
  return clone;
}
