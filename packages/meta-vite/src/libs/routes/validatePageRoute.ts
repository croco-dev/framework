import type { PageRouteDefinition } from "./types";

type PageRouteValidationCode =
  | "CROCO_META_VITE_ROUTE_REVALIDATE_INVALID"
  | "CROCO_META_VITE_ROUTE_MODE_UNSUPPORTED"
  | "CROCO_META_VITE_ROUTE_COMPONENT_REQUIRED";

export class PageRouteValidationError extends Error {
  constructor(
    readonly path: string,
    readonly code: PageRouteValidationCode,
    detail: string,
  ) {
    super(`Page route '${path}': ${detail}`);
    this.name = "PageRouteValidationError";
  }
}

export function validatePageRoute(definition: PageRouteDefinition): void {
  if (
    definition.mode !== undefined &&
    definition.mode !== "ssr" &&
    definition.mode !== "ssg" &&
    definition.mode !== "isr" &&
    definition.mode !== "rsc"
  ) {
    throw new PageRouteValidationError(
      definition.path,
      "CROCO_META_VITE_ROUTE_MODE_UNSUPPORTED",
      `unsupported render mode '${definition.mode}'`,
    );
  }
  if (
    definition.component === null ||
    (typeof definition.component !== "function" && typeof definition.component !== "object")
  ) {
    throw new PageRouteValidationError(
      definition.path,
      "CROCO_META_VITE_ROUTE_COMPONENT_REQUIRED",
      "component must be a function or object",
    );
  }
  if (definition.revalidate !== undefined) {
    validatePageRevalidate(definition.path, definition.revalidate);
    validatePageRevalidate(definition.path, definition.revalidate * 1000);
  }
}

export function validatePageRevalidate(path: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new PageRouteValidationError(
      path,
      "CROCO_META_VITE_ROUTE_REVALIDATE_INVALID",
      "revalidation interval must be finite and non-negative in seconds and milliseconds",
    );
  }
}
