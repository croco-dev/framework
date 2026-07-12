import type { ModuleToken } from "./types/ModuleToken";

export function getModuleTokenLabel(token: ModuleToken<unknown>): string {
  if (typeof token === "string") {
    return token;
  }

  if (typeof token === "symbol") {
    return Symbol.keyFor(token) ?? token.description ?? token.toString();
  }

  if (typeof token === "function") {
    return token.name || "anonymous-constructor";
  }

  const namedToken = token as { readonly name?: unknown };
  if (typeof namedToken.name === "string" && namedToken.name.length > 0) {
    return namedToken.name;
  }

  return String(token);
}
