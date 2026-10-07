const ROUTE_PARAMETER_TOKEN = /:([^/]+)/g;

/**
 * Converts Croco's authored catch-all parameter syntax into the matcher syntax used by HTTP runtimes.
 * Ordinary named parameters remain unchanged; callers can retain the authored path as contract metadata.
 */
export function toRuntimeRoutePath(path: string): string {
  return path.replace(ROUTE_PARAMETER_TOKEN, (token, paramToken: string) => {
    const name = paramToken.replace(/^\.\.\./, "");

    return name === paramToken || name.length === 0 ? token : `:${name}{.+}`;
  });
}

/** Returns a matcher comparison key without changing authored route metadata. */
export function toRouteMatchKey(path: string): string {
  return toRuntimeRoutePath(path).replace(ROUTE_PARAMETER_TOKEN, (token, paramToken: string) => {
    if (paramToken === "...") return token;

    const constraintStart = paramToken.indexOf("{");
    return constraintStart === -1 ? ":" : `:${paramToken.slice(constraintStart)}`;
  });
}
