import { handleJsonResponse } from "@croco/frontend-problems";

const DEFAULT_API_BASE_PATH = "/api/";

type ViteImportMeta = ImportMeta & {
  env?: {
    VITE_API_URL?: string;
  };
};

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function resolveApiBaseUrl(): URL {
  const configuredUrl = (import.meta as ViteImportMeta).env?.VITE_API_URL?.trim();

  return new URL(
    ensureTrailingSlash(configuredUrl || DEFAULT_API_BASE_PATH),
    window.location.origin,
  );
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(new URL(path.replace(/^\//, ""), resolveApiBaseUrl()), init);

  return handleJsonResponse<T>(response);
}
