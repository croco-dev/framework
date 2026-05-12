const DEFAULT_API_BASE_PATH = "http://localhost:3000";

type ViteImportMeta = ImportMeta & {
  env?: {
    VITE_API_URL?: string;
  };
};

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function resolveApiBaseUrl(): string {
  const configuredUrl = (import.meta as ViteImportMeta).env?.VITE_API_URL?.trim();

  return ensureTrailingSlash(configuredUrl || DEFAULT_API_BASE_PATH);
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(new URL(path.replace(/^\//, ""), resolveApiBaseUrl()), init);

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}
