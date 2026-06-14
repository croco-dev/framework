import "reflect-metadata";
import { type Constructor, REST_CONTROLLER_KEY } from "./sharedTypes";

export function isControllerConstructor(value: unknown): value is Constructor {
  return (
    typeof value === "function" && Reflect.getMetadata(REST_CONTROLLER_KEY, value) !== undefined
  );
}

export function discoverControllerConstructors(
  moduleExports: Record<string, unknown>,
): Constructor[] {
  const constructors: Constructor[] = [];
  const seen = new Set<Constructor>();

  for (const exported of Object.values(moduleExports)) {
    if (!isControllerConstructor(exported) || seen.has(exported)) {
      continue;
    }

    constructors.push(exported);
    seen.add(exported);
  }

  return constructors;
}
