import type { ModuleProvider, ModuleProviderDefinition } from "./types";
import type { Constructor, ModuleToken } from "./types/ModuleToken";

export function getProviderToken<T>(provider: ModuleProvider<T>): ModuleToken<T> {
  return isProviderDefinition(provider) ? provider.provide : provider;
}

export function isConstructorToken<T = unknown>(token: unknown): token is Constructor<T> {
  return typeof token === "function";
}

export function isProviderDefinition<T>(
  provider: ModuleProvider<T>,
): provider is ModuleProviderDefinition<T> {
  return typeof provider === "object" && provider !== null && "provide" in provider;
}
