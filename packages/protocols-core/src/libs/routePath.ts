/**
 * Converts Croco's authored catch-all parameter syntax into the matcher syntax used by HTTP runtimes.
 * Ordinary named parameters remain unchanged; callers can retain the authored path as contract metadata.
 */
export function toRuntimeRoutePath(path: string): string {
  return path.replace(/:([^/]+)/g, (token, paramToken: string) => {
    const name = paramToken.replace(/^\.\.\./, "");

    return name === paramToken || name.length === 0 ? token : `:${name}{.+}`;
  });
}
