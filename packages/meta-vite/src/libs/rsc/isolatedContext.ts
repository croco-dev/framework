/** The isolated encoder carries Node platform metadata, never live host values. */
export type IsolatedRscNodeContext = { readonly platform: "node" };

export function isIsolatedRscNodeContext(value: unknown): value is IsolatedRscNodeContext {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return (
    (prototype === Object.prototype || prototype === null) &&
    Reflect.ownKeys(value).length === 1 &&
    Object.getOwnPropertyDescriptor(value, "platform")?.value === "node"
  );
}
